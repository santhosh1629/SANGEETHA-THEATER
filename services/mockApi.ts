
import { createClient } from '@supabase/supabase-js';
import type { User, MenuItem, Order, OrderStatus, SalesSummary, Feedback, Offer, StudentProfile, Reward, StudentPoints, TodaysDashboardStats, TodaysDetailedReport, AdminStats, OwnerBankDetails, CanteenPhoto, CommissionRecord } from '../types';
import { Role as RoleEnum, OrderStatus as OrderStatusEnum } from '../types';

const SUPABASE_URL = 'https://hhaddkpolzczqnchmrjt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYWRka3BvbHpjenFuY2htcmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODY3ODMsImV4cCI6MjA4Mzg2Mjc4M30.K_2gLrTsXaHJY1qchu7lM7wscpdpg28XWMHth1tSHdk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- HELPER MAPPERS ---

const mapUser = (row: any): User => ({
    id: row.id,
    username: row.username,
    role: row.role as RoleEnum,
    phone: row.phone,
    email: row.email,
    canteenName: row.canteen_name,
    approvalStatus: row.approval_status,
    approvalDate: row.created_at, 
    idProofUrl: row.id_proof_url,
    loyaltyPoints: row.loyalty_points || 0
});

const mapMenuItem = (row: any, userFavorites: string[] = []): MenuItem => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    isAvailable: row.is_available,
    imageUrl: row.image_url,
    emoji: row.emoji,
    description: row.description,
    averageRating: row.average_rating ? Number(row.average_rating) : 0,
    favoriteCount: Number(row.favorite_count || 0),
    isFavorited: userFavorites.includes(row.id),
    isCombo: row.is_combo,
    comboItems: row.combo_items ? (typeof row.combo_items === 'string' ? JSON.parse(row.combo_items) : row.combo_items) : []
});

const mapOrder = (row: any): Order => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    customerPhone: row.customer_phone,
    totalAmount: Number(row.total_amount),
    status: row.status as OrderStatusEnum,
    payment_status: row.payment_status || (row.payment_success ? 'paid' : 'created'),
    qrToken: row.qr_token,
    seatNumber: row.seat_number,
    items: row.items ? (typeof row.items === 'string' ? JSON.parse(row.items) : row.items) : [],
    timestamp: new Date(row.created_at),
    paymentSuccess: row.payment_success || false,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
    deliveredByStaffId: row.delivered_by_staff_id,
    deliveredByStaffName: row.delivered_by_staff_name,
    orderType: 'real',
    couponCode: row.coupon_code || '', 
    discountAmount: Number(row.discount_amount || 0),
    preparedBy: row.prepared_by,
    preparedAt: row.prepared_at ? new Date(row.prepared_at) : undefined
});

const mapBankDetails = (row: any): OwnerBankDetails => ({
    accountNumber: row.account_number || '',
    bankName: row.bank_name || '',
    ifscCode: row.ifsc_code || '',
    upiId: row.upi_id || '',
    email: row.email || '',
    phone: row.phone || ''
});

const mapCommissionRecord = (row: any): CommissionRecord => ({
    id: row.id,
    month: row.month,
    ownerName: row.owner_name,
    ownerId: row.owner_id,
    totalIncome: Number(row.total_income),
    commissionAmount: Number(row.commission_amount),
    generatedAt: new Date(row.generated_at)
});

const handleSupabaseError = (error: any, context: string) => {
    let message = error?.message || "Database Connection Error";
    console.error(`[Supabase Error] ${context}:`, message);
    throw new Error(message);
};

// --- API FUNCTIONS ---

export const getMenu = async (studentId?: string): Promise<MenuItem[]> => {
    let userFavoriteIds: string[] = [];
    if (studentId) {
        const { data: favs } = await supabase.from('user_favorites').select('item_id').eq('user_id', studentId);
        if (favs) userFavoriteIds = favs.map(f => f.item_id);
    }
    const { data, error } = await supabase.from('menu_items').select('*').order('name');
    if (error) return [];
    return data.map(item => mapMenuItem(item, userFavoriteIds));
};

export const addMenuItem = async (item: any, ownerId: string): Promise<MenuItem> => {
    const dbPayload = {
        name: item.name,
        price: Number(item.price),
        is_available: !!item.isAvailable,
        image_url: item.imageUrl,
        emoji: item.emoji,
        description: item.description,
        is_combo: !!item.isCombo,
        combo_items: item.comboItems || [],
        owner_id: ownerId
    };

    const { data, error } = await supabase.from('menu_items').insert([dbPayload]).select().single();
    if (error) handleSupabaseError(error, "Menu Items Insert");
    return mapMenuItem(data);
};

export const updateMenuItem = async (itemId: string, item: any): Promise<MenuItem> => {
    const dbPayload = {
        name: item.name,
        price: Number(item.price),
        is_available: !!item.isAvailable,
        image_url: item.imageUrl,
        emoji: item.emoji,
        description: item.description,
        is_combo: !!item.isCombo,
        combo_items: item.comboItems || []
    };

    const { data, error } = await supabase.from('menu_items').update(dbPayload).eq('id', itemId).select().single();
    if (error) handleSupabaseError(error, "Menu Items Update");
    return mapMenuItem(data);
};

export const removeMenuItem = async (itemId: string): Promise<void> => {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (error) handleSupabaseError(error, "Menu Items Delete");
};

export const getOwnerOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatusEnum, staffId?: string, staffName?: string): Promise<void> => {
    const updates: any = { status };
    if (status === OrderStatusEnum.COLLECTED || status === OrderStatusEnum.DELIVERED) {
        updates.delivered_at = new Date().toISOString();
        if (staffId) updates.delivered_by_staff_id = staffId;
        if (staffName) updates.delivered_by_staff_name = staffName;
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Status Update");
};

export const updateOrderPaymentStatus = async (orderId: string, success: boolean): Promise<void> => {
    const updates = { payment_success: success, payment_status: success ? 'paid' : 'failed', status: success ? OrderStatusEnum.CONFIRMED : OrderStatusEnum.PENDING };
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Payment Update");
};

export const getOrderById = async (orderId: string): Promise<Order> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !data) throw new Error("Order not found.");
    return mapOrder(data);
};

export const placeOrder = async (order: any): Promise<Order> => {
    const { data, error } = await supabase.from('orders').insert([{ student_id: order.studentId, student_name: order.studentName, customer_phone: order.customerPhone, items: order.items, total_amount: order.totalAmount, status: order.status || OrderStatusEnum.PENDING, qr_token: `ORD-${Date.now()}`, seat_number: order.seat_number, payment_status: 'created', payment_success: false }]).select().single();
    if (error) handleSupabaseError(error, "Orders Insert");
    return mapOrder(data);
};

export const loginUserApi = async (phoneOrEmail: string, password: string): Promise<User> => {
    let { data, error } = await supabase.from('users').select('*').eq('phone', phoneOrEmail).eq('password', password).maybeSingle();
    if (error || !data) {
        const res = await supabase.from('users').select('*').eq('email', phoneOrEmail).eq('password', password).maybeSingle();
        data = res.data;
        error = res.error;
    }
    if (error || !data) throw new Error('Invalid credentials.');
    return mapUser(data);
};

export const registerUserApi = async (userData: any): Promise<User> => {
    const { data, error } = await supabase.from('users').insert([{
        username: userData.username,
        phone: userData.phone,
        password: userData.password,
        role: userData.role,
        email: userData.email,
        canteen_name: userData.canteen_name,
        id_proof_url: userData.id_proof_url,
        approval_status: userData.approval_status || 'approved'
    }]).select().single();
    if (error) handleSupabaseError(error, "Users Registration");
    return mapUser(data);
};

export const updateUserApi = async (userId: string, updates: Partial<User>) => {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) handleSupabaseError(error, "Users Update");
};

// --- FIX: Added implementation for missing member verifyQrCodeAndCollectOrder ---
/**
 * Verifies a QR token and marks the corresponding order as collected.
 * @param qrToken The token from the scanned QR code.
 * @param staffId The ID of the staff member performing the scan.
 */
export const verifyQrCodeAndCollectOrder = async (qrToken: string, staffId: string): Promise<Order> => {
    const { data: orderData, error: findError } = await supabase
        .from('orders')
        .select('*')
        .eq('qr_token', qrToken)
        .maybeSingle();
    
    if (findError || !orderData) {
        throw new Error("Invalid or expired QR code.");
    }

    const order = mapOrder(orderData);

    if (!order.paymentSuccess && order.payment_status !== 'paid') {
        throw new Error("Payment is pending for this order.");
    }

    if (order.status === OrderStatusEnum.COLLECTED || order.status === OrderStatusEnum.DELIVERED) {
        throw new Error("This order has already been collected.");
    }

    if (order.status === OrderStatusEnum.CANCELLED || order.status === OrderStatusEnum.REFUNDED) {
        throw new Error("This order was cancelled or refunded.");
    }

    // Get staff name for recording
    const { data: staffData } = await supabase
        .from('users')
        .select('username')
        .eq('id', staffId)
        .maybeSingle();
    
    const staffName = staffData?.username || 'Staff';

    // Update order status to collected
    await updateOrderStatus(order.id, OrderStatusEnum.COLLECTED, staffId, staffName);

    // Fetch and return fresh order state
    return await getOrderById(order.id);
};

export const getOwnerStatus = async () => ({ isOnline: true });
export const getStudentPointsList = async () => [];
export const getTodaysDashboardStats = async (): Promise<TodaysDashboardStats> => {
    const startToday = new Date(); startToday.setHours(0,0,0,0);
    const { data: orders } = await supabase.from('orders').select('*').eq('payment_status', 'paid').gte('created_at', startToday.toISOString());
    const totalIncome = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
    return { totalOrders: orders?.length || 0, totalIncome, itemsSold: [] };
};
export const getSalesSummary = async (): Promise<SalesSummary> => ({ daily: [], weekly: [] });
export const getMostSellingItems = async () => [];
export const getOrderStatusSummary = async () => [];
export const getStudentProfile = async (id: string): Promise<StudentProfile> => {
    const { data } = await supabase.from('users').select('*').eq('id', id).single();
    return { id, name: data.username, phone: data.phone, totalOrders: 0, lifetimeSpend: 0, favoriteItemsCount: 0, loyaltyPoints: data.loyalty_points };
};
export const getStudentOrders = async (studentId: string): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};
export const getFeedbacks = async (): Promise<Feedback[]> => {
    const { data } = await supabase.from('feedbacks').select('*, menu_items(name)').order('created_at', { ascending: false });
    return data?.map(fb => ({ id: fb.id, studentId: fb.student_id, studentName: fb.student_name, itemId: fb.item_id, itemName: fb.menu_items?.name || 'Unknown', rating: fb.rating, comment: fb.comment, timestamp: new Date(fb.created_at) })) || [];
};
export const submitFeedback = async (fb: any) => {
    await supabase.from('feedbacks').insert([{ student_id: fb.studentId, item_id: fb.itemId, rating: fb.rating, comment: fb.comment, student_name: fb.studentName || 'Anonymous' }]);
};
export const updateMenuAvailability = async (itemId: string, isAvailable: boolean) => {
    await supabase.from('menu_items').update({ is_available: isAvailable }).eq('id', itemId);
};
export const updateAllMenuItemsAvailability = async (ownerId: string, isAvailable: boolean) => {
    await supabase.from('menu_items').update({ is_available: isAvailable }).eq('owner_id', ownerId);
};

// --- FIX: Implementation for staff terminal management ---
export const getScanTerminalStaff = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', RoleEnum.CANTEEN_OWNER)
        .is('canteen_name', null);
    if (error) return [];
    return data.map(mapUser);
};

export const deleteScanTerminalStaff = async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) handleSupabaseError(error, "Staff Delete");
};

export const getSalesByDate = async (date: string): Promise<Order[]> => {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', OrderStatusEnum.COLLECTED)
        .gte('delivered_at', start.toISOString())
        .lte('delivered_at', end.toISOString());
    if (error) return [];
    return data.map(mapOrder);
};

export const getTodaysDetailedReport = async () => ({ date: '', totalOrders: 0, totalIncome: 0, itemSales: [] });

export const getMenuItemById = async (id: string, sId?: string) => {
    const { data } = await supabase.from('menu_items').select('*').eq('id', id).single();
    return data ? mapMenuItem(data) : null;
};
export const toggleFavoriteItem = async (sId: string, iId: string) => {};
export const createRazorpayOrderApi = async (a: number, sId: string) => ({ id: 'rzp_test_123', amount: a, currency: 'INR' });
export const verifyRazorpayPaymentApi = async (oId: string, resp: any) => true;
export const createPaymentRecord = async (p: any) => {};
export const updateOrderSeatNumber = async (oId: string, s: string) => {
    await supabase.from('orders').update({ seat_number: s }).eq('id', oId);
};
export const getAdminMonthlySalesReport = async (m: string) => ({ summary: { total_sales: 0, total_orders: 0 }, breakdown: [] });
export const getUsers = async () => [];
export const getAdminDashboardStats = async () => ({ totalUsers: 0, totalCustomers: 0, totalOwners: 0, pendingApprovals: 0, totalFeedbacks: 0 });
export const getPendingOwnerRequests = async () => [];
export const getApprovedOwners = async () => [];
export const getRejectedOwners = async () => [];
export const updateOwnerApprovalStatus = async (id: string, s: any) => {};
export const removeOwnerAccount = async (id: string) => {};

// --- FIX: Implementation for staff order processing ---
export const getStaffUnclaimedPendingOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', [OrderStatusEnum.CONFIRMED, OrderStatusEnum.SEAT_SELECTED])
        .is('prepared_by', null)
        .order('created_at', { ascending: true });
    if (error) return [];
    return data.map(mapOrder);
};

export const getStaffMyPreparedOrders = async (id: string): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', OrderStatusEnum.PREPARED)
        .eq('prepared_by', id)
        .order('prepared_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const markOrderAsPrepared = async (oId: string, sId: string) => {
    const { error } = await supabase
        .from('orders')
        .update({ 
            status: OrderStatusEnum.PREPARED, 
            prepared_by: sId,
            prepared_at: new Date().toISOString()
        })
        .eq('id', oId);
    if (error) handleSupabaseError(error, "Mark Prepared");
};

export const getOwnerBankDetails = async (id: string) => ({ accountNumber: '', bankName: '', ifscCode: '', upiId: '', email: '', phone: '' });
export const requestSaveBankDetailsOtp = async (d: any) => ({ success: true });
export const verifyOtpAndSaveBankDetails = async (d: any, o: string, id: string) => d;
export const getCanteenPhotos = async () => [];
export const addCanteenPhoto = async (f: File) => ({ id: '', data: '', uploadedAt: new Date() });
export const deleteCanteenPhoto = async (id: string) => {};
export const updateCanteenPhoto = async (id: string, f: File) => ({ id: '', data: '', uploadedAt: new Date() });
export const getOwnerCommissions = async (id: string) => [];
export const getAllCommissions = async () => [];
export const generateMonthlyCommissions = async () => ({ success: true });

// --- FIX: Added implementation for popularity stats ---
export const getFoodPopularityStats = async (): Promise<MenuItem[]> => {
    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('favorite_count', { ascending: false });
    if (error) return [];
    return data.map(item => mapMenuItem(item));
};

export const getAllOffersForOwner = async () => [];
export const createOffer = async (o: any) => o;
export const updateOffer = async (id: string, o: any) => {};
export const deleteOffer = async (id: string) => {};
export const getAllStudentCoupons = async (id: string) => [];
export const getAllRewardsForOwner = async () => [];
export const createReward = async (r: any) => r;
export const updateReward = async (id: string, r: any) => {};
export const deleteReward = async (id: string) => {};
export const redeemReward = async (sId: string, rId: string) => ({ code: 'REDEEMED' });
