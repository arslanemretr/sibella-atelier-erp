export const EARNINGS_STATUS_META = {
  "Donem Tamamlanmadi": { color: "default" },
  "Fatura Bekleniyor": { color: "gold" },
  "Odeme Bekleniyor": { color: "orange" },
  Tamamlandi: { color: "green" },
  "Satis Yok": { color: "default" },
};

export function getMonthKeyFromDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function getDateFromPeriodKey(periodKey) {
  const [year, month] = String(periodKey || "").split("-").map(Number);
  return new Date(year, Math.max((month || 1) - 1, 0), 1);
}

export function getPreviousMonthPeriodKey() {
  const now = new Date();
  return getMonthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

export function getPeriodBounds(periodKey) {
  const [year, month] = String(periodKey || "").split("-").map(Number);
  const start = new Date(year, Math.max((month || 1) - 1, 0), 1, 0, 0, 0, 0);
  const end = new Date(year, Math.max(month || 1, 1), 0, 23, 59, 59, 999);
  return { start, end };
}

export function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatPeriodLabel(periodKey) {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(getDateFromPeriodKey(periodKey));
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

export function getThirdFridayAfterPeriodEnd(periodKey) {
  const [year, month] = String(periodKey || "").split("-").map(Number);
  const current = new Date(year, month || 1, 1);
  let fridayCount = 0;

  while (true) {
    if (current.getDay() === 5) {
      fridayCount += 1;
      if (fridayCount === 3) {
        return new Date(current);
      }
    }
    current.setDate(current.getDate() + 1);
  }
}

function isCurrentPeriodKey(periodKey) {
  return periodKey === getMonthKeyFromDate(new Date());
}

function resolveAdminEarningsStatus(periodKey, earningsTotal, earningsRecord) {
  if (isCurrentPeriodKey(periodKey)) {
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

export function buildAdminEarningsList({ suppliers, products, sales, returns, contracts, earningsRecords }) {
  const consignmentProductsBySupplierId = new Map();
  (products || []).filter((product) => product.productType === "konsinye").forEach((product) => {
    if (!product.supplierId) {
      return;
    }
    const list = consignmentProductsBySupplierId.get(product.supplierId) || [];
    list.push(product);
    consignmentProductsBySupplierId.set(product.supplierId, list);
  });

  const periodKeysBySupplier = new Map();
  (sales || []).forEach((sale) => {
    const soldAt = sale.soldAt ? new Date(sale.soldAt) : null;
    if (!soldAt || Number.isNaN(soldAt.getTime())) {
      return;
    }
    const periodKey = getMonthKeyFromDate(new Date(soldAt.getFullYear(), soldAt.getMonth(), 1));
    consignmentProductsBySupplierId.forEach((supplierProducts, supplierId) => {
      const hasSupplierLine = (sale.lines || []).some((line) => supplierProducts.some((product) => product.id === line.productId));
      if (!hasSupplierLine) {
        return;
      }
      const keys = periodKeysBySupplier.get(supplierId) || new Set();
      keys.add(periodKey);
      periodKeysBySupplier.set(supplierId, keys);
    });
  });

  const earningsRecordMap = new Map((earningsRecords || []).map((record) => [`${record.supplierId}::${record.periodKey}`, record]));
  const rows = [];

  periodKeysBySupplier.forEach((periodKeys, supplierId) => {
    const supplier = (suppliers || []).find((item) => item.id === supplierId);
    if (!supplier) {
      return;
    }

    const supplierProducts = consignmentProductsBySupplierId.get(supplierId) || [];
    const productIds = new Set(supplierProducts.map((product) => product.id));
    const relevantContracts = (contracts || [])
      .filter((contract) => contract.supplierId === supplierId)
      .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || ""), "tr"));

    periodKeys.forEach((periodKey) => {
      const { start, end } = getPeriodBounds(periodKey);
      const contract = relevantContracts.find((item) => {
        const contractStart = item.startDate ? new Date(item.startDate) : null;
        const contractEnd = item.endDate ? new Date(item.endDate) : null;
        return (!contractStart || contractStart <= end) && (!contractEnd || contractEnd >= start);
      }) || relevantContracts[0] || null;

      const commissionRate = Number(contract?.commissionRate || 0);
      const productLineMap = new Map();

      (sales || []).forEach((sale) => {
        const soldAt = sale.soldAt ? new Date(sale.soldAt) : null;
        if (!soldAt || soldAt < start || soldAt > end) {
          return;
        }
        (sale.lines || []).forEach((line) => {
          if (!productIds.has(line.productId)) {
            return;
          }
          const existing = productLineMap.get(line.productId) || {
            productId: line.productId,
            productCode: line.productCode || "",
            productName: line.productName || "",
            salesQty: 0,
            salesAmount: 0,
            returnQty: 0,
          };
          existing.salesQty += Number(line.quantity || 0);
          existing.salesAmount += Number(line.lineTotal || Number(line.quantity || 0) * Number(line.unitPrice || 0));
          productLineMap.set(line.productId, existing);
        });
      });

      (returns || []).forEach((ret) => {
        const returnDate = ret.returnDate ? new Date(ret.returnDate) : null;
        if (!returnDate) {
          return;
        }
        const returnPeriodKey = getMonthKeyFromDate(new Date(returnDate.getFullYear(), returnDate.getMonth(), 1));
        if (returnPeriodKey !== periodKey) {
          return;
        }
        (ret.lines || []).forEach((line) => {
          if (!productIds.has(line.productId)) {
            return;
          }
          const existing = productLineMap.get(line.productId);
          if (!existing) {
            return;
          }
          existing.returnQty += Number(line.quantity || 0);
          productLineMap.set(line.productId, existing);
        });
      });

      const productLines = Array.from(productLineMap.values())
        .map((line) => {
          const unitPrice = line.salesQty > 0 ? line.salesAmount / line.salesQty : 0;
          const netQty = Math.max(0, line.salesQty - line.returnQty);
          const netAmount = netQty * unitPrice;
          const earningsAmount = netAmount * (1 - commissionRate / 100);
          return {
            productId: line.productId,
            productCode: line.productCode,
            productName: line.productName,
            salesQty: line.salesQty,
            returnQty: line.returnQty,
            netQty,
            unitPrice,
            netAmount,
            earningsAmount,
            commissionRate,
          };
        })
        .sort((a, b) => String(a.productCode).localeCompare(String(b.productCode), "tr"));

      const grossTotal = productLines.reduce((sum, line) => sum + line.salesQty * line.unitPrice, 0);
      const returnTotal = productLines.reduce((sum, line) => sum + line.returnQty * line.unitPrice, 0);
      const netTotal = productLines.reduce((sum, line) => sum + line.netAmount, 0);
      const earningsTotal = productLines.reduce((sum, line) => sum + line.earningsAmount, 0);
      const earningsRecord = earningsRecordMap.get(`${supplierId}::${periodKey}`) || null;

      rows.push({
        key: `${supplierId}::${periodKey}`,
        supplierId,
        supplierName: supplier.company || "-",
        periodKey,
        periodLabel: formatPeriodLabel(periodKey),
        commissionRate,
        grossTotal,
        returnTotal,
        netTotal,
        earningsTotal,
        productLines,
        earningsRecord,
        status: resolveAdminEarningsStatus(periodKey, earningsTotal, earningsRecord),
      });
    });
  });

  return rows.sort((a, b) => b.periodKey.localeCompare(a.periodKey, "tr") || a.supplierName.localeCompare(b.supplierName, "tr"));
}
