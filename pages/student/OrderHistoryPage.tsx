
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import type { Order, CartItem, MenuItem } from '../../types';
import { OrderStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getStudentOrders, getMenu, supabase } from '../../services/mockApi';

const getCartFromStorage = (): CartItem[] => {
    const cart = localStorage.getItem('cart');
    const parsedCart = cart ? JSON.parse(cart) : [];
    return parsedCart;
};

const saveCartToStorage = (cart: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(cart));
};

const OrderCard: React.FC<{ order: Order; onReorder: (order: Order) => void; }> = ({ order, onReorder }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const isCollected = order.status === OrderStatus.COLLECTED || order.status === OrderStatus.DELIVERED;
    const isPaid = order.payment_status === 'paid' || order.paymentSuccess;

    return (
        <div className="bg-surface backdrop-blur-lg border border-surface-light rounded-3xl shadow-xl overflow-hidden transition-all duration-300 mb-5 text-textPrimary group">
            <div 
                className="p-5 flex justify-between items-center cursor-pointer hover:bg-white/5"
                onClick={() => setIsExpanded(!isExpanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsExpanded(!isExpanded)}
            >
                <div className="space-y-1">
                    <p className="font-black font-heading text-lg tracking-tight">
                        ORDER <span className="text-primary">#{order.id.slice(-6).toUpperCase()}</span>
                    </p>
                    <p className="text-xs text-textSecondary font-bold uppercase tracking-widest opacity-60">
                        {order.timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {order.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    
                    {/* STATUS BADGES */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-1 rounded-md font-black border border-green-500/30 uppercase tracking-tighter">
                            PAID ✅
                        </span>
                        {isCollected ? (
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-1 rounded-md font-black border border-indigo-500/30 uppercase tracking-tighter">
                                COLLECTED ✅
                            </span>
                        ) : (
                            <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-md font-black border border-red-500/30 uppercase tracking-tighter animate-pulse">
                                NOT COLLECTED ❌
                            </span>
                        )}
                    </div>
                    
                    {/* STAFF DELIVERY INFO */}
                    <div className="pt-2">
                        {isCollected ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg w-fit border border-indigo-500/20">
                                <span>🤝</span>
                                <span>Delivered By: <span className="text-white uppercase">{order.deliveredByStaffName || 'Sangeetha Staff'}</span></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 bg-black/20 px-2 py-1 rounded-lg w-fit border border-white/5">
                                <span>⌛</span>
                                <span>Delivered By: Not yet delivered</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                         <p className="font-black font-heading text-2xl text-white">₹{(order.totalAmount || 0).toFixed(0)}</p>
                         <p className="text-[10px] text-textSecondary uppercase font-black opacity-40">Total Amount</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-primary transition-transform duration-500 ${isExpanded ? 'rotate-180 scale-125' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isExpanded && (
                <div className="p-6 bg-black/40 border-t border-white/5 animate-fade-in-down">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Items Summary</h4>
                            <div className="space-y-3">
                                {order.items.map(item => (
                                    <div key={item.id} className="flex justify-between items-center text-sm bg-white/5 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-white font-bold">{item.name}</p>
                                            {item.notes && <p className="text-[10px] text-primary italic">Note: "{item.notes}"</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-white">x{item.quantity}</p>
                                            <p className="text-[10px] text-textSecondary font-bold">₹{(item.price * item.quantity).toFixed(0)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/20">
                                <div className="flex justify-between font-black font-heading text-xl text-white uppercase tracking-tighter">
                                    <span>Verified Paid</span>
                                    <span className="text-primary">₹{(order.totalAmount || 0).toFixed(0)}</span>
                                </div>
                            </div>

                            {isCollected && order.deliveredAt && (
                                <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-center">
                                    <p className="text-[10px] text-indigo-300/60 uppercase font-black tracking-widest">Collection Timestamp</p>
                                    <p className="text-xs font-bold text-indigo-200 mt-1">{new Date(order.deliveredAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-center justify-center text-center sm:border-l sm:border-white/5 sm:pl-8">
                             {!isCollected ? (
                                <div className="animate-pop-in">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary mb-4">Counter Pickup Code</p>
                                    <div className="p-3 bg-white rounded-[2rem] shadow-2xl shadow-primary/20 border-8 border-primary/10">
                                        <QRCodeSVG value={order.qrToken || 'NO-TOKEN'} size={150} fgColor="#1E293B" />
                                    </div>
                                    <p className="mt-4 text-xs font-bold text-primary animate-pulse uppercase tracking-widest">Show this to staff</p>
                                </div>
                             ) : (
                                <div className="opacity-50">
                                     <div className="w-32 h-32 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 border-4 border-green-500/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                     </div>
                                     <p className="text-lg font-black font-heading uppercase text-white">Order Collected</p>
                                     <p className="text-xs font-medium text-gray-400 mt-1 italic">Served by: {order.deliveredByStaffName || 'Our Team'}</p>
                                </div>
                             )}
                        </div>
                    </div>
                     <div className="mt-8 pt-6 border-t border-white/5">
                        <button
                            onClick={() => onReorder(order)}
                            className="w-full bg-primary text-white font-black py-4 px-6 rounded-2xl hover:bg-primary-dark transition-all transform active:scale-95 shadow-xl shadow-primary/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                            Order Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const OrderHistoryPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const { user, loading: authLoading, promptForPhone } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
        if (!authLoading && !user) {
            promptForPhone();
        }
    }, [user, authLoading, promptForPhone]);

    const fetchInitialData = useCallback(async () => {
        if (user) {
            setLoading(true);
            try {
                const [ordersData, menuData] = await Promise.all([
                    getStudentOrders(user.id, 0),
                    getMenu()
                ]);
                setOrders(ordersData);
                setMenu(menuData);
                setHasMore(ordersData.length === 20);
            } catch (error) {
                console.error("Failed to fetch order history", error);
            } finally {
                setLoading(false);
            }
        }
    }, [user]);

    // Real-time synchronization
    useEffect(() => {
        if (!user) return;
        
        const channel = supabase
            .channel('history-realtime')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders', 
                filter: `student_id=eq.${user.id}` 
            }, (payload) => {
                setOrders(prev => prev.map(o => o.id === payload.new.id ? { 
                    ...o, 
                    status: payload.new.status as OrderStatus,
                    deliveredByStaffName: payload.new.delivered_by_staff_name,
                    deliveredAt: payload.new.delivered_at ? new Date(payload.new.delivered_at) : undefined
                } : o));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const fetchMoreOrders = async () => {
        if (!user || loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        try {
            const moreOrders = await getStudentOrders(user.id, nextPage);
            if (moreOrders.length === 0) {
                setHasMore(false);
            } else {
                setOrders(prev => [...prev, ...moreOrders]);
                setPage(nextPage);
                if (moreOrders.length < 20) setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);
    
    const handleReorder = (orderToReorder: Order) => {
        const currentCart = getCartFromStorage();
        let itemsAdded = 0;

        orderToReorder.items.forEach(orderItem => {
            const fullMenuItem = menu.find(menuItem => menuItem.id === orderItem.id);
            if (fullMenuItem && fullMenuItem.isAvailable) {
                const cartItemIndex = currentCart.findIndex(ci => ci.id === orderItem.id);
                if (cartItemIndex > -1) {
                    currentCart[cartItemIndex].quantity += orderItem.quantity;
                } else {
                    currentCart.push({ ...fullMenuItem, quantity: orderItem.quantity, notes: orderItem.notes });
                }
                itemsAdded++;
            }
        });

        if (itemsAdded > 0) {
            saveCartToStorage(currentCart);
            window.dispatchEvent(new CustomEvent('itemAddedToCart'));
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${itemsAdded} item(s) re-added!`, type: 'cart-add' } }));
            navigate('/customer/cart');
        } else {
             window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Items are currently out of stock.', type: 'stock-out' } }));
        }
    };

    if (loading || !user) {
        return (
            <div className="space-y-6 pt-6">
                <div className="h-12 bg-white/5 rounded-3xl w-1/2 mb-8 animate-pulse"></div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-white/5 rounded-[2.5rem] animate-pulse"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pt-4 pb-20">
            <h1 className="text-4xl font-black font-heading mb-2 text-white uppercase tracking-tighter">Order <span className="text-primary animate-sparkle">History</span></h1>
            <p className="text-textSecondary text-sm font-medium mb-8 opacity-60">Displaying your verified paid orders only.</p>

            {orders.length > 0 ? (
                <div className="pb-10">
                    {orders.map(order => (
                        <OrderCard key={order.id} order={order} onReorder={handleReorder} />
                    ))}
                    
                    {hasMore && (
                        <button 
                            onClick={fetchMoreOrders}
                            disabled={loadingMore}
                            className="w-full py-5 mt-4 bg-white/5 border border-white/5 rounded-[2rem] text-textSecondary font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all disabled:opacity-50"
                        >
                            {loadingMore ? 'Loading Ledger...' : 'Load Older Receipts'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="text-center py-24 bg-surface/50 backdrop-blur-lg border border-white/5 rounded-[3rem] shadow-2xl">
                    <span className="text-6xl mb-6 block opacity-30">📜</span>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">No History Yet</h3>
                    <p className="text-textSecondary mt-2 max-w-xs mx-auto font-medium">Place your first order to see it appear here once payment is confirmed!</p>
                    <button 
                        onClick={() => navigate('/customer/menu')}
                        className="mt-8 bg-primary text-white font-black py-4 px-8 rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-primary/20 uppercase tracking-widest text-xs"
                    >
                        Browse Menu
                    </button>
                </div>
            )}
        </div>
    );
};

export default OrderHistoryPage;
