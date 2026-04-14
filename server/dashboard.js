import { sqlMany, sqlOne } from "./db.js";

function nowDateString() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(dateString, dayCount) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseDateRange(query) {
  const endDate = isValidDateString(query?.end) ? query.end : nowDateString();
  const startDate = isValidDateString(query?.start) ? query.start : shiftDays(endDate, -29);

  if (startDate > endDate) {
    return null;
  }
  return { startDate, endDate };
}

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildDetailItems(items, mapper, limit = 8) {
  return (items || []).slice(0, limit).map(mapper);
}

async function getDashboardSummary({ startDate, endDate }) {
  const [{ active_product_count = 0 } = {}] = await sqlMany(`
    SELECT COUNT(*)::int AS active_product_count
    FROM products
    WHERE status = 'Aktif'
  `);
  const activeProductCount = Number(active_product_count || 0);

  const [{ supplier_count = 0 } = {}] = await sqlMany(`
    SELECT COUNT(*)::int AS supplier_count
    FROM suppliers
    WHERE status = 'Aktif'
  `);
  const supplierCount = Number(supplier_count || 0);

  const lowStockRows = await sqlMany(`
    WITH stock_in AS (
      SELECT sl.product_id, COALESCE(SUM(sl.quantity), 0) AS qty
      FROM stock_lines sl
      JOIN stock_entries se ON se.id = sl.stock_entry_id
      WHERE COALESCE(se.status, '') = 'Tamamlandi'
      GROUP BY sl.product_id
    ),
    stock_out AS (
      SELECT psl.product_id, COALESCE(SUM(psl.quantity), 0) AS qty
      FROM pos_sale_lines psl
      GROUP BY psl.product_id
    )
    SELECT
      p.id,
      p.code,
      p.name,
      COALESCE(stock_in.qty, 0) - COALESCE(stock_out.qty, 0) AS stock,
      COALESCE(p.min_stock, 0) AS min_stock
    FROM products p
    LEFT JOIN stock_in ON stock_in.product_id = p.id
    LEFT JOIN stock_out ON stock_out.product_id = p.id
    WHERE p.status = 'Aktif'
      AND COALESCE(p.track_inventory, TRUE) = TRUE
      AND COALESCE(stock_in.qty, 0) - COALESCE(stock_out.qty, 0) <= COALESCE(p.min_stock, 0)
    ORDER BY p.code ASC, p.name ASC
    LIMIT 12
  `);

  const purchaseRows = await sqlMany(`
    SELECT
      p.id,
      p.document_no AS document_no,
      p.date::text AS date,
      s.company AS supplier_name,
      COUNT(pl.id)::int AS line_count,
      COALESCE(SUM(COALESCE(pl.quantity, 0) * COALESCE(pl.unit_price, 0)), 0) AS total_amount,
      p.procurement_type_id
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE COALESCE(p.date::text, SUBSTRING(COALESCE(p.created_at::text, ''), 1, 10)) BETWEEN $1 AND $2
    GROUP BY p.id, p.document_no, p.date, s.company, p.procurement_type_id, p.created_at
    ORDER BY COALESCE(p.date, p.created_at::date) DESC, p.created_at DESC
  `, [startDate, endDate]);

  const stockRows = await sqlMany(`
    SELECT
      se.id,
      se.document_no AS document_no,
      se.date::text AS date,
      s.company AS source_party_name,
      COUNT(sl.id)::int AS line_count,
      COALESCE(SUM(COALESCE(sl.quantity, 0) * COALESCE(sl.unit_cost, 0)), 0) AS total_amount,
      se.stock_type,
      se.source_type
    FROM stock_entries se
    LEFT JOIN suppliers s ON s.id = se.source_party_id
    LEFT JOIN stock_lines sl ON sl.stock_entry_id = se.id
    WHERE COALESCE(se.date::text, SUBSTRING(COALESCE(se.created_at::text, ''), 1, 10)) BETWEEN $1 AND $2
    GROUP BY se.id, se.document_no, se.date, s.company, se.stock_type, se.source_type, se.created_at
    ORDER BY COALESCE(se.date, se.created_at::date) DESC, se.created_at DESC
  `, [startDate, endDate]);

  const openPosSessions = await sqlMany(`
    SELECT
      id,
      session_no AS session_no,
      register_name AS register_name,
      cashier_name AS cashier_name,
      opening_balance AS opening_balance,
      opened_at,
      closed_at,
      status,
      note,
      created_at,
      updated_at
    FROM pos_sessions
    WHERE (
      COALESCE(SUBSTRING(opened_at::text, 1, 10), SUBSTRING(created_at::text, 1, 10)) BETWEEN $1 AND $2
      OR COALESCE(SUBSTRING(closed_at::text, 1, 10), '') BETWEEN $1 AND $2
    )
      AND LOWER(COALESCE(status, '')) LIKE '%acik%'
    ORDER BY opened_at DESC NULLS LAST, created_at DESC
  `, [startDate, endDate]);

  const saleRows = await sqlMany(`
    SELECT
      ps.id,
      ps.receipt_no AS receipt_no,
      ps.sold_at,
      COALESCE(ps.customer_name, 'Misafir Musteri') AS customer_name,
      COALESCE(ps.payment_method, '-') AS payment_method,
      COUNT(psl.id)::int AS line_count,
      COALESCE(ps.grand_total, 0) AS grand_total
    FROM pos_sales ps
    LEFT JOIN pos_sale_lines psl ON psl.sale_id = ps.id
    WHERE COALESCE(SUBSTRING(ps.sold_at::text, 1, 10), SUBSTRING(ps.created_at::text, 1, 10)) BETWEEN $1 AND $2
    GROUP BY ps.id, ps.receipt_no, ps.sold_at, ps.customer_name, ps.payment_method, ps.grand_total, ps.created_at
    ORDER BY COALESCE(ps.sold_at, ps.created_at) DESC
  `, [startDate, endDate]);

  const totalSalesAmount = saleRows.reduce((sum, sale) => sum + Number(sale.grand_total || 0), 0);
  const movements = [
    ...stockRows.map((entry) => ({
      key: `stock-${entry.id}`,
      module: "Stok",
      documentNo: entry.document_no || "-",
      description: `${entry.source_party_name || "-"} - ${entry.line_count} kalem stok girisi`,
      status: entry.source_type || entry.stock_type || "Kayitli",
      date: entry.date || null,
      amount: formatMoney(entry.total_amount),
    })),
    ...purchaseRows.map((purchase) => ({
      key: `purchase-${purchase.id}`,
      module: "Satinalma",
      documentNo: purchase.document_no || "-",
      description: `${purchase.supplier_name || "-"} - ${purchase.line_count} kalem alim`,
      status: purchase.procurement_type_id || "Kayitli",
      date: purchase.date || null,
      amount: formatMoney(purchase.total_amount),
    })),
    ...saleRows.map((sale) => ({
      key: `sale-${sale.id}`,
      module: "POS",
      documentNo: sale.receipt_no || "-",
      description: `${sale.customer_name || "-"} - ${sale.line_count} kalem satis`,
      status: sale.payment_method || "-",
      date: String(sale.sold_at || "").slice(0, 10) || null,
      amount: formatMoney(sale.grand_total),
    })),
  ]
    .sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0))
    .slice(0, 12);

  const alerts = [];
  if (lowStockRows.length > 0) {
    alerts.push({
      key: "low-stock",
      severity: "warning",
      title: "Dusuk stok uyarisi",
      description: `${lowStockRows.length} urun minimum stok seviyesinde veya altinda gorunuyor.`,
    });
  }
  if (movements.length === 0) {
    alerts.push({
      key: "empty-period",
      severity: "info",
      title: "Secilen aralikta hareket yok",
      description: "Tarih araligi icin satin alma, stok veya POS hareketi bulunmadi.",
    });
  }

  return {
    filters: { startDate, endDate },
    stats: [
      { key: "sales", title: "Donem Ciro", value: formatMoney(totalSalesAmount), rawValue: totalSalesAmount, color: "#1f9d66" },
      { key: "products", title: "Aktif Urun", value: String(activeProductCount), rawValue: activeProductCount, color: "#1677ff" },
      { key: "low-stock", title: "Dusuk Stok", value: String(lowStockRows.length), rawValue: lowStockRows.length, color: "#d46b08" },
      { key: "open-pos", title: "Acik Pos", value: String(openPosSessions.length), rawValue: openPosSessions.length, color: "#722ed1" },
      { key: "suppliers", title: "Tedarikci", value: String(supplierCount), rawValue: supplierCount, color: "#0f766e" },
      { key: "purchases", title: "Satinalma Kaydi", value: String(purchaseRows.length), rawValue: purchaseRows.length, color: "#c2410c" },
    ],
    metricDetails: {
      sales: {
        title: "Ciro Dagilimi",
        items: buildDetailItems(saleRows, (item) => ({
          label: String(item.sold_at || "").slice(0, 10),
          value: formatMoney(item.grand_total),
          hint: item.receipt_no,
        })),
      },
      products: {
        title: "Aktif Urun Ozeti",
        items: [
          { label: "Aktif urun sayisi", value: String(activeProductCount), hint: "Aktif durumdaki urunler" },
          { label: "Dusuk stoklu urun", value: String(lowStockRows.length), hint: "Minimum seviyede veya altinda" },
        ],
      },
      "low-stock": {
        title: "Dusuk Stok Listesi",
        items: buildDetailItems(lowStockRows, (item) => ({
          label: `${item.code || "-"} - ${item.name || "Adsiz Urun"}`,
          value: `${Number(item.stock || 0)} / ${Number(item.min_stock || 0)}`,
          hint: "Mevcut stok / minimum stok",
        }), 12),
      },
      "open-pos": {
        title: "Acik POS Oturumlari",
        items: buildDetailItems(openPosSessions, (item) => ({
          label: `${item.session_no || "-"} - ${item.register_name || "Kasa"}`,
          value: item.cashier_name || "-",
          hint: item.opened_at ? new Date(item.opened_at).toLocaleString("tr-TR") : "-",
        })),
      },
      suppliers: {
        title: "Tedarikci Gorunumu",
        items: buildDetailItems(await sqlMany(`
          SELECT company, contact, city
          FROM suppliers
          WHERE status = 'Aktif'
          ORDER BY company ASC
        `), (item) => ({
          label: item.company || "-",
          value: item.contact || "-",
          hint: item.city || "-",
        })),
      },
      purchases: {
        title: "Satinalma Kayitlari",
        items: buildDetailItems(purchaseRows, (item) => ({
          label: item.document_no || "-",
          value: item.supplier_name || "-",
          hint: formatMoney(item.total_amount),
        })),
      },
    },
    movements,
    alerts,
  };
}

export async function handleDashboardSummary(req, res) {
  const range = parseDateRange(req.query || {});
  if (!range) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Baslangic tarihi bitis tarihinden buyuk olamaz.",
    });
  }

  const summary = await getDashboardSummary(range);
  return res.json({
    ok: true,
    ...summary,
  });
}
