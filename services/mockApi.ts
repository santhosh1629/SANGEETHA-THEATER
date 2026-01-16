
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

// Added mapper for bank details
const mapBankDetails = (row: any): OwnerBankDetails => ({
    accountNumber: row.account_number || '',
    bankName: row.bank_name || '',
    ifscCode: row.ifsc_code || '',
    upiId: row.upi_id || '',
    email: row.email || '',
    phone: row.phone || ''
});

// Added mapper for commission records
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

// --- SALES REPORTING APIS ---

export const getAdminMonthlySalesReport = async (monthKey: string) => {
    const { data: monthlyData, error: mError } = await supabase
        .from('monthly_sales')
        .select('month_key, total_sales, total_orders')
        .eq('month_key', monthKey)
        .maybeSingle();

    if (mError) handleSupabaseError(mError, "Fetch Monthly Sales");

    const { data: dailyData, error: dError } = await supabase
        .from('daily_sales')
        .select('date_key, month_key, daily_total, daily_orders')
        .eq('month_key', monthKey)
        .order('date_key', { ascending: false });

    if (dError) handleSupabaseError(dError, "Fetch Daily Sales");

    return {
        summary: monthlyData || { total_sales: 0, total_orders: 0 },
        breakdown: dailyData || []
    };
};

// --- ANALYTICS & STATS ---

export const getTodaysDashboardStats = async (): Promise<TodaysDashboardStats> => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    const { data } = await supabase
        .from('daily_sales')
        .select('daily_total, daily_orders')
        .eq('date_key', today)
        .maybeSingle();

    const startToday = new Date();
    startToday.setHours(0,0,0,0);
    const { data: orders } = await supabase
        .from('orders')
        .select('items')
        .eq('payment_status', 'paid')
        .gte('created_at', startToday.toISOString());

    const itemAggregates = new Map<string, number>();
    orders?.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : []);
        items.forEach((item: any) => {
            itemAggregates.set(item.name, (itemAggregates.get(item.name) || 0) + item.quantity);
        });
    });

    return {
        totalOrders: data?.daily_orders || 0,
        totalIncome: data?.daily_total || 0,
        itemsSold: Array.from(itemAggregates.entries()).map(([name, quantity]) => ({ name, quantity }))
    };
};

export const getSalesSummary = async (): Promise<SalesSummary> => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data } = await supabase
        .from('daily_sales')
        .select('date_key, daily_total')
        .gte('date_key', fourteenDaysAgo.toISOString().split('T')[0])
        .order('date_key', { ascending: true });

    const daily = (data || []).map(d => ({
        date: new Date(d.date_key).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        total: Number(d.daily_total)
    }));

    const { data: mData } = await supabase.from('monthly_sales').select('month_key, total_sales').limit(4).order('month_key', { ascending: false });
    const weekly = (mData || []).reverse().map(m => ({ week: m.month_key, total: Number(m.total_sales) }));

    return { daily, weekly };
};

// --- AUTH & OTHER APIS ---

export const loginUserApi = async (phoneOrEmail: string, password: string): Promise<User> => {
    let { data, error } = await supabase.from('users').select('id, username, role, phone, email, canteen_name, approval_status, created_at, loyalty_points').eq('phone', phoneOrEmail).eq('password', password).maybeSingle();
    if (error || !data) {
        const res = await supabase.from('users').select('id, username, role, phone, email, canteen_name, approval_status, created_at, loyalty_points').eq('email', phoneOrEmail).eq('password', password).maybeSingle();
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

export const getMenu = async (studentId?: string): Promise<MenuItem[]> => {
    let userFavoriteIds: string[] = [];
    if (studentId) {
        const { data: favs } = await supabase.from('user_favorites').select('item_id').eq('user_id', studentId);
        if (favs) userFavoriteIds = favs.map(f => f.item_id);
    }
    const { data, error } = await supabase.from('menu_items').select('id, name, price, is_available, image_url, emoji, description, average_rating, favorite_count, is_combo, combo_items').order('name');
    if (error) return [];
    return data.map(item => mapMenuItem(item, userFavoriteIds));
};

export const getMenuItemById = async (itemId: string, studentId?: string): Promise<MenuItem | null> => {
    let isFavorited = false;
    if (studentId) {
        const { data: fav } = await supabase.from('user_favorites').select('id').eq('user_id', studentId).eq('item_id', itemId).maybeSingle();
        isFavorited = !!fav;
    }
    const { data, error } = await supabase.from('menu_items').select('id, name, price, is_available, image_url, emoji, description, average_rating, favorite_count, is_combo, combo_items').eq('id', itemId).maybeSingle();
    if (error || !data) return null;
    return mapMenuItem(data, isFavorited ? [itemId] : []);
};

export const toggleFavoriteItem = async (studentId: string, itemId: string): Promise<void> => {
    const { data: existingFav } = await supabase.from('user_favorites').select('id').eq('user_id', studentId).eq('item_id', itemId).maybeSingle();
    const { data: itemData } = await supabase.from('menu_items').select('favorite_count').eq('id', itemId).single();
    const currentCount = itemData?.favorite_count || 0;
    if (existingFav) {
        await supabase.from('user_favorites').delete().eq('id', existingFav.id);
        await supabase.from('menu_items').update({ favorite_count: Math.max(0, currentCount - 1) }).eq('id', itemId);
    } else {
        await supabase.from('user_favorites').insert([{ user_id: studentId, item_id: itemId }]);
        await supabase.from('menu_items').update({ favorite_count: currentCount + 1 }).eq('id', itemId);
    }
};

export const createRazorpayOrderApi = async (amount: number, studentId: string) => {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', { body: { amount: Math.round(amount * 100), studentId } });
    if (error) throw new Error(error.message || "Failed to create payment order.");
    return data;
};

export const verifyRazorpayPaymentApi = async (orderId: string, razorpayResponse: any) => {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', { body: { razorpay_order_id: razorpayResponse.razorpay_order_id, razorpay_payment_id: razorpayResponse.razorpay_payment_id, razorpay_signature: razorpayResponse.razorpay_signature } });
    if (error) throw new Error("Payment verification failed.");
    return data.verified === true;
};

export const placeOrder = async (order: any): Promise<Order> => {
    const { data, error } = await supabase.from('orders').insert([{ student_id: order.studentId, student_name: order.studentName, customer_phone: order.customerPhone, items: order.items, total_amount: order.totalAmount, status: order.status || OrderStatusEnum.PENDING, qr_token: `ORD-${Date.now()}`, seat_number: order.seat_number, payment_status: 'created', payment_success: false }]).select().single();
    if (error) handleSupabaseError(error, "Orders Insert");
    return mapOrder(data);
};

export const updateOrderPaymentStatus = async (orderId: string, success: boolean): Promise<void> => {
    const updates = { payment_success: success, payment_status: success ? 'paid' : 'failed', status: success ? OrderStatusEnum.CONFIRMED : OrderStatusEnum.PENDING };
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Payment Update");
};

export const getStudentOrders = async (studentId: string): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('id, student_id, student_name, customer_phone, total_amount, status, payment_status, qr_token, seat_number, items, created_at, payment_success, delivered_at, delivered_by_staff_id, delivered_by_staff_name').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const getOrderById = async (orderId: string): Promise<Order> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !data) throw new Error("Order not found.");
    return mapOrder(data);
};

export const getMostSellingItems = async () => {
    const { data } = await supabase.from('orders').select('items').eq('payment_status', 'paid');
    if (!data) return [];
    const map = new Map<string, number>();
    data.forEach(o => {
        const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items) : []);
        items.forEach((i: any) => map.set(i.name, (map.get(i.name) || 0) + i.quantity));
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);
};

export const getOrderStatusSummary = async () => {
    const { data } = await supabase.from('orders').select('status');
    if (!data) return [];
    const counts: any = {};
    data.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
    return Object.entries(counts).map(([name, value]) => ({ name, value: value as number }));
};

export const getStaffUnclaimedPendingOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('id, student_name, total_amount, items, created_at, seat_number, status, payment_status').eq('payment_status', 'paid').in('status', [OrderStatusEnum.CONFIRMED, OrderStatusEnum.PENDING]).is('prepared_by', null).order('created_at', { ascending: true });
    if (error) return [];
    return data.map(mapOrder);
};

export const getStaffMyPreparedOrders = async (staffId: string): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('id, student_name, items, prepared_at, seat_number, status, payment_status').eq('payment_status', 'paid').eq('status', OrderStatusEnum.PREPARED).eq('prepared_by', staffId).order('prepared_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const markOrderAsPrepared = async (orderId: string, staffId: string): Promise<void> => {
    const { error } = await supabase.from('orders').update({ status: OrderStatusEnum.PREPARED, prepared_by: staffId, prepared_at: new Date().toISOString() }).eq('id', orderId).is('prepared_by', null);
    if (error) handleSupabaseError(error, "Mark Prepared");
};

export const getOwnerOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('id, student_name, customer_phone, total_amount, status, seat_number, items, created_at, payment_status, coupon_code, discount_amount').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const getSalesByDate = async (date: string): Promise<Order[]> => {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const { data, error } = await supabase.from('orders').select('id, student_name, total_amount, delivered_at').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).eq('payment_status', 'paid');
    if (error) return [];
    return data.map(mapOrder);
};

export const getOwnerStatus = async () => ({ isOnline: true });
export const getStudentPointsList = async () => [];
export const getTodaysDetailedReport = async () => {
    const stats = await getTodaysDashboardStats();
    return { date: new Date().toLocaleDateString(), totalOrders: stats.totalOrders, totalIncome: stats.totalIncome, itemSales: stats.itemsSold.map(i => ({ ...i, totalPrice: 0 })) };
};
export const getFoodPopularityStats = async () => getMenu();
export const getAllOffersForOwner = async () => [];
export const createOffer = async (o: any) => ({ ...o, id: '1' });
export const updateOffer = async (id: string, u: any) => {};
export const deleteOffer = async (id: string) => {};
export const getAllStudentCoupons = async (id: string) => [];
export const getAllRewardsForOwner = async () => [];
export const createReward = async (r: any) => ({ ...r, id: '1' });
export const updateReward = async (id: string, u: any) => {};
export const deleteReward = async (id: string) => {};
export const redeemReward = async (s: string, r: string) => ({ id: '1', code: 'X' } as any);

export const addMenuItem = async (item: any, ownerId: string): Promise<MenuItem> => {
    const { data, error } = await supabase.from('menu_items').insert([{ name: item.name, price: Number(item.price), is_available: item.isAvailable, image_url: item.imageUrl, emoji: item.emoji, description: item.description, is_combo: !!item.isCombo, combo_items: item.comboItems || [], owner_id: ownerId }]).select().single();
    if (error) handleSupabaseError(error, "Menu Items Insert");
    return mapMenuItem(data);
};

export const updateMenuItem = async (itemId: string, item: any): Promise<MenuItem> => {
    const { data, error } = await supabase.from('menu_items').update(item).eq('id', itemId).select().single();
    if (error) handleSupabaseError(error, "Menu Items Update");
    return mapMenuItem(data);
};

export const removeMenuItem = async (itemId: string): Promise<void> => {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (error) handleSupabaseError(error, "Menu Items Delete");
};

export const updateMenuAvailability = async (itemId: string, isAvailable: boolean): Promise<void> => {
    const { error } = await supabase.from('menu_items').update({ is_available: isAvailable }).eq('id', itemId);
    if (error) handleSupabaseError(error, "Menu Availability Update");
};

export const updateAllMenuItemsAvailability = async (ownerId: string, isAvailable: boolean): Promise<void> => {
    const { error } = await supabase.from('menu_items').update({ is_available: isAvailable }).eq('owner_id', ownerId);
    if (error) handleSupabaseError(error, "All Menu Items Availability Update");
};

export const submitFeedback = async (feedback: any): Promise<void> => {
    const { error } = await supabase.from('feedbacks').insert([{ student_id: feedback.studentId, item_id: feedback.itemId, rating: feedback.rating, comment: feedback.comment, student_name: feedback.studentName || 'Anonymous' }]);
    if (error) handleSupabaseError(error, "Feedback Insert");
};

export const getFeedbacks = async (): Promise<Feedback[]> => {
    const { data, error } = await supabase.from('feedbacks').select('id, student_id, student_name, item_id, rating, comment, created_at, menu_items(name)').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(fb => ({ id: fb.id, studentId: fb.student_id, studentName: fb.student_name, itemId: fb.item_id, itemName: fb.menu_items?.name || 'Unknown Item', rating: fb.rating, comment: fb.comment, timestamp: new Date(fb.created_at) }));
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

export const updateOrderSeatNumber = async (orderId: string, seatNumber: string): Promise<void> => {
    const { error } = await supabase.from('orders').update({ seat_number: seatNumber }).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Seat Update");
};

export const getScanTerminalStaff = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('id, username, phone, role').eq('role', RoleEnum.CANTEEN_OWNER).is('canteen_name', null);
    if (error) return [];
    return data.map(mapUser);
};

export const deleteScanTerminalStaff = async (userId: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) handleSupabaseError(error, "Staff Delete");
};

export const getStaffActiveOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('id, student_name, items, status, payment_status, created_at').in('status', [OrderStatusEnum.CONFIRMED, OrderStatusEnum.PREPARED, OrderStatusEnum.PENDING]).eq('payment_status', 'paid').order('created_at', { ascending: true });
    if (error) return [];
    return data.map(mapOrder);
};

export const verifyQrCodeAndCollectOrder = async (qrToken: string, staffId: string): Promise<Order> => {
    const { data, error } = await supabase.from('orders').select('*').eq('qr_token', qrToken).maybeSingle();
    if (error || !data) throw new Error("Invalid QR Code.");
    const order = mapOrder(data);
    if (order.payment_status !== 'paid') throw new Error("This order has not been paid for yet.");
    if (order.status === OrderStatusEnum.COLLECTED || order.status === OrderStatusEnum.DELIVERED) throw new Error("Order already collected.");
    if (order.status !== OrderStatusEnum.PREPARED) throw new Error("Food is not prepared yet!");
    const { data: staff } = await supabase.from('users').select('username').eq('id', staffId).single();
    await updateOrderStatus(order.id, OrderStatusEnum.COLLECTED, staffId, staff?.username);
    return { ...order, status: OrderStatusEnum.COLLECTED, deliveredByStaffId: staffId, deliveredByStaffName: staff?.username };
};

export const getUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('id, username, role, phone, email, created_at').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapUser);
};

export const getAdminDashboardStats = async (): Promise<AdminStats> => {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: totalCustomers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', RoleEnum.STUDENT);
    const { count: totalOwners } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', RoleEnum.CANTEEN_OWNER);
    const { count: pendingApprovals } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', RoleEnum.CANTEEN_OWNER).eq('approval_status', 'pending');
    const { count: totalFeedbacks } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true });

    return {
        totalUsers: totalUsers || 0,
        totalCustomers: totalCustomers || 0,
        totalOwners: totalOwners || 0,
        pendingApprovals: pendingApprovals || 0,
        totalFeedbacks: totalFeedbacks || 0
    };
};

export const getPendingOwnerRequests = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users')
        .select('id, username, phone, email, canteen_name, id_proof_url, created_at, approval_status')
        .eq('role', RoleEnum.CANTEEN_OWNER)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });
    if (error) return [];
    return data.map(mapUser);
};

export const getApprovedOwners = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users')
        .select('id, username, phone, email, canteen_name, created_at, approval_status, approval_date')
        .eq('role', RoleEnum.CANTEEN_OWNER)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapUser);
};

export const getRejectedOwners = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users')
        .select('id, username, phone, email, canteen_name, created_at, approval_status')
        .eq('role', RoleEnum.CANTEEN_OWNER)
        .eq('approval_status', 'rejected')
        .order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapUser);
};

export const updateOwnerApprovalStatus = async (userId: string, status: 'approved' | 'rejected'): Promise<void> => {
    const updates: any = { approval_status: status };
    if (status === 'approved') {
        updates.approval_date = new Date().toISOString(); 
    }
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) handleSupabaseError(error, "Update Approval Status");
};

export const removeOwnerAccount = async (userId: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) handleSupabaseError(error, "Remove Owner Account");
};

export const getStudentProfile = async (id: string): Promise<StudentProfile> => {
    const { data: userRow } = await supabase.from('users').select('username, phone, loyalty_points').eq('id', id).single();
    const { data: orderRows } = await supabase.from('orders').select('total_amount').eq('student_id', id).eq('payment_status', 'paid');
    const { count: favCount } = await supabase.from('user_favorites').select('id', { count: 'exact', head: true }).eq('user_id', id);
    return { id, name: userRow?.username || 'Customer', phone: userRow?.phone || 'N/A', totalOrders: orderRows?.length || 0, lifetimeSpend: orderRows?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0, favoriteItemsCount: favCount || 0, loyaltyPoints: userRow?.loyalty_points || 0 };
};

// Fixed: Added missing createPaymentRecord member
export const createPaymentRecord = async (payment: any) => {
    const { data, error } = await supabase.from('payments').insert([payment]).select().single();
    if (error) handleSupabaseError(error, "Payments Insert");
    return data;
};

// Fixed: Added missing getOwnerBankDetails member
export const getOwnerBankDetails = async (ownerId: string): Promise<OwnerBankDetails> => {
    const { data, error } = await supabase.from('owner_bank_details').select('*').eq('owner_id', ownerId).maybeSingle();
    if (error) handleSupabaseError(error, "Fetch Bank Details");
    return data ? mapBankDetails(data) : { accountNumber: '', bankName: '', ifscCode: '', upiId: '', email: '', phone: '' };
};

// Fixed: Added missing requestSaveBankDetailsOtp member
export const requestSaveBankDetailsOtp = async (details: OwnerBankDetails) => {
    // Mock OTP delivery
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "OTP sent (Mock: 123456)" };
};

// Fixed: Added missing verifyOtpAndSaveBankDetails member
export const verifyOtpAndSaveBankDetails = async (details: OwnerBankDetails, otp: string, ownerId: string): Promise<OwnerBankDetails> => {
    if (otp !== '123456') throw new Error("Invalid OTP");
    
    const dbPayload = {
        owner_id: ownerId,
        account_number: details.accountNumber,
        bank_name: details.bankName,
        ifsc_code: details.ifscCode,
        upi_id: details.upiId,
        email: details.email,
        phone: details.phone
    };

    const { data, error } = await supabase.from('owner_bank_details').upsert(dbPayload).select().single();
    if (error) handleSupabaseError(error, "Bank Details Upsert");
    return mapBankDetails(data);
};

// Fixed: Added missing getCanteenPhotos member
export const getCanteenPhotos = async (): Promise<CanteenPhoto[]> => {
    const { data, error } = await supabase.from('canteen_photos').select('*').order('uploaded_at', { ascending: false });
    if (error) return [];
    return data.map(p => ({ id: p.id, data: p.data, uploadedAt: new Date(p.uploaded_at) }));
};

// Fixed: Added missing addCanteenPhoto member
export const addCanteenPhoto = async (file: File): Promise<CanteenPhoto> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const { data, error } = await supabase.from('canteen_photos').insert([{ data: base64, uploaded_at: new Date().toISOString() }]).select().single();
    if (error) handleSupabaseError(error, "Canteen Photos Insert");
    return { id: data.id, data: data.data, uploadedAt: new Date(data.uploaded_at) };
};

// Fixed: Added missing deleteCanteenPhoto member
export const deleteCanteenPhoto = async (id: string): Promise<void> => {
    const { error } = await supabase.from('canteen_photos').delete().eq('id', id);
    if (error) handleSupabaseError(error, "Canteen Photos Delete");
};

// Fixed: Added missing updateCanteenPhoto member
export const updateCanteenPhoto = async (id: string, file: File): Promise<CanteenPhoto> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const { data, error } = await supabase.from('canteen_photos').update({ data: base64 }).eq('id', id).select().single();
    if (error) handleSupabaseError(error, "Canteen Photos Update");
    return { id: data.id, data: data.data, uploadedAt: new Date(data.uploaded_at) };
};

// Fixed: Added missing getOwnerCommissions member
export const getOwnerCommissions = async (ownerId: string): Promise<CommissionRecord[]> => {
    const { data, error } = await supabase.from('commissions').select('*').eq('owner_id', ownerId).order('generated_at', { ascending: false });
    if (error) return [];
    return data.map(mapCommissionRecord);
};

// Fixed: Added missing getAllCommissions member
export const getAllCommissions = async (): Promise<CommissionRecord[]> => {
    const { data, error } = await supabase.from('commissions').select('*').order('generated_at', { ascending: false });
    if (error) return [];
    return data.map(mapCommissionRecord);
};

// Fixed: Added missing generateMonthlyCommissions member
export const generateMonthlyCommissions = async () => {
    // Mock logic for manual calculation trigger
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
};
