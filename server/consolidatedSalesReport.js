import { sqlMany } from "./db.js";

/**
 * Converts a "YYYY-MM" period key to start/end timestamps for SQL range queries.
 * periodFrom → first millisecond of that month
 * periodTo   → first millisecond of the NEXT month (exclusive upper bound)
 */
function periodToDateRange(periodFrom, periodTo) {
  const [fy, fm] = periodFrom.split("-").map(Number);
  const [ty, tm] = periodTo.split("-").map(Number);

  // start of periodFrom month
  const dateFrom = new Date(Date.UTC(fy, fm - 1, 1)).toISOString();

  // start of month AFTER periodTo
  const nextMonth = tm === 12 ? new Date(Date.UTC(ty + 1, 0, 1)) : new Date(Date.UTC(ty, tm, 1));
  const dateTo = nextMonth.toISOString();

  return { dateFrom, dateTo };
}

export async function handleConsolidatedSalesReport(req, res) {
  try {
    const { periodFrom, periodTo } = req.query;

    if (!periodFrom || !periodTo) {
      return res.status(400).json({ ok: false, error: "periodFrom ve periodTo zorunludur." });
    }

    const { dateFrom, dateTo } = periodToDateRange(periodFrom, periodTo);

    // ── 1. POS satışları – aylık özet ───────────────────────────────────────
    const posMonthly = await sqlMany(
      `
      SELECT
        TO_CHAR(sold_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') AS period_key,
        COUNT(id)::int                                              AS sale_count,
        COALESCE(SUM(grand_total), 0)                              AS total_amount,
        COALESCE(SUM(discount_amount), 0)                          AS discount_amount
      FROM pos_sales
      WHERE sold_at >= $1::timestamptz
        AND sold_at <  $2::timestamptz
      GROUP BY period_key
      ORDER BY period_key
      `,
      [dateFrom, dateTo],
    );

    // ── 2. Mağaza faturaları – aylık + mağaza bazlı ─────────────────────────
    const storeMonthly = await sqlMany(
      `
      SELECT
        si.period_key,
        s.id   AS store_id,
        s.name AS store_name,
        COALESCE(s.commission_rate, 0)             AS commission_rate,
        COUNT(si.id)::int                          AS invoice_count,
        COALESCE(SUM(si.total_amount),   0)        AS total_amount,
        COALESCE(SUM(si.service_amount), 0)        AS service_amount,
        COALESCE(SUM(si.kdv_amount),     0)        AS kdv_amount
      FROM store_invoices si
      JOIN stores s ON s.id = si.store_id
      WHERE si.period_key >= $1
        AND si.period_key <= $2
      GROUP BY si.period_key, s.id, s.name, s.commission_rate
      ORDER BY si.period_key, s.name
      `,
      [periodFrom, periodTo],
    );

    // ── 3. Kategori kırılımı – POS satır detayı ─────────────────────────────
    const categoryBreakdown = await sqlMany(
      `
      SELECT
        COALESCE(c.level1, 'Tanımsız')                          AS level1,
        COALESCE(c.level2, '')                                  AS level2,
        COALESCE(c.level3, '')                                  AS level3,
        COUNT(DISTINCT ps.id)::int                              AS sale_count,
        COALESCE(SUM(psl.quantity), 0)                          AS total_quantity,
        COALESCE(SUM(psl.line_total), 0)                        AS total_amount
      FROM pos_sales ps
      JOIN pos_sale_lines psl ON psl.sale_id = ps.id
      LEFT JOIN products    p ON p.id = psl.product_id
      LEFT JOIN categories  c ON c.id = p.category_id
      WHERE ps.sold_at >= $1::timestamptz
        AND ps.sold_at <  $2::timestamptz
      GROUP BY c.level1, c.level2, c.level3
      ORDER BY total_amount DESC
      `,
      [dateFrom, dateTo],
    );

    // ── 4. Mağaza özeti (tüm dönem) ─────────────────────────────────────────
    const storeBreakdown = await sqlMany(
      `
      SELECT
        s.id   AS store_id,
        s.name AS store_name,
        COALESCE(s.commission_rate, 0)          AS commission_rate,
        COUNT(si.id)::int                       AS invoice_count,
        COALESCE(SUM(si.total_amount),   0)     AS total_amount,
        COALESCE(SUM(si.service_amount), 0)     AS service_amount,
        COALESCE(SUM(si.kdv_amount),     0)     AS kdv_amount
      FROM store_invoices si
      JOIN stores s ON s.id = si.store_id
      WHERE si.period_key >= $1
        AND si.period_key <= $2
      GROUP BY s.id, s.name, s.commission_rate
      ORDER BY total_amount DESC
      `,
      [periodFrom, periodTo],
    );

    // ── Scalar summary ───────────────────────────────────────────────────────
    const posTotal         = posMonthly.reduce((s, r) => s + Number(r.total_amount),   0);
    const storeGrossTotal  = storeMonthly.reduce((s, r) => s + Number(r.total_amount),   0);
    const storeServiceTotal= storeMonthly.reduce((s, r) => s + Number(r.service_amount), 0);
    const commissionTotal  = storeGrossTotal - storeServiceTotal;

    return res.json({
      ok: true,
      summary: {
        posTotal,
        storeGrossTotal,
        storeServiceTotal,
        commissionTotal,
        consolidatedTotal: posTotal + storeGrossTotal,
      },
      posMonthly: posMonthly.map((r) => ({
        periodKey:      r.period_key,
        saleCount:      r.sale_count,
        totalAmount:    Number(r.total_amount),
        discountAmount: Number(r.discount_amount),
      })),
      storeMonthly: storeMonthly.map((r) => ({
        periodKey:       r.period_key,
        storeId:         r.store_id,
        storeName:       r.store_name,
        commissionRate:  Number(r.commission_rate),
        invoiceCount:    r.invoice_count,
        totalAmount:     Number(r.total_amount),
        serviceAmount:   Number(r.service_amount),
        kdvAmount:       Number(r.kdv_amount),
        commissionAmount: Number(r.total_amount) - Number(r.service_amount),
      })),
      storeBreakdown: storeBreakdown.map((r) => ({
        storeId:         r.store_id,
        storeName:       r.store_name,
        commissionRate:  Number(r.commission_rate),
        invoiceCount:    r.invoice_count,
        totalAmount:     Number(r.total_amount),
        serviceAmount:   Number(r.service_amount),
        kdvAmount:       Number(r.kdv_amount),
        commissionAmount: Number(r.total_amount) - Number(r.service_amount),
      })),
      categoryBreakdown: categoryBreakdown.map((r) => ({
        level1:       r.level1,
        level2:       r.level2,
        level3:       r.level3,
        saleCount:    r.sale_count,
        totalQuantity: Number(r.total_quantity),
        totalAmount:  Number(r.total_amount),
      })),
    });
  } catch (err) {
    console.error("[consolidatedSalesReport]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
