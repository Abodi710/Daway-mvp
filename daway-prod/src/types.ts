/**
 * تعريفات الأنواع المشتركة لتطبيق دواي
 * Shared TypeScript definitions for the Daway pharmacy platform.
 */

/* ------------------------------------------------------------------ */
/* Users & roles                                                       */
/* ------------------------------------------------------------------ */

export type UserRole = 'patient' | 'pharmacy' | 'supplier' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  /** معرّف صاحب الصيدلية للموظفين التابعين له */
  ownerId?: number | null;
  pharmacyId?: number | null;
  city?: string;
  state?: string;
  isActive?: boolean;
  createdAt?: string;
}

/* ------------------------------------------------------------------ */
/* Medicines                                                           */
/* ------------------------------------------------------------------ */

export type MedicineCategory =
  | 'مسكنات'
  | 'مضادات حيوية'
  | 'أدوية القلب والضغط'
  | 'أدوية السكري'
  | 'أدوية الجهاز التنفسي'
  | 'أدوية الجهاز الهضمي'
  | 'فيتامينات ومكملات'
  | 'مستحضرات جلدية'
  | 'أدوية العيون'
  | 'مستلزمات طبية';

export type MedicineForm =
  | 'أقراص'
  | 'كبسولات'
  | 'شراب'
  | 'حقن'
  | 'مرهم'
  | 'قطرة'
  | 'بخاخ'
  | 'تحاميل';

export interface Medicine {
  id: number;
  name: string;
  /** الاسم العلمي / المادة الفعالة */
  genericName: string;
  price: number;
  category: MedicineCategory | string;
  /** الكمية المتوفرة في المخزون */
  stock: number;
  /** تاريخ انتهاء الصلاحية بصيغة ISO (YYYY-MM-DD) */
  expiryDate: string;
  pharmacyId?: number;
  pharmacyName: string;
  manufacturer?: string;
  form?: MedicineForm | string;
  strength?: string;
  barcode?: string;
  batchNumber?: string;
  /** يحتاج وصفة طبية */
  requiresPrescription?: boolean;
  description?: string;
  imageUrl?: string;
  /** حد إعادة الطلب لتنبيهات المخزون المنخفض */
  reorderLevel?: number;
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Pharmacies                                                          */
/* ------------------------------------------------------------------ */

export type PharmacyStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Pharmacy {
  id: number;
  name: string;
  /** الولاية */
  state: string;
  /** المدينة / المحلية */
  city: string;
  status: PharmacyStatus;
  phone: string;
  licenseNumber: string;
  ownerId?: number;
  ownerName?: string;
  email?: string;
  address?: string;
  /** ساعات العمل، مثال: "8:00 ص - 10:00 م" */
  workingHours?: string;
  isOpen24h?: boolean;
  hasDelivery?: boolean;
  rating?: number;
  reviewsCount?: number;
  latitude?: number;
  longitude?: number;
  /** سبب الرفض إن كانت الحالة rejected */
  rejectionReason?: string | null;
  registeredAt?: string;
}

/* ------------------------------------------------------------------ */
/* Cart & customer orders                                              */
/* ------------------------------------------------------------------ */

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export interface OrderItem {
  medicineId: number;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  /** unitPrice * quantity */
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'card' | 'bankak' | 'mobile_wallet';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: number;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  /** تاريخ الطلب بصيغة ISO */
  date: string;
  customerId?: number;
  customerPhone?: string;
  pharmacyId?: number;
  pharmacyName?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Supplier orders                                                     */
/* ------------------------------------------------------------------ */

export type SupplierOrderStatus =
  | 'pending'
  | 'approved'
  | 'shipped'
  | 'received'
  | 'rejected'
  | 'cancelled';

export interface SupplierOrder {
  id: number;
  supplierName: string;
  medicineName: string;
  quantity: number;
  status: SupplierOrderStatus;
  /** تاريخ إنشاء أمر التوريد بصيغة ISO */
  date: string;
  supplierId?: number;
  pharmacyId?: number;
  pharmacyName?: string;
  unitPrice?: number;
  totalAmount?: number;
  expectedDeliveryDate?: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'sale'
  | 'stock_adjust'
  | 'password_change';

export interface AuditLog {
  id: number;
  action: AuditAction | string;
  /** اسم أو بريد المستخدم الذي نفّذ الإجراء */
  user: string;
  /** الطابع الزمني بصيغة ISO */
  timestamp: string;
  details: string;
  userId?: number;
  role?: UserRole;
  /** نوع الكيان المتأثر، مثال: "medicine" | "pharmacy" | "order" */
  entityType?: string;
  entityId?: number | string;
  ipAddress?: string;
}

/* ------------------------------------------------------------------ */
/* Geography                                                           */
/* ------------------------------------------------------------------ */

export interface SudaneseState {
  id: number;
  /** اسم الولاية بالعربية */
  name: string;
  nameEn: string;
  /** المدن والمحليات التابعة */
  cities: string[];
}
