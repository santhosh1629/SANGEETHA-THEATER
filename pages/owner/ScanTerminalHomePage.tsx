
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import ScanQrPage from './ScanQrPage'; 
import { getStaffActiveOrders, updateOrderStatus } from '../../services/mockApi';
import type { Order } from '../../types';
import { OrderStatus } from '../../types';

const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const styles = {
        [OrderStatus.PENDING]: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
        [OrderStatus.PREPARED]: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
        [OrderStatus.SEAT_SELECTED]: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
        [OrderStatus.COLLECTED]: 'bg-green-500/20 text-green-300 border-green-500/50',
        [OrderStatus.CANCELLED]: 'bg-red-500/20 text-red-300 border-red-500/50',
    };
    return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border tracking-wider ${styles[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/50'}`}>
            {status}
        </span>
    );
};

const StaffOrderList: React.FC = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const fetchActive = useCallback(async () => {
        try {
            const data = await getStaffActiveOrders();
            setOrders(data);
        } catch (e) {
            console.error("Failed to fetch staff orders", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActive();
        const interval = setInterval(fetchActive, 5000);
        return () => clearInterval(interval);
    }, [fetchActive]);

    const handleMarkDelivered = async (orderId: string) => {
        if (!window.confirm("Confirm order delivery to customer?")) return;
        setIsUpdating(orderId);
        try {
            await updateOrderStatus(orderId, OrderStatus.COLLECTED, user?.id, user?.username);
            await fetchActive();
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Order Delivered!' } }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Delivery confirmation failed.' } }));
        } finally {
            setIsUpdating(null);
        }
    };

    const handleMarkReady = async (orderId: string) => {
        setIsUpdating(orderId);
        try {
            await updateOrderStatus(orderId, OrderStatus.PREPARED);
            await fetchActive();
        } finally {
            setIsUpdating(null);
        }
    };

    if (loading && orders.length === 0) return <div className="p-10 text-center animate-pulse text-gray-500">Loading orders...</div>;

    return (
        <div className="space-y-4 max-w-2xl mx-auto w-full">
            <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Active Orders
                </h3>
                <span className="text-xs text-gray-500 uppercase font-black tracking-widest">{orders.length} Items</span>
            </div>

            {orders.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 text-center">
                    <p className="text-gray-500 font-medium italic">No active orders found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-gray-800/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl shadow-xl transition-all hover:border-indigo-500/30">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-indigo-400 font-heading">#{order.id.slice(-6)}</span>
                                        <OrderStatusBadge status={order.status} />
                                    </div>
                                    <p className="text-lg font-bold text-white uppercase tracking-tight">{order.studentName}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="text-right">
                                    {order.seatNumber ? (
                                        <div className="bg-amber-500 text-black font-black px-4 py-1.5 rounded-xl text-lg shadow-lg shadow-amber-500/20">
                                            🪑 SEAT {order.seatNumber}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-700 text-gray-400 font-bold px-3 py-1 rounded-lg text-xs italic">
                                            Counter Pickup
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-black/20 rounded-xl p-3 mb-4 space-y-1.5 border border-white/5">
                                {order.items.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm items-center">
                                        <span className="text-gray-300">
                                            {item.name} 
                                            <span className="text-indigo-400 font-black ml-2 px-2 py-0.5 bg-indigo-400/10 rounded-md">x{item.quantity}</span>
                                        </span>
                                        <span className="text-xs font-bold text-white/40">₹{item.price}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                     <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Total</p>
                                     <p className="text-xl font-black text-white">₹{order.totalAmount.toFixed(0)}</p>
                                </div>
                                <div className="flex gap-2 flex-[2]">
                                    {order.status !== OrderStatus.PREPARED && (
                                        <button 
                                            onClick={() => handleMarkReady(order.id)}
                                            disabled={!!isUpdating}
                                            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-xs transition-all disabled:opacity-50"
                                        >
                                            Mark Ready
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleMarkDelivered(order.id)}
                                        disabled={!!isUpdating}
                                        className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-sm transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20 disabled:bg-indigo-800"
                                    >
                                        {isUpdating === order.id ? 'Processing...' : 'Confirm Delivery'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ScanTerminalHomePage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState<'dashboard' | 'orders' | 'scan'>('dashboard');

    if (user && user.canteenName) {
        return <Navigate to="/owner/dashboard" replace />;
    }

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans">
            <header className="bg-gray-800/80 backdrop-blur-lg border-b border-white/5 p-4 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-600/20">S</div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter leading-tight uppercase">Staff <span className="text-indigo-400">Terminal</span></h1>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user?.username}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="bg-red-500/10 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all group"
                        title="Logout"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </header>

            <main className="flex-grow p-4 overflow-y-auto pb-24">
                <div className="max-w-4xl mx-auto">
                    {view === 'dashboard' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 animate-fade-in-down">
                            <button 
                                onClick={() => setView('orders')}
                                className="bg-indigo-600 p-8 rounded-[2rem] text-left transition-all hover:bg-indigo-500 group relative overflow-hidden shadow-2xl hover:-translate-y-1 active:scale-95"
                            >
                                <div className="relative z-10">
                                    <span className="text-4xl block mb-4">📜</span>
                                    <h2 className="text-2xl font-black mb-1 uppercase tracking-tight">Active Orders</h2>
                                    <p className="text-indigo-200 text-sm font-medium">View and deliver items to seats</p>
                                </div>
                                <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:rotate-12 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-40 w-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                </div>
                            </button>

                            <button 
                                onClick={() => setView('scan')}
                                className="bg-gray-800 p-8 rounded-[2rem] text-left transition-all hover:bg-gray-700 group relative overflow-hidden shadow-xl border border-white/5 hover:-translate-y-1 active:scale-95"
                            >
                                <div className="relative z-10">
                                    <span className="text-4xl block mb-4">📸</span>
                                    <h2 className="text-2xl font-black mb-1 uppercase tracking-tight">Scan QR</h2>
                                    <p className="text-gray-400 text-sm font-medium">Verify customer pickup</p>
                                </div>
                                <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:rotate-12 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-40 w-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 21v-2M17 21v-2M7 3v2M17 3v2" /></svg>
                                </div>
                            </button>
                        </div>
                    )}

                    {view === 'orders' && (
                        <div className="animate-fade-in-up">
                            <button onClick={() => setView('dashboard')} className="mb-6 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 flex items-center gap-2 bg-white/5 py-2 px-4 rounded-full w-fit transition-all border border-white/5">
                                <span className="text-base">←</span> Back to Dashboard
                            </button>
                            <StaffOrderList />
                        </div>
                    )}

                    {view === 'scan' && (
                        <div className="animate-fade-in-up pt-6">
                            <button onClick={() => setView('dashboard')} className="mb-6 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 flex items-center gap-2 bg-white/5 py-2 px-4 rounded-full w-fit transition-all border border-white/5">
                                <span className="text-base">←</span> Back to Dashboard
                            </button>
                            <div className="max-w-md mx-auto">
                                <ScanQrPage />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-xl border-t border-white/5 h-16 flex items-center justify-around px-6 z-50">
                <button 
                    onClick={() => setView('dashboard')}
                    className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-indigo-400' : 'text-gray-500'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Home</span>
                </button>
                <button 
                    onClick={() => setView('orders')}
                    className={`flex flex-col items-center gap-1 transition-all ${view === 'orders' ? 'text-indigo-400' : 'text-gray-500'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Orders</span>
                </button>
                <button 
                    onClick={() => setView('scan')}
                    className={`flex flex-col items-center gap-1 transition-all ${view === 'scan' ? 'text-indigo-400' : 'text-gray-500'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 21v-2M17 21v-2M7 3v2M17 3v2" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Scan</span>
                </button>
            </nav>
        </div>
    );
};

export default ScanTerminalHomePage;
