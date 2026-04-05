export const trackingData = [
  { 
    id: 1, 
    status: 'Mutabık', 
    unvan: 'Bilişim Sistemleri A.Ş.', 
    vkn: '1112223334', 
    tur: 'Cari Bakiye', 
    donem: '03-2026', 
    tutar: 450000, 
    paraBirimi: 'TL', 
    emailDurum: 'success', 
    smsDurum: 'success', 
    tarih: '28 Mar 2026 10:00', 
    sonIslem: 'Müşteri e-imza ile onayladı.', 
    notVar: false,
    email: 'finans@bilisim.com',
    timeline: [
      { time: '28 Mar 10:00', title: 'Gönderildi', desc: 'Email ve SMS ile iletildi.' },
      { time: '28 Mar 10:15', title: 'Okundu', desc: 'Sisteme giriş yapıldı.' },
      { time: '28 Mar 10:30', title: 'Mutabık Kalındı', desc: 'IP: 192.168.1.5 üzerinden onaylandı.' }
    ]
  },
  { 
    id: 2, 
    status: 'Red', 
    redNedeni: '"Elinizdeki 0045 no\'lu fatura bizde kayıtlı değil, ekstreleri kıyaslayalım."', 
    unvan: 'Logosan Yazılım Ltd.', 
    vkn: '5556667778', 
    tur: 'BA', 
    donem: '03-2026', 
    tutar: 180000, 
    paraBirimi: 'TL', 
    emailDurum: 'success', 
    smsDurum: 'none', 
    tarih: '28 Mar 2026 11:30', 
    sonIslem: 'Müşteri reddetti.', 
    notVar: true,
    email: 'muhasebe@logosan.com',
    timeline: [
      { time: '28 Mar 11:30', title: 'Gönderildi', desc: 'Sadece Email ile iletildi.' },
      { time: '29 Mar 09:00', title: 'Okundu', desc: 'Müşteri mektubu görüntüledi.' },
      { time: '29 Mar 09:15', title: 'Reddedildi', desc: 'Müşteri kendi ekstresini yükleyip red verdi.' }
    ]
  },
  { 
    id: 3, 
    status: 'Hatalı', 
    unvan: 'Netsistem Donanım A.Ş.', 
    vkn: '9998887776', 
    tur: 'BS', 
    donem: '03-2026', 
    tutar: 95000, 
    paraBirimi: 'USD', 
    emailDurum: 'bounced', 
    smsDurum: 'none', 
    tarih: '29 Mar 2026 09:15', 
    sonIslem: 'E-Posta ulaşılamaz durumda (Hard Bounce).', 
    notVar: false,
    email: 'muhasebbe@netsistem.com',
    timeline: [
      { time: '29 Mar 09:15', title: 'Gönderim Denemesi', desc: 'SMTP sunucusuna iletildi.' },
      { time: '29 Mar 09:16', title: 'Hata (Bounced)', desc: 'Address not found: muhasebbe@netsistem.com' }
    ]
  },
  { 
    id: 4, 
    status: 'Okundu', 
    unvan: 'Mikro Teknoloji Ltd.', 
    vkn: '4445556667', 
    tur: 'Cari Bakiye', 
    donem: '03-2026', 
    tutar: -7500, 
    paraBirimi: 'EUR', 
    emailDurum: 'success', 
    smsDurum: 'success', 
    tarih: '29 Mar 2026 14:20', 
    sonIslem: 'Müşteri linke tıkladı, işlem bekleniyor.', 
    notVar: false,
    email: 'info@mikrotek.com',
    timeline: [
      { time: '29 Mar 14:20', title: 'Gönderildi', desc: 'Email ve SMS ile iletildi.' },
      { time: '29 Mar 14:25', title: 'Okundu', desc: 'Müşteri portalına giriş yaptı.' }
    ]
  },
  { 
    id: 5, 
    status: 'Bekliyor', 
    unvan: 'Zirve Müşavirlik Danışmanlık', 
    vkn: '1234567890', 
    tur: 'İhtarname', 
    donem: '03-2026', 
    tutar: 45000, 
    paraBirimi: 'TL', 
    emailDurum: 'success', 
    smsDurum: 'error', 
    tarih: '29 Mar 2026 16:00', 
    sonIslem: 'Henüz aksiyon alınmadı.', 
    notVar: false,
    email: 'bilgi@zirve.com',
    timeline: [
      { time: '29 Mar 16:00', title: 'Gönderildi', desc: 'E-Posta ulaştı, SMS GSM şebekesinden reddedildi.' }
    ]
  }
];
