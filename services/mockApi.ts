
import { createClient } from '@supabase/supabase-js';
import type { User, MenuItem, Order, OrderStatus, SalesSummary, Feedback, Offer, StudentProfile, Reward, StudentPoints, TodaysDashboardStats, TodaysDetailedReport, AdminStats, OwnerBankDetails, CanteenPhoto, CommissionRecord } from '../types';
import { Role as RoleEnum, OrderStatus as OrderStatusEnum } from '../types';

const SUPABASE_URL = 'https://hhaddkpolzczqnchmrjt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYWRka3BvbHpjenFuY2htcmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODY3ODMsImV4cCI6MjA4Mzg2Mjc4M30.K_2gLrTsXaHJY1qchu7lM7wscpdpg28XWMHth1tSHdk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- OPTIMIZED FIELD SELECTIONS ---
const MENU_FIELDS = 'id, name, price, is_available, image_url, emoji, description, average_rating, favorite_count, is_combo, combo_items';
const ORDER_MINIMAL_FIELDS = 'id, student_name, customer_phone, total_amount, status, payment_status, items, created_at, seat_number, prepared_at';

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
    isFavorited: Array.isArray(userFavorites) ? userFavorites.includes(row.id) : false,
    isCombo: row.is_combo,
    comboItems: row.combo_items ? (typeof row.combo_items === 'string' ? JSON.parse(row.combo_items) : row.combo_items) : []
});

const parseOrderItems = (items: any): any[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
        try { return JSON.parse(items); } catch (e) { return []; }
    }
    return [];
};

const mapOrder = (row: any): Order => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    customerPhone: row.customer_phone,
    totalAmount: Number(row.total_amount || 0),
    status: row.status as OrderStatusEnum,
    payment_status: row.payment_status || (row.payment_success ? 'paid' : 'created'),
    qrToken: row.qr_token,
    seatNumber: row.seat_number,
    items: parseOrderItems(row.items),
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

// --- CORE MENU & USER API ---

export const getMenu = async (studentId?: string): Promise<MenuItem[]> => {
    let userFavoriteIds: string[] = [];
    if (studentId) {
        const { data: favs } = await supabase.from('user_favorites').select('item_id').eq('user_id', studentId);
        if (favs) userFavoriteIds = favs.map(f => f.item_id);
    }
    const { data, error } = await supabase.from('menu_items')
        .select(MENU_FIELDS)
        .order('name');
    if (error) return [];
    return data.map(item => mapMenuItem(item, userFavoriteIds));
};

export const getOwnerOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS + ', qr_token')
        .in('status', [
            OrderStatusEnum.QR_GENERATED, 
            OrderStatusEnum.PREPARED, 
            OrderStatusEnum.COLLECTED, 
            OrderStatusEnum.DELIVERED
        ])
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (error) return [];
    return data.map(mapOrder);
};

export const getStudentOrders = async (studentId: string, page: number = 0): Promise<Order[]> => {
    const pageSize = 20;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS + ', qr_token')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .range(from, to);
        
    if (error) return [];
    return data.map(mapOrder);
};

export const getStaffUnclaimedPendingOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS)
        .in('status', [OrderStatusEnum.QR_GENERATED, OrderStatusEnum.PAYMENT_SUCCESS])
        .is('prepared_by', null)
        .order('created_at', { ascending: true });
        
    if (error) return [];
    return data.map(mapOrder);
};

export const getStaffMyPreparedOrders = async (id: string): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS)
        .eq('status', OrderStatusEnum.PREPARED)
        .eq('prepared_by', id)
        .order('prepared_at', { ascending: false })
        .limit(20);
        
    if (error) return [];
    return data.map(mapOrder);
};

export const markOrderAsPrepared = async (oId: string, sId: string) => {
    const { error } = await supabase.from('orders').update({ 
        status: OrderStatusEnum.PREPARED, 
        prepared_by: sId, 
        prepared_at: new Date().toISOString() 
    }).eq('id', oId);
    if (error) throw error;
};

// --- REMAINING API WRAPPERS ---

export const createRazorpayOrderApi = async (amount: number, studentId: string) => {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount, studentId }
    });
    if (error) throw new Error(`Edge Function Error: ${error.message}`);
    return data; 
};

export const verifyRazorpayPaymentApi = async (orderId: string, razorpayResponse: any) => {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
        body: { 
            razorpay_order_id: razorpayResponse.razorpay_order_id,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id,
            razorpay_signature: razorpayResponse.razorpay_signature
        }
    });
    
    if (error) return false;
    
    const isSuccess = data?.success ?? false;
    
    if (isSuccess) {
        const qrToken = `SECURE-ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await supabase.from('orders').update({
            payment_success: true,
            payment_status: 'paid',
            status: OrderStatusEnum.QR_GENERATED,
            qr_token: qrToken
        }).eq('id', orderId);
    } else {
        await supabase.from('orders').update({
            payment_status: 'failed',
            status: OrderStatusEnum.PAYMENT_FAILED
        }).eq('id', orderId);
    }
    
    return isSuccess;
};

export const addMenuItem = async (item: any, ownerId: string): Promise<MenuItem> => {
    const dbPayload = {
        name: item.name, price: Number(item.price), is_available: !!item.isAvailable,
        image_url: item.imageUrl, emoji: item.emoji, description: item.description,
        is_combo: !!item.isCombo, combo_items: item.combo_items || [], owner_id: ownerId
    };
    const { data, error } = await supabase.from('menu_items').insert([dbPayload]).select().single();
    if (error) throw error;
    return mapMenuItem(data);
};

export const updateMenuItem = async (itemId: string, item: any): Promise<MenuItem> => {
    const dbPayload = {
        name: item.name, price: Number(item.price), is_available: !!item.isAvailable,
        image_url: item.imageUrl, emoji: item.emoji, description: item.description,
        is_combo: !!item.isCombo, combo_items: item.combo_items || []
    };
    const { data, error } = await supabase.from('menu_items').update(dbPayload).eq('id', itemId).select().single();
    if (error) throw error;
    return mapMenuItem(data);
};

export const removeMenuItem = async (itemId: string): Promise<void> => {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    if (error) throw error;
};

export const getSalesByDate = async (date: string): Promise<Order[]> => {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'paid')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

    if (error) return [];
    return data ? data.map(mapOrder) : [];
};

export const getUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapUser);
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

export const loginUserApi = async (phoneOrEmail: string, password: string): Promise<User> => {
    let { data, error } = await supabase.from('users').select('*').eq('phone', phoneOrEmail).eq('password', password).maybeSingle();
    if (error || !data) {
        const res = await supabase.from('users').select('*').eq('email', phoneOrEmail).eq('password', password).maybeSingle();
        data = res.data; error = res.error;
    }
    if (error || !data) throw new Error('Invalid credentials.');
    return mapUser(data);
};

export const registerUserApi = async (userData: any): Promise<User> => {
    const { data, error } = await supabase.from('users').insert([{
        username: userData.username, phone: userData.phone, password: userData.password,
        role: userData.role, email: userData.email, canteen_name: userData.canteen_name,
        id_proof_url: userData.id_proof_url, approval_status: userData.approval_status || 'approved'
    }]).select().single();
    if (error) throw error;
    return mapUser(data);
};

export const updateUserApi = async (userId: string, updates: Partial<User>) => {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) throw error;
};

export const placeOrder = async (order: any): Promise<Order> => {
    const { data, error } = await supabase.from('orders').insert([{ 
        student_id: order.studentId, 
        student_name: order.studentName, 
        customer_phone: order.customerPhone, 
        items: order.items, 
        total_amount: Number(order.totalAmount), 
        status: OrderStatusEnum.INITIATED, 
        qr_token: null, 
        seat_number: order.seat_number, 
        payment_status: 'created', 
        payment_success: false 
    }]).select().single();
    if (error) throw error;
    return mapOrder(data);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatusEnum, staffId?: string, staffName?: string): Promise<void> => {
    const updates: any = { status };
    if (status === OrderStatusEnum.COLLECTED || status === OrderStatusEnum.DELIVERED) {
        updates.delivered_at = new Date().toISOString();
        if (staffId) updates.delivered_by_staff_id = staffId;
        if (staffName) updates.delivered_by_staff_name = staffName;
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) throw error;
};

export const getOrderById = async (orderId: string): Promise<Order> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !data) throw new Error("Order not found.");
    return mapOrder(data);
};

export const getScanTerminalStaff = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').eq('role', RoleEnum.CANTEEN_OWNER).is('canteen_name', null);
    if (error) return [];
    return data.map(mapUser);
};

export const deleteScanTerminalStaff = async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
};

export const verifyQrCodeAndCollectOrder = async (qrToken: string, staffId: string): Promise<Order> => {
    const { data: orderData, error: findError } = await supabase.from('orders').select('*').eq('qr_token', qrToken).maybeSingle();
    if (findError || !orderData) throw new Error("Invalid QR code.");
    const order = mapOrder(orderData);
    if (order.status === OrderStatusEnum.COLLECTED) throw new Error("Order already collected.");
    const { data: staffData } = await supabase.from('users').select('username').eq('id', staffId).single();
    await updateOrderStatus(order.id, OrderStatusEnum.COLLECTED, staffId, staffData?.username);
    await supabase.from('orders').update({ qr_token: `REDEEMED-${Date.now()}` }).eq('id', order.id);
    return await getOrderById(order.id);
};

export const getStudentPointsList = async (): Promise<StudentPoints[]> => {
    const { data, error } = await supabase.from('users').select('id, username, loyalty_points').eq('role', RoleEnum.STUDENT).gt('loyalty_points', 0).order('loyalty_points', { ascending: false });
    if (error || !data) return [];
    return data.map(u => ({ studentId: u.id, studentName: u.username, points: u.loyalty_points || 0 }));
};

export const getStudentProfile = async (id: string): Promise<StudentProfile> => {
    const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', id).single();
    if (userError || !userData) throw new Error("User not found");

    const { data: ordersData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('student_id', id)
        .eq('payment_status', 'paid');
    
    const { count: favoritesCount } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id);

    const totalOrders = ordersData?.length || 0;
    const lifetimeSpend = ordersData?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

    return { 
        id, 
        name: userData.username, 
        phone: userData.phone, 
        totalOrders, 
        lifetimeSpend, 
        favoriteItemsCount: favoritesCount || 0, 
        loyaltyPoints: userData.loyalty_points || 0 
    };
};

export const submitFeedback = async (fb: any) => {
    await supabase.from('feedbacks').insert([{ student_id: fb.studentId, item_id: fb.itemId, rating: fb.rating, comment: fb.comment, student_name: fb.studentName || 'Anonymous' }]);
};

export const getMenuItemById = async (id: string, sId?: string) => {
    const { data } = await supabase.from('menu_items').select('*').eq('id', id).single();
    return data ? mapMenuItem(data) : null;
};

export const updateMenuAvailability = async (itemId: string, isAvailable: boolean) => {
    await supabase.from('menu_items').update({ is_available: isAvailable }).eq('id', itemId);
};

export const updateAllMenuItemsAvailability = async (ownerId: string, isAvailable: boolean) => {
    await supabase.from('menu_items').update({ is_available: isAvailable }).eq('owner_id', ownerId);
};

export const createPaymentRecord = async (p: any) => {
     await supabase.from('payment_records').insert([p]);
};

export const getTodaysDashboardStats = async (): Promise<TodaysDashboardStats> => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data: orders } = await supabase.from('orders')
        .select('total_amount, items')
        .eq('payment_status', 'paid')
        .gte('created_at', start.toISOString());
    
    if (!orders) return { totalOrders: 0, totalIncome: 0, itemsSold: [] };
    
    const totalIncome = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const itemMap: Record<string, number> = {};
    
    orders.forEach(o => {
        const items = parseOrderItems(o.items);
        items.forEach(i => {
            itemMap[i.name] = (itemMap[i.name] || 0) + Number(i.quantity);
        });
    });
    
    const itemsSold = Object.entries(itemMap).map(([name, quantity]) => ({ name, quantity }));
    return { totalOrders: orders.length, totalIncome, itemsSold };
};

export const getMostSellingItems = async () => {
    const { data: orders } = await supabase.from('orders').select('items').eq('payment_status', 'paid');
    if (!orders) return [];
    
    const itemMap: Record<string, number> = {};
    orders.forEach(o => {
        const items = parseOrderItems(o.items);
        items.forEach(i => {
            itemMap[i.name] = (itemMap[i.name] || 0) + Number(i.quantity);
        });
    });
    
    return Object.entries(itemMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
};

export const getOrderStatusSummary = async () => {
    const { data: orders } = await supabase.from('orders').select('status');
    if (!orders) return [];
    
    const statusMap: Record<string, number> = {};
    orders.forEach(o => {
        statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });
    
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
};

export const getSalesSummary = async (): Promise<SalesSummary> => {
    const start = new Date(); start.setDate(start.getDate() - 14);
    const { data: orders } = await supabase.from('orders')
        .select('total_amount, created_at')
        .eq('payment_status', 'paid')
        .gte('created_at', start.toISOString());
        
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dailyMap[d.toISOString().split('T')[0]] = 0;
    }
    
    orders?.forEach(o => {
        const date = o.created_at.split('T')[0];
        if (dailyMap[date] !== undefined) {
            dailyMap[date] += Number(o.total_amount);
        }
    });
    
    const daily = Object.entries(dailyMap)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date));
        
    return { daily, weekly: [] };
};

export const getAdminDashboardStats = async (): Promise<AdminStats> => {
    const { data: users, error: userError } = await supabase.from('users').select('role, approval_status');
    const { count: feedbackCount, error: fbError } = await supabase.from('feedbacks').select('*', { count: 'exact', head: true });
    
    if (userError || fbError) return { totalUsers: 0, totalCustomers: 0, totalOwners: 0, pendingApprovals: 0, totalFeedbacks: 0 };
    
    return {
        totalUsers: users.length,
        totalCustomers: users.filter(u => u.role === RoleEnum.STUDENT).length,
        totalOwners: users.filter(u => u.role === RoleEnum.CANTEEN_OWNER).length,
        pendingApprovals: users.filter(u => u.role === RoleEnum.CANTEEN_OWNER && u.approval_status === 'pending').length,
        totalFeedbacks: feedbackCount || 0
    };
};

export const getAdminMonthlySalesReport = async (monthKey: string) => {
    const start = new Date(monthKey + "-01");
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    
    const { data, error } = await supabase.from('orders')
        .select('total_amount, created_at')
        .eq('payment_status', 'paid')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
        
    if (error || !data) return { summary: { total_sales: 0, total_orders: 0 }, breakdown: [] };
    
    const totalSales = data.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const breakdownMap: Record<string, { date_key: string, daily_orders: number, daily_total: number }> = {};
    
    data.forEach(o => {
        const date = o.created_at.split('T')[0];
        if (!breakdownMap[date]) breakdownMap[date] = { date_key: date, daily_orders: 0, daily_total: 0 };
        breakdownMap[date].daily_orders += 1;
        breakdownMap[date].daily_total += Number(o.total_amount);
    });
    
    return {
        summary: { total_sales: totalSales, total_orders: data.length },
        breakdown: Object.values(breakdownMap).sort((a, b) => b.date_key.localeCompare(a.date_key))
    };
};

export const getTodaysDetailedReport = async (): Promise<TodaysDetailedReport> => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data: orders } = await supabase.from('orders')
        .select('total_amount, items')
        .eq('payment_status', 'paid')
        .gte('created_at', start.toISOString());
        
    if (!orders) return { date: new Date().toLocaleDateString(), totalOrders: 0, totalIncome: 0, itemSales: [] };

    const totalIncome = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const itemMap: Record<string, { quantity: number, total: number }> = {};
    
    orders.forEach(o => {
        const items = parseOrderItems(o.items);
        items.forEach(i => {
            if (!itemMap[i.name]) itemMap[i.name] = { quantity: 0, total: 0 };
            itemMap[i.name].quantity += Number(i.quantity);
            itemMap[i.name].total += (Number(i.price) * Number(i.quantity));
        });
    });
    
    const itemSales = Object.entries(itemMap).map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        totalPrice: stats.total
    }));
    
    return {
        date: new Date().toLocaleDateString(),
        totalOrders: orders.length,
        totalIncome,
        itemSales
    };
};

export const getPendingOwnerRequests = async () => {
    const { data } = await supabase.from('users').select('*').eq('role', RoleEnum.CANTEEN_OWNER).eq('approval_status', 'pending');
    return data ? data.map(mapUser) : [];
};

export const getApprovedOwners = async () => {
    const { data } = await supabase.from('users').select('*').eq('role', RoleEnum.CANTEEN_OWNER).eq('approval_status', 'approved');
    return data ? data.map(mapUser) : [];
};

export const getRejectedOwners = async () => {
    const { data } = await supabase.from('users').select('*').eq('role', RoleEnum.CANTEEN_OWNER).eq('approval_status', 'rejected');
    return data ? data.map(mapUser) : [];
};

export const updateOwnerApprovalStatus = async (userId: string, status: string) => {
    await supabase.from('users').update({ approval_status: status }).eq('id', userId);
};

export const removeOwnerAccount = async (userId: string) => {
    await supabase.from('users').delete().eq('id', userId);
};

export const getFoodPopularityStats = async (): Promise<MenuItem[]> => {
    try {
        // FETCH EVERYTHING TO COMPUTE LIVE POPULARITY
        const [menuRes, feedbackRes, favoriteRes] = await Promise.all([
            supabase.from('menu_items').select('*'),
            supabase.from('feedbacks').select('item_id, rating'),
            supabase.from('user_favorites').select('item_id')
        ]);

        if (menuRes.error) throw menuRes.error;

        const feedbacks = feedbackRes.data || [];
        const favorites = favoriteRes.data || [];

        return menuRes.data.map(item => {
            const itemFeedbacks = feedbacks.filter(f => f.item_id === item.id);
            const avgRating = itemFeedbacks.length > 0 
                ? itemFeedbacks.reduce((sum, f) => sum + Number(f.rating), 0) / itemFeedbacks.length 
                : 0;
            
            const favCount = favorites.filter(fav => fav.item_id === item.id).length;

            return mapMenuItem({
                ...item,
                average_rating: avgRating,
                favorite_count: favCount
            });
        });
    } catch (e) {
        console.error("Aggregation Error:", e);
        return [];
    }
};

export const getOwnerStatus = async () => ({ isOnline: true });
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
export const updateOrderSeatNumber = async (oId: string, s: string) => {
    await supabase.from('orders').update({ seat_number: s }).eq('id', oId);
};
export const toggleFavoriteItem = async (sId: string, iId: string) => {
    const { data: existing } = await supabase.from('user_favorites').select('*').eq('user_id', sId).eq('item_id', iId).maybeSingle();
    if (existing) {
        await supabase.from('user_favorites').delete().eq('user_id', sId).eq('item_id', iId);
    } else {
        await supabase.from('user_favorites').insert([{ user_id: sId, item_id: iId }]);
    }
};
