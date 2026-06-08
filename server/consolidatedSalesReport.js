import { sqlMany, sqlOne } from "./db.js";

/**
 * Converts "YYYY-MM" period keys to UTC timestamp bounds.
 */
function periodToDateRange(periodFrom, periodTo) {
  const [fy, fm] = periodFrom.split("-").map(Number);
  const [ty, tm] = periodTo.split("-").map(Number);
  const dateFrom = new Date(Date.UTC(fy, fm - 1, 1)).toISOString();
  const nextMonth = tm === 12
    ? new Date(Date.UTC(ty + 1, 0, 1))
    : new Date(Date.UTC(ty, tm, 1));
  return { dateFrom, dateTo: nextMonth.toISOString() };
}

export async function handleConsolidatedSalesReport(req, res) {
  try {
    const { periodFrom, periodTo } = req.query;
    if (!periodFrom || !periodTo) {
      return res.status(400).json({ ok: false, error: "periodFrom ve periodTo zorunludur." });
    }

    const { dateFrom, dateTo } = periodToDateRange(periodFrom, periodTo);

    // Sibella Atelier tedarikçi ID'sini dinamik çek
    const sibellaSupplier = await sqlOne(
      `SELECT id FROM suppliers WHERE short_code = 'SBSE' LIMIT 1`,
      [],
    ).catch(() => null);
    const sibellaSupplierIds = sibellaSupplier?.id ? [sibellaSupplier.id] : [];

    // ── 1. POS — Sibella vs Tedarikçi aylık kırılım ─────────────────────────
    //  grand_total'ı ayrı CTE'de topla (JOIN fan-out önlenir).
    //  Kalem bazlı tutarlar ayrı CTE'de hesaplanır.
    //  NULL supplier_id → Sibella ürünü sayılır.
    const posMonthly = await sqlMany(
      `
      WITH sale_totals AS (
        SELECT
          TO_CHAR(sold_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') AS period_key,
          COUNT(id)::int                                              AS sale_count,
          COALESCE(SUM(grand_total), 0)                              AS pos_total
        FROM pos_sales
        WHERE sold_at >= $1::timestamptz
          AND sold_at <  $2::timestamptz
        GROUP BY period_key
      ),
      line_totals AS (
        SELECT
          TO_CHAR(ps.sold_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') AS period_key,
          COALESCE(SUM(
            CASE
              WHEN p.supplier_id IS NULL
                OR p.supplier_id = ANY($3::text[])
              THEN psl.line_total ELSE 0
            END
          ), 0) AS sibella_amount,
          COALESCE(SUM(
            CASE
              WHEN p.supplier_id IS NOT NULL
               AND NOT (p.supplier_id = ANY($3::text[]))
              THEN psl.line_total ELSE 0
            END
          ), 0) AS tedarikci_amount
        FROM pos_sales ps
        LEFT JOIN pos_sale_lines psl ON psl.sale_id = ps.id
        LEFT JOIN products        p  ON p.id = psl.product_id
        WHERE ps.sold_at >= $1::timestamptz
          AND ps.sold_at <  $2::timestamptz
        GROUP BY period_key
      )
      SELECT
        st.period_key,
        st.sale_count,
        st.pos_total,
        COALESCE(lt.sibella_amount,   0) AS sibella_amount,
        COALESCE(lt.tedarikci_amount, 0) AS tedarikci_amount
      FROM sale_totals  st
      LEFT JOIN line_totals lt ON lt.period_key = st.period_key
      ORDER BY st.period_key
      `,
      [dateFrom, dateTo, sibellaSupplierIds],
    );

    // ── 2. POS — tedarikçi bazlı özet + Sibella komisyon payı hesabı ──────────
    //  Her tedarikçi için aktif konsinyasyon sözleşmesindeki komisyon oranı alınır.
    //  sibella_commission = tedarikçi satış × (commission_rate / 100)
    const posSupplierBreakdown = await sqlMany(
      `
      WITH latest_contracts AS (
        SELECT DISTINCT ON (supplier_id)
          supplier_id,
          commission_rate
        FROM consignment_contracts
        ORDER BY supplier_id, COALESCE(start_date, '2000-01-01') DESC
      )
      SELECT
        COALESCE(sup.company, 'Tanımsız')                           AS supplier_name,
        p.supplier_id,
        CASE WHEN p.supplier_id = ANY($3::text[]) THEN true ELSE false END AS is_sibella,
        COALESCE(SUM(psl.line_total), 0)                            AS total_amount,
        COALESCE(SUM(psl.quantity),   0)                            AS total_quantity,
        COALESCE(MAX(lc.commission_rate), 0)                        AS commission_rate,
        COALESCE(SUM(
          CASE
            WHEN p.supplier_id IS NOT NULL AND NOT (p.supplier_id = ANY($3::text[]))
              THEN psl.line_total * COALESCE(lc.commission_rate, 0) / 100.0
            ELSE 0
          END
        ), 0)                                                       AS sibella_commission
      FROM pos_sales ps
      JOIN pos_sale_lines psl ON psl.sale_id = ps.id
      LEFT JOIN products        p   ON p.id = psl.product_id
      LEFT JOIN suppliers       sup ON sup.id = p.supplier_id
      LEFT JOIN latest_contracts lc  ON lc.supplier_id = p.supplier_id
      WHERE ps.sold_at >= $1::timestamptz
        AND ps.sold_at <  $2::timestamptz
      GROUP BY sup.company, p.supplier_id
      ORDER BY total_amount DESC
      `,
      [dateFrom, dateTo, sibellaSupplierIds],
    );

    // ── 3. Mağaza faturaları — aylık kırılım ────────────────────────────────
    //  gross_store_sales = total_amount / (1 - commission_rate/100)
    const storeMonthly = await sqlMany(
      `
      SELECT
        si.period_key,
        COUNT(si.id)::int                                            AS invoice_count,
        COALESCE(SUM(si.total_amount), 0)                            AS invoice_total,
        COALESCE(SUM(si.service_amount), 0)                          AS service_amount,
        COALESCE(SUM(
          CASE
            WHEN s.commission_rate > 0 AND s.commission_rate < 100
              THEN si.total_amount / (1.0 - s.commission_rate / 100.0)
            ELSE si.total_amount
          END
        ), 0)                                                        AS gross_store_sales
      FROM store_invoices si
      JOIN stores s ON s.id = si.store_id
      WHERE si.period_key >= $1
        AND si.period_key <= $2
      GROUP BY si.period_key
      ORDER BY si.period_key
      `,
      [periodFrom, periodTo],
    );

    // ── 4. Mağaza özeti (tüm dönem) ──────────────────────────────────────────
    const storeBreakdown = await sqlMany(
      `
      SELECT
        s.id   AS store_id,
        s.name AS store_name,
        COALESCE(s.commission_rate, 0)              AS commission_rate,
        COUNT(si.id)::int                           AS invoice_count,
        COALESCE(SUM(si.total_amount),   0)         AS invoice_total,
        COALESCE(SUM(si.service_amount), 0)         AS service_amount,
        COALESCE(SUM(
          CASE
            WHEN s.commission_rate > 0 AND s.commission_rate < 100
              THEN si.total_amount / (1.0 - s.commission_rate / 100.0)
            ELSE si.total_amount
          END
        ), 0)                                       AS gross_store_sales
      FROM store_invoices si
      JOIN stores s ON s.id = si.store_id
      WHERE si.period_key >= $1
        AND si.period_key <= $2
      GROUP BY s.id, s.name, s.commission_rate
      ORDER BY gross_store_sales DESC
      `,
      [periodFrom, periodTo],
    );

    // ── 5. Kategori kırılımı (POS, Sibella ürünleri) ─────────────────────────
    const categoryBreakdown = await sqlMany(
      `
      SELECT
        COALESCE(c.level1, 'Tanımsız')   AS level1,
        COALESCE(c.level2, '')           AS level2,
        COALESCE(c.level3, '')           AS level3,
        COALESCE(SUM(psl.quantity), 0)   AS total_quantity,
        COALESCE(SUM(psl.line_total), 0) AS total_amount
      FROM pos_sales ps
      JOIN pos_sale_lines psl ON psl.sale_id = ps.id
      LEFT JOIN products   p  ON p.id = psl.product_id
      LEFT JOIN categories c  ON c.id = p.category_id
      WHERE ps.sold_at >= $1::timestamptz
        AND ps.sold_at <  $2::timestamptz
        AND (p.supplier_id = ANY($3::text[]) OR p.supplier_id IS NULL)
      GROUP BY c.level1, c.level2, c.level3
      ORDER BY total_amount DESC
      `,
      [dateFrom, dateTo, sibellaSupplierIds],
    );

    // ── Scalar summary ────────────────────────────────────────────────────────
    const posTotal              = posMonthly.reduce((s, r) => s + Number(r.pos_total),        0);
    const sibellaPosTotal       = posMonthly.reduce((s, r) => s + Number(r.sibella_amount),   0);
    const tedarikciPosTotal     = posMonthly.reduce((s, r) => s + Number(r.tedarikci_amount), 0);
    const grossStoreTotal       = storeMonthly.reduce((s, r) => s + Number(r.gross_store_sales), 0);
    const invoiceTotal          = storeMonthly.reduce((s, r) => s + Number(r.invoice_total),     0);
    const serviceTotal          = storeMonthly.reduce((s, r) => s + Number(r.service_amount),    0);
    const storeCommission       = grossStoreTotal - invoiceTotal;
    // Tedarikçi POS'tan Sibella'ya düşen komisyon payı (sözleşme oranlarından)
    const tedarikciPosCommission = posSupplierBreakdown.reduce(
      (s, r) => s + Number(r.sibella_commission), 0,
    );
    // Şarköy Hakediş = Sibella kendi ürün satışı + tedarikçi satışlarındaki Sibella komisyonu
    const sarkoyHakEdis   = sibellaPosTotal + tedarikciPosCommission;
    // Net Sibella Ciro = Şarköy Hakediş + Mağaza Hakediş (invoiceTotal = KDV dahil fatura)
    const netSibellaCiro  = sarkoyHakEdis + invoiceTotal;

    return res.json({
      ok: true,
      summary: {
        posTotal,
        sibellaPosTotal,
        tedarikciPosTotal,
        tedarikciPosCommission,
        sarkoyHakEdis,
        grossStoreTotal,
        invoiceTotal,
        serviceTotal,
        storeCommission,
        totalCiro:     posTotal + grossStoreTotal,
        netSibellaCiro,
      },
      posMonthly: posMonthly.map((r) => ({
        periodKey:       r.period_key,
        saleCount:       r.sale_count,
        posTotal:        Number(r.pos_total),
        sibellaAmount:   Number(r.sibella_amount),
        tedarikciAmount: Number(r.tedarikci_amount),
      })),
      storeMonthly: storeMonthly.map((r) => ({
        periodKey:      r.period_key,
        invoiceCount:   r.invoice_count,
        invoiceTotal:   Number(r.invoice_total),
        serviceAmount:  Number(r.service_amount),
        grossStoreSales: Number(r.gross_store_sales),
        commissionAmount: Number(r.gross_store_sales) - Number(r.invoice_total),
      })),
      storeBreakdown: storeBreakdown.map((r) => ({
        storeId:         r.store_id,
        storeName:       r.store_name,
        commissionRate:  Number(r.commission_rate),
        invoiceCount:    r.invoice_count,
        invoiceTotal:    Number(r.invoice_total),
        serviceAmount:   Number(r.service_amount),
        grossStoreSales: Number(r.gross_store_sales),
        commissionAmount: Number(r.gross_store_sales) - Number(r.invoice_total),
      })),
      posSupplierBreakdown: posSupplierBreakdown.map((r) => ({
        supplierId:        r.supplier_id,
        supplierName:      r.supplier_name,
        isSibella:         r.is_sibella,
        totalAmount:       Number(r.total_amount),
        totalQuantity:     Number(r.total_quantity),
        commissionRate:    Number(r.commission_rate),
        sibellaCommission: Number(r.sibella_commission),
      })),
      categoryBreakdown: categoryBreakdown.map((r) => ({
        level1:        r.level1,
        level2:        r.level2,
        level3:        r.level3,
        totalQuantity: Number(r.total_quantity),
        totalAmount:   Number(r.total_amount),
      })),
    });
  } catch (err) {
    console.error("[consolidatedSalesReport]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
