import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import ScanQrPage from './ScanQrPage'; 
import { getStaffUnclaimedPendingOrders, getStaffMyPreparedOrders, markOrderAsPreparing, markOrderAsReady, supabase } from '../../services/mockApi';
import type { Order } from '../../types';
import { OrderStatus } from '../../types';

const OrderStatusBadge: React.FC<{ status: OrderStatus; paymentStatus: string }> = ({ status, paymentStatus }) => {
    const styles = {
        [OrderStatus.PAYMENT_PENDING]: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
        [OrderStatus.QR_GENERATED]: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
        [OrderStatus.PREPARING]: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
        [OrderStatus.READY]: 'bg-green-500/20 text-green-300 border-green-500/50',
        [OrderStatus.PREPARED]: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
        [OrderStatus.COLLECTED]: 'bg-green-500/20 text-green-300 border-green-500/50',
        [OrderStatus.DELIVERED]: 'bg-green-500/20 text-green-300 border-green-500/50',
    };
    
    return (
        <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border tracking-wider ${styles[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/50'}`}>
                {status === OrderStatus.QR_GENERATED ? 'PENDING' : status}
            </span>
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border tracking-wider ${paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                {paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
            </span>
        </div>
    );
};

const StaffOrderList: React.FC<{ staffId: string; staffName: string }> = ({ staffId, staffName }) => {
    const [activeTab, setActiveTab] = useState<'available' | 'my_prepared'>('available');
    const [unclaimedOrders, setUnclaimedOrders] = useState<Order[]>([]);
    const [myPreparedOrders, setMyPreparedOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [unclaimed, myPrepared] = await Promise.all([
                getStaffUnclaimedPendingOrders(),
                getStaffMyPreparedOrders(staffId)
            ]);
            setUnclaimedOrders(unclaimed);
            setMyPreparedOrders(myPrepared);
        } catch (e) {
            console.error("Failed to fetch staff orders", e);
        } finally {
            setLoading(false);
        }
    }, [staffId]);

    useEffect(() => {
        fetchData();
        
        const ordersSubscription = supabase
            .channel('orders-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersSubscription);
        };
    }, [fetchData]);

    const handleClaimAndPrepare = async (orderId: string) => {
        const orderToClaim = unclaimedOrders.find(o => o.id === orderId);
        if (!orderToClaim) return;

        try {
            await markOrderAsPreparing(orderId, staffId, staffName);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Order assigned to you!' } }));
            fetchData();
            setActiveTab('my_prepared');
        } catch (e) {
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Failed to claim order.' } }));
        }
    };

    const handleMarkAsReady = async (orderId: string) => {
        try {
            await markOrderAsReady(orderId);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Order is now READY!' } }));
            fetchData();
        } catch (e) {
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Failed to update status.' } }));
        }
    };

    const ordersToDisplay = activeTab === 'available' ? unclaimedOrders : myPreparedOrders;

    if (loading && unclaimedOrders.length === 0 && myPreparedOrders.length === 0) {
        return <div className="p-10 text-center text-gray-500 uppercase tracking-widest font-black">Scanning ledger...</div>;
    }

    return (
        <div className="space-y-4 max-w-2xl mx-auto w-full pb-20">
            <div className="flex bg-black/30 p-1 rounded-2xl border border-white/5 mb-6">
                <button 
                    onClick={() => setActiveTab('available')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'available' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Available ({unclaimedOrders.length})
                </button>
                <button 
                    onClick={() => setActiveTab('my_prepared')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'my_prepared' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Prepared By Me ({myPreparedOrders.length})
                </button>
            </div>

            {ordersToDisplay.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 text-center animate-pop-in">
                    <p className="text-4xl mb-4 opacity-30">🍿</p>
                    <p className="text-gray-500 font-medium italic">
                        {activeTab === 'available' 
                            ? 'No pending orders found.' 
                            : 'No prepared items in this view.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {ordersToDisplay.map(order => (
                        <div key={order.id} className="bg-gray-800/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl shadow-xl transition-all hover:border-indigo-500/30 animate-fade-in-up">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-black text-indigo-400 font-heading tracking-widest">#{order.id.slice(-6).toUpperCase()}</span>
                                        <OrderStatusBadge status={order.status} paymentStatus={order.payment_status} />
                                    </div>
                                    <p className="text-lg font-bold text-white uppercase tracking-tight mt-2">{order.studentName}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">
                                        {activeTab === 'available' 
                                            ? `Time: ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                            : `Ready: ${order.preparedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {order.seatNumber ? (
                                        <div className="bg-amber-500 text-black font-black px-4 py-1.5 rounded-xl text-lg shadow-lg shadow-amber-500/20">
                                            SEAT {order.seatNumber}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-700 text-gray-400 font-bold px-3 py-1 rounded-lg text-[10px] italic">
                                            COUNTER
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
                                    </div>
                                ))}
                            </div>

                            {activeTab === 'available' ? (
                                <button 
                                    onClick={() => handleClaimAndPrepare(order.id)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-sm transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20"
                                >
                                    PREPARE BY ME
                                </button>
                            ) : (
                                order.status === OrderStatus.PREPARING && (
                                    <button 
                                        onClick={() => handleMarkAsReady(order.id)}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl text-sm transition-all transform active:scale-95 shadow-lg shadow-green-600/20"
                                    >
                                        MARK AS READY
                                    </button>
                                )
                            )}
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
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">S</div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter uppercase leading-tight">Staff <span className="text-indigo-400">Terminal</span></h1>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user?.username}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="bg-red-500/10 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all">
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
                                className="bg-gray-800 p-8 rounded-[2rem] text-left transition-all border border-white/5 hover:bg-gray-700 shadow-xl"
                            >
                                <span className="text-4xl block mb-4">📜</span>
                                <h2 className="text-2xl font-black mb-1 uppercase tracking-tight">Orders</h2>
                                <p className="text-gray-400 text-sm font-medium">Claim & prepare live orders</p>
                            </button>

                            <button 
                                onClick={() => setView('scan')}
                                className="bg-indigo-600 p-8 rounded-[2rem] text-left transition-all hover:bg-indigo-500 shadow-2xl"
                            >
                                <span className="text-4xl block mb-4">📸</span>
                                <h2 className="text-2xl font-black mb-1 uppercase tracking-tight">Scan QR</h2>
                                <p className="text-indigo-200 text-sm font-medium">Complete delivery by scan</p>
                            </button>
                        </div>
                    )}

                    {view === 'orders' && (
                        <div className="animate-fade-in-up">
                            <button onClick={() => setView('dashboard')} className="mb-6 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 flex items-center gap-2 bg-white/5 py-2 px-4 rounded-full w-fit transition-all border border-white/5">
                                <span className="text-base">←</span> Back
                            </button>
                            <StaffOrderList staffId={user?.id || ''} staffName={user?.username || 'Staff'} />
                        </div>
                    )}

                    {view === 'scan' && (
                        <div className="animate-fade-in-up pt-6">
                            <button onClick={() => setView('dashboard')} className="mb-6 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 flex items-center gap-2 bg-white/5 py-2 px-4 rounded-full w-fit transition-all border border-white/5">
                                <span className="text-base">←</span> Back
                            </button>
                            <div className="max-w-md mx-auto">
                                <ScanQrPage />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-xl border-t border-white/5 h-16 flex items-center justify-around px-6 z-50">
                <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-indigo-400' : 'text-gray-500'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Home</span>
                </button>
                <button onClick={() => setView('orders')} className={`flex flex-col items-center gap-1 transition-all ${view === 'orders' ? 'text-indigo-400' : 'text-gray-500'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Orders</span>
                </button>
                <button onClick={() => setView('scan')} className={`flex flex-col items-center gap-1 transition-all ${view === 'scan' ? 'text-indigo-400' : 'text-gray-500'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 21v-2M17 21v-2M7 3v2M17 3v2" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Scan</span>
                </button>
            </nav>
        </div>
    );
};

export default ScanTerminalHomePage;