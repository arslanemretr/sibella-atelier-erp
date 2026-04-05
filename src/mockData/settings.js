export const settingsMockData = {
  system_config: {
    smtp_status: "Connected",
    kep_status: "Active",
    active_firm: "Holding A.Ş. - Merkez",
    timestamp_active: true
  },
  user_matrix: [
    { 
      id: 1, 
      name: "Ahmet Finans", 
      role: "Muhasebe", 
      email: "ahmet@sirket.com", 
      permissions: ["Okuma", "Veri Yükleme", "Gönderme"] 
    },
    { 
      id: 2, 
      name: "Mehmet Denetçi", 
      role: "Denetçi", 
      email: "mehmet@denetim.com", 
      permissions: ["Sadece Okuma", "Rapor Alma"] 
    },
    { 
      id: 3, 
      name: "Zeynep Admin", 
      role: "Admin", 
      email: "zeynep@sirket.com", 
      permissions: ["Tam Yetki"] 
    }
  ],
  integrations: {
    provider: "TNB KEP",
    api_key: "********-****-****-****-************"
  }
};
