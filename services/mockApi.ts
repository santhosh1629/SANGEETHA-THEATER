
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

const handleSupabaseError = (error: any, context: string) => {
    let message = error?.message || "Database Connection Error";
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
    const { error } = await supabase.from('users').update(dbUpdates).eq('id', userId);
    if (error) handleSupabaseError(error, "Users Update");
};

// --- MENU API ---

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

export const getMenuItemById = async (itemId: string, studentId?: string): Promise<MenuItem | null> => {
    let isFavorited = false;
    if (studentId) {
        const { data: fav } = await supabase.from('user_favorites').select('id').eq('user_id', studentId).eq('item_id', itemId).maybeSingle();
        isFavorited = !!fav;
    }
    const { data, error } = await supabase.from('menu_items').select('*').eq('id', itemId).maybeSingle();
    if (error || !data) return null;
    return mapMenuItem(data, isFavorited ? [itemId] : []);
};

// --- FAVORITES ---

export const toggleFavoriteItem = async (studentId: string, itemId: string): Promise<void> => {
    const { data: existingFav } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', studentId)
        .eq('item_id', itemId)
        .maybeSingle();

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

// --- RAZORPAY & ORDERS ---

/**
 * MANDATORY: Call Edge Function to create real Razorpay Order ID
 */
export const createRazorpayOrderApi = async (amount: number, studentId: string) => {
    const amountInPaise = Math.round(amount * 100);
    
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: amountInPaise, studentId }
    });

    if (error) {
        console.error("Razorpay Order Creation Failed:", error);
        throw new Error(error.message || "Failed to create payment order. Is the Edge Function deployed?");
    }
    return data; // Returns { id: 'order_abc', amount: 500, ... }
};

/**
 * MANDATORY: Verify Signature via Backend Edge Function
 */
export const verifyRazorpayPaymentApi = async (orderId: string, razorpayResponse: any) => {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
        body: { 
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_signature: razorpayResponse.razorpay_signature
        }
    });

    if (error) {
        console.error("Signature Verification Failed:", error);
        throw new Error("Payment verification failed at the security layer.");
    }
    return data.verified === true;
};

export const placeOrder = async (order: any): Promise<Order> => {
    const payload: any = {
        student_id: order.studentId,
        student_name: order.studentName,
        customer_phone: order.customerPhone,
        items: order.items,
        total_amount: order.totalAmount,
        status: order.status || OrderStatusEnum.PENDING,
        payment_status: 'created',
        qr_token: `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        seat_number: order.seat_number,
        payment_success: false
    };

    const { data, error } = await supabase.from('orders').insert([payload]).select().single();
    if (error) {
        if (error.message.includes('payment_status') || error.code === '42703') {
            delete payload.payment_status;
            const retry = await supabase.from('orders').insert([payload]).select().single();
            if (retry.error) handleSupabaseError(retry.error, "Orders Insert Retry");
            return mapOrder(retry.data);
        }
        handleSupabaseError(error, "Orders Insert");
    }
    return mapOrder(data);
};

export const updateOrderPaymentStatus = async (orderId: string, success: boolean): Promise<void> => {
    const updates: any = { 
        payment_success: success,
        payment_status: success ? 'paid' : 'failed'
    };
    if (success) updates.status = OrderStatusEnum.CONFIRMED;
    
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) handleSupabaseError(error, "Orders Payment Status Update");
};

/**
 * Fetch orders for a specific student
 */
export const getStudentOrders = async (studentId: string): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) {
        console.error("Error fetching student orders:", error);
        return [];
    }
    return data.map(mapOrder);
};

/**
 * Fetch a single order by ID
 */
export const getOrderById = async (orderId: string): Promise<Order> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error) {
        handleSupabaseError(error, "Get Order By ID");
    }
    if (!data) {
        throw new Error("Order not found.");
    }
    return mapOrder(data);
};

// --- STAFF DASHBOARD LOGIC ---

/**
 * Returns orders that are paid but not yet prepared/claimed by any staff.
 */
export const getStaffUnclaimedPendingOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'paid')
        .in('status', [OrderStatusEnum.CONFIRMED, OrderStatusEnum.PENDING])
        .is('prepared_by', null)
        .order('created_at', { ascending: true });
        
    if (error) return [];
    return data.map(mapOrder);
};

/**
 * Returns orders prepared by the specific staff member that aren't collected yet.
 */
export const getStaffMyPreparedOrders = async (staffId: string): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'paid')
        .eq('status', OrderStatusEnum.PREPARED)
        .eq('prepared_by', staffId)
        .order('prepared_at', { ascending: false });
        
    if (error) return [];
    return data.map(mapOrder);
};

/**
 * Claim and mark an order as prepared.
 */
export const markOrderAsPrepared = async (orderId: string, staffId: string): Promise<void> => {
    const { error } = await supabase
        .from('orders')
        .update({ 
            status: OrderStatusEnum.PREPARED,
            prepared_by: staffId,
            prepared_at: new Date().toISOString()
        })
        .eq('id', orderId)
        // Optimistic check: only update if no one else grabbed it first
        .is('prepared_by', null);
        
    if (error) handleSupabaseError(error, "Mark Prepared");
};

// --- STUDENT PROFILE (FIXED) ---

export const getStudentProfile = async (id: string): Promise<StudentProfile> => {
    const { data: userRow } = await supabase.from('users').select('*').eq('id', id).single();
    
    // Aggregation: Lifetime Spend & Orders
    const { data: orderRows } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('student_id', id)
        .eq('payment_status', 'paid');
    
    // Aggregation: Favorites
    const { count: favCount } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id);

    const totalOrders = orderRows?.length || 0;
    const lifetimeSpend = orderRows?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

    return {
        id,
        name: userRow?.username || 'Customer',
        phone: userRow?.phone || 'N/A',
        totalOrders,
        lifetimeSpend,
        favoriteItemsCount: favCount || 0,
        loyaltyPoints: userRow?.loyalty_points || 0
    };
};

// --- REST OF ANALYTICS ---
export const getOwnerOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapOrder);
};
export const getOwnerStatus = async () => ({ isOnline: true });
export const getSalesByDate = async (date: string): Promise<Order[]> => {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const { data, error } = await supabase.from('orders').select('*').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).eq('payment_status', 'paid');
    if (error) return [];
    return data.map(mapOrder);
};
export const getSalesSummary = async (): Promise<SalesSummary> => ({ daily: [], weekly: [] });
export const getMostSellingItems = async () => [{ name: 'Popcorn', count: 45 }];
export const getOrderStatusSummary = async () => [{ name: 'Pending', value: 5 }];
export const getStudentPointsList = async () => [];
export const getTodaysDashboardStats = async (): Promise<TodaysDashboardStats> => {
    const today = new Date().toISOString().split('T')[0];
    const orders = await getSalesByDate(today);
    return { totalOrders: orders.length, totalIncome: orders.reduce((sum, o) => sum + o.totalAmount, 0), itemsSold: [] };
};
export const getTodaysDetailedReport = async () => ({ date: '', totalOrders: 0, totalIncome: 0, itemSales: [] });
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
    const { data, error } = await supabase.from('feedbacks').select('*, menu_items(name)').order('created_at', { ascending: false });
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
    const { data, error } = await supabase.from('users').select('*').eq('role', RoleEnum.CANTEEN_OWNER).is('canteen_name', null);
    if (error) return [];
    return data.map(mapUser);
};
export const deleteScanTerminalStaff = async (userId: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) handleSupabaseError(error, "Staff Delete");
};
export const getStaffActiveOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').in('status', [OrderStatusEnum.CONFIRMED, OrderStatusEnum.PREPARED, OrderStatusEnum.PENDING]).eq('payment_status', 'paid').order('created_at', { ascending: true });
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
export const createPaymentRecord = async (p: any) => {};
export const getUsers = async () => [];
export const getAdminDashboardStats = async () => ({ totalUsers: 0, totalCustomers: 0, totalOwners: 0, pendingApprovals: 0, totalFeedbacks: 0 });
export const getPendingOwnerRequests = async () => [];
export const getApprovedOwners = async () => [];
export const getRejectedOwners = async () => [];
export const updateOwnerApprovalStatus = async (i: string, s: string) => {};
export const removeOwnerAccount = async (i: string) => {};
export const getOwnerBankDetails = async (id: string) => ({ accountNumber: '', bankName: '', ifscCode: '', email: '', phone: '' });
export const requestSaveBankDetailsOtp = async (d: any) => true;
export const verifyOtpAndSaveBankDetails = async (d: any, o: any, i: any) => d;
export const getOwnerCommissions = async (id: string) => [];
export const getAllCommissions = async () => [];
export const generateMonthlyCommissions = async () => {};
export const getCanteenPhotos = async () => [];
export const addCanteenPhoto = async (f: any) => ({ id: '', data: '', uploadedAt: new Date() });
export const deleteCanteenPhoto = async (id: string) => {};
export const updateCanteenPhoto = async (id: string, f: any) => ({ id: '', data: '', uploadedAt: new Date() });
