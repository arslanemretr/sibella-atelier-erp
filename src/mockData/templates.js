export const templateData = [
  { 
    id: 'ID_101', 
    name: 'Standart Form BA Mektubu', 
    type: 'Email', 
    category: 'BA', 
    lang: 'TR', 
    subject: 'Form BA Mutabakat Talebi - {{DONEM}}',
    content: '<p>Sayın <strong>{{CARI_UNVAN}}</strong> Yetkilisi,</p><p>Kayıtlarımızın incelenmesi neticesinde, şirketimiz ile <strong>{{DONEM}}</strong> dönemine ait alım/satım işlemlerinize istinaden Bilanço Bakiyeniz <strong>{{BAKIYE_TUTAR}}</strong> olarak tespit edilmiştir.</p><p>Gerekli mutabakat işlemlerini sağlamak için lütfen aşağıdaki bağlantıyı kullanınız:</p><p style="text-align: center; margin: 30px 0;">{{MUTABAKAT_LINK}}</p><p>Saygılarımızla,</p>'
  },
  { 
    id: 'ID_301', 
    name: 'Kısa Hatırlatma (SMS)', 
    type: 'SMS', 
    category: 'Hatırlatma', 
    lang: 'TR', 
    subject: '',
    content: 'Sayin {{CARI_UNVAN}}, {{DONEM}} donemine ait mutabakat mektubunuz beklemededir. Bakiyeniz: {{BAKIYE_TUTAR}}. Yanitlamak icin tiklayin: {{MUTABAKAT_LINK}} B001'
  },
  { 
    id: 'ID_201', 
    name: 'Resmi Antetli İhtarname PDF', 
    type: 'PDF', 
    category: 'İhtarname', 
    lang: 'TR', 
    subject: '1. Seviye Vade Uyarısı',
    content: '<div style="text-align: right; color: #8c8c8c; font-size: 12px;">Tarih: 30.03.2026</div><h2 style="text-align: center;">HESAP MUTABAKAT VE İHTAR MEKTUBU</h2><p>Sayın <strong>{{CARI_UNVAN}}</strong>,</p><p>Vergi Kimlik Numaranız: <strong>{{VKN}}</strong></p><p>Finansal kayıtlarımıza göre, vadesi geçen borç bakiyeniz <strong>{{BAKIYE_TUTAR}}</strong> tutarına ulaşmıştır. Bu mektup kurumsal mutabakat ve yasal 1. seviye ihtar niteliği taşımaktadır.</p><p>Lütfen online onay için tıklayınız: {{MUTABAKAT_LINK}}</p><div style="margin-top: 50px;"><img src="https://via.placeholder.com/150x50.png?text=IsLAK+IMZA" alt="imza" /></div>'
  },
  { 
    id: 'ID_102', 
    name: 'Standard Form BS Account (İngilizce)', 
    type: 'Email', 
    category: 'BS', 
    lang: 'EN', 
    subject: 'BS Form Reconciliation Request - {{DONEM}}',
    content: '<p>Dear <strong>{{CARI_UNVAN}}</strong>,</p><p>According to our financial records for the period of <strong>{{DONEM}}</strong>, your outstanding balance is <strong>{{BAKIYE_TUTAR}}</strong>.</p><p>Please review and respond using the secure link below:</p><p style="text-align: center; margin: 30px 0;">{{MUTABAKAT_LINK}}</p><p>Best Regards,</p>'
  }
];
