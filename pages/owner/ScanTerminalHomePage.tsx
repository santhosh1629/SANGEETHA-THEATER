import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import ScanQrPage from './ScanQrPage'; 
import { useStaffOrders } from '../../hooks/useStaffOrders';
import type { Order } from '../../types';
import { OrderStatus } from '../../types';

const OrderStatusBadge: React.FC<{ 
    status: OrderStatus; 
    paymentStatus: string; 
    preparedByName?: string;
    isCurrentStaff?: boolean;
}> = ({ status, paymentStatus, preparedByName, isCurrentStaff }) => {
    const statusStyles: Record<string, string> = {
        [OrderStatus.PAYMENT_PENDING]: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
        [OrderStatus.NEW]: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
        [OrderStatus.PREPARING]: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
        [OrderStatus.READY]: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
        [OrderStatus.COLLECTED]: 'bg-green-500/20 text-green-300 border-green-500/50',
    };
    
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border tracking-wider ${statusStyles[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/50'}`}>
                {status}
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border tracking-wider ${paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                {paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
            </span>
            {preparedByName && (
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${isCurrentStaff ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-purple-500/20 text-purple-300 border-purple-500/40'}`}>
                    👨‍🍳 {isCurrentStaff ? 'Prepared By You ✓' : preparedByName}
                </span>
            )}
        </div>
    );
};

const StaffOrderList: React.FC<{ 
    staffId: string; 
    staffName: string;
    onOpenScanner: (targetOrderId?: string) => void;
}> = ({ staffId, staffName, onOpenScanner }) => {
    const [activeTab, setActiveTab] = useState<'available' | 'my_prepared'>('available');
    const [searchQuery, setSearchQuery] = useState('');
    const [alreadyPreparedModal, setAlreadyPreparedModal] = useState<{
        isOpen: boolean;
        orderId: string;
    } | null>(null);

    const {
        unclaimedOrders,
        myPreparedOrders,
        loading,
        syncing,
        claimingIds,
        actionInProgressIds,
        claimOrder,
        markReady,
        refreshOrders,
        refreshSingleOrder
    } = useStaffOrders(staffId, staffName);

    const handleClaimAndPrepare = async (orderId: string) => {
        try {
            await claimOrder(orderId);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { 
                detail: { message: 'Prepared By You ✓' } 
            }));
            setActiveTab('my_prepared');
        } catch (err: any) {
            // Check specifically for already prepared by another staff member
            if (
                err?.code === 'ALREADY_PREPARED_BY_OTHER' ||
                err?.message === 'This food has already been prepared by another staff member.' ||
                err?.message?.includes('already been prepared') ||
                err?.message?.includes('already claimed')
            ) {
                setAlreadyPreparedModal({
                    isOpen: true,
                    orderId
                });
                return;
            }

            const msg = err?.message || 'Failed to claim order.';
            window.dispatchEvent(new CustomEvent('show-owner-toast', { 
                detail: { message: `⚠️ ${msg}` } 
            }));
        }
    };

    const handleCloseAlreadyPreparedModal = async () => {
        const targetOrderId = alreadyPreparedModal?.orderId;
        setAlreadyPreparedModal(null);
        if (targetOrderId) {
            await refreshSingleOrder(targetOrderId);
        }
    };

    const handleMarkAsReady = async (orderId: string) => {
        try {
            await markReady(orderId);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { 
                detail: { message: '🔔 Order marked READY for customer QR scan!' } 
            }));
        } catch (err: any) {
            window.dispatchEvent(new CustomEvent('show-owner-toast', { 
                detail: { message: `⚠️ ${err.message || 'Failed to update status.'}` } 
            }));
        }
    };

    const filterOrders = useCallback((orderList: Order[]) => {
        if (!searchQuery.trim()) return orderList;
        const q = searchQuery.toLowerCase().trim();
        return orderList.filter(o => 
            o.id.toLowerCase().includes(q) ||
            o.studentName?.toLowerCase().includes(q) ||
            o.seatNumber?.toLowerCase().includes(q) ||
            o.customerPhone?.includes(q)
        );
    }, [searchQuery]);

    const displayedOrders = useMemo(() => {
        const list = activeTab === 'available' ? unclaimedOrders : myPreparedOrders;
        return filterOrders(list);
    }, [activeTab, unclaimedOrders, myPreparedOrders, filterOrders]);

    const readyToDeliverCount = useMemo(() => {
        return myPreparedOrders.filter(o => o.status === OrderStatus.READY).length;
    }, [myPreparedOrders]);

    const getOrderTimeLabel = (order: Order) => {
        if (activeTab === 'available') {
            return `Ordered: ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (order.status === OrderStatus.PREPARING && order.preparedAt) {
            return `Started: ${new Date(order.preparedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (order.status === OrderStatus.READY && order.preparedAt) {
            return `Ready since: ${new Date(order.preparedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return `Placed: ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    return (
        <div className="space-y-4 max-w-2xl mx-auto w-full pb-20">
            {/* Live Sync Status Bar */}
            <div className="flex items-center justify-between bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 text-xs">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-bold text-gray-300">Live Sync Active</span>
                    {syncing && <span className="text-[10px] text-indigo-400 font-mono animate-pulse">(updating...)</span>}
                </div>
                <button 
                    onClick={() => refreshOrders()}
                    className="text-gray-400 hover:text-white text-[11px] font-bold flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg transition-colors"
                >
                    <svg className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="grid grid-cols-2 gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/5">
                <button 
                    onClick={() => setActiveTab('available')}
                    className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'available' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <span>Available Orders</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'available' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
                        {unclaimedOrders.length}
                    </span>
                </button>
                <button 
                    onClick={() => setActiveTab('my_prepared')}
                    className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'my_prepared' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <span>Prepared By Me</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'my_prepared' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
                        {myPreparedOrders.length}
                    </span>
                </button>
            </div>

            {/* Quick Filter Search Bar */}
            <div className="relative">
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Order #, Seat, or Name..."
                    className="w-full bg-gray-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all pl-9"
                />
                <svg className="absolute left-3 top-3 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Ready for QR Scan Banner */}
            {activeTab === 'my_prepared' && readyToDeliverCount > 0 && (
                <div className="bg-gradient-to-r from-emerald-950/60 to-indigo-950/60 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">📸</span>
                        <div>
                            <p className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                                {readyToDeliverCount} {readyToDeliverCount === 1 ? 'Order' : 'Orders'} Ready to Deliver
                            </p>
                            <p className="text-[10px] text-gray-400">Customer QR scan is required to complete handover.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onOpenScanner()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
                    >
                        <span>Open Scanner</span>
                        <span>→</span>
                    </button>
                </div>
            )}

            {/* Orders Feed */}
            {loading && unclaimedOrders.length === 0 && myPreparedOrders.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Connecting to Staff Terminal...</p>
                </div>
            ) : displayedOrders.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 text-center">
                    <p className="text-4xl mb-3 opacity-30">🍿</p>
                    <p className="text-gray-400 font-bold text-sm">
                        {searchQuery 
                            ? 'No orders match your filter.'
                            : activeTab === 'available' 
                                ? 'No pending unclaimed orders at the moment.' 
                                : 'You have no active claimed orders in progress.'}
                    </p>
                    {activeTab === 'my_prepared' && unclaimedOrders.length > 0 && (
                        <button 
                            onClick={() => setActiveTab('available')}
                            className="mt-4 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold py-2 px-4 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                        >
                            View Available Orders ({unclaimedOrders.length})
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3.5">
                    {displayedOrders.map(order => {
                        const isClaiming = claimingIds.has(order.id);
                        const isActionInProgress = actionInProgressIds.has(order.id);
                        const isClaimedByOther = !!order.preparedBy && order.preparedBy !== staffId;

                        return (
                            <div 
                                key={order.id} 
                                id={`staff-order-card-${order.id}`}
                                className="bg-gray-800/60 backdrop-blur-md border border-white/10 p-4 sm:p-5 rounded-2xl shadow-xl transition-all hover:border-indigo-500/40 space-y-3.5"
                            >
                                {/* Header Info */}
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-indigo-400 font-mono tracking-wider">
                                                #{order.id.slice(-6).toUpperCase()}
                                            </span>
                                            <OrderStatusBadge 
                                                status={order.status} 
                                                paymentStatus={order.payment_status} 
                                                preparedByName={order.preparedByName}
                                                isCurrentStaff={order.preparedBy === staffId}
                                            />
                                        </div>
                                        <div className="pt-0.5">
                                            <p className="text-base font-bold text-white uppercase tracking-tight">
                                                {order.studentName || 'Customer'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-mono">
                                                {getOrderTimeLabel(order)}
                                                {order.customerPhone && <span className="ml-2 text-gray-500">• {order.customerPhone}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {order.seatNumber ? (
                                            <div className="bg-amber-500 text-black font-black px-3.5 py-1.5 rounded-xl text-sm shadow-md shadow-amber-500/20 flex flex-col items-center">
                                                <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-80">Seat</span>
                                                <span className="leading-none">{order.seatNumber}</span>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-700/80 text-gray-300 font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider border border-white/5">
                                                Counter Pickup
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="bg-black/30 rounded-xl p-3 space-y-1.5 border border-white/5">
                                    {order.items.map((item, idx) => (
                                        <div key={`${order.id}-item-${idx}`} className="flex justify-between text-xs sm:text-sm items-center">
                                            <span className="text-gray-200 font-medium">{item.name}</span>
                                            <span className="text-indigo-300 font-black px-2 py-0.5 bg-indigo-500/20 rounded-md">
                                                x{item.quantity}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Workflow Action Buttons */}
                                <div>
                                    {activeTab === 'available' ? (
                                        isClaimedByOther ? (
                                            <div 
                                                id={`order-claimed-by-other-${order.id}`}
                                                className="w-full bg-purple-950/40 border border-purple-500/40 text-purple-300 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-inner"
                                            >
                                                <span>👨‍🍳 Prepared by {order.preparedByName || 'another staff member'}</span>
                                            </div>
                                        ) : (
                                            <button 
                                                id={`claim-order-btn-${order.id}`}
                                                onClick={() => handleClaimAndPrepare(order.id)}
                                                disabled={isClaiming}
                                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-98 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                                            >
                                                {isClaiming ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                        <span>Claiming Order...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>👨‍🍳 PREPARED BY ME</span>
                                                    </>
                                                )}
                                            </button>
                                        )
                                    ) : (
                                        <div className="space-y-2">
                                            {order.status === OrderStatus.PREPARING && (
                                                <button 
                                                    onClick={() => handleMarkAsReady(order.id)}
                                                    disabled={isActionInProgress}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-98 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                                >
                                                    {isActionInProgress ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                            <span>Updating...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>🔔 MARK AS READY</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {order.status === OrderStatus.READY && (
                                                <button 
                                                    onClick={() => onOpenScanner(order.id)}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all transform active:scale-98 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
                                                >
                                                    <span>📸 SCAN CUSTOMER QR TO DELIVER</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Already Prepared By Other Dialog Modal */}
            {alreadyPreparedModal && (
                <div 
                    id="already-prepared-dialog-backdrop"
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                >
                    <div 
                        id="already-prepared-dialog"
                        className="w-full max-w-sm bg-gray-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl shadow-black/80 space-y-4"
                    >
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                                👨‍🍳
                            </div>
                            <div className="space-y-1">
                                <h3 
                                    id="already-prepared-dialog-title" 
                                    className="text-base font-black text-white tracking-tight"
                                >
                                    Already Prepared By Other
                                </h3>
                                <p 
                                    id="already-prepared-dialog-message" 
                                    className="text-xs text-gray-300 leading-relaxed"
                                >
                                    This food has already been prepared by another staff member.
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                id="already-prepared-dialog-ok-btn"
                                onClick={handleCloseAlreadyPreparedModal}
                                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ScanTerminalHomePage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState<'dashboard' | 'orders' | 'scan'>('dashboard');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        const handleToast = (e: any) => {
            const msg = e.detail?.message;
            if (msg) {
                setToastMessage(msg);
                setTimeout(() => {
                    setToastMessage(prev => prev === msg ? null : prev);
                }, 3500);
            }
        };
        window.addEventListener('show-owner-toast', handleToast);
        return () => window.removeEventListener('show-owner-toast', handleToast);
    }, []);

    if (user && user.canteenName) {
        return <Navigate to="/owner/dashboard" replace />;
    }

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleOpenScanner = (targetOrderId?: string) => {
        setView('scan');
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
            {/* Toast Notification Banner */}
            {toastMessage && (
                <div 
                    id="terminal-toast-banner" 
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] bg-gray-900/95 border border-emerald-500/40 text-emerald-300 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-black flex items-center gap-2 animate-fade-in-down"
                >
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Navigation Bar */}
            <header className="bg-gray-900/90 backdrop-blur-xl border-b border-white/10 p-3.5 sm:p-4 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center font-black text-lg shadow-md shadow-indigo-600/30">
                            S
                        </div>
                        <div>
                            <h1 className="text-base font-black tracking-tight uppercase leading-tight">
                                Smart <span className="text-indigo-400">Terminal</span>
                            </h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                {user?.username || 'Staff'} • Canteen Crew
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="bg-red-500/10 text-red-400 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
                        title="Logout"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-grow p-4 overflow-y-auto pb-24">
                <div className="max-w-4xl mx-auto">
                    {view === 'dashboard' && (
                        <div className="space-y-6 pt-4 animate-fade-in-down">
                            <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 p-6 rounded-3xl">
                                <h2 className="text-xl sm:text-2xl font-black mb-1 tracking-tight">
                                    Welcome back, {user?.username}! 🍿
                                </h2>
                                <p className="text-gray-400 text-xs sm:text-sm">
                                    Claim active orders, mark preparation progress, and verify customer QR codes.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setView('orders')}
                                    className="bg-gray-900/80 hover:bg-gray-850 p-6 rounded-3xl text-left transition-all border border-white/10 hover:border-indigo-500/50 shadow-xl group"
                                >
                                    <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">📜</span>
                                    <h3 className="text-xl font-black mb-1 uppercase tracking-tight text-white">Live Orders</h3>
                                    <p className="text-gray-400 text-xs font-medium">Claim, prepare & track live orders in real-time.</p>
                                    <div className="mt-4 flex items-center text-xs font-bold text-indigo-400 gap-1">
                                        <span>Open Orders Ledger</span>
                                        <span>→</span>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setView('scan')}
                                    className="bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 p-6 rounded-3xl text-left transition-all shadow-xl shadow-indigo-600/20 group"
                                >
                                    <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">📸</span>
                                    <h3 className="text-xl font-black mb-1 uppercase tracking-tight text-white">QR Delivery Scan</h3>
                                    <p className="text-indigo-100 text-xs font-medium">Scan customer QR codes for mandatory verification.</p>
                                    <div className="mt-4 flex items-center text-xs font-bold text-white gap-1">
                                        <span>Launch Camera Scanner</span>
                                        <span>→</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {view === 'orders' && (
                        <div className="animate-fade-in-up">
                            <div className="flex items-center justify-between mb-4">
                                <button 
                                    onClick={() => setView('dashboard')} 
                                    className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white flex items-center gap-1.5 bg-white/5 py-2 px-3.5 rounded-xl transition-all border border-white/5"
                                >
                                    <span>←</span> Dashboard
                                </button>
                                <button 
                                    onClick={() => setView('scan')}
                                    className="text-xs font-bold uppercase tracking-wider text-indigo-300 hover:text-white flex items-center gap-1.5 bg-indigo-600/20 py-2 px-3.5 rounded-xl transition-all border border-indigo-500/30"
                                >
                                    <span>📸</span> Scan QR
                                </button>
                            </div>
                            <StaffOrderList 
                                staffId={user?.id || ''} 
                                staffName={user?.username || 'Staff'} 
                                onOpenScanner={handleOpenScanner}
                            />
                        </div>
                    )}

                    {view === 'scan' && (
                        <div className="animate-fade-in-up pt-2">
                            <div className="flex items-center justify-between mb-4 max-w-sm mx-auto">
                                <button 
                                    onClick={() => setView('dashboard')} 
                                    className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white flex items-center gap-1.5 bg-white/5 py-2 px-3.5 rounded-xl transition-all border border-white/5"
                                >
                                    <span>←</span> Dashboard
                                </button>
                                <button 
                                    onClick={() => setView('orders')}
                                    className="text-xs font-bold uppercase tracking-wider text-indigo-300 hover:text-white flex items-center gap-1.5 bg-indigo-600/20 py-2 px-3.5 rounded-xl transition-all border border-indigo-500/30"
                                >
                                    <span>📜</span> View Orders
                                </button>
                            </div>
                            <div className="max-w-sm mx-auto">
                                <ScanQrPage />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Floating Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-2xl border-t border-white/10 h-16 flex items-center justify-around px-6 z-50">
                <button 
                    onClick={() => setView('dashboard')} 
                    className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-gray-400'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-wider">Home</span>
                </button>
                <button 
                    onClick={() => setView('orders')} 
                    className={`flex flex-col items-center gap-1 transition-all ${view === 'orders' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-gray-400'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-wider">Orders</span>
                </button>
                <button 
                    onClick={() => setView('scan')} 
                    className={`flex flex-col items-center gap-1 transition-all ${view === 'scan' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-gray-400'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 21v-2M17 21v-2M7 3v2M17 3v2" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-wider">Scan QR</span>
                </button>
            </nav>
        </div>
    );
};

export default ScanTerminalHomePage;
