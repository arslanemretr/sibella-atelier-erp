export const usersData = [
  { 
    id: 1, 
    name: 'Emre Arslan', 
    email: 'admin@bilisim.com', 
    role: 'Yönetici', 
    sube: ['Tümü'], 
    durum: true, 
    lastLogin: '30 Mar 2026 00:15',
    avatar: 'https://i.pravatar.cc/150?u=1'
  },
  { 
    id: 2, 
    name: 'Ayşe Kaya', 
    email: 'muhasebe@bilisim.com', 
    role: 'Operatör', 
    sube: ['İstanbul Şube'], 
    durum: true, 
    lastLogin: '29 Mar 2026 14:30',
    avatar: 'https://i.pravatar.cc/150?u=2'
  },
  { 
    id: 3, 
    name: 'Mehmet Demir', 
    email: 'finans@bilisim.com', 
    role: 'Operatör', 
    sube: ['Ankara Şube'], 
    durum: true, 
    lastLogin: '28 Mar 2026 09:15',
    avatar: 'https://i.pravatar.cc/150?u=3'
  },
  { 
    id: 4, 
    name: 'Denetçi Rapor', 
    email: 'denetim@bilisim.com', 
    role: 'İzleyici', 
    sube: ['Tümü'], 
    durum: false, 
    lastLogin: '01 Mar 2026 10:00',
    avatar: null
  }
];

export const auditLogs = [
  { id: 1, action: 'Sisteme Giriş (Login)', user: 'Emre Arslan', time: '30 Mar 2026 00:15', ip: '192.168.1.5', status: 'Başarılı' },
  { id: 2, action: 'Cari Email Güncelleme', user: 'Ayşe Kaya', time: '29 Mar 2026 16:20', ip: '192.168.1.12', status: 'Başarılı' },
  { id: 3, action: 'Sisteme Giriş (Login)', user: 'Bilinmeyen (Hatalı Şifre)', time: '29 Mar 2026 14:05', ip: '88.243.15.11', status: 'Reddedildi' },
  { id: 4, action: 'Manuel Mutabakat Onayı', user: 'Mehmet Demir', time: '28 Mar 2026 11:30', ip: '192.168.2.14', status: 'Başarılı' },
  { id: 5, action: 'Admin Paneli Erişimi', user: 'Emre Arslan', time: '28 Mar 2026 10:00', ip: '192.168.1.5', status: 'Başarılı' },
];
