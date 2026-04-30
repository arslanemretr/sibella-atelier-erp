export const SUPPLIER_EARNINGS_STATUS_META = {
  "Donem Tamamlanmadi": { color: "default" },
  "Fatura Bekleniyor": { color: "gold" },
  "Odeme Bekleniyor": { color: "orange" },
  Tamamlandi: { color: "green" },
  "Satis Yok": { color: "default" },
};

export function formatSupplierReportMoney(value, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function toSupplierPeriodDate(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function addSupplierMonths(value, amount) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function getDefaultSupplierEarningsPeriod() {
  return addSupplierMonths(new Date(), -1);
}

export function getSupplierMonthKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function getSupplierDateFromMonthKey(value) {
  const [year, month] = String(value || "").split("-").map((item) => Number(item || 0));
  return new Date(year, Math.max(month - 1, 0), 1);
}

export function parseSupplierDateValue(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatSupplierPeriodLabel(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(value);
}

export function formatSupplierDateShort(value) {
  const parsed = parseSupplierDateValue(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function isCurrentSupplierPeriod(value) {
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

export function getSupplierPeriodBounds(value) {
  const start = new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getSupplierPeriodContract(contracts, supplierId, periodDate) {
  const { start, end } = getSupplierPeriodBounds(periodDate);
  const relevantContracts = (contracts || [])
    .filter((item) => item.supplierId === supplierId)
    .slice()
    .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || ""), "tr"));

  return (
    relevantContracts.find((item) => {
      const contractStart = item.startDate ? parseSupplierDateValue(item.startDate) : null;
      const contractEnd = item.endDate ? parseSupplierDateValue(item.endDate) : null;
      const startsBeforePeriod = !contractStart || contractStart <= end;
      const endsAfterPeriod = !contractEnd || contractEnd >= start;
      return startsBeforePeriod && endsAfterPeriod;
    }) ||
    relevantContracts[0] ||
    null
  );
}

export function resolveSupplierEarningsStatus(periodDate, earningsTotal, earningsRecord) {
  if (isCurrentSupplierPeriod(periodDate)) {
    return "Donem Tamamlanmadi";
  }
  if (!Number(earningsTotal || 0)) {
    return "Satis Yok";
  }
  if (!earningsRecord?.invoiceNo) {
    return "Fatura Bekleniyor";
  }
  if (!earningsRecord?.paymentDate) {
    return "Odeme Bekleniyor";
  }
  return "Tamamlandi";
}

export function buildSupplierEarningsSummary({ periodDate, products = [], sales = [], returns = [], contracts = [], supplierId, earningsRecord = null }) {
  const relevantProducts = (products || []).filter((item) => item.supplierId === supplierId && item.productType === "konsinye");
  const productMap = new Map(relevantProducts.map((item) => [item.id, item]));
  const contract = getSupplierPeriodContract(contracts, supplierId, periodDate);
  const commissionRate = Number(contract?.commissionRate || 0);
  const { start, end } = getSupplierPeriodBounds(periodDate);
  const groupedRows = new Map();

  (sales || []).forEach((sale) => {
    const soldAt = parseSupplierDateValue(sale.soldAt);
    if (!soldAt || soldAt < start || soldAt > end) {
      return;
    }

    (sale.lines || []).forEach((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        return;
      }

      const grossAmount = Number(line.lineTotal || (Number(line.quantity || 0) * Number(line.unitPrice || 0)));
      const existingRow = groupedRows.get(line.productId) || {
        key: line.productId,
        productCode: line.productCode || product.code || "-",
        productName: line.productName || product.name || "-",
        salesQuantity: 0,
        returnQuantity: 0,
        unitPrice: Number(line.unitPrice || 0),
        grossAmount: 0,
      };

      existingRow.salesQuantity += Number(line.quantity || 0);
      existingRow.unitPrice = Number(line.unitPrice || existingRow.unitPrice || 0);
      existingRow.grossAmount += grossAmount;
      groupedRows.set(line.productId, existingRow);
    });
  });

  (returns || []).forEach((ret) => {
    const retDate = parseSupplierDateValue(ret.returnDate);
    if (!retDate || retDate < start || retDate > end) {
      return;
    }
    (ret.lines || []).forEach((line) => {
      const existing = groupedRows.get(line.productId);
      if (!existing) {
        return;
      }
      existing.returnQuantity += Number(line.quantity || 0);
    });
  });

  const detailRows = Array.from(groupedRows.values())
    .map((row) => {
      const netQuantity = Math.max(0, row.salesQuantity - row.returnQuantity);
      const salesAmount = netQuantity * row.unitPrice;
      const commissionAmount = salesAmount * (commissionRate / 100);
      const netAmount = salesAmount - commissionAmount;
      return {
        ...row,
        netQuantity,
        salesAmount,
        commissionRate,
        commissionAmount,
        netAmount,
      };
    })
    .sort((a, b) => String(a.productCode || "").localeCompare(String(b.productCode || ""), "tr"));

  const grossTotal = detailRows.reduce((sum, item) => sum + item.grossAmount, 0);
  const returnTotal = detailRows.reduce((sum, item) => sum + item.returnQuantity * item.unitPrice, 0);
  const netSalesTotal = detailRows.reduce((sum, item) => sum + item.salesAmount, 0);
  const commissionTotal = detailRows.reduce((sum, item) => sum + item.commissionAmount, 0);
  const earningsTotal = detailRows.reduce((sum, item) => sum + item.netAmount, 0);
  const status = resolveSupplierEarningsStatus(periodDate, earningsTotal, earningsRecord);

  return {
    periodKey: getSupplierMonthKey(periodDate),
    periodDate,
    periodLabel: formatSupplierPeriodLabel(periodDate),
    contract,
    commissionRate,
    detailRows,
    grossTotal,
    returnTotal,
    netSalesTotal,
    commissionTotal,
    earningsTotal,
    invoiceNo: earningsRecord?.invoiceNo || null,
    invoiceDate: earningsRecord?.invoiceDate || null,
    paymentDueDate: earningsRecord?.paymentDueDate || null,
    paymentDate: earningsRecord?.paymentDate || null,
    status,
  };
}

export function buildSupplierStatusMessage(summary) {
  if (!summary) {
    return "-";
  }
  if (summary.status === "Donem Tamamlanmadi") {
    return "Donem henuz tamamlanmadi. Donem kapandiginda hakedis hesabiniz kesinlesecektir.";
  }
  if (summary.status === "Satis Yok") {
    return "Bu donem icin hakedis olusturan konsinye satis bulunmamaktadir.";
  }
  if (summary.status === "Fatura Bekleniyor") {
    return `Fatura bilgisi bekleniyor. Hakedis tutari ${formatSupplierReportMoney(summary.earningsTotal)} icin fatura kesilmesi beklenmektedir.`;
  }
  if (summary.status === "Odeme Bekleniyor") {
    return `Fatura alindi. Fatura No: ${summary.invoiceNo || "-"} | Fatura Tarihi: ${formatSupplierDateShort(summary.invoiceDate)} | Son Odeme: ${formatSupplierDateShort(summary.paymentDueDate)}`;
  }
  if (summary.status === "Tamamlandi") {
    return `Odeme ${formatSupplierDateShort(summary.paymentDate)} tarihinde tamamlandi. Fatura No: ${summary.invoiceNo || "-"}`;
  }
  return "-";
}
