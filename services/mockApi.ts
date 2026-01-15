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
    password: row.password, 
    canteenName: row.canteen_name,
    approvalStatus: row.approval_status,
    approvalDate: row.created_at, 
    idProofUrl: row.id_proof_url,
    loyaltyPoints: row.loyalty_points
});

const mapMenuItem = (row: any): MenuItem => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    isAvailable: row.is_available,
    imageUrl: row.image_url,
    emoji: row.emoji,
    description: row.description,
    averageRating: row.average_rating ? Number(row.average_rating) : 0,
    favoriteCount: Number(row.favorite_count),
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
    discountAmount: Number(row.discount_amount || 0)
});

const mapOffer = (row: any): Offer => ({
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type as 'fixed' | 'percentage',
    discountValue: Number(row.discount_value),
    isUsed: row.is_used || false,
    studentId: row.student_id,
    isReward: row.is_reward,
    isActive: row.is_active,
    usageCount: row.usage_count,
    redeemedCount: row.redeemed_count
});

// --- API ERROR HELPER ---
const handleSupabaseError = (error: any, context: string) => {
    let message = error?.message;
    if (!message) {
        try {
            message = typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error);
        } catch (e) {
            message = String(error);
        }
    }
    console.error(`[Supabase Error] ${context}:`, message);
    throw new Error(message);
};

// --- AUTH API ---

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
        canteen_name: userData.canteenName,
        id_proof_url: userData.idProofUrl,
        approval_status: userData.approval_status || 'approved'
    }]).select().single();
    if (error) {
        if (error.code === '23505') throw new Error('User with this phone or email already exists.');
        handleSupabaseError(error, "Users Registration");
    }
    return mapUser(data);
};

export const updateUserApi = async (userId: string, updates: Partial<User>) => {
    const dbUpdates: any = {};
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.password) dbUpdates.password = updates.password;
    if (updates.approvalStatus) dbUpdates.approval_status = updates.approvalStatus;
    if (updates.loyaltyPoints !== undefined) dbUpdates.loyalty_points = updates.loyaltyPoints;
    const { error } = await supabase.from('users').update(dbUpdates).eq('id', userId);
    if (error) handleSupabaseError(error, "Users Update");
};

// --- MENU API ---

export const getMenu = async (studentId?: string): Promise<MenuItem[]> => {
    const { data, error } = await supabase.from('menu_items').select('*').order('name');
    if (error) return [];
    return data.map(mapMenuItem);
};

export const getMenuItemById = async (itemId: string, studentId?: string): Promise<MenuItem | null> => {
    const { data, error } = await supabase.from('menu_items').select('*').eq('id', itemId).maybeSingle();
    if (error || !data) return null;
    return mapMenuItem(data);
};

export const addMenuItem = async (item: any, ownerId: string): Promise<MenuItem> => {
    const comboPayload = Array.isArray(item.comboItems) ? item.comboItems : [];
    const { data, error } = await supabase.from('menu_items').insert([{
        name: item.name,
        price: Number(item.price),
        is_available: item.isAvailable,
        image_url: item.imageUrl,
        emoji: item.emoji,
        description: item.description,
        is_combo: !!item.isCombo,
        combo_items: comboPayload,
        owner_id: ownerId 
    }]).select().single();
    
    if (error) handleSupabaseError(error, "Menu Items Insert");
    return mapMenuItem(data);
};

export const updateMenuItem = async (itemId: string, item: any): Promise<MenuItem> => {
    const updates: any = {};
    if (item.name !== undefined) updates.name = item.name;
    if (item.price !== undefined) updates.price = Number(item.price);
    if (item.isAvailable !== undefined) updates.is_available = item.isAvailable;
    if (item.imageUrl !== undefined) updates.image_url = item.imageUrl;
    if (item.emoji !== undefined) updates.emoji = item.emoji;
    if (item.description !== undefined) updates.description = item.description;
    if (item.isCombo !== undefined) updates.is_combo = !!item.isCombo;
    if (item.comboItems !== undefined) updates.combo_items = Array.isArray(item.comboItems) ? item.comboItems : [];

    const { data, error } = await supabase.from('menu_items').update(updates).eq('id', itemId).select().single();
    
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

// --- FAVORITES & FEEDBACK ---

export const toggleFavoriteItem = async (studentId: string, itemId: string): Promise<void> => {
    const { data, error: getErr } = await supabase.from('menu_items').select('favorite_count').eq('id', itemId).single();
    if (!getErr && data) {
        await supabase.from('menu_items').update({ favorite_count: (data.favorite_count || 0) + 1 }).eq('id', itemId);
    }
};

export const submitFeedback = async (feedback: any): Promise<void> => {
    const { error } = await supabase.from('feedbacks').insert([{
        student_id: feedback.studentId,
        item_id: feedback.itemId,
        rating: feedback.rating,
        comment: feedback.comment,
        student_name: feedback.studentName || 'Anonymous'
    }]);
    if (error) handleSupabaseError(error, "Feedback Insert");
};

export const getFeedbacks = async (): Promise<Feedback[]> => {
    const { data, error } = await supabase.from('feedbacks').select('*, menu_items(name)').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(fb => ({
        id: fb.id,
        studentId: fb.student_id,
        studentName: fb.student_name,
        itemId: fb.item_id,
        itemName: fb.menu_items?.name || 'Unknown Item',
        rating: fb.rating,
        comment: fb.comment,
        timestamp: new Date(fb.created_at)
    }));
};

// --- ORDERS API ---

export const getStudentOrders = async (studentId: string): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !data) return null;
    return mapOrder(data);
};

export const placeOrder = async (order: any): Promise<Order> => {
    const { data, error } = await supabase.from('orders').insert([{
        student_id: order.studentId,
        student_name: order.studentName,
        customer_phone: order.customerPhone,
        items: order.items,
        total_amount: order.totalAmount,
        status: order.status || OrderStatusEnum.PENDING,
        qr_token: `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        seat_number: order.seat_number,
        payment_success: false
    }]).select().single();
    
    if (error) handleSupabaseError(error, "Orders Insert");
    return mapOrder(data);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatusEnum, staffId?: string, staffName?: string): Promise<void> => {
    const updates: any = { status };
    if (status === OrderStatusEnum.COLLECTED) {
        updates.delivered_at = new Date().toISOString();
        if (staffId) updates.delivered_by_staff_id = staffId;
        if (staffName) updates.delivered_by_staff_name = staffName;
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Status Update");
};

export const updateOrderPaymentStatus = async (orderId: string, success: boolean): Promise<void> => {
    const { error } = await supabase.from('orders').update({ payment_success: success }).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Payment Status Update");
};

export const updateOrderSeatNumber = async (orderId: string, seatNumber: string): Promise<void> => {
    const { error } = await supabase.from('orders').update({ seat_number: seatNumber }).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Seat Update");
};

// --- OWNER DASHBOARD & ANALYTICS ---

export const getOwnerOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};

export const getOwnerStatus = async () => {
    return { isOnline: true };
};

export const getSalesByDate = async (date: string): Promise<Order[]> => {
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);
    
    const { data, error } = await supabase.from('orders')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('payment_success', true);
        
    if (error) return [];
    return data.map(mapOrder);
};

export const getSalesSummary = async (): Promise<SalesSummary> => {
    return { daily: [], weekly: [] };
};

export const getMostSellingItems = async (): Promise<{ name: string; count: number }[]> => {
    return [
        { name: 'Popcorn', count: 45 },
        { name: 'Samosa', count: 32 }
    ];
};

export const getOrderStatusSummary = async (): Promise<{ name: string; value: number }[]> => {
    return [
        { name: 'Pending', value: 5 },
        { name: 'Ready', value: 8 },
        { name: 'Collected', value: 20 }
    ];
};

export const getStudentPointsList = async (): Promise<StudentPoints[]> => {
    const { data } = await supabase.from('users').select('id, username, loyalty_points').eq('role', RoleEnum.STUDENT);
    return (data || []).map(u => ({
        studentId: u.id,
        studentName: u.username,
        points: u.loyalty_points || 0
    }));
};

export const getTodaysDashboardStats = async (): Promise<TodaysDashboardStats> => {
    const today = new Date().toISOString().split('T')[0];
    const orders = await getSalesByDate(today);
    
    const itemMap: Record<string, number> = {};
    let totalIncome = 0;

    orders.forEach(order => {
        totalIncome += Number(order.totalAmount);
        order.items.forEach(item => {
            itemMap[item.name] = (itemMap[item.name] || 0) + item.quantity;
        });
    });

    const itemsSold = Object.entries(itemMap).map(([name, quantity]) => ({
        name,
        quantity
    })).sort((a, b) => b.quantity - a.quantity);

    return {
        totalOrders: orders.length,
        totalIncome,
        itemsSold
    };
};

export const getTodaysDetailedReport = async (): Promise<TodaysDetailedReport> => {
    const stats = await getTodaysDashboardStats();
    return {
        date: new Date().toISOString().split('T')[0],
        totalOrders: stats.totalOrders,
        totalIncome: stats.totalIncome,
        itemSales: stats.itemsSold.map(i => ({ name: i.name, quantity: i.quantity, totalPrice: 0 }))
    };
};

// --- STAFF MANAGEMENT ---

export const getScanTerminalStaff = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').eq('role', RoleEnum.CANTEEN_OWNER).is('canteen_name', null);
    if (error) return [];
    return data.map(mapUser);
};

export const deleteScanTerminalStaff = async (userId: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) handleSupabaseError(error, "Staff Delete");
};

export const getStaffActiveOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').in('status', [OrderStatusEnum.PENDING, OrderStatusEnum.PREPARED, OrderStatusEnum.SEAT_SELECTED]).order('created_at', { ascending: true });
    if (error) return [];
    return data.map(mapOrder);
};

// --- ADMIN API ---

export const getUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapUser);
};

export const getAdminDashboardStats = async (): Promise<AdminStats> => {
    return { totalUsers: 0, totalCustomers: 0, totalOwners: 0, pendingApprovals: 0, totalFeedbacks: 0 };
};

export const getPendingOwnerRequests = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').eq('approval_status', 'pending');
    if (error) return [];
    return data.map(mapUser);
};

export const getApprovedOwners = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').eq('approval_status', 'approved').not('canteen_name', 'is', null);
    if (error) return [];
    return data.map(mapUser);
};

export const getRejectedOwners = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').eq('approval_status', 'rejected');
    if (error) return [];
    return data.map(mapUser);
};

export const updateOwnerApprovalStatus = async (userId: string, status: 'approved' | 'rejected'): Promise<void> => {
    const { error } = await supabase.from('users').update({ approval_status: status }).eq('id', userId);
    if (error) handleSupabaseError(error, "Owner Approval Update");
};

export const removeOwnerAccount = async (userId: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) handleSupabaseError(error, "Owner Removal");
};

// --- QR SCANNER ---

export const verifyQrCodeAndCollectOrder = async (qrToken: string, staffId: string): Promise<Order> => {
    const { data, error } = await supabase.from('orders').select('*').eq('qr_token', qrToken).maybeSingle();
    if (error || !data) throw new Error("Invalid QR Code");
    if (data.status === OrderStatusEnum.COLLECTED) throw new Error("Order already collected.");
    
    await updateOrderStatus(data.id, OrderStatusEnum.COLLECTED, staffId);
    return mapOrder({ ...data, status: OrderStatusEnum.COLLECTED });
};

// --- POPULARITY ---

export const getFoodPopularityStats = async (): Promise<MenuItem[]> => {
    return getMenu();
};

// --- OFFERS & COUPONS ---

export const getAllOffersForOwner = async (): Promise<Offer[]> => {
    const { data, error } = await supabase.from('offers').select('*').eq('is_reward', false);
    if (error) return [];
    return data.map(mapOffer);
};

export const createOffer = async (offer: any): Promise<Offer> => {
    const { data, error } = await supabase.from('offers').insert([{
        code: offer.code,
        description: offer.description,
        discount_type: offer.discountType,
        discount_value: offer.discountValue,
        is_active: offer.isActive,
        usage_count: offer.usageCount,
        is_reward: false
    }]).select().single();
    if (error) handleSupabaseError(error, "Offer Insert");
    return mapOffer(data);
};

export const updateOffer = async (offerId: string, updates: any): Promise<void> => {
    const { error } = await supabase.from('offers').update(updates).eq('id', offerId);
    if (error) handleSupabaseError(error, "Offer Update");
};

export const deleteOffer = async (offerId: string): Promise<void> => {
    const { error } = await supabase.from('offers').delete().eq('id', offerId);
    if (error) handleSupabaseError(error, "Offer Delete");
};

export const getAllStudentCoupons = async (studentId: string): Promise<Offer[]> => {
    const { data, error } = await supabase.from('offers').select('*').or(`student_id.eq.${studentId},student_id.is.null`).eq('is_active', true);
    if (error) return [];
    return data.map(mapOffer);
};

// --- REWARDS ---

export const getAllRewardsForOwner = async (): Promise<Reward[]> => {
    const { data, error } = await supabase.from('rewards').select('*').eq('is_active', true);
    if (error) return [];
    return data.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        pointsCost: r.points_cost,
        discount: { type: r.discount_type, value: r.discount_value },
        isActive: r.is_active,
        expiryDate: r.expiry_date
    }));
};

export const createReward = async (reward: any): Promise<Reward> => {
    const { data, error } = await supabase.from('rewards').insert([{
        title: reward.title,
        description: reward.description,
        points_cost: reward.pointsCost,
        discount_type: reward.discount.type,
        discount_value: reward.discount.value,
        is_active: true,
        expiry_date: reward.expiryDate
    }]).select().single();
    if (error) handleSupabaseError(error, "Reward Insert");
    return data;
};

export const updateReward = async (id: string, updates: any) => {
    await supabase.from('rewards').update({ is_active: updates.isActive }).eq('id', id);
};

export const deleteReward = async (id: string) => {
    await supabase.from('rewards').delete().eq('id', id);
};

export const redeemReward = async (studentId: string, rewardId: string): Promise<Offer> => {
    const { data: reward } = await supabase.from('rewards').select('*').eq('id', rewardId).single();
    const { data: user } = await supabase.from('users').select('loyalty_points').eq('id', studentId).single();
    if (!reward || !user) throw new Error("Redemption failed.");
    if (user.loyalty_points < reward.points_cost) throw new Error("Insufficient points.");
    await supabase.from('users').update({ loyalty_points: user.loyalty_points - reward.points_cost }).eq('id', studentId);
    return createOffer({
        code: `REW-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        description: `Reward: ${reward.title}`,
        discountType: reward.discount_type,
        discountValue: reward.discount_value,
        isActive: true,
        usageCount: 1,
        studentId
    });
};

// --- RAZORPAY API ---

export const createRazorpayOrderApi = async (amount: number, studentId: string) => {
    return { id: `rzp_test_${Date.now()}`, amount: amount * 100, currency: 'INR' };
};

export const verifyRazorpayPaymentApi = async (orderId: string, response: any): Promise<boolean> => {
    return true; 
};

export const createPaymentRecord = async (payment: any): Promise<void> => {
    const { error } = await supabase.from('payments').insert([{
        order_id: payment.order_id,
        student_id: payment.student_id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        transaction_id: payment.transaction_id
    }]);
    if (error) handleSupabaseError(error, "Payments Insert");
};

// --- BANK DETAILS ---

export const getOwnerBankDetails = async (id: string) => ({ accountNumber: '', bankName: '', ifscCode: '', upiId: '', email: '', phone: '' });
export const requestSaveBankDetailsOtp = async (d: any) => true;
export const verifyOtpAndSaveBankDetails = async (d: any, o: any, i: any) => d;

// --- PROFILE ---

export const getStudentProfile = async (studentId: string): Promise<StudentProfile> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', studentId).single();
    const { data: orders } = await supabase.from('orders').select('total_amount').eq('student_id', studentId).eq('payment_success', true);
    return {
        id: studentId,
        name: user?.username || 'Student',
        phone: user?.phone || '',
        totalOrders: orders?.length || 0,
        lifetimeSpend: orders?.reduce((s, o) => s + Number(o.total_amount), 0) || 0,
        favoriteItemsCount: 0,
        loyaltyPoints: user?.loyalty_points || 0
    };
};

// --- COMMISSIONS ---

export const getOwnerCommissions = async (id: string): Promise<CommissionRecord[]> => [];
export const getAllCommissions = async (): Promise<CommissionRecord[]> => [];
export const generateMonthlyCommissions = async () => {};

// --- GALLERY ---

export const getCanteenPhotos = async (): Promise<CanteenPhoto[]> => [];
export const addCanteenPhoto = async (f: any): Promise<CanteenPhoto> => ({ id: '', data: '', uploadedAt: new Date() });
export const deleteCanteenPhoto = async (id: string) => {};
export const updateCanteenPhoto = async (id: string, f: any): Promise<CanteenPhoto> => ({ id, data: '', uploadedAt: new Date() });
