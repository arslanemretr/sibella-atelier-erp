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
  if (startDate > endDate) return null;
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
  // --- Temel sayımlar ---
  const [{ active_product_count = 0 } = {}] = await sqlMany(`
    SELECT COUNT(*)::int AS active_product_count FROM products WHERE status = 'Aktif'
  `);
  const activeProductCount = Number(active_product_count || 0);

  const [{ supplier_count = 0 } = {}] = await sqlMany(`
    SELECT COUNT(*)::int AS supplier_count FROM suppliers WHERE status = 'Aktif'
  `);
  const supplierCount = Number(supplier_count || 0);

  // --- Düşük stok ---
  const lowStockRows = await sqlMany(`
    SELECT
      p.id, p.code, p.name,
      COALESCE(slb.quantity, 0) AS stock,
      COALESCE(p.min_stock, 0) AS min_stock
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS quantity
      FROM stock_location_balances
      GROUP BY product_id
    ) slb ON slb.product_id = p.id
    WHERE p.status = 'Aktif'
      AND COALESCE(p.track_inventory, TRUE) = TRUE
      AND COALESCE(slb.quantity, 0) <= COALESCE(p.min_stock, 0)
    ORDER BY p.code ASC, p.name ASC
  `);

  // --- POS satışları (dönem) ---
  const saleRows = await sqlMany(`
    SELECT
      ps.id,
      ps.receipt_no,
      ps.sold_at,
      COALESCE(ps.customer_name, 'Misafir Müşteri') AS customer_name,
      COALESCE(ps.payment_method, '-') AS payment_method,
      COUNT(psl.id)::int AS line_count,
      COALESCE(SUM(psl.quantity), 0) AS total_qty,
      COALESCE(ps.grand_total, 0) AS grand_total
    FROM pos_sales ps
    LEFT JOIN pos_sale_lines psl ON psl.sale_id = ps.id
    WHERE COALESCE(SUBSTRING(ps.sold_at::text, 1, 10), SUBSTRING(ps.created_at::text, 1, 10)) BETWEEN $1 AND $2
    GROUP BY ps.id, ps.receipt_no, ps.sold_at, ps.customer_name, ps.payment_method, ps.grand_total, ps.created_at
    ORDER BY COALESCE(ps.sold_at, ps.created_at) DESC
  `, [startDate, endDate]);

  const totalSalesAmount = saleRows.reduce((sum, r) => sum + Number(r.grand_total || 0), 0);
  const totalSalesCount = saleRows.length;
  const totalSalesQty = saleRows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0);

  // --- Günlük satış dağılımı (bar chart) ---
  const dailySalesRows = await sqlMany(`
    SELECT
      COALESCE(SUBSTRING(ps.sold_at::text, 1, 10), SUBSTRING(ps.created_at::text, 1, 10)) AS sale_date,
      COUNT(*)::int AS sale_count,
      COALESCE(SUM(ps.grand_total), 0) AS total_amount
    FROM pos_sales ps
    WHERE COALESCE(SUBSTRING(ps.sold_at::text, 1, 10), SUBSTRING(ps.created_at::text, 1, 10)) BETWEEN $1 AND $2
    GROUP BY sale_date
    ORDER BY sale_date ASC
  `, [startDate, endDate]);

  // --- En çok satan ürünler ---
  const topProductRows = await sqlMany(`
    SELECT
      p.id,
      p.code,
      p.name,
      COALESCE(SUM(psl.quantity), 0) AS total_qty,
      COALESCE(SUM(psl.line_total), 0) AS total_amount
    FROM pos_sale_lines psl
    JOIN products p ON p.id = psl.product_id
    JOIN pos_sales ps ON ps.id = psl.sale_id
    WHERE COALESCE(SUBSTRING(ps.sold_at::text, 1, 10), SUBSTRING(ps.created_at::text, 1, 10)) BETWEEN $1 AND $2
    GROUP BY p.id, p.code, p.name
    ORDER BY total_qty DESC
    LIMIT 8
  `, [startDate, endDate]);

  // --- İade toplamı (dönem) ---
  const returnRows = await sqlMany(`
    SELECT
      pr.id,
      pr.return_no,
      pr.return_date,
      COALESCE(SUM(prl.line_total), 0) AS total_amount,
      COUNT(prl.id)::int AS line_count
    FROM pos_returns pr
    LEFT JOIN pos_return_lines prl ON prl.return_id = pr.id
    WHERE SUBSTRING(pr.return_date::text, 1, 10) BETWEEN $1 AND $2
    GROUP BY pr.id, pr.return_no, pr.return_date
    ORDER BY pr.return_date DESC
  `, [startDate, endDate]);
  const totalReturnAmount = returnRows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  const totalReturnCount = returnRows.length;

  // --- Satın almalar (dönem) ---
  const purchaseRows = await sqlMany(`
    SELECT
      p.id,
      p.document_no,
      p.date::text AS date,
      s.company AS supplier_name,
      COUNT(pl.id)::int AS line_count,
      COALESCE(SUM(COALESCE(pl.quantity, 0) * COALESCE(pl.unit_price, 0)), 0) AS total_amount
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE COALESCE(p.date::text, SUBSTRING(COALESCE(p.created_at::text, ''), 1, 10)) BETWEEN $1 AND $2
    GROUP BY p.id, p.document_no, p.date, s.company, p.created_at
    ORDER BY COALESCE(p.date, p.created_at::date) DESC, p.created_at DESC
  `, [startDate, endDate]);

  // --- Açık POS oturumları ---
  const openPosSessions = await sqlMany(`
    SELECT id, session_no, register_name, cashier_name, opening_balance, opened_at, status
    FROM pos_sessions
    WHERE LOWER(COALESCE(status, '')) NOT LIKE '%kapat%'
      AND LOWER(COALESCE(status, '')) NOT LIKE '%kapali%'
    ORDER BY opened_at DESC NULLS LAST, created_at DESC
  `);

  // --- Stok girişleri (dönem) ---
  const stockRows = await sqlMany(`
    SELECT
      se.id,
      se.document_no,
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

  // --- Uyarılar ---
  const alerts = [];
  if (lowStockRows.length > 0) {
    alerts.push({
      key: "low-stock",
      severity: "warning",
      title: "Düşük stok uyarısı",
      description: `${lowStockRows.length} ürün minimum stok seviyesinde veya altında görünüyor.`,
    });
  }
  if (openPosSessions.length > 0) {
    alerts.push({
      key: "open-pos",
      severity: "info",
      title: `${openPosSessions.length} açık POS oturumu bulunuyor`,
      description: openPosSessions.map((s) => s.session_no || s.id).join(", "),
    });
  }

  return {
    filters: { startDate, endDate },

    stats: {
      totalSalesAmount,
      totalSalesCount,
      totalSalesQty,
      totalReturnAmount,
      totalReturnCount,
      activeProductCount,
      supplierCount,
      lowStockCount: lowStockRows.length,
      openPosCount: openPosSessions.length,
      purchaseCount: purchaseRows.length,
    },

    dailySales: dailySalesRows.map((r) => ({
      date: r.sale_date,
      amount: Number(r.total_amount || 0),
      count: Number(r.sale_count || 0),
    })),

    topProducts: topProductRows.map((r) => ({
      id: r.id,
      code: r.code || "",
      name: r.name || "",
      totalQty: Number(r.total_qty || 0),
      totalAmount: Number(r.total_amount || 0),
    })),

    recentSales: saleRows.slice(0, 8).map((r) => ({
      id: r.id,
      receiptNo: r.receipt_no || "-",
      customerName: r.customer_name || "Misafir",
      paymentMethod: r.payment_method || "-",
      lineCount: Number(r.line_count || 0),
      grandTotal: Number(r.grand_total || 0),
      soldAt: r.sold_at || null,
    })),

    lowStockProducts: lowStockRows.map((r) => ({
      id: r.id,
      code: r.code || "",
      name: r.name || "",
      stock: Number(r.stock || 0),
      minStock: Number(r.min_stock || 0),
    })),

    recentPurchases: purchaseRows.slice(0, 5).map((r) => ({
      id: r.id,
      documentNo: r.document_no || "-",
      supplierName: r.supplier_name || "-",
      lineCount: Number(r.line_count || 0),
      totalAmount: Number(r.total_amount || 0),
      date: r.date || null,
    })),

    alerts,

    // Legacy uyumluluk - eski frontend bekleyenler için
    metricDetails: {
      "low-stock": {
        title: "Düşük Stok Listesi",
        items: buildDetailItems(lowStockRows, (item) => ({
          label: `${item.code || "-"} - ${item.name || "Adsız Ürün"}`,
          value: `${Number(item.stock || 0)} / ${Number(item.min_stock || 0)}`,
          hint: "Mevcut stok / minimum stok",
        }), 12),
      },
      "open-pos": {
        title: "Açık POS Oturumları",
        items: buildDetailItems(openPosSessions, (item) => ({
          label: `${item.session_no || "-"} - ${item.register_name || "Kasa"}`,
          value: item.cashier_name || "-",
          hint: item.opened_at ? new Date(item.opened_at).toLocaleString("tr-TR") : "-",
        })),
      },
      suppliers: {
        title: "Tedarikçi Görünümü",
        items: buildDetailItems(await sqlMany(`
          SELECT company, contact, city FROM suppliers WHERE status = 'Aktif' ORDER BY company ASC
        `), (item) => ({
          label: item.company || "-",
          value: item.contact || "-",
          hint: item.city || "-",
        })),
      },
    },
  };
}

export async function handleDashboardSummary(req, res) {
  const range = parseDateRange(req.query || {});
  if (!range) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: "Başlangıç tarihi bitiş tarihinden büyük olamaz.",
    });
  }
  const summary = await getDashboardSummary(range);
  return res.json({ ok: true, ...summary });
}
