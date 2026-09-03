
import { createClient } from '@supabase/supabase-js';
import type { User, MenuItem, Order, OrderStatus, SalesSummary, Feedback, Offer, StudentProfile, Reward, StudentPoints, TodaysDashboardStats, TodaysDetailedReport, AdminStats, OwnerBankDetails, CanteenPhoto, CommissionRecord } from '../types';
import { Role as RoleEnum, OrderStatus as OrderStatusEnum } from '../types';
import { CONFIG } from '../config';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ovscyblbtabarclgucgp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92c2N5YmxidGFiYXJjbGd1Y2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNzQ4NTEsImV4cCI6MjA4MjY1MDg1MX0.fto7lebnWDCv-YX2Y0dw4k0LeLM471brwzOuyPpfRgY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- OPTIMIZED FIELD SELECTIONS ---
const MENU_FIELDS = 'id, name, price, is_available, image_url, emoji, description, average_rating, favorite_count, is_combo, combo_items';
const ORDER_MINIMAL_FIELDS = 'id, student_id, student_name, customer_phone, total_amount, status, payment_status, items, created_at, seat_number, prepared_at, qr_token, delivered_by_staff_name, delivered_by_staff_id, delivered_at, coupon_code, discount_amount, prepared_by_id, prepared_by_name';

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

const mapOrder = (row: any): Order => {
    const paymentStatus = (row.payment_status || 'created').toLowerCase();
    return {
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        customerPhone: row.customer_phone,
        totalAmount: Number(row.total_amount || 0),
        status: row.status as OrderStatusEnum,
        payment_status: paymentStatus as any,
        qrToken: row.qr_token,
        seatNumber: row.seat_number,
        items: parseOrderItems(row.items),
        timestamp: new Date(row.created_at),
        paymentSuccess: paymentStatus === 'paid',
        deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
        deliveredByStaffId: row.delivered_by_staff_id,
        deliveredByStaffName: row.delivered_by_staff_name,
        orderType: 'real',
        couponCode: row.coupon_code || '', 
        discountAmount: Number(row.discount_amount || 0),
        preparedBy: row.prepared_by_id,
        prepared_by_id: row.prepared_by_id,
        preparedByName: row.prepared_by_name,
        prepared_by_name: row.prepared_by_name,
        preparedAt: row.prepared_at ? new Date(row.prepared_at) : undefined
    };
};

export const getOwnerOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS)
        .order('created_at', { ascending: false })
        .limit(200);
        
    if (error) {
        console.error("Error fetching owner orders:", error);
        return [];
    }
    return data ? data.map(mapOrder) : [];
};

export const getStudentOrders = async (studentId: string, page: number = 0): Promise<Order[]> => {
    const pageSize = 20;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    try {
        // 1. Try fetching by student_id first
        let { data, error } = await supabase
            .from('orders')
            .select(ORDER_MINIMAL_FIELDS)
            .eq('student_id', studentId)
            .ilike('payment_status', 'paid') 
            .order('created_at', { ascending: false })
            .range(from, to);
            
        // 2. Fallback: If no orders found by ID, try by phone number
        if ((!data || data.length === 0) && !error) {
            const { data: userData } = await supabase.from('users').select('phone').eq('id', studentId).maybeSingle();
            if (userData?.phone) {
                 const res = await supabase
                    .from('orders')
                    .select(ORDER_MINIMAL_FIELDS)
                    .eq('customer_phone', userData.phone)
                    .ilike('payment_status', 'paid') 
                    .order('created_at', { ascending: false })
                    .range(from, to);
                 
                 if (res.data && res.data.length > 0) {
                     data = res.data;
                     error = res.error;
                 }
            }
        }

        if (error) {
            console.error("Supabase Query Error (getStudentOrders):", error);
            return [];
        }
        return data ? data.map(mapOrder) : [];
    } catch (err) {
        console.error("System Error (getStudentOrders):", err);
        return [];
    }
};

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

export const getStaffUnclaimedPendingOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS)
        .eq('status', OrderStatusEnum.NEW)
        .is('prepared_by_id', null)
        .ilike('payment_status', 'paid')
        .order('created_at', { ascending: true });
        
    if (error) return [];
    return data.map(mapOrder);
};

export const getStaffMyPreparedOrders = async (id: string): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_MINIMAL_FIELDS)
        .in('status', [OrderStatusEnum.PREPARING, OrderStatusEnum.READY])
        .eq('prepared_by_id', id)
        .order('prepared_at', { ascending: false })
        .limit(50);
        
    if (error) return [];
    return data.map(mapOrder);
};

/**
 * ATOMIC CLAIM: Atomically claim an order for preparation.
 * Uses conditional WHERE (prepared_by_id IS NULL AND status = 'NEW') so only one staff member can claim it.
 */
export const claimOrderAsPreparing = async (oId: string, sId: string, sName: string): Promise<Order> => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from('orders')
        .update({ 
            status: OrderStatusEnum.PREPARING, 
            prepared_by_id: sId,
            prepared_by_name: sName,
            prepared_at: nowIso 
        })
        .eq('id', oId)
        .is('prepared_by_id', null)
        .eq('status', OrderStatusEnum.NEW)
        .select(ORDER_MINIMAL_FIELDS);

    if (error) {
        throw new Error(error.message || "Failed to claim order.");
    }

    if (!data || data.length === 0) {
        // Find who claimed it or current status for helpful error
        const { data: existing } = await supabase
            .from('orders')
            .select('prepared_by_name, prepared_by_id, status')
            .eq('id', oId)
            .maybeSingle();

        const alreadyPreparedErr: any = new Error("This food has already been prepared by another staff member.");
        alreadyPreparedErr.code = 'ALREADY_PREPARED_BY_OTHER';
        alreadyPreparedErr.name = 'ALREADY_PREPARED_BY_OTHER';
        alreadyPreparedErr.preparedByName = existing?.prepared_by_name;
        alreadyPreparedErr.preparedById = existing?.prepared_by_id;
        alreadyPreparedErr.status = existing?.status;
        throw alreadyPreparedErr;
    }

    return mapOrder(data[0]);
};

export const markOrderAsPreparing = async (oId: string, sId: string, sName: string) => {
    return await claimOrderAsPreparing(oId, sId, sName);
};

export const markOrderAsReady = async (oId: string, sId?: string): Promise<Order> => {
    let query = supabase
        .from('orders')
        .update({ 
            status: OrderStatusEnum.READY
        })
        .eq('id', oId)
        .eq('status', OrderStatusEnum.PREPARING);

    if (sId) {
        query = query.eq('prepared_by_id', sId);
    }

    const { data, error } = await query.select(ORDER_MINIMAL_FIELDS);
    if (error) throw new Error(error.message || "Failed to mark order as ready.");
    if (!data || data.length === 0) {
        throw new Error("Cannot mark as ready: order is not in PREPARING state or was claimed by another staff.");
    }
    return mapOrder(data[0]);
};

export const markOrderAsCollected = async (oId: string, sId: string, sName: string) => {
    const { error } = await supabase.from('orders').update({ 
        status: OrderStatusEnum.COLLECTED,
        delivered_by_staff_id: sId,
        delivered_by_staff_name: sName,
        delivered_at: new Date().toISOString(),
        qr_token: `REDEEMED-${Date.now()}`
    }).eq('id', oId);
    if (error) throw error;
};

// --- UPDATED: ROBUST INVOKE FOR EDGE FUNCTIONS ---
const invokeEdgeFunction = async (name: string, payload: any) => {
    try {
        console.log(`[Edge Function] Invoking ${name}...`);
        const { data, error } = await supabase.functions.invoke(name, {
            body: payload
        });
        
        if (error) {
            const errorMsg = error.message?.toLowerCase() || "";
            const isNetworkError = errorMsg.includes('failed to send a request') || errorMsg.includes('fetch');
            
            if (isNetworkError) {
                // Log as info/warn since we have a fallback
                console.warn(`[Edge Function] ${name} unreachable. Using fallback logic.`);
            } else {
                console.error(`Edge Function Error (${name}):`, error);
            }
            throw error;
        }
        
        return data;
    } catch (err: any) {
        const errorMsg = err.message?.toLowerCase() || "";
        const isNetworkError = errorMsg.includes('failed to send a request') || errorMsg.includes('fetch');
        
        if (!isNetworkError) {
            console.error(`Edge Function Invocation Failed (${name}):`, err.message);
        }
        throw err;
    }
};

export const createRazorpayOrderApi = async (amount: number, studentId: string) => {
    const amountInPaise = Math.round(Number(amount) * 100);
    
    if (CONFIG.USE_EDGE_FUNCTIONS) {
        try {
            const data = await invokeEdgeFunction('create-order', { amount: amountInPaise, studentId });
            if (data && data.order_id) {
                return { id: data.order_id, amount: amountInPaise, currency: "INR" };
            }
        } catch (err: any) {
            console.warn("Edge function create-order not responding, falling back to direct Razorpay checkout.", err);
        }
    }
    
    // In Test Mode / Standard Checkout, Razorpay Key ID + Amount in paise opens checkout modal directly
    return {
        id: undefined,
        amount: amountInPaise,
        currency: "INR"
    };
};

export const verifyRazorpayPaymentApi = async (orderId: string, razorpayResponse: any, studentId: string) => {
    let isSuccess = false;
    
    if (CONFIG.USE_EDGE_FUNCTIONS && razorpayResponse.razorpay_signature) {
        try {
            const data = await invokeEdgeFunction('verify-payment', { 
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                user_id: studentId
            });
            isSuccess = data?.status === "verified";
        } catch (err: any) {
            console.warn("Edge function verify-payment failed, verifying via payment response.", err);
            isSuccess = !!razorpayResponse.razorpay_payment_id;
        }
    } else {
        // Direct test mode verification: confirmed via received payment_id
        isSuccess = !!razorpayResponse.razorpay_payment_id;
    }
    
    if (isSuccess) {
        const qrToken = `SECURE-ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await supabase.from('orders').update({
            payment_status: 'paid',
            status: OrderStatusEnum.NEW,
            qr_token: qrToken,
            razorpay_payment_id: razorpayResponse.razorpay_payment_id || `pay_${Date.now()}`,
            razorpay_order_id: razorpayResponse.razorpay_order_id || null,
            razorpay_signature: razorpayResponse.razorpay_signature || null
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
        status: order.status || OrderStatusEnum.INITIATED, 
        qr_token: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
        seat_number: order.seat_number, 
        payment_status: 'created'
    }]).select().single();
    if (error) throw error;
    return mapOrder(data);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatusEnum, staffId?: string, staffName?: string): Promise<void> => {
    const updates: any = { status };
    if (status === OrderStatusEnum.COLLECTED) {
        updates.delivered_at = new Date().toISOString();
        if (staffId) updates.delivered_by_staff_id = staffId;
        updates.delivered_by_staff_name = staffName || 'Staff';
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
    if (!qrToken || typeof qrToken !== 'string') {
        throw new Error("Invalid QR code format.");
    }
    const cleanToken = qrToken.trim();

    if (cleanToken.startsWith('REDEEMED-')) {
        throw new Error("This QR code has already been scanned and order collected.");
    }

    const { data: orderData, error: findError } = await supabase
        .from('orders')
        .select('*')
        .eq('qr_token', cleanToken)
        .maybeSingle();

    if (findError || !orderData) {
        throw new Error("Invalid or unverified QR code.");
    }
    const order = mapOrder(orderData);
    
    if (order.status === OrderStatusEnum.COLLECTED) {
        throw new Error("Order has already been collected.");
    }

    if (order.status === OrderStatusEnum.CANCELLED) {
        throw new Error("Cannot collect a cancelled order.");
    }
    
    // Ensure order is paid
    if (order.payment_status !== 'paid' && !order.paymentSuccess) {
        throw new Error("Order payment not verified.");
    }

    const { data: staffData } = await supabase.from('users').select('username').eq('id', staffId).maybeSingle();
    const staffName = staffData?.username || 'Staff';
    
    // Atomic update to mark collected and invalidate token in one step
    const { data: updatedData, error: updateError } = await supabase
        .from('orders')
        .update({
            status: OrderStatusEnum.COLLECTED,
            delivered_by_staff_id: staffId,
            delivered_by_staff_name: staffName,
            delivered_at: new Date().toISOString(),
            qr_token: `REDEEMED-${Date.now()}` // Prevent reuse
        })
        .eq('id', order.id)
        .neq('status', OrderStatusEnum.COLLECTED)
        .select();

    if (updateError) throw updateError;
    if (!updatedData || updatedData.length === 0) {
        throw new Error("Order was already collected by another staff member.");
    }
    
    return mapOrder(updatedData[0]);
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
        .ilike('payment_status', 'paid');
    
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
        .ilike('payment_status', 'paid')
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
    const { data: orders } = await supabase.from('orders').select('items').ilike('payment_status', 'paid');
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
        .ilike('payment_status', 'paid')
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
        .ilike('payment_status', 'paid')
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
        .ilike('payment_status', 'paid')
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

export const getOwnerBankDetails = async (ownerId: string): Promise<OwnerBankDetails> => {
    const { data, error } = await supabase.from('bank_details').select('*').eq('owner_id', ownerId).maybeSingle();
    if (error || !data) return { accountNumber: '', bankName: '', ifscCode: '', upiId: '', email: '', phone: '' };
    return {
        accountNumber: data.account_number,
        bankName: data.bank_name,
        ifscCode: data.ifsc_code,
        upiId: data.upi_id,
        email: data.email,
        phone: data.phone
    };
};

export const requestSaveBankDetailsOtp = async (details: any) => {
    // In a real app, this would send an actual OTP via SMS/Email
    console.log("OTP requested for bank details update:", details);
    return { success: true };
};

export const verifyOtpAndSaveBankDetails = async (details: OwnerBankDetails, otp: string, ownerId: string) => {
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

    const { data: existing } = await supabase.from('bank_details').select('id').eq('owner_id', ownerId).maybeSingle();
    
    if (existing) {
        const { error } = await supabase.from('bank_details').update(dbPayload).eq('owner_id', ownerId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('bank_details').insert([dbPayload]);
        if (error) throw error;
    }
    
    return details;
};

export const getCanteenPhotos = async (ownerId: string): Promise<CanteenPhoto[]> => {
    const { data, error } = await supabase.from('canteen_photos').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(p => ({
        id: p.id,
        data: p.image_url,
        uploadedAt: new Date(p.created_at)
    }));
};

export const addCanteenPhoto = async (file: File, ownerId: string): Promise<CanteenPhoto> => {
    // In a real app, we would upload to Supabase Storage first
    // For now, we'll convert to base64 as a fallback or assume a storage helper exists
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });
    const base64Data = await base64Promise;

    const { data, error } = await supabase.from('canteen_photos').insert([{
        owner_id: ownerId,
        image_url: base64Data,
        created_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;
    return {
        id: data.id,
        data: data.image_url,
        uploadedAt: new Date(data.created_at)
    };
};

export const deleteCanteenPhoto = async (id: string) => {
    const { error } = await supabase.from('canteen_photos').delete().eq('id', id);
    if (error) throw error;
};

export const updateCanteenPhoto = async (id: string, file: File, ownerId: string): Promise<CanteenPhoto> => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });
    const base64Data = await base64Promise;

    const { data, error } = await supabase.from('canteen_photos').update({
        image_url: base64Data
    }).eq('id', id).select().single();

    if (error) throw error;
    return {
        id: data.id,
        data: data.image_url,
        uploadedAt: new Date(data.created_at)
    };
};

export const getOwnerCommissions = async (ownerId: string): Promise<CommissionRecord[]> => {
    const { data, error } = await supabase.from('commissions').select('*').eq('owner_id', ownerId).order('month', { ascending: false });
    if (error) return [];
    return data.map(c => ({
        id: c.id,
        month: c.month,
        ownerId: c.owner_id,
        ownerName: c.owner_name, // Assuming owner_name is stored or joined
        totalIncome: Number(c.total_income),
        commissionAmount: Number(c.commission_amount),
        generatedAt: new Date(c.created_at)
    }));
};

export const getAllCommissions = async (): Promise<CommissionRecord[]> => {
    const { data, error } = await supabase.from('commissions').select('*').order('month', { ascending: false });
    if (error) return [];
    return data.map(c => ({
        id: c.id,
        month: c.month,
        ownerId: c.owner_id,
        ownerName: c.owner_name,
        totalIncome: Number(c.total_income),
        commissionAmount: Number(c.commission_amount),
        generatedAt: new Date(c.created_at)
    }));
};

export const generateMonthlyCommissions = async () => {
    // This logic should ideally be in an Edge Function or Cron Job
    // For now, we'll simulate the trigger
    return { success: true };
};

export const getAllOffersForOwner = async (ownerId?: string): Promise<Offer[]> => {
    let query = supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }
    const { data, error } = await query;
    if (error) return [];
    return data.map(o => ({
        id: o.id,
        code: o.code,
        description: o.description,
        discountType: o.discount_type,
        discountValue: Number(o.discount_value),
        isUsed: false,
        isActive: o.is_active,
        usageCount: o.usage_count || 0,
        redeemedCount: o.redeemed_count || 0,
        isReward: !!o.is_reward
    }));
};

export const createOffer = async (offer: any, ownerId: string) => {
    const { data, error } = await supabase.from('offers').insert([{
        owner_id: ownerId,
        code: offer.code,
        description: offer.description,
        discount_type: offer.discountType,
        discount_value: Number(offer.discountValue),
        is_active: true,
        is_reward: !!offer.isReward
    }]).select().single();
    if (error) throw error;
    return data;
};

export const updateOffer = async (id: string, updates: any) => {
    const { error } = await supabase.from('offers').update({
        code: updates.code,
        description: updates.description,
        discount_type: updates.discountType,
        discount_value: Number(updates.discountValue),
        is_active: updates.isActive
    }).eq('id', id);
    if (error) throw error;
};

export const deleteOffer = async (id: string) => {
    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (error) throw error;
};

export const getAllStudentCoupons = async (studentId: string): Promise<Offer[]> => {
    const { data, error } = await supabase.from('student_coupons').select('*, offers(*)').eq('student_id', studentId);
    if (error) return [];
    return data.map(sc => ({
        id: sc.offers.id,
        code: sc.offers.code,
        description: sc.offers.description,
        discountType: sc.offers.discount_type,
        discountValue: Number(sc.offers.discount_value),
        isUsed: sc.is_used,
        isActive: sc.offers.is_active,
        usageCount: 0,
        redeemedCount: 0,
        isReward: true
    }));
};

export const getAllRewardsForOwner = async (ownerId?: string): Promise<Reward[]> => {
    let query = supabase.from('rewards').select('*').order('points_cost', { ascending: true });
    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }
    const { data, error } = await query;
    if (error) return [];
    return data.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        pointsCost: Number(r.points_cost),
        discount: {
            type: r.discount_type,
            value: Number(r.discount_value)
        },
        isActive: r.is_active,
        expiryDate: r.expiry_date
    }));
};

export const createReward = async (reward: any, ownerId: string) => {
    const { data, error } = await supabase.from('rewards').insert([{
        owner_id: ownerId,
        title: reward.title,
        description: reward.description,
        points_cost: Number(reward.pointsCost),
        discount_type: reward.discount.type,
        discount_value: Number(reward.discount.value),
        is_active: true,
        expiry_date: reward.expiryDate
    }]).select().single();
    if (error) throw error;
    return data;
};

export const updateReward = async (id: string, updates: any) => {
    const { error } = await supabase.from('rewards').update({
        title: updates.title,
        description: updates.description,
        points_cost: Number(updates.pointsCost),
        discount_type: updates.discount.type,
        discount_value: Number(updates.discount.value),
        is_active: updates.isActive,
        expiry_date: updates.expiryDate
    }).eq('id', id);
    if (error) throw error;
};

export const deleteReward = async (id: string) => {
    const { error } = await supabase.from('rewards').delete().eq('id', id);
    if (error) throw error;
};

export const redeemReward = async (studentId: string, rewardId: string) => {
    // This would involve checking points, deducting them, and creating a coupon
    // For now, we'll simulate the success
    return { code: `REWARD-${Math.random().toString(36).substring(7).toUpperCase()}` };
};
export const getOwnerStatus = async (ownerId?: string): Promise<{ isOnline: boolean }> => {
    // If no ownerId is provided, we check if any owner is online (for the student view)
    // In this specific app, we can assume there's one main canteen or check for any approved owner
    const query = supabase.from('users').select('id').eq('role', RoleEnum.CANTEEN_OWNER).eq('approval_status', 'approved');
    
    if (ownerId) {
        query.eq('id', ownerId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return { isOnline: false };
    
    // For now, we'll return true if an approved owner exists. 
    // A more complex implementation would check a specific 'is_online' field.
    return { isOnline: true };
};

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
