export const dashboardData = {
  summary: {
    total_risk_amount: 14500000.00,
    success_rate: 82.4,
    pending_approvals: 145,
    system_errors: 7,
    pending_critical: [
      { id: 1, vkn: '1112223334', unvan: "Bilişim Sistemleri A.Ş.", type: 'Cari Bakiye', amount: 450000, currency: 'TL', remaining_days: 1, status: "3. Hatırlatma", action: "whatsapp" },
      { id: 2, vkn: '5556667778', unvan: "Logosan Yazılım Ltd.", type: 'BA', amount: 180000, currency: 'TL', remaining_days: 0, status: "Okundu", action: "call" },
      { id: 3, vkn: '9998887776', unvan: "Netsistem Donanım A.Ş.", type: 'BS', amount: 95000, currency: 'USD', remaining_days: 3, status: "İletildi", action: "email" },
      { id: 4, vkn: '4445556667', unvan: "Mikro Teknoloji Ltd.", type: 'Cari Bakiye', amount: 75000, currency: 'EUR', remaining_days: 5, status: "Bekliyor", action: "email" },
    ]
  },
  type_analysis: [
    { key: 1, type: "BA", sent_amount: 5000000, confirmed_amount: 4800000, reject_amount: 200000, rate: 96, status: "Critical" },
    { key: 2, type: "BS", sent_amount: 8000000, confirmed_amount: 7950000, reject_amount: 50000, rate: 99, status: "Stable" },
    { key: 3, type: "Cari Bakiye", sent_amount: 12000000, confirmed_amount: 9000000, reject_amount: 3000000, rate: 75, status: "Riskli" },
    { key: 4, type: "İhtarname", sent_amount: 450000, confirmed_amount: 150000, reject_amount: 300000, rate: 33, status: "Kritik" }
  ],
  trend_analysis: [
    { key: 1, period: "2026/01", volume_change: "+5.2%", avg_response_days: 3.4, top_reject_reason: "Fiyat Farkı" },
    { key: 2, period: "2026/02", volume_change: "-1.1%", avg_response_days: 2.8, top_reject_reason: "Eksik Belge" },
    { key: 3, period: "2026/03", volume_change: "+8.7%", avg_response_days: 4.1, top_reject_reason: "Kur Farkı" }
  ]
};
