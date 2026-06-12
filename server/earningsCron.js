import cron from "node-cron";
import { sqlMany, sqlOne } from "./db.js";
import { sendManagedEmail } from "./mailer.js";

function formatMoney(amount) {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0)) + " TL";
}

function formatDate(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("tr-TR");
}

async function calcEarningsAmount(supplierId, periodKey) {
  const row = await sqlOne(`
    WITH period_bounds AS (
      SELECT
        ($2 || '-01')::date AS period_start,
        (($2 || '-01')::date + INTERVAL '1 month')::date AS period_end
    ),
    contract_rate AS (
      SELECT COALESCE(commission_rate, 0) AS rate
      FROM consignment_contracts
      WHERE supplier_id = $1
      ORDER BY start_date DESC NULLS LAST
      LIMIT 1
    ),
    sales_total AS (
      SELECT COALESCE(SUM(psl.line_total), 0) AS amount
      FROM pos_sale_lines psl
      JOIN pos_sales ps ON ps.id = psl.sale_id
      CROSS JOIN period_bounds pb
      WHERE ps.sold_at >= pb.period_start AND ps.sold_at < pb.period_end
        AND psl.product_id IN (
          SELECT id FROM products WHERE supplier_id = $1 AND product_type = 'konsinye'
        )
    ),
    returns_total AS (
      SELECT COALESCE(SUM(prl.line_total), 0) AS amount
      FROM pos_return_lines prl
      JOIN pos_returns pr ON pr.id = prl.return_id
      CROSS JOIN period_bounds pb
      WHERE pr.return_date >= pb.period_start AND pr.return_date < pb.period_end
        AND prl.product_id IN (
          SELECT id FROM products WHERE supplier_id = $1 AND product_type = 'konsinye'
        )
    )
    SELECT
      ROUND(GREATEST(0, (st.amount - rt.amount) * (1 - cr.rate / 100.0)), 2) AS earnings_total
    FROM sales_total st, returns_total rt, contract_rate cr
  `, [supplierId, periodKey]);
  return Number(row?.earnings_total || 0);
}

async function sendEarningsNotifications(eventKey) {
  const dateCondition = eventKey === "earnings_payment_reminder"
    ? `DATE(ser.payment_due_date AT TIME ZONE 'Europe/Istanbul') = (CURRENT_DATE AT TIME ZONE 'Europe/Istanbul' + INTERVAL '1 day')::date`
    : `DATE(ser.payment_due_date AT TIME ZONE 'Europe/Istanbul') = (CURRENT_DATE AT TIME ZONE 'Europe/Istanbul')::date`;

  const records = await sqlMany(`
    SELECT
      ser.id,
      ser.supplier_id,
      ser.period_key,
      ser.invoice_no,
      ser.invoice_date,
      ser.payment_due_date,
      s.company  AS supplier_company,
      s.contact  AS supplier_contact,
      s.email    AS supplier_email,
      s.iban     AS supplier_iban
    FROM supplier_earnings_records ser
    JOIN suppliers s ON s.id = ser.supplier_id
    WHERE ${dateCondition}
      AND ser.payment_date IS NULL
  `);

  for (const record of records) {
    try {
      const amount = await calcEarningsAmount(record.supplier_id, record.period_key);
      const notifiedAt = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
      void sendManagedEmail({
        eventKey,
        context: {
          supplierName:  record.supplier_company  || "-",
          contact:       record.supplier_contact  || "-",
          supplierEmail: record.supplier_email    || "-",
          iban:          record.supplier_iban     || "-",
          periodKey:     record.period_key        || "-",
          paymentDueDate: formatDate(record.payment_due_date),
          amount:        formatMoney(amount),
          invoiceNo:     record.invoice_no        || "-",
          notifiedAt,
        },
      }).catch((err) => {
        console.error(`[EarningsCron] ${eventKey} mail error for supplier ${record.supplier_id}:`, err?.message);
      });
    } catch (err) {
      console.error(`[EarningsCron] calcEarnings error for supplier ${record.supplier_id}:`, err?.message);
    }
  }
}

export function startEarningsCron() {
  // 09:00 her gün — yarın ödeme tarihi dolacak kayıtlar için hatırlatma
  cron.schedule("0 9 * * *", () => {
    sendEarningsNotifications("earnings_payment_reminder").catch((err) => {
      console.error("[EarningsCron] reminder job error:", err?.message);
    });
  }, { timezone: "Europe/Istanbul" });

  // 10:00 her gün — bugün ödeme tarihi olan kayıtlar için bildirim
  cron.schedule("0 10 * * *", () => {
    sendEarningsNotifications("earnings_payment_due").catch((err) => {
      console.error("[EarningsCron] due job error:", err?.message);
    });
  }, { timezone: "Europe/Istanbul" });

  console.log("[EarningsCron] Hakediş ödeme bildirim zamanlaması başlatıldı.");
}
