
// ... (rest of your imports)

// 1. IMPROVED ERROR HANDLER (Prevents [object Object] logging)
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

// 2. BROAD SALES QUERY (Includes all paid orders)
export const getSalesByDate = async (date: string): Promise<Order[]> => {
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);
    
    const { data, error } = await supabase.from('orders')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('payment_success', true); // Critical: Show money as soon as paid
        
    if (error) return [];
    return data.map(mapOrder);
};

// 3. ITEM SOLD AGGREGATION LOGIC
export const getTodaysDashboardStats = async (): Promise<TodaysDashboardStats> => {
    const today = new Date().toISOString().split('T')[0];
    const orders = await getSalesByDate(today);
    
    const itemMap: Record<string, number> = {};
    let totalIncome = 0;

    orders.forEach(order => {
        totalIncome += Number(order.totalAmount);
        order.items.forEach(item => {
            // Aggregating quantities by item name
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

// ... (rest of your file)
