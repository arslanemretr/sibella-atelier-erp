export const mainMenuItems = [
  { key: "/dashboard", label: "Dashboard", permissionKey: "dashboard" },
  {
    key: "products",
    label: "Urunler",
    children: [
      { key: "/products/list", label: "Urun Listesi", permissionKey: "products_list" },
      { key: "/products/new", label: "Urun Ekle", permissionKey: "products_list", permissionWrite: true },
    ],
  },
  {
    key: "pos",
    label: "Pos",
    children: [
      { key: "/pos/sessions", label: "Oturumlar", permissionKey: "pos_sessions" },
      { key: "/pos/store", label: "Pos Ekrani", permissionKey: "pos_store" },
      { key: "/pos/orders", label: "Satislar", permissionKey: "pos_orders" },
      { key: "/pos/returns", label: "Iadeler", permissionKey: "pos_returns" },
    ],
  },
  {
    key: "purchasing",
    label: "Satinalma",
    children: [
      { key: "/purchasing/suppliers", label: "Tedarikci Listesi", permissionKey: "purchasing_suppliers" },
      { key: "/purchasing/suppliers/new", label: "Tedarikci Ekle", permissionKey: "purchasing_suppliers", permissionWrite: true },
      { key: "/purchasing/contracts", label: "Sozlesmeler", permissionKey: "purchasing_contracts" },
    ],
  },
  {
    key: "stores",
    label: "Magaza",
    children: [
      { key: "/stores/list", label: "Magaza Listesi", permissionKey: "stores_list" },
      { key: "/stores/new", label: "Magaza Tanimla", permissionKey: "stores_list", permissionWrite: true },
      { key: "/stores/shipments", label: "Gonderi Listesi", permissionKey: "stores_shipments" },
      { key: "/stores/shipments/new", label: "Gonderi Olustur", permissionKey: "stores_shipments", permissionWrite: true },
    ],
  },
  {
    key: "store-sales",
    label: "Mağaza Satış",
    children: [
      { key: "/stores/invoices", label: "Mağaza Fatura Listesi", permissionKey: "stores_invoices" },
      { key: "/stores/cari", label: "Mağaza Cari Hesap", permissionKey: "stores_invoices" },
    ],
  },
  {
    key: "stock",
    label: "Stok",
    children: [
      { key: "/stock/entry", label: "Stok Giris Ekrani", permissionKey: "stock_entry" },
      { key: "/stock/list", label: "Stok Hareketleri", permissionKey: "stock_list" },
      { key: "/stock/locations", label: "Stok Yerleri", permissionKey: "stock_locations" },
    ],
  },
  {
    key: "supplier-portal",
    label: "Tedarikci Portal",
    children: [
      { key: "/supplier-portal/delivery-lists", label: "Teslimat Listeleri" },
      { key: "/supplier-portal/earnings", label: "Hakedis Yonetimi" },
    ],
  },
  {
    key: "reports",
    label: "Raporlar",
    children: [
      { key: "/reports/sales", label: "Satış Raporu", permissionKey: "reports_sales" },
      { key: "/reports/stock", label: "Stok Raporu", permissionKey: "reports_stock" },
      { key: "/reports/consolidated-earnings", label: "Toplu Hakedis Raporu", permissionKey: "reports_consolidated" },
      { key: "/reports/supplier-earnings", label: "Tedarikci Hakedis Raporu", permissionKey: "reports_supplier" },
      { key: "/reports/activity", label: "Aktivite Raporu", permissionKey: "settings_audit_log" },
      { key: "/reports/store-invoices", label: "Mağaza Satış Raporu", permissionKey: "stores_invoices" },
    ],
  },
  {
    key: "settings",
    label: "Ayarlar",
    children: [
      { key: "/settings/users", label: "Kullanici", permissionKey: "settings_users" },
      { key: "/settings/categories", label: "Kategori Tanimlari", permissionKey: "settings_categories" },
      { key: "/settings/collections", label: "Koleksiyon Tanimlari", permissionKey: "settings_collections" },
      { key: "/settings/pos-categories", label: "Pos Kategori Tanimlari", permissionKey: "settings_pos_categories" },
      { key: "/settings/barcode-standards", label: "Barkod Olusturma Standarti", permissionKey: "settings_barcode" },
      { key: "/settings/procurement-types", label: "Tedarik Tipi Tanimlama", permissionKey: "settings_procurement" },
      { key: "/settings/payment-terms", label: "Odeme Kosulu Tanimlama", permissionKey: "settings_payment_terms" },
      { key: "/settings/parameters", label: "Parametreler", permissionKey: "settings_parameters" },
      { key: "/settings/mail-management", label: "Mail Yonetimi", permissionKey: "settings_mail" },
      { key: "/settings/branding", label: "Tema Ayarlari", permissionKey: "settings_branding" },
      { key: "/settings/audit-log", label: "Aktivite Günlüğü", permissionKey: "settings_audit_log" },
    ],
  },
];

export const sidebarGroups = [
  {
    type: "group",
    children: [
      { key: "/dashboard", label: "Dashboard", permissionKey: "dashboard" },
      {
        key: "products-group",
        label: "Urunler",
        children: [
          { key: "/products/list", label: "Urun Listesi", permissionKey: "products_list" },
          { key: "/products/new", label: "Urun Ekle", permissionKey: "products_list", permissionWrite: true },
        ],
      },
      {
        key: "pos-group",
        label: "Pos",
        children: [
          { key: "/pos/sessions", label: "Oturumlar", permissionKey: "pos_sessions" },
          { key: "/pos/store", label: "Pos Ekrani", permissionKey: "pos_store" },
          { key: "/pos/orders", label: "Satislar", permissionKey: "pos_orders" },
          { key: "/pos/returns", label: "Iadeler", permissionKey: "pos_returns" },
        ],
      },
      {
        key: "purchasing-group",
        label: "Satinalma",
        children: [
          { key: "/purchasing/suppliers", label: "Tedarikci Listesi", permissionKey: "purchasing_suppliers" },
          { key: "/purchasing/suppliers/new", label: "Tedarikci Ekle", permissionKey: "purchasing_suppliers", permissionWrite: true },
          { key: "/purchasing/contracts", label: "Sozlesmeler", permissionKey: "purchasing_contracts" },
        ],
      },
      {
        key: "stores-group",
        label: "Magaza",
        children: [
          { key: "/stores/list", label: "Magaza Listesi", permissionKey: "stores_list" },
          { key: "/stores/new", label: "Magaza Tanimla", permissionKey: "stores_list", permissionWrite: true },
          { key: "/stores/shipments", label: "Gonderi Listesi", permissionKey: "stores_shipments" },
          { key: "/stores/shipments/new", label: "Gonderi Olustur", permissionKey: "stores_shipments", permissionWrite: true },
        ],
      },
      {
        key: "store-sales-group",
        label: "Mağaza Satış",
        children: [
          { key: "/stores/invoices", label: "Mağaza Fatura Listesi", permissionKey: "stores_invoices" },
          { key: "/stores/cari", label: "Mağaza Cari Hesap", permissionKey: "stores_invoices" },
        ],
      },
      {
        key: "stock-group",
        label: "Stok",
        children: [
          { key: "/stock/entry", label: "Stok Giris Ekrani", permissionKey: "stock_entry" },
          { key: "/stock/list", label: "Stok Hareketleri", permissionKey: "stock_list" },
          { key: "/stock/locations", label: "Stok Yerleri", permissionKey: "stock_locations" },
        ],
      },
      {
        key: "supplier-portal-group",
        label: "Tedarikci Portal",
        children: [
          { key: "/supplier-portal/delivery-lists", label: "Teslimat Listeleri" },
          { key: "/supplier-portal/earnings", label: "Hakedis Yonetimi" },
        ],
      },
      {
        key: "reports-group",
        label: "Raporlar",
        children: [
          { key: "/reports/sales", label: "Satış Raporu", permissionKey: "reports_sales" },
          { key: "/reports/stock", label: "Stok Raporu", permissionKey: "reports_stock" },
          { key: "/reports/consolidated-earnings", label: "Toplu Hakedis Raporu", permissionKey: "reports_consolidated" },
          { key: "/reports/supplier-earnings", label: "Tedarikci Hakedis Raporu", permissionKey: "reports_supplier" },
          { key: "/reports/activity", label: "Aktivite Raporu", permissionKey: "settings_audit_log" },
          { key: "/reports/store-invoices", label: "Mağaza Satış Raporu", permissionKey: "stores_invoices" },
        ],
      },
      {
        key: "settings-group",
        label: "Ayarlar",
        children: [
          { key: "/settings/users", label: "Kullanici", permissionKey: "settings_users" },
          { key: "/settings/categories", label: "Kategori Tanimlari", permissionKey: "settings_categories" },
          { key: "/settings/collections", label: "Koleksiyon Tanimlari", permissionKey: "settings_collections" },
          { key: "/settings/pos-categories", label: "Pos Kategori Tanimlari", permissionKey: "settings_pos_categories" },
          { key: "/settings/barcode-standards", label: "Barkod Olusturma Standarti", permissionKey: "settings_barcode" },
          { key: "/settings/procurement-types", label: "Tedarik Tipi Tanimlama", permissionKey: "settings_procurement" },
          { key: "/settings/payment-terms", label: "Odeme Kosulu Tanimlama", permissionKey: "settings_payment_terms" },
          { key: "/settings/parameters", label: "Parametreler", permissionKey: "settings_parameters" },
          { key: "/settings/mail-management", label: "Mail Yonetimi", permissionKey: "settings_mail" },
          { key: "/settings/branding", label: "Tema Ayarlari", permissionKey: "settings_branding" },
          { key: "/settings/audit-log", label: "Aktivite Günlüğü", permissionKey: "settings_audit_log" },
        ],
      },
    ],
  },
];

export const supplierMainMenuItems = [
  { key: "/supplier/dashboard", label: "Dashboard" },
  { key: "/supplier/products", label: "Urunlerim" },
  { key: "/supplier/earnings", label: "Hakedis Ozeti" },
  { key: "/supplier/deliveries", label: "Teslimat Listesi" },
];

export const supplierSidebarGroups = [
  {
    type: "group",
    label: "TEDARIKCI PORTALI",
    children: [
      { key: "/supplier/dashboard", label: "Dashboard" },
      { key: "/supplier/products", label: "Urunlerim" },
      { key: "/supplier/earnings", label: "Hakedis Ozeti" },
      { key: "/supplier/deliveries", label: "Teslimat Listesi" },
    ],
  },
];

function isItemVisible(item, permissions, role) {
  if (!item.permissionKey) return true;
  // Yonetici her zaman tum ekranlari gorur
  if (role === "Yonetici") return true;
  // Permissions bossa: izin ver
  if (!permissions || Object.keys(permissions).length === 0) return true;
  const perm = permissions[item.permissionKey];
  return item.permissionWrite ? perm?.write === true : perm?.view === true;
}

export function filterNavigationItems(items, role, permissions = {}) {
  return (items || [])
    .map((item) => {
      if (!isItemVisible(item, permissions, role)) return null;
      const nextChildren = item.children
        ? filterNavigationItems(item.children, role, permissions)
        : undefined;
      if (item.children && (!nextChildren || nextChildren.length === 0)) return null;
      return { ...item, children: nextChildren };
    })
    .filter(Boolean);
}
