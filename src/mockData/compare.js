export const compareData = [
  { 
    id: 1, 
    ourDate: '01.03.2026', 
    ourDoc: 'FT-123', 
    ourAmount: 1500.00, 
    status: 'match', 
    theirDate: '01.03.2026', 
    theirDoc: 'FT-123', 
    theirAmount: 1500.00,
    diff: 0
  },
  { 
    id: 2, 
    ourDate: '05.03.2026', 
    ourDoc: 'FT-125', 
    ourAmount: 2000.00, 
    status: 'partial', 
    theirDate: '05.03.2026', 
    theirDoc: 'FT-125', 
    theirAmount: 1950.00,
    diff: 50
  },
  { 
    id: 3, 
    ourDate: '10.03.2026', 
    ourDoc: 'FT-130', 
    ourAmount: 3400.00, 
    status: 'missing_theirs', 
    theirDate: '-', 
    theirDoc: '-', 
    theirAmount: null,
    diff: 3400
  },
  { 
    id: 4, 
    ourDate: '-', 
    ourDoc: '-', 
    ourAmount: null, 
    status: 'missing_ours', 
    theirDate: '12.03.2026', 
    theirDoc: 'ÖDM-44', 
    theirAmount: 1000.00,
    diff: 1000
  },
  { 
    id: 5, 
    ourDate: '15.03.2026', 
    ourDoc: 'FT-140', 
    ourAmount: 5000.00, 
    status: 'match', 
    theirDate: '16.03.2026', // Tarih toleransı
    theirDoc: 'FT-140', 
    theirAmount: 5000.00,
    diff: 0
  },
  { 
    id: 6, 
    ourDate: '20.03.2026', 
    ourDoc: 'IAD-05', 
    ourAmount: -450.00, 
    status: 'missing_theirs', 
    theirDate: '-', 
    theirDoc: '-', 
    theirAmount: null,
    diff: -450
  }
];
