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
    key: "stock",
    label: "Stok",
    children: [
      { key: "/stock/entry", label: "Stok Giris Ekrani" },
      { key: "/stock/list", label: "Stok Hareketleri" },
    ],
  },
  {
    key: "supplier-portal",
    label: "Tedarikci Portal",
    children: [
      { key: "/supplier-portal/delivery-lists", label: "Teslimat Listeleri" },
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
      { key: "/settings/smtp", label: "SMTP ve E-posta" },
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
        key: "stock-group",
        label: "Stok",
        children: [
          { key: "/stock/entry", label: "Stok Giris Ekrani" },
          { key: "/stock/list", label: "Stok Hareketleri" },
        ],
      },
      {
        key: "supplier-portal-group",
        label: "Tedarikci Portal",
        children: [
          { key: "/supplier-portal/delivery-lists", label: "Teslimat Listeleri" },
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
          { key: "/settings/smtp", label: "SMTP ve E-posta" },
        ],
      },
    ],
  },
];

export const supplierMainMenuItems = [
  { key: "/supplier/dashboard", label: "Dashboard" },
  { key: "/supplier/products", label: "Urunlerim" },
  { key: "/supplier/deliveries/new", label: "Teslimat Olustur" },
  { key: "/supplier/deliveries", label: "Teslimat Listesi" },
];

export const supplierSidebarGroups = [
  {
    type: "group",
    label: "TEDARIKCI PORTALI",
    children: [
      { key: "/supplier/dashboard", label: "Dashboard" },
      { key: "/supplier/products", label: "Urunlerim" },
      { key: "/supplier/deliveries/new", label: "Teslimat Olustur" },
      { key: "/supplier/deliveries", label: "Teslimat Listesi" },
    ],
  },
];
