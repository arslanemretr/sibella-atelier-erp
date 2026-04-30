export const mainMenuItems = [
  { key: "/dashboard", label: "Dashboard" },
  {
    key: "products",
    label: "Urunler",
    children: [
      { key: "/products/list", label: "Urun Listesi" },
      { key: "/products/new", label: "Urun Ekle" },
    ],
  },
  {
    key: "pos",
    label: "Pos",
    children: [
      { key: "/pos/sessions", label: "Oturumlar" },
      { key: "/pos/store", label: "Pos Ekrani" },
      { key: "/pos/orders", label: "Siparisler" },
      { key: "/pos/returns", label: "Iadeler" },
    ],
  },
  {
    key: "purchasing",
    label: "Satinalma",
    children: [
      { key: "/purchasing/suppliers", label: "Tedarikci Listesi" },
      { key: "/purchasing/suppliers/new", label: "Tedarikci Ekle" },
      { key: "/purchasing/contracts", label: "Sozlesmeler" },
    ],
  },
  {
    key: "stores",
    label: "Magaza",
    roles: ["Yonetici", "Muhasebe"],
    children: [
      { key: "/stores/list", label: "Magaza Listesi", roles: ["Yonetici", "Muhasebe"] },
      { key: "/stores/new", label: "Magaza Tanimla", roles: ["Yonetici", "Muhasebe"] },
      { key: "/stores/shipments", label: "Gonderi Listesi", roles: ["Yonetici", "Muhasebe"] },
      { key: "/stores/shipments/new", label: "Gonderi Olustur", roles: ["Yonetici", "Muhasebe"] },
    ],
  },
  {
    key: "stock",
    label: "Stok",
    children: [
      { key: "/stock/entry", label: "Stok Giris Ekrani" },
      { key: "/stock/list", label: "Stok Hareketleri" },
      { key: "/stock/locations", label: "Stok Yerleri", roles: ["Yonetici", "Muhasebe"] },
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
    roles: ["Yonetici", "Muhasebe"],
    children: [
      { key: "/reports/consolidated-earnings", label: "Toplu Hakedis Raporu", roles: ["Yonetici", "Muhasebe"] },
      { key: "/reports/supplier-earnings", label: "Tedarikci Hakedis Raporu", roles: ["Yonetici", "Muhasebe"] },
    ],
  },
  {
    key: "settings",
    label: "Ayarlar",
    children: [
      { key: "/settings/users", label: "Kullanici" },
      { key: "/settings/categories", label: "Kategori Tanimlari" },
      { key: "/settings/collections", label: "Koleksiyon Tanimlari" },
      { key: "/settings/pos-categories", label: "Pos Kategori Tanimlari" },
      { key: "/settings/barcode-standards", label: "Barkod Olusturma Standarti" },
      { key: "/settings/procurement-types", label: "Tedarik Tipi Tanimlama" },
      { key: "/settings/payment-terms", label: "Odeme Kosulu Tanimlama" },
      { key: "/settings/parameters", label: "Parametreler" },
      { key: "/settings/mail-management", label: "Mail Yonetimi" },
    ],
  },
];

export const sidebarGroups = [
  {
    type: "group",
    children: [
      { key: "/dashboard", label: "Dashboard" },
      {
        key: "products-group",
        label: "Urunler",
        children: [
          { key: "/products/list", label: "Urun Listesi" },
          { key: "/products/new", label: "Urun Ekle" },
        ],
      },
      {
        key: "pos-group",
        label: "Pos",
        children: [
          { key: "/pos/sessions", label: "Oturumlar" },
          { key: "/pos/store", label: "Pos Ekrani" },
          { key: "/pos/orders", label: "Siparisler" },
          { key: "/pos/returns", label: "Iadeler" },
        ],
      },
      {
        key: "purchasing-group",
        label: "Satinalma",
        children: [
          { key: "/purchasing/suppliers", label: "Tedarikci Listesi" },
          { key: "/purchasing/suppliers/new", label: "Tedarikci Ekle" },
          { key: "/purchasing/contracts", label: "Sozlesmeler" },
        ],
      },
      {
        key: "stores-group",
        label: "Magaza",
        roles: ["Yonetici", "Muhasebe"],
        children: [
          { key: "/stores/list", label: "Magaza Listesi", roles: ["Yonetici", "Muhasebe"] },
          { key: "/stores/new", label: "Magaza Tanimla", roles: ["Yonetici", "Muhasebe"] },
          { key: "/stores/shipments", label: "Gonderi Listesi", roles: ["Yonetici", "Muhasebe"] },
          { key: "/stores/shipments/new", label: "Gonderi Olustur", roles: ["Yonetici", "Muhasebe"] },
        ],
      },
      {
        key: "stock-group",
        label: "Stok",
        children: [
          { key: "/stock/entry", label: "Stok Giris Ekrani" },
          { key: "/stock/list", label: "Stok Hareketleri" },
          { key: "/stock/locations", label: "Stok Yerleri", roles: ["Yonetici", "Muhasebe"] },
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
        roles: ["Yonetici", "Muhasebe"],
        children: [
          { key: "/reports/consolidated-earnings", label: "Toplu Hakedis Raporu", roles: ["Yonetici", "Muhasebe"] },
          { key: "/reports/supplier-earnings", label: "Tedarikci Hakedis Raporu", roles: ["Yonetici", "Muhasebe"] },
        ],
      },
      {
        key: "settings-group",
        label: "Ayarlar",
        children: [
          { key: "/settings/users", label: "Kullanici" },
          { key: "/settings/categories", label: "Kategori Tanimlari" },
          { key: "/settings/collections", label: "Koleksiyon Tanimlari" },
          { key: "/settings/pos-categories", label: "Pos Kategori Tanimlari" },
          { key: "/settings/barcode-standards", label: "Barkod Olusturma Standarti" },
          { key: "/settings/procurement-types", label: "Tedarik Tipi Tanimlama" },
          { key: "/settings/payment-terms", label: "Odeme Kosulu Tanimlama" },
          { key: "/settings/parameters", label: "Parametreler" },
          { key: "/settings/mail-management", label: "Mail Yonetimi" },
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

function isItemVisibleForRole(item, role) {
  if (!item?.roles || item.roles.length === 0) {
    return true;
  }
  return item.roles.includes(role);
}

export function filterNavigationItems(items, role) {
  return (items || [])
    .map((item) => {
      const nextChildren = item.children ? filterNavigationItems(item.children, role) : undefined;
      if (!isItemVisibleForRole(item, role)) {
        return null;
      }
      if (item.children && (!nextChildren || nextChildren.length === 0)) {
        return null;
      }
      return {
        ...item,
        children: nextChildren,
      };
    })
    .filter(Boolean);
}
