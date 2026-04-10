import { getStoreValue } from "./db.js";

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

function inDateRange(dateValue, startDate, endDate) {
  const dateText = String(dateValue || "").slice(0, 10);
  if (!dateText) {
    return false;
  }
  return dateText >= startDate && dateText <= endDate;
}

function buildDetailItems(items, mapper, limit = 8) {
  return (items || []).slice(0, limit).map(mapper);
}

async function getStoreArray(key) {
  const record = await getStoreValue(key);
  return Array.isArray(record?.value) ? record.value : [];
}

async function getStoreObject(key) {
  const record = await getStoreValue(key);
  return record?.value || null;
}

async function getDashboardSummary({ startDate, endDate }) {
  const products = await getStoreArray("sibella.erp.products.v1");
  const suppliers = await getStoreArray("sibella.erp.suppliers.v1");
  const purchases = await getStoreArray("sibella.erp.purchases.v2");
  const stockEntries = await getStoreArray("sibella.erp.stockEntries.v2");
  const posSessions = await getStoreArray("sibella.erp.posSessions.v2");
  const posSales = await getStoreArray("sibella.erp.posSales.v2");

  const activeProductCount = products.filter((item) => item.status === "Aktif").length;
  const lowStockRows = products
    .filter((item) => (item.trackInventory ?? true) && item.status === "Aktif")
    .filter((item) => Number(item.stock || 0) <= Number(item.minStock || 0))
    .slice(0, 12);
  const supplierCount = suppliers.filter((item) => item.status === "Aktif").length;

  const purchaseRows = purchases
    .filter((item) => inDateRange(item.date || item.createdAt, startDate, endDate))
    .map((purchase) => {
      const totalAmount = (purchase.lines || []).reduce(
        (sum, line) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0)),
        0,
      );
      const supplier = suppliers.find((item) => item.id === purchase.supplierId);
      return {
        id: purchase.id,
        documentNo: purchase.documentNo || "-",
        date: purchase.date || purchase.createdAt || "",
        supplierName: supplier?.company || "-",
        lineCount: (purchase.lines || []).length,
        totalAmount,
        procurementTypeId: purchase.procurementTypeId || "",
      };
    });

  const stockRows = stockEntries
    .filter((entry) => inDateRange(entry.date || entry.createdAt, startDate, endDate))
    .map((entry) => {
      const totalAmount = (entry.lines || []).reduce(
        (sum, line) => sum + (Number(line.quantity || 0) * Number(line.unitCost || 0)),
        0,
      );
      const supplier = suppliers.find((item) => item.id === entry.sourcePartyId);
      return {
        id: entry.id,
        documentNo: entry.documentNo || "-",
        date: entry.date || entry.createdAt || "",
        sourcePartyName: supplier?.company || "-",
        lineCount: (entry.lines || []).length,
        totalAmount,
        stockType: entry.stockType || "",
        sourceType: entry.sourceType || "",
      };
    });

  const normalizedPosSessions = posSessions
    .filter((session) => inDateRange(session.openedAt || session.createdAt, startDate, endDate) || inDateRange(session.closedAt, startDate, endDate))
    .map((session) => ({
      ...session,
      status: session.status || "-",
    }));
  const openPosSessions = normalizedPosSessions.filter((session) => String(session.status).toLowerCase().includes("acik"));

  const saleRows = posSales
    .filter((sale) => inDateRange(sale.soldAt || sale.createdAt, startDate, endDate))
    .map((sale) => ({
      id: sale.id,
      receiptNo: sale.receiptNo || "-",
      soldAt: sale.soldAt || sale.createdAt || "",
      customerName: sale.customerName || "Misafir Musteri",
      paymentMethod: sale.paymentMethod || "-",
      lineCount: (sale.lines || []).length,
      grandTotal: Number(sale.grandTotal || 0),
    }));

  const totalSalesAmount = saleRows.reduce((sum, sale) => sum + sale.grandTotal, 0);
  const movements = [
    ...stockRows.map((entry) => ({
      key: `stock-${entry.id}`,
      module: "Stok",
      documentNo: entry.documentNo,
      description: `${entry.sourcePartyName} - ${entry.lineCount} kalem stok girisi`,
      status: entry.sourceType || entry.stockType || "Kayitli",
      date: entry.date || null,
      amount: formatMoney(entry.totalAmount),
    })),
    ...purchaseRows.map((purchase) => ({
      key: `purchase-${purchase.id}`,
      module: "Satinalma",
      documentNo: purchase.documentNo,
      description: `${purchase.supplierName} - ${purchase.lineCount} kalem alim`,
      status: purchase.procurementTypeId || "Kayitli",
      date: purchase.date || null,
      amount: formatMoney(purchase.totalAmount),
    })),
    ...saleRows.map((sale) => ({
      key: `sale-${sale.id}`,
      module: "POS",
      documentNo: sale.receiptNo,
      description: `${sale.customerName} - ${sale.lineCount} kalem satis`,
      status: sale.paymentMethod,
      date: sale.soldAt || null,
      amount: formatMoney(sale.grandTotal),
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
          label: String(item.soldAt || "").slice(0, 10),
          value: formatMoney(item.grandTotal),
          hint: item.receiptNo,
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
          value: `${Number(item.stock || 0)} / ${Number(item.minStock || 0)}`,
          hint: "Mevcut stok / minimum stok",
        }), 12),
      },
      "open-pos": {
        title: "Acik POS Oturumlari",
        items: buildDetailItems(openPosSessions, (item) => ({
          label: `${item.sessionNo || "-"} - ${item.registerName || "Kasa"}`,
          value: item.cashierName || "-",
          hint: item.openedAt ? new Date(item.openedAt).toLocaleString("tr-TR") : "-",
        })),
      },
      suppliers: {
        title: "Tedarikci Gorunumu",
        items: buildDetailItems(suppliers.filter((item) => item.status === "Aktif"), (item) => ({
          label: item.company || "-",
          value: item.contact || "-",
          hint: item.city || "-",
        })),
      },
      purchases: {
        title: "Satinalma Kayitlari",
        items: buildDetailItems(purchaseRows, (item) => ({
          label: item.documentNo || "-",
          value: item.supplierName || "-",
          hint: formatMoney(item.totalAmount),
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
