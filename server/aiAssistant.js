/* global process */
// AI Asistan - manuel test asamasi.
// Bu modul, Claude'a gonderilecek TAM prompt'u uretir ve Claude'un dondurdugu
// "action" (sql / tool / answer / clarify) cevabini YEREL veritabaninda
// guvenli (salt-okunur) sekilde calistirir. API anahtari takilinca ayni
// katman otomatik cagri ile kullanilacak; prompt + arac + calistirma mantigi
// degismeyecek.

import { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { sqlMany } from "./db.js";
import { createProductRecord } from "./catalog.js";
import { writeAuditLog } from "./auditLog.js";
import { getAiApiKey, getAiModel } from "./aiSettings.js";

const MAX_CHAT_ITERATIONS = 8;

// db.js kendi havuzunu disari acmiyor; salt-okunur sorgular icin ayri,
// kucuk bir havuz kullaniyoruz (ayni DATABASE_URL).
const READONLY_MAX_ROWS = 500;
const READONLY_TIMEOUT_MS = 5000;

let roPool = null;
function getReadonlyPool() {
  if (!roPool) {
    const url = String(process.env.DATABASE_URL || "").trim();
    if (!url) throw new Error("DATABASE_URL tanimli degil.");
    roPool = new Pool({ connectionString: url, max: 3 });
  }
  return roPool;
}

// AI'in ASLA gormemesi/sorgulamamasi gereken tablolar (kimlik/gizli veri).
const DENY_TABLES = [
  "users",
  "auth_sessions",
  "password_reset_tokens",
  "login_attempts",
  "smtp_settings",
  "roles",
];

// ─── Sema baglami (modele verilecek) ──────────────────────────────────────────
// Yalnizca is verisi tablolari. Hassas tablolar bilincli olarak yok.
const SCHEMA_CONTEXT = `VERITABANI: PostgreSQL. Asagidaki tablolar ve onemli kolonlar kullanilabilir.
Para birimi TRY. Tarih kolonlari timestamptz/date. ILIKE ile buyuk/kucuk harf duyarsiz arama yap.

products(id, code, name, sale_price, sale_currency, store_price, cost, category_id, collection_id, supplier_id, barcode, stock, status)
  - urun. status='Aktif' aktif urun. supplier_id -> suppliers.id, category_id -> categories.id

suppliers(id, short_code, company, contact, email, phone, city, status)
  - tedarikci. company = firma adi.

categories(id, level1, level2, level3, level4, full_path, status)
collections(id, name, status)

stores(id, code, name, commission_rate, contact_name, is_center)
  - magaza. is_center=true ise merkez.

pos_sales(id, session_id, receipt_no, sold_at, customer_name, payment_method, discount_amount, subtotal, grand_total, stock_location_id, created_at)
  - POS (kasa) satis basligi. customer_name = MUSTERI ADI (serbest metin).
pos_sale_lines(id, sale_id, product_id, quantity, unit_price, line_total)
  - POS satis satiri. sale_id -> pos_sales.id, product_id -> products.id

pos_returns(id, return_no, original_sale_id, return_date, status)
pos_return_lines(id, return_id, original_sale_line_id, product_id, product_code, product_name, quantity, unit_price, line_total, supplier_id, commission_rate)

store_sales(id, sale_no, store_id, stock_location_id, sale_date, invoice_name, total_quantity, total_amount, status)
  - magaza satis basligi. store_id -> stores.id
store_sale_lines(id, sale_id, product_id, product_code, product_name, quantity, unit_price, line_total)

stock_locations(id, name, store_id, is_default_main)
stock_location_balances(stock_location_id, product_id, quantity)
  - urun bazinda lokasyon stok bakiyesi.
stock_movements(id, movement_type, direction, quantity, stock_delta, product_id, stock_location_id, document_no, document_date, source_module, party_name, total_amount, created_at)

delivery_lists(id, delivery_no, supplier_id, supplier_name, date, status)
delivery_lines(id, delivery_list_id, product_id, name, code, sale_price, quantity)

supplier_earnings_records(id, supplier_id, period_key, invoice_no, invoice_date, payment_due_date, payment_date)

ILISKILER:
- POS satis adedi: pos_sale_lines.quantity. Tutar: pos_sale_lines.line_total veya pos_sales.grand_total.
- Bir musterinin toplam satisi: pos_sales.customer_name uzerinden filtrele, pos_sale_lines ile join et.
- Urun satisi: pos_sale_lines + store_sale_lines (her ikisi de olabilir).`;

// ─── Hazir araclar (hibrit) ───────────────────────────────────────────────────
// Her arac, parametreli (guvenli) bir sorguya karsilik gelir.
const TOOLS = [
  {
    name: "musteri_satis_ozeti",
    description: "Bir musterinin (pos_sales.customer_name) toplam POS satis adedini ve tutarini dondurur.",
    args: { musteri_adi: "string - musteri adi (kismi eslesme, ILIKE)" },
    run: async (run, args) => {
      const term = `%${String(args?.musteri_adi || "").trim()}%`;
      const rows = await run(
        `SELECT s.customer_name,
                COUNT(DISTINCT s.id)::int AS satis_fisi,
                COALESCE(SUM(l.quantity),0) AS toplam_adet,
                COALESCE(SUM(l.line_total),0) AS toplam_tutar
         FROM pos_sales s
         JOIN pos_sale_lines l ON l.sale_id = s.id
         WHERE s.customer_name ILIKE $1
         GROUP BY s.customer_name
         ORDER BY toplam_tutar DESC`,
        [term],
      );
      return rows;
    },
  },
  {
    name: "urun_satis_ozeti",
    description: "Bir urunun (ad/kod) POS + magaza satis adedini ve tutarini, opsiyonel tarih araliginda dondurur.",
    args: {
      urun_arama: "string - urun adi veya kodu (ILIKE)",
      baslangic: "string? - YYYY-MM-DD (opsiyonel)",
      bitis: "string? - YYYY-MM-DD (opsiyonel)",
    },
    run: async (run, args) => {
      const term = `%${String(args?.urun_arama || "").trim()}%`;
      const start = args?.baslangic ? String(args.baslangic) : null;
      const end = args?.bitis ? String(args.bitis) : null;
      const rows = await run(
        `WITH p AS (
            SELECT id, code, name FROM products WHERE name ILIKE $1 OR code ILIKE $1
         ),
         pos AS (
            SELECT pl.product_id, SUM(pl.quantity) qty, SUM(pl.line_total) tutar
            FROM pos_sale_lines pl JOIN pos_sales ps ON ps.id = pl.sale_id
            WHERE pl.product_id IN (SELECT id FROM p)
              AND ($2::date IS NULL OR ps.sold_at >= $2::date)
              AND ($3::date IS NULL OR ps.sold_at < ($3::date + 1))
            GROUP BY pl.product_id
         ),
         mag AS (
            SELECT sl.product_id, SUM(sl.quantity) qty, SUM(sl.line_total) tutar
            FROM store_sale_lines sl JOIN store_sales ss ON ss.id = sl.sale_id
            WHERE sl.product_id IN (SELECT id FROM p)
              AND ($2::date IS NULL OR ss.sale_date >= $2::date)
              AND ($3::date IS NULL OR ss.sale_date <= $3::date)
            GROUP BY sl.product_id
         )
         SELECT p.code, p.name,
                COALESCE(pos.qty,0) AS pos_adet, COALESCE(pos.tutar,0) AS pos_tutar,
                COALESCE(mag.qty,0) AS magaza_adet, COALESCE(mag.tutar,0) AS magaza_tutar,
                COALESCE(pos.qty,0)+COALESCE(mag.qty,0) AS toplam_adet
         FROM p
         LEFT JOIN pos ON pos.product_id = p.id
         LEFT JOIN mag ON mag.product_id = p.id
         ORDER BY toplam_adet DESC`,
        [term, start, end],
      );
      return rows;
    },
  },
  {
    name: "gunluk_satis_ozeti",
    description: "Belirli bir gun (verilmezse bugun) icin POS ve magaza satis adet/tutar toplamlarini dondurur.",
    args: { tarih: "string? - YYYY-MM-DD (verilmezse bugun)" },
    run: async (run, args) => {
      const day = args?.tarih ? String(args.tarih) : null;
      const rows = await run(
        `SELECT 'POS' AS kanal,
                COUNT(DISTINCT ps.id)::int AS satis_sayisi,
                COALESCE(SUM(pl.quantity),0) AS toplam_adet,
                COALESCE(SUM(pl.line_total),0) AS toplam_tutar
         FROM pos_sales ps JOIN pos_sale_lines pl ON pl.sale_id = ps.id
         WHERE ps.sold_at >= COALESCE($1::date, CURRENT_DATE)
           AND ps.sold_at < COALESCE($1::date, CURRENT_DATE) + 1
         UNION ALL
         SELECT 'Magaza' AS kanal,
                COUNT(DISTINCT ss.id)::int,
                COALESCE(SUM(sl.quantity),0),
                COALESCE(SUM(sl.line_total),0)
         FROM store_sales ss JOIN store_sale_lines sl ON sl.sale_id = ss.id
         WHERE ss.sale_date = COALESCE($1::date, CURRENT_DATE)`,
        [day],
      );
      return rows;
    },
  },
  {
    name: "urun_stok_durumu",
    description: "Bir urunun (ad/kod) lokasyon bazinda stok bakiyelerini dondurur.",
    args: { urun_arama: "string - urun adi veya kodu (ILIKE)" },
    run: async (run, args) => {
      const term = `%${String(args?.urun_arama || "").trim()}%`;
      const rows = await run(
        `SELECT pr.code, pr.name, sl.name AS lokasyon, b.quantity AS adet
         FROM stock_location_balances b
         JOIN products pr ON pr.id = b.product_id
         JOIN stock_locations sl ON sl.id = b.stock_location_id
         WHERE (pr.name ILIKE $1 OR pr.code ILIKE $1)
         ORDER BY pr.name, sl.name`,
        [term],
      );
      return rows;
    },
  },
  {
    name: "urun_kayit_referanslari",
    description: "Urun olusturma oncesi mevcut kategori, tedarikci, koleksiyon, POS kategori ve ornek urun kartlarini dondurur.",
    args: {},
    run: async () => {
      return [await getProductEntryReferenceData()];
    },
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

function toolListText() {
  return TOOLS.map((t) => {
    const args = Object.entries(t.args).map(([k, v]) => `      "${k}": ${v}`).join("\n");
    return `- ${t.name}: ${t.description}\n    args:\n${args}`;
  }).join("\n");
}

async function getProductEntryReferenceData() {
  const [categories, suppliers, collections, posCategories, products] = await Promise.all([
    sqlMany(`
      SELECT full_path AS label
      FROM categories
      WHERE COALESCE(status, 'Aktif') = 'Aktif' AND COALESCE(full_path, '') <> ''
      ORDER BY full_path
      LIMIT 10
    `),
    sqlMany(`
      SELECT company AS label, short_code
      FROM suppliers
      WHERE COALESCE(status, 'Aktif') = 'Aktif' AND COALESCE(company, '') <> ''
      ORDER BY company
      LIMIT 10
    `),
    sqlMany(`
      SELECT name AS label
      FROM collections
      WHERE COALESCE(status, 'Aktif') = 'Aktif' AND COALESCE(name, '') <> ''
      ORDER BY name
      LIMIT 10
    `),
    sqlMany(`
      SELECT name AS label
      FROM pos_categories
      WHERE COALESCE(status, 'Aktif') = 'Aktif' AND COALESCE(name, '') <> ''
      ORDER BY name
      LIMIT 10
    `),
    sqlMany(`
      SELECT p.code, p.name, p.sale_price, p.store_price, c.full_path AS category, s.company AS supplier
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE COALESCE(p.name, '') <> ''
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
      LIMIT 6
    `),
  ]);
  return { categories, suppliers, collections, posCategories, products };
}

function productEntryReferenceText(data) {
  const list = (items, mapper = (item) => item.label) =>
    items?.length ? items.map(mapper).filter(Boolean).join(", ") : "(ornek bulunamadi)";
  const productExamples = data?.products?.length
    ? data.products.map((p) => {
        const price = p.sale_price ? `${p.sale_price} TRY` : "fiyat yok";
        return `${p.code || "-"} | ${p.name} | ${price} | kategori: ${p.category || "-"} | tedarikci: ${p.supplier || "-"}`;
      }).join("\n")
    : "(ornek urun bulunamadi)";

  return `=== URUN KAYDI REHBERI ===
AI Veri Giris Konsolu'nda urun olusturmak icin minimum zorunlu alanlar:
- urun_adi
- tedarikci_adi (mevcut supplier/company adindan secilmeli)
- kategori_adi (mevcut categories/full_path adindan secilmeli)
- satis_fiyati (merkez/POS satis fiyati, TRY, sifirdan buyuk)

Sistem varsayilanlari:
- kod verilmezse sistem otomatik kod atar.
- gorsel verilmezse varsayilan urun gorseli kullanilir.
- magaza_fiyati verilmezse satis_fiyati ile ayni kabul edilir.
- urun_tipi verilmezse "kendi", durum verilmezse "Aktif" kabul edilir.

Mevcut kategori ornekleri: ${list(data?.categories)}
Mevcut tedarikci ornekleri: ${list(data?.suppliers, (s) => s.short_code ? `${s.label} (${s.short_code})` : s.label)}
Mevcut koleksiyon ornekleri: ${list(data?.collections)}
Mevcut POS kategori ornekleri: ${list(data?.posCategories)}
Mevcut urun karti ornekleri:
${productExamples}`;
}

// ─── Yazma araclari (veri giris konsolu) ──────────────────────────────────────
// Yazma ASLA otomatik degildir: model "write" onerir, sistem insan-okur onizleme
// uretir, kullanici onayladiktan sonra mevcut kayit fonksiyonu calistirilir.

async function resolveByName(table, column, term, idColumn = "id") {
  const t = String(term || "").trim();
  if (!t) return null;
  const rows = await sqlMany(
    `SELECT ${idColumn} AS id, ${column} AS label FROM ${table} WHERE ${column} ILIKE $1 ORDER BY ${column} LIMIT 2`,
    [`%${t}%`],
  );
  if (rows.length === 0) return { id: null, label: null, ambiguous: false, notFound: true, candidates: [] };
  return { id: rows[0].id, label: rows[0].label, ambiguous: rows.length > 1, notFound: false, candidates: rows };
}

async function resolveRequiredByName({ table, column, term, fieldLabel }) {
  const text = String(term || "").trim();
  if (!text) {
    throw new Error(`${fieldLabel} zorunludur. Mevcut kayitlardan bir deger secilmelidir.`);
  }
  const resolved = await resolveByName(table, column, text);
  if (resolved?.notFound) {
    throw new Error(`${fieldLabel} bulunamadi: "${text}". Prompttaki mevcut orneklerden birini kullanin veya once urun_kayit_referanslari araciyla liste isteyin.`);
  }
  if (resolved?.ambiguous) {
    const options = resolved.candidates.map((row) => row.label).join(", ");
    throw new Error(`${fieldLabel} net degil: "${text}". Eslesen secenekler: ${options}. Kullanicidan netlestirmesini isteyin.`);
  }
  return resolved;
}

const WRITE_TOOLS = [
  {
    name: "urun_olustur",
    description: "Yeni urun kaydi olusturur. Zorunlu: urun_adi, tedarikci_adi, kategori_adi, satis_fiyati. Kod verilmezse sistem otomatik kod atar. Kategori/koleksiyon/tedarikci/POS kategori ad olarak verilir (sistem ID'ye cevirir).",
    args: {
      urun_adi: "string - ZORUNLU",
      tedarikci_adi: "string - ZORUNLU, mevcut tedarikci firma adi",
      kategori_adi: "string - ZORUNLU, mevcut kategori yolu/adindan",
      satis_fiyati: "number - ZORUNLU, merkez satis fiyati (TRY)",
      magaza_fiyati: "number? - magaza satis fiyati (verilmezse satis_fiyati)",
      koleksiyon_adi: "string? - koleksiyon (ILIKE eslesme)",
      pos_kategori_adi: "string? - POS kategorisi (ILIKE eslesme)",
      barkod: "string?",
      urun_tipi: "string? - 'kendi' (varsayilan) veya 'konsinye'",
      durum: "string? - 'Aktif' (varsayilan) veya 'Pasif'",
      notlar: "string?",
      kod: "string? - verilirse bu kod kullanilir, yoksa otomatik",
    },
    // Args -> {values (createProductRecord body), preview, warnings}
    resolve: async (args) => {
      const warnings = [];
      const name = String(args?.urun_adi || "").trim();
      const hasSalePrice = args?.satis_fiyati !== undefined && args?.satis_fiyati !== null && String(args.satis_fiyati).trim() !== "";
      const missing = [];
      if (!name) missing.push("urun_adi");
      if (!args?.tedarikci_adi) missing.push("tedarikci_adi");
      if (!args?.kategori_adi) missing.push("kategori_adi");
      if (!hasSalePrice) missing.push("satis_fiyati");
      if (missing.length) {
        throw new Error(`Eksik zorunlu alanlar: ${missing.join(", ")}. Kullaniciya tek soruda bu alanlari sorun ve prompttaki mevcut kategori/tedarikci/ornek urunlerden ornek verin.`);
      }

      const category = await resolveRequiredByName({
        table: "categories",
        column: "full_path",
        term: args?.kategori_adi,
        fieldLabel: "kategori_adi",
      });
      const categoryId = category.id;
      const categoryLabel = category.label;

      const supplier = await resolveRequiredByName({
        table: "suppliers",
        column: "company",
        term: args?.tedarikci_adi,
        fieldLabel: "tedarikci_adi",
      });
      const supplierId = supplier.id;
      const supplierLabel = supplier.label;

      let collectionId = null, collectionLabel = null;
      if (args?.koleksiyon_adi) {
        const r = await resolveByName("collections", "name", args.koleksiyon_adi);
        collectionId = r.id; collectionLabel = r.label;
        if (r.notFound) warnings.push(`Koleksiyon bulunamadi: "${args.koleksiyon_adi}"`);
        else if (r.ambiguous) warnings.push(`Birden fazla koleksiyon eslesti; ilki secildi: "${r.label}"`);
      }

      let posCategoryId = null, posCategoryLabel = null;
      if (args?.pos_kategori_adi) {
        const r = await resolveByName("pos_categories", "name", args.pos_kategori_adi);
        posCategoryId = r.id; posCategoryLabel = r.label;
        if (r.notFound) warnings.push(`POS kategorisi bulunamadi: "${args.pos_kategori_adi}"`);
        else if (r.ambiguous) warnings.push(`Birden fazla POS kategorisi eslesti; ilki secildi: "${r.label}"`);
      }

      const code = String(args?.kod || "").trim();
      const salePrice = Number(args.satis_fiyati);
      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        throw new Error("satis_fiyati gecerli ve sifirdan buyuk bir sayi olmalidir.");
      }
      const storePrice = args?.magaza_fiyati !== undefined && args?.magaza_fiyati !== null && args?.magaza_fiyati !== ""
        ? Number(args.magaza_fiyati) : undefined;
      if (storePrice !== undefined && (!Number.isFinite(storePrice) || storePrice < 0)) {
        throw new Error("magaza_fiyati gecerli ve negatif olmayan bir sayi olmalidir.");
      }
      const status = args?.durum === "Pasif" ? "Pasif" : "Aktif";
      const productType = args?.urun_tipi === "konsinye" ? "konsinye" : "kendi";

      const values = {
        name,
        code,
        autoCode: !code,
        salePrice,
        ...(storePrice !== undefined ? { storePrice } : {}),
        saleCurrency: "TRY",
        categoryId,
        collectionId,
        posCategoryId,
        supplierId,
        barcode: String(args?.barkod || "").trim(),
        status,
        productType,
        notes: String(args?.notlar || "").trim(),
        isForSale: true,
        isForPurchase: true,
        useInPos: true,
        trackInventory: true,
      };

      const preview = {
        title: "Yeni Urun Olusturulacak",
        lines: [
          ["Urun adi", name],
          ["Kod", code || "(otomatik atanacak)"],
          ["Satis fiyati", salePrice ? `${salePrice} TRY` : "-"],
          ["Magaza fiyati", storePrice !== undefined ? `${storePrice} TRY` : "(satis fiyatiyla ayni)"],
          ["Kategori", categoryLabel || (args?.kategori_adi ? "(bulunamadi)" : "-")],
          ["Koleksiyon", collectionLabel || (args?.koleksiyon_adi ? "(bulunamadi)" : "-")],
          ["Tedarikci", supplierLabel || (args?.tedarikci_adi ? "(bulunamadi)" : "-")],
          ["POS kategorisi", posCategoryLabel || (args?.pos_kategori_adi ? "(bulunamadi)" : "-")],
          ["Urun tipi", productType === "konsinye" ? "Konsinye" : "Kendi Uretim"],
          ["Gorsel", "(varsayilan gorsel)"],
          ["Barkod", values.barcode || "-"],
          ["Durum", status],
        ],
      };
      return { values, preview, warnings };
    },
    run: async (values, authUser) => {
      const created = await createProductRecord({
        ...values,
        createdBy: values.createdBy || authUser?.id || null,
        priceSource: "ai-veri-giris",
      }, authUser);
      return {
        id: created?.id,
        kod: created?.code,
        ad: created?.name,
        durum: created?.status,
      };
    },
  },
];

const WRITE_TOOL_MAP = new Map(WRITE_TOOLS.map((t) => [t.name, t]));

function writeToolListText() {
  return WRITE_TOOLS.map((t) => {
    const args = Object.entries(t.args).map(([k, v]) => `      "${k}": ${v}`).join("\n");
    return `- ${t.name}: ${t.description}\n    args:\n${args}`;
  }).join("\n");
}

// ─── Sistem talimati + cikti sozlesmesi ───────────────────────────────────────
function normalizePromptMode(mode) {
  return mode === "write" ? "write" : "read";
}

function getWriteToolName(action) {
  return String(action?.tool || action?.name || "").trim();
}

function getClientIp(req) {
  return String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req?.socket?.remoteAddress || "";
}

async function prepareAiWrite(action) {
  if (!action || typeof action !== "object" || action.action !== "write") {
    throw new Error("Gecersiz yazma action'i.");
  }
  const toolName = getWriteToolName(action);
  const tool = WRITE_TOOL_MAP.get(toolName);
  if (!tool) throw new Error(`Bilinmeyen yazma araci: ${toolName || "-"}`);
  const prepared = await tool.resolve(action.args || {});
  return {
    tool: tool.name,
    args: action.args || {},
    preview: prepared.preview,
    warnings: prepared.warnings || [],
  };
}

async function executeAiWrite(action, authUser, req) {
  if (!action || typeof action !== "object" || action.action !== "write") {
    throw new Error("Gecersiz yazma action'i.");
  }
  const toolName = getWriteToolName(action);
  const tool = WRITE_TOOL_MAP.get(toolName);
  if (!tool) throw new Error(`Bilinmeyen yazma araci: ${toolName || "-"}`);

  const prepared = await tool.resolve(action.args || {});
  const result = await tool.run(prepared.values, authUser);
  writeAuditLog({
    userId: authUser?.id || null,
    userName: authUser?.fullName || authUser?.email || null,
    userRole: authUser?.role || null,
    actionType: "CREATE",
    resource: "AI Veri Giris Konsolu",
    resourceId: result?.id || result?.kod || null,
    description: `AI yazma araci onaylandi: ${tool.name}`,
    ipAddress: getClientIp(req),
    userAgent: req?.headers?.["user-agent"] || null,
    statusCode: 201,
  });
  return {
    tool: tool.name,
    result,
    preview: prepared.preview,
    warnings: prepared.warnings || [],
  };
}

function systemInstruction(mode = "read") {
  const base = `Sen Sibella Atelier ERP icin Turkce konusan bir asistansin.`;
  const writeClause = mode === "write"
    ? `\n\n5) Veri yazma onerisi (urun olusturma gibi). Yazma OTOMATIK YAPILMAZ; sistem kullaniciya onizleme gosterir ve kullanici onaylar:
{"action":"write","tool":"<yazma_araci>","args":{...}}`
    : "";
  const writeFlow = mode === "write"
    ? ` Yazma icin: once eksik bilgi varsa "clarify" ile sor; bilgi tamamsa "write" oner. urun_olustur icin zorunlu alanlar: urun_adi, tedarikci_adi, kategori_adi, satis_fiyati. Bu alanlardan biri yoksa veya belirsizse ASLA tahmin etme, ASLA 0 yazma, ASLA write onerme. Eksik alanlari tek soruda iste ve kullaniciya URUN KAYDI REHBERI'ndeki mevcut kategori/tedarikci/ornek urunlerden 2-4 ornek ver. Gerekirse once urun_kayit_referanslari aracini cagir. Magaza fiyati verilmezse satis_fiyati ile ayni kabul edilebilir. Kod ve gorsel sistem tarafindan varsayilan/otomatik doldurulabilir. Sistem sana yazma SONUCUNU ("YAZMA SONUCU") geri verecek; sonra kisa bir "answer" ver.`
    : "";
  const writeTools = mode === "write"
    ? `\n\n=== KULLANILABILIR YAZMA ARACLARI ===\n${writeToolListText()}`
    : "";
  return `${base} Gorevin, kullanicinin istegini anlamak, gerekli veriyi cekmek${mode === "write" ? " ve istenen kaydi olusturmayi onermek" : " ve sade bir Turkce cevap vermek"}.

CIKTI KURALI (cok onemli): Cevabini SADECE tek bir JSON nesnesi olarak ver. JSON disinda hicbir metin, aciklama veya kod blogu isaretleyici yazma. Su bicimlerden birini kullan:

1) Hazir okuma araci calistir:
{"action":"tool","name":"<arac_adi>","args":{...}}

2) Serbest salt-okunur SQL (yalnizca SELECT/WITH; tek ifade; veri DEGISTIRME):
{"action":"sql","query":"SELECT ..."}

3) Nihai cevap (kullaniciya gosterilecek):
{"action":"answer","text":"..."}

4) Soru sor (eksik bilgi varsa):
{"action":"clarify","text":"..."}${writeClause}

AKIS: Once gerekli veriyi tool/sql ile iste. Sistem sana sonucu "ARAC SONUCU" olarak geri verecek.${writeFlow} Sayilari Turkce ve okunur bicimde yaz. Veri yoksa bunu acikca soyle.${writeTools}`;
}

// Bir adim gecmisini (steps) tek prompt metnine cevirir.
// steps: [{type:"user", question}, {type:"result", action, result, error?}]
function buildPromptText(steps, mode = "read", extraContext = "") {
  const parts = [];
  parts.push(systemInstruction(mode));
  if (extraContext) {
    parts.push("\n" + extraContext);
  }
  parts.push("\n=== VERITABANI SEMASI ===\n" + SCHEMA_CONTEXT);
  parts.push("\n=== KULLANILABILIR HAZIR ARACLAR ===\n" + toolListText());
  parts.push("\n=== KONUSMA ===");
  for (const step of steps || []) {
    if (step.type === "user") {
      parts.push(`KULLANICI SORUSU: ${step.question}`);
    } else if (step.type === "result") {
      const label = step.action?.action === "tool"
        ? `ARAC SONUCU (${step.action.name})`
        : step.action?.action === "sql"
          ? "SQL SONUCU"
          : step.action?.action === "write"
            ? "YAZMA SONUCU"
            : "SONUC";
      if (step.error) {
        parts.push(`${label} - HATA: ${step.error}`);
      } else {
        const truncated = step.truncated ? ` (ilk ${READONLY_MAX_ROWS} satir gosterildi)` : "";
        parts.push(`${label}${truncated}:\n${JSON.stringify(step.result, null, 2)}`);
      }
    }
  }
  parts.push("\nSimdi tek bir JSON nesnesi ile cevap ver.");
  return parts.join("\n");
}

// ─── Salt-okunur SQL calistirici (guardrails) ─────────────────────────────────
function assertReadOnlySql(query) {
  const cleaned = String(query || "").trim().replace(/;+\s*$/g, "");
  if (!cleaned) throw new Error("Bos sorgu.");
  if (cleaned.includes(";")) throw new Error("Tek bir SELECT ifadesine izin verilir (; yok).");
  if (!/^(select|with)\b/i.test(cleaned)) throw new Error("Yalnizca SELECT/WITH sorgulari calistirilabilir.");
  const lowered = cleaned.toLowerCase();
  const banned = ["insert", "update", "delete", "drop", "alter", "create", "truncate", "grant", "revoke", "copy", "merge", "call", " into "];
  for (const kw of banned) {
    if (new RegExp(`\\b${kw.trim()}\\b`).test(lowered)) {
      throw new Error(`Yasakli ifade: ${kw.trim()}`);
    }
  }
  for (const tbl of DENY_TABLES) {
    if (new RegExp(`\\b${tbl}\\b`).test(lowered)) {
      throw new Error(`Bu tabloya erisim engellendi: ${tbl}`);
    }
  }
  return cleaned;
}

async function runReadOnly(querySql, params = []) {
  const pool = getReadonlyPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${READONLY_TIMEOUT_MS}`);
    const result = await client.query(querySql, params);
    return result.rows;
  } finally {
    try { await client.query("ROLLBACK"); } catch { /* yoksay */ }
    client.release();
  }
}

// Disari acilan: bir action'i calistir, {result, truncated} dondur.
export async function executeAiAction(action) {
  if (!action || typeof action !== "object") {
    throw new Error("Gecersiz action.");
  }

  if (action.action === "tool") {
    const tool = TOOL_MAP.get(action.name);
    if (!tool) throw new Error(`Bilinmeyen arac: ${action.name}`);
    // Hazir araclar parametreli sorgu kullanir; calistirici salt-okunur sarar.
    const rows = await tool.run(
      (sql, params) => runReadOnly(sql, params),
      action.args || {},
    );
    const truncated = rows.length > READONLY_MAX_ROWS;
    return { result: truncated ? rows.slice(0, READONLY_MAX_ROWS) : rows, truncated, rowCount: rows.length };
  }

  if (action.action === "sql") {
    const cleaned = assertReadOnlySql(action.query);
    const wrapped = `SELECT * FROM (${cleaned}) AS _ai_sub LIMIT ${READONLY_MAX_ROWS + 1}`;
    const rows = await runReadOnly(wrapped, []);
    const truncated = rows.length > READONLY_MAX_ROWS;
    return { result: truncated ? rows.slice(0, READONLY_MAX_ROWS) : rows, truncated, rowCount: rows.length };
  }

  throw new Error(`Bu action sunucuda calistirilmaz: ${action.action}`);
}

// ─── Express handler'lari ─────────────────────────────────────────────────────
export async function handleAiBuildPrompt(req, res) {
  const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
  const mode = normalizePromptMode(req.body?.mode);
  try {
    const extraContext = mode === "write"
      ? productEntryReferenceText(await getProductEntryReferenceData())
      : "";
    const prompt = buildPromptText(steps, mode, extraContext);
    return res.json({ ok: true, mode, prompt });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "AI_PROMPT_ERROR", message: error?.message || "Prompt olusturulamadi." });
  }
}

export async function handleAiExecuteAction(req, res) {
  try {
    const action = req.body?.action;
    const out = await executeAiAction(action);
    return res.json({ ok: true, ...out });
  } catch (error) {
    return res.status(400).json({ ok: false, code: "AI_EXEC_ERROR", message: error?.message || "Calistirilamadi." });
  }
}

export async function handleAiPrepareWrite(req, res) {
  try {
    const action = req.body?.action;
    const write = await prepareAiWrite(action);
    return res.json({ ok: true, write });
  } catch (error) {
    return res.status(400).json({ ok: false, code: "AI_WRITE_PREPARE_ERROR", message: error?.message || "Yazma onizlemesi hazirlanamadi." });
  }
}

export async function handleAiExecuteWrite(req, res) {
  try {
    if (req.body?.confirmed !== true) {
      return res.status(400).json({ ok: false, code: "AI_WRITE_CONFIRM_REQUIRED", message: "Kayit icin confirmed:true zorunludur." });
    }
    const action = req.body?.action;
    const out = await executeAiWrite(action, req.authUser, req);
    return res.status(201).json({ ok: true, ...out });
  } catch (error) {
    return res.status(400).json({ ok: false, code: "AI_WRITE_EXEC_ERROR", message: error?.message || "Yazma islemi tamamlanamadi." });
  }
}

// ─── Otomatik (API) sohbet dongusu ────────────────────────────────────────────
// Manuel ekranla AYNI sozlesmeyi kullanir; tek fark transport: Claude'u sunucu cagirir.
async function assemblePrompt(steps, mode) {
  const extraContext = mode === "write"
    ? productEntryReferenceText(await getProductEntryReferenceData())
    : "";
  return buildPromptText(steps, mode, extraContext);
}

function parseActionText(text) {
  const stripped = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Modelden gecerli JSON alinamadi.");
    return JSON.parse(stripped.slice(start, end + 1));
  }
}

async function callClaudeAction(client, model, prompt) {
  const msg = await client.messages.create({
    model,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: "Yalnizca tek bir JSON nesnesi dondur. JSON disinda hicbir aciklama, metin veya kod blogu isaretleyici yazma.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { action: parseActionText(text), usage: msg.usage || null };
}

export async function handleAiChat(req, res) {
  const mode = normalizePromptMode(req.body?.mode);
  const steps = Array.isArray(req.body?.steps) ? [...req.body.steps] : [];

  const apiKey = await getAiApiKey();
  if (!apiKey) {
    return res.status(400).json({ ok: false, code: "AI_NO_KEY", message: "Anthropic API anahtari tanimli degil. Ayarlar > Parametreler'den ekleyin." });
  }
  const model = await getAiModel();
  const client = new Anthropic({ apiKey });

  try {
    for (let i = 0; i < MAX_CHAT_ITERATIONS; i += 1) {
      const prompt = await assemblePrompt(steps, mode);
      const { action } = await callClaudeAction(client, model, prompt);

      if (action?.action === "answer") {
        return res.json({ ok: true, status: "answer", text: String(action.text || ""), steps });
      }
      if (action?.action === "clarify") {
        return res.json({ ok: true, status: "clarify", text: String(action.text || ""), steps });
      }
      if (action?.action === "write") {
        if (mode !== "write") {
          steps.push({ type: "result", action, error: "Bu modda yazma yapilamaz." });
          continue;
        }
        const write = await prepareAiWrite(action);
        return res.json({ ok: true, status: "write", action, write, steps });
      }
      if (action?.action === "tool" || action?.action === "sql") {
        try {
          const out = await executeAiAction(action);
          steps.push({ type: "result", action, result: out.result, truncated: out.truncated, rowCount: out.rowCount });
        } catch (execError) {
          steps.push({ type: "result", action, error: execError?.message || "Calistirilamadi." });
        }
        continue;
      }
      steps.push({ type: "result", action, error: `Bilinmeyen action: ${action?.action}` });
    }
    return res.json({ ok: true, status: "maxiter", text: "Islem iterasyon sinirina ulasti; lutfen soruyu sadelestirin.", steps });
  } catch (error) {
    const message = error?.status === 401
      ? "API anahtari gecersiz (401). Ayarlardan kontrol edin."
      : (error?.message || "AI cagrisi basarisiz oldu.");
    return res.status(400).json({ ok: false, code: "AI_CHAT_ERROR", message });
  }
}

export async function handleAiTestKey(req, res) {
  try {
    const incoming = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    const apiKey = incoming || await getAiApiKey();
    if (!apiKey) {
      return res.status(400).json({ ok: false, message: "Test edilecek API anahtari yok." });
    }
    const model = await getAiModel();
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Sadece 'OK' yaz." }],
    });
    const txt = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return res.json({ ok: true, message: `Baglanti basarili (model: ${model}). Yanit: ${txt.slice(0, 40) || "(bos)"}` });
  } catch (error) {
    const message = error?.status === 401
      ? "API anahtari gecersiz (401)."
      : (error?.message || "Test basarisiz oldu.");
    return res.status(400).json({ ok: false, message });
  }
}
