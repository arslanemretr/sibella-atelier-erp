import { db } from "./db.js";

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

function repairTurkishEncoding(value) {
  return String(value || "")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã‡", "Ç")
    .replaceAll("Ä±", "ı")
    .replaceAll("Ä°", "İ")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ã¼", "ü")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("ÅŸ", "ş")
    .replaceAll("Åž", "Ş")
    .replaceAll("ÄŸ", "ğ")
    .replaceAll("Äž", "Ğ");
}

function normalizePosStatus(value) {
  const repaired = repairTurkishEncoding(value);
  const normalized = repaired
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (normalized.includes("acik") || normalized.includes("open")) {
    return "Acik";
  }

  if (normalized.includes("kapali") || normalized.includes("closed")) {
    return "Kapali";
  }

  return repaired || "-";
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

function normalizePosStatusesInDatabase() {
  const rows = db.prepare(`
    SELECT id, status
    FROM pos_sessions
    WHERE status IS NOT NULL
      AND status <> ''
  `).all();

  const updateStatus = db.prepare(`
    UPDATE pos_sessions
    SET status = ?
    WHERE id = ?
  `);

  let normalizedCount = 0;
  rows.forEach((row) => {
    const normalizedStatus = normalizePosStatus(row.status);
    if (normalizedStatus !== String(row.status || "")) {
      updateStatus.run(normalizedStatus, row.id);
      normalizedCount += 1;
    }
  });

  return normalizedCount;
}

function getDashboardSummary({ startDate, endDate }) {
  const normalizedPosStatusCount = normalizePosStatusesInDatabase();
  const activeProductCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM products
    WHERE status = 'Aktif'
  `).get()?.count || 0;

  const lowStockRows = db.prepare(`
    SELECT id, code, name, stock, min_stock
    FROM products
    WHERE COALESCE(track_inventory, 1) = 1
      AND status = 'Aktif'
      AND COALESCE(stock, 0) <= COALESCE(min_stock, 0)
    ORDER BY (COALESCE(min_stock, 0) - COALESCE(stock, 0)) DESC, name ASC
    LIMIT 12
  `).all();

  const supplierCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM suppliers
    WHERE status = 'Aktif'
  `).get()?.count || 0;

  const purchaseRows = db.prepare(`
    SELECT p.id, p.document_no, p.date, p.description, p.procurement_type_id, s.company AS supplier_name,
           COUNT(l.id) AS line_count, COALESCE(SUM(COALESCE(l.quantity, 0) * COALESCE(l.unit_price, 0)), 0) AS total_amount
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN purchase_lines l ON l.purchase_id = p.id
    WHERE substr(COALESCE(p.date, p.created_at, ''), 1, 10) BETWEEN ? AND ?
    GROUP BY p.id, p.document_no, p.date, p.description, p.procurement_type_id, s.company
    ORDER BY COALESCE(p.date, p.created_at) DESC
  `).all(startDate, endDate);

  const stockRows = db.prepare(`
    SELECT e.id, e.document_no, e.date, e.stock_type, e.source_type, e.note,
           s.company AS source_party_name,
           COUNT(l.id) AS line_count,
           COALESCE(SUM(COALESCE(l.quantity, 0) * COALESCE(l.unit_cost, 0)), 0) AS total_amount
    FROM stock_entries e
    LEFT JOIN suppliers s ON s.id = e.source_party_id
    LEFT JOIN stock_lines l ON l.stock_entry_id = e.id
    WHERE substr(COALESCE(e.date, e.created_at, ''), 1, 10) BETWEEN ? AND ?
    GROUP BY e.id, e.document_no, e.date, e.stock_type, e.source_type, e.note, s.company
    ORDER BY COALESCE(e.date, e.created_at) DESC
  `).all(startDate, endDate);

  const posSessionRows = db.prepare(`
    SELECT id, session_no, register_name, cashier_name, opening_balance, opened_at, closed_at, status
    FROM pos_sessions
    WHERE substr(COALESCE(opened_at, created_at, ''), 1, 10) BETWEEN ? AND ?
       OR (closed_at IS NOT NULL AND substr(closed_at, 1, 10) BETWEEN ? AND ?)
    ORDER BY COALESCE(opened_at, created_at) DESC
  `).all(startDate, endDate, startDate, endDate);

  const normalizedPosSessions = posSessionRows.map((session) => ({
    id: session.id,
    sessionNo: session.session_no,
    registerName: session.register_name,
    cashierName: session.cashier_name,
    openingBalance: Number(session.opening_balance || 0),
    openedAt: session.opened_at,
    closedAt: session.closed_at,
    rawStatus: session.status || "",
    status: normalizePosStatus(session.status),
  }));

  const openPosSessions = normalizedPosSessions.filter((session) => session.status === "Acik");
  const posSaleRows = db.prepare(`
    SELECT s.id, s.receipt_no, s.sold_at, s.customer_name, s.payment_method, s.grand_total,
           COUNT(l.id) AS line_count
    FROM pos_sales s
    LEFT JOIN pos_sale_lines l ON l.sale_id = s.id
    WHERE substr(COALESCE(s.sold_at, s.created_at, ''), 1, 10) BETWEEN ? AND ?
    GROUP BY s.id, s.receipt_no, s.sold_at, s.customer_name, s.payment_method, s.grand_total
    ORDER BY COALESCE(s.sold_at, s.created_at) DESC
  `).all(startDate, endDate);

  const salesByDayRows = db.prepare(`
    SELECT substr(COALESCE(sold_at, created_at, ''), 1, 10) AS day,
           COALESCE(SUM(COALESCE(grand_total, 0)), 0) AS total
    FROM pos_sales
    WHERE substr(COALESCE(sold_at, created_at, ''), 1, 10) BETWEEN ? AND ?
    GROUP BY substr(COALESCE(sold_at, created_at, ''), 1, 10)
    ORDER BY day DESC
    LIMIT 7
  `).all(startDate, endDate);

  const totalSalesAmount = posSaleRows.reduce((sum, sale) => sum + Number(sale.grand_total || 0), 0);
  const movements = [
    ...stockRows.map((entry) => ({
      key: `stock-${entry.id}`,
      module: "Stok",
      documentNo: entry.document_no || "-",
      description: `${entry.source_party_name || "Kaynak belirtilmedi"} - ${entry.line_count} kalem stok girisi`,
      status: entry.source_type || entry.stock_type || "Kayitli",
      date: entry.date || null,
      amount: formatMoney(entry.total_amount),
    })),
    ...purchaseRows.map((purchase) => ({
      key: `purchase-${purchase.id}`,
      module: "Satinalma",
      documentNo: purchase.document_no || "-",
      description: `${purchase.supplier_name || "Tedarikci belirtilmedi"} - ${purchase.line_count} kalem alim`,
      status: purchase.procurement_type_id || "Kayitli",
      date: purchase.date || null,
      amount: formatMoney(purchase.total_amount),
    })),
    ...posSaleRows.map((sale) => ({
      key: `sale-${sale.id}`,
      module: "POS",
      documentNo: sale.receipt_no || "-",
      description: `${sale.customer_name || "Misafir Musteri"} - ${sale.line_count} kalem satis`,
      status: sale.payment_method || "Tamamlandi",
      date: sale.sold_at || null,
      amount: formatMoney(sale.grand_total),
    })),
  ]
    .sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0))
    .slice(0, 12);

  const alerts = [];
  if (normalizedPosStatusCount > 0) {
    alerts.push({
      key: "pos-status-normalized",
      severity: "warning",
      title: "POS durum verisi normalize edildi",
      description: `${normalizedPosStatusCount} POS oturumunda bozuk veya tutarsiz durum metni temizlenerek kalici olarak guncellendi.`,
    });
  }
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
    filters: {
      startDate,
      endDate,
    },
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
        items: salesByDayRows.map((item) => ({
          label: item.day,
          value: formatMoney(item.total),
          hint: "Gunluk POS cirosu",
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
        items: lowStockRows.map((item) => ({
          label: `${item.code || "-"} - ${item.name || "Adsiz Urun"}`,
          value: `${Number(item.stock || 0)} / ${Number(item.min_stock || 0)}`,
          hint: "Mevcut stok / minimum stok",
        })),
      },
      "open-pos": {
        title: "Acik POS Oturumlari",
        items: openPosSessions.map((item) => ({
          label: `${item.sessionNo || "-"} - ${item.registerName || "Kasa"}`,
          value: item.cashierName || "-",
          hint: item.openedAt ? new Date(item.openedAt).toLocaleString("tr-TR") : "-",
        })),
      },
      suppliers: {
        title: "Tedarikci Gorunumu",
        items: db.prepare(`
          SELECT company, contact, city
          FROM suppliers
          WHERE status = 'Aktif'
          ORDER BY company ASC
          LIMIT 8
        `).all().map((item) => ({
          label: item.company || "-",
          value: item.contact || "-",
          hint: item.city || "-",
        })),
      },
      purchases: {
        title: "Satinalma Kayitlari",
        items: purchaseRows.slice(0, 8).map((item) => ({
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

export function handleDashboardSummary(req, res) {
  const range = parseDateRange(req.query || {});
  if (!range) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Baslangic tarihi bitis tarihinden buyuk olamaz.",
    });
  }

  return res.json({
    ok: true,
    ...getDashboardSummary(range),
  });
}
