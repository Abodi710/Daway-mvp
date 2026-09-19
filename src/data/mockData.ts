/**
 * بيانات تجريبية مصغّرة لتطبيق دواي
 * Minimal mock dataset for the Daway pharmacy platform.
 */

import type {
  AuditLog,
  Medicine,
  Order,
  Pharmacy,
  SudaneseState,
} from '../types';

/* الولايات والمدن الرئيسية */
export const mockStates: SudaneseState[] = [
  {
    id: 1,
    name: 'الخرطوم',
    nameEn: 'Khartoum',
    cities: ['الخرطوم', 'أم درمان', 'الخرطوم بحري'],
  },
  {
    id: 2,
    name: 'الجزيرة',
    nameEn: 'Al Jazirah',
    cities: ['ودمدني', 'الحصاحيصا', 'المناقل'],
  },
];

/* الصيدليات المسجّلة */
export const mockPharmacies: Pharmacy[] = [
  {
    id: 1,
    name: 'صيدلية النيل',
    state: 'الخرطوم',
    city: 'الخرطوم',
    status: 'approved',
    phone: '+249 91 234 5678',
    licenseNumber: 'KRT-2024-001',
    ownerId: 11,
    ownerName: 'أحمد عبد الله',
    address: 'شارع الجمهورية، الخرطوم',
    workingHours: '8:00 ص - 10:00 م',
    hasDelivery: true,
    rating: 4.5,
    registeredAt: '2026-01-15',
  },
  {
    id: 2,
    name: 'صيدلية الشفاء',
    state: 'الجزيرة',
    city: 'ودمدني',
    status: 'pending',
    phone: '+249 92 876 5432',
    licenseNumber: 'GZR-2026-014',
    ownerId: 12,
    ownerName: 'فاطمة الطيب',
    address: 'شارع المستشفى، ودمدني',
    hasDelivery: false,
    registeredAt: '2026-07-02',
  },
];

/* كتالوج الأدوية */
export const mockMedicines: Medicine[] = [
  {
    id: 1,
    name: 'بنادول 500 مجم',
    genericName: 'باراسيتامول',
    price: 350,
    category: 'مسكنات',
    stock: 120,
    expiryDate: '2027-06-30',
    pharmacyId: 1,
    pharmacyName: 'صيدلية النيل',
    form: 'أقراص',
    strength: '500 مجم',
    requiresPrescription: false,
    reorderLevel: 20,
  },
  {
    id: 2,
    name: 'أموكسيل 250 مجم',
    genericName: 'أموكسيسيلين',
    price: 1200,
    category: 'مضادات حيوية',
    stock: 45,
    expiryDate: '2027-03-31',
    pharmacyId: 1,
    pharmacyName: 'صيدلية النيل',
    form: 'كبسولات',
    strength: '250 مجم',
    requiresPrescription: true,
    reorderLevel: 15,
  },
  {
    id: 3,
    name: 'جلوكوفاج 850 مجم',
    genericName: 'ميتفورمين',
    price: 800,
    category: 'أدوية السكري',
    stock: 8,
    expiryDate: '2026-12-31',
    pharmacyId: 2,
    pharmacyName: 'صيدلية الشفاء',
    form: 'أقراص',
    strength: '850 مجم',
    requiresPrescription: true,
    reorderLevel: 10,
  },
];

/* طلبات تجريبية */
export const mockOrders: Order[] = [
  {
    id: 1001,
    customerName: 'محمد إبراهيم',
    items: [
      { medicineId: 1, medicineName: 'بنادول 500 مجم', quantity: 2, unitPrice: 350, subtotal: 700 },
      { medicineId: 2, medicineName: 'أموكسيل 250 مجم', quantity: 1, unitPrice: 1200, subtotal: 1200 },
    ],
    totalAmount: 1900,
    paymentMethod: 'cash',
    status: 'delivered',
    date: '2026-08-10',
    customerId: 21,
    customerPhone: '+249 99 111 2233',
    pharmacyId: 1,
    pharmacyName: 'صيدلية النيل',
    deliveryAddress: 'الرياض، الخرطوم',
  },
  {
    id: 1002,
    customerName: 'سارة عثمان',
    items: [
      { medicineId: 3, medicineName: 'جلوكوفاج 850 مجم', quantity: 3, unitPrice: 800, subtotal: 2400 },
    ],
    totalAmount: 2400,
    paymentMethod: 'bankak',
    status: 'preparing',
    date: '2026-08-16',
    customerId: 22,
    customerPhone: '+249 91 444 5566',
    pharmacyId: 2,
    pharmacyName: 'صيدلية الشفاء',
    deliveryAddress: 'حي الدرجة الأولى، ودمدني',
  },
];

/* سجل التدقيق */
export const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    action: 'approve',
    user: 'admin@daway.sd',
    timestamp: '2026-01-15T09:20:00Z',
    details: 'تمت الموافقة على تسجيل صيدلية النيل',
    userId: 1,
    role: 'admin',
    entityType: 'pharmacy',
    entityId: 1,
  },
  {
    id: 2,
    action: 'sale',
    user: 'ahmed@alnil.sd',
    timestamp: '2026-08-10T14:05:00Z',
    details: 'تم تسليم الطلب رقم 1001 بمبلغ 1900',
    userId: 11,
    role: 'pharmacy',
    entityType: 'order',
    entityId: 1001,
  },
];
