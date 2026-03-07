
export enum Role {
  STUDENT = 'STUDENT',
  CANTEEN_OWNER = 'CANTEEN_OWNER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  username: string;
  role: Role;
  phone?: string;
  password?: string;
  email?: string;
  profileImageUrl?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalDate?: string;
  isFirstLogin?: boolean;
  resetOtp?: string;
  resetOtpExpires?: Date;
  canteenName?: string;
  idProofUrl?: string;
  loyaltyPoints?: number;
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free';

export interface MenuItem {
  id:string;
  name: string;
  price: number;
  isAvailable: boolean;
  imageUrl: string;
  description?: string;
  emoji?: string;
  averageRating?: number;
  favoriteCount?: number;
  isFavorited?: boolean;
  dietaryTags?: DietaryTag[];
  nutrition?: {
    calories: number;
    protein: string;
    fat: string;
    carbs: string;
  };
  isCombo?: boolean;
  comboItems?: { id: string; name: string }[];
  isDemo?: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

export enum OrderStatus {
  INITIATED = 'INITIATED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  NEW = 'NEW',
  QR_GENERATED = 'NEW',
  PREPARING = 'PREPARING',
  READY = 'READY',
  PREPARED = 'PREPARED',
  DELIVERED = 'DELIVERED',
  COLLECTED = 'COLLECTED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  SEAT_SELECTED = 'SEAT_SELECTED',
}

export interface Order {
  id: string;
  studentId: string;
  studentName: string;
  customerPhone?: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    imageUrl: string;
  }[];
  totalAmount: number;
  status: OrderStatus;
  payment_status: 'paid' | 'pending' | 'failed' | 'created';
  qrToken: string;
  timestamp: Date;
  paymentSuccess: boolean;
  deliveredByStaffId?: string;
  deliveredByStaffName?: string;
  deliveredAt?: Date;
  orderType: 'real';
  canteenOwnerPhone?: string;
  refundAmount?: number;
  seatNumber?: string;
  couponCode?: string;
  discountAmount?: number;
  preparedBy?: string;
  prepared_by_id?: string;
  preparedByName?: string;
  prepared_by_name?: string;
  preparedAt?: Date;
}

export interface SalesSummary {
    daily: { date: string; total: number }[];
    weekly: { week: string; total: number }[];
}

export interface Feedback {
    id: string;
    studentId: string;
    studentName: string;
    itemId: string;
    itemName: string;
    rating: number;
    comment?: string;
    timestamp: Date;
}

export interface StudentProfile {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  lifetimeSpend: number;
  favoriteItemsCount: number;
  loyaltyPoints?: number;
}

export interface Offer {
  id: string;
  code: string;
  description: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  isUsed: boolean;
  studentId?: string;
  isReward: boolean;
  isActive: boolean;
  usageCount: number;
  redeemedCount: number;
}

export interface Reward {
    id: string;
    title: string;
    description: string;
    pointsCost: number;
    discount: {
        type: 'fixed' | 'percentage';
        value: number;
    };
    isActive: boolean;
    expiryDate?: string;
}

export interface StudentPoints {
    studentId: string;
    studentName: string;
    points: number;
}

export interface TodaysDashboardStats {
  totalOrders: number;
  totalIncome: number;
  itemsSold: { name: string; quantity: number }[];
}

export interface TodaysDetailedReport {
  date: string;
  totalOrders: number;
  totalIncome: number;
  itemSales: {
    name: string;
    quantity: number;
    totalPrice: number;
  }[];
}

export interface OwnerBankDetails {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    upiId?: string;
    email: string;
    phone: string;
}

export interface CanteenPhoto {
    id: string;
    data: string;
    uploadedAt: Date;
}

export interface AdminStats {
  totalUsers: number;
  totalCustomers: number;
  totalOwners: number;
  pendingApprovals: number;
  totalFeedbacks: number;
}

export interface CommissionRecord {
    id: string;
    month: string;
    ownerName: string;
    ownerId: string;
    totalIncome: number;
    commissionAmount: number;
    generatedAt: Date;
}
