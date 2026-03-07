
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Order, MenuItem, SalesSummary, StudentPoints, TodaysDashboardStats, User } from '../../types';
import { OrderStatus } from '../../types';
import { 
    getOwnerOrders, updateOrderStatus, getMenu, updateMenuAvailability, getSalesSummary, 
    getMostSellingItems, getOrderStatusSummary, getStudentPointsList, getTodaysDashboardStats, getTodaysDetailedReport,
    getScanTerminalStaff, deleteScanTerminalStaff, getSalesByDate, supabase
} from '../../services/mockApi';
import { useAuth } from '../../context/AuthContext';

// For xlsx library loaded from CDN
declare const XLSX: any;

type DashboardTab = 'live' | 'seats' | 'sales' | 'analytics' | 'management' | 'history' | 'staff';

// --- Reusable Components & Icons ---

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.1 0 1 0-.708.708l3 3z"/>
    </svg>
);

const PIE_COLORS = ['#fbbf24', '#60a5fa', '#4ade80']; // amber-400, blue-400, green-400

// --- Tab Components ---

const SalesView: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [salesOrders, setSalesOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getSalesByDate(selectedDate);
            setSalesOrders(data);
        } catch (error) {
            console.error("Error fetching sales by date:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const totalRevenue = useMemo(() => salesOrders.reduce((sum, o) => sum + o.totalAmount, 0), [salesOrders]);
    
    const dateObj = new Date(selectedDate);
    const monthYear = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-200">Date-wise Sales Reports</h2>
                        <p className="text-gray-400 text-sm">Review financial performance for {monthYear}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-col">
                            <label className="text-xs text-gray-500 font-bold mb-1 uppercase">Select Date</label>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2"
                            />
                        </div>
                        <button 
                            onClick={fetchSales} 
                            disabled={isLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-lg mt-5 flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <svg className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                        <p className="mt-4 text-gray-400">Fetching sales data...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700 text-center">
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">📦 Total Orders</p>
                                <p className="text-4xl font-black text-white">{salesOrders.length}</p>
                            </div>
                            <div className="bg-green-900/20 p-6 rounded-xl border border-green-800/30 text-center">
                                <p className="text-green-400/70 text-sm font-bold uppercase tracking-wider mb-2">💰 Total Sales Amount</p>
                                <p className="text-4xl font-black text-green-400">₹{totalRevenue.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="bg-gray-900/30 rounded-xl overflow-hidden border border-gray-700">
                            <h3 className="bg-gray-700/50 px-6 py-4 font-bold text-gray-200">Orders Collected on {new Date(selectedDate).toLocaleDateString()}</h3>
                            {salesOrders.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-800">
                                        <thead className="bg-gray-800/40">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Order ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Customer</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Amount</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Pickup Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {salesOrders.map(order => (
                                                <tr key={order.id} className="hover:bg-gray-800/30">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">...{order.id.slice(-6)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{order.studentName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400">₹{order.totalAmount.toFixed(2)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">
                                                        {order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-20 text-center text-gray-500">
                                    <p className="text-4xl mb-4">🏜️</p>
                                    <p className="font-bold">No sales recorded on this date.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const DailyStats: React.FC<{ stats: TodaysDashboardStats }> = ({ stats }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadReport = async () => {
        setIsDownloading(true);
        try {
            const reportData = await getTodaysDetailedReport();
            const summaryData = [
                ["Daily Report Summary"], [],
                ["Date", reportData.date],
                ["Total Orders", reportData.totalOrders],
                ["Total Income (₹)", reportData.totalIncome.toFixed(2)],
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            const itemSalesData = [
                ["Item Name", "Quantity Sold", "Total Price (₹)"],
                ...reportData.itemSales.map(item => [item.name, item.quantity, item.totalPrice])
            ];
            const wsItems = XLSX.utils.aoa_to_sheet(itemSalesData);
            wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }];
            wsItems['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
            XLSX.utils.book_append_sheet(wb, wsItems, "Item-wise Sales");
            XLSX.writeFile(wb, `Daily_Report_${reportData.date}.xlsx`);
        } catch (error) { console.error("Failed to generate report", error); } 
        finally { setIsDownloading(false); }
    };

    return (
        <div className="mb-6">
             <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-bold text-gray-200">Today's Summary ({new Date().toLocaleDateString()})</h2>
                <button onClick={handleDownloadReport} disabled={isDownloading} className="bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-600 hover:bg-gray-600 transform hover:-translate-y-0.5">
                    <DownloadIcon /> {isDownloading ? 'Generating...' : 'Download Report'}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg shadow-md flex items-center gap-4 border border-gray-700">
                     <div className="bg-indigo-500/20 text-indigo-400 p-4 rounded-full text-3xl">📦</div>
                     <div>
                        <p className="text-sm text-gray-400">Total Orders</p>
                        <p className="text-3xl font-bold text-white">{stats.totalOrders}</p>
                     </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-md flex items-center gap-4 border border-gray-700">
                    <div className="bg-green-500/20 text-green-300 p-4 rounded-full text-3xl">💰</div>
                     <div>
                        <p className="text-sm text-gray-400">Total Income</p>
                        <p className="text-3xl font-bold text-white">₹{stats.totalIncome.toFixed(2)}</p>
                     </div>
                </div>
                <div className="md:col-span-2 lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
                    <h3 className="font-bold mb-2 text-gray-200">Items Sold Today</h3>
                     {stats.itemsSold.length > 0 ? (
                        <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                            {stats.itemsSold.map(item => (
                                <li key={item.name} className="flex justify-between text-sm">
                                    <span className="text-gray-300">{item.name}</span>
                                    <span className="font-bold text-white">x {item.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-gray-400">No items sold yet today.</p>}
                </div>
            </div>
        </div>
    );
};

const StaffScanLeaderboard: React.FC<{ counts: { name: string; count: number }[] }> = ({ counts }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h2 className="text-2xl font-bold text-gray-200 mb-4">Today's Staff Scans 🏆</h2>
        {counts.length > 0 ? (
            <ul className="space-y-3">
                {counts.map((staff, index) => (
                    <li key={staff.name + index} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg transition-transform hover:scale-105">
                        <div className="flex items-center gap-3">
                            <span className={`font-bold text-lg w-8 text-center ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </span>
                            <span className="font-semibold text-white">{staff.name}</span>
                        </div>
                        <span className="font-black text-xl text-indigo-400">{staff.count} scans</span>
                    </li>
                ))}
            </ul>
        ) : (
            <p className="text-center text-gray-400 py-4">No scans recorded by staff today.</p>
        )}
    </div>
);


const OrdersManager: React.FC<{orders: Order[], onStatusUpdate: (orderId: string, newStatus: OrderStatus) => Promise<void>, onViewOrder: (order: Order) => void}> = ({ orders, onStatusUpdate, onViewOrder }) => {
    // REQUIREMENT: Strict filtering logic for LIVE view
    const currentActiveOrders = useMemo(() => 
        orders
            .filter(o => 
                (o.payment_status === 'paid' || o.paymentSuccess) && 
                o.status !== OrderStatus.COLLECTED && 
                o.status !== OrderStatus.DELIVERED &&
                o.status !== OrderStatus.CANCELLED
            )
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), 
        [orders]
    );

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-200">Current Orders 🛎️</h2>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Showing Paid & Not Collected Only</p>
                </div>
                <div className="bg-indigo-600/10 border border-indigo-500/20 px-4 py-2 rounded-xl">
                    <span className="text-indigo-400 font-black">{currentActiveOrders.length} ORDERS PENDING</span>
                </div>
            </div>

            {currentActiveOrders.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Order Details</th>
                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Verification Status</th>
                                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {currentActiveOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-700/20 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <div className="font-black text-indigo-400 font-heading">#{order.id.slice(-6).toUpperCase()}</div>
                                        <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase">
                                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="mt-2 text-sm text-gray-300">
                                            {order.items.map(i => (
                                                <div key={i.id} className="flex gap-2">
                                                    <span className="font-bold text-white">x{i.quantity}</span>
                                                    <span>{i.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm align-top">
                                        <div className="font-bold text-gray-200">{order.studentName}</div>
                                        {order.customerPhone && <div className="text-xs text-gray-400">{order.customerPhone}</div>}
                                        {order.seatNumber && (
                                            <div className="mt-2 font-black text-sm text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 inline-block">
                                                🪑 SEAT {order.seatNumber}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-1 rounded-md font-black border border-green-500/30 uppercase">
                                                PAID ✅
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-md font-black border border-red-500/30 uppercase animate-pulse">
                                                NOT COLLECTED ❌
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                        <div className="flex items-center justify-end gap-3">
                                            <div className="text-right mr-2">
                                                <p className="font-black text-white">₹{order.totalAmount.toFixed(0)}</p>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
                                            </div>
                                            <button onClick={() => onViewOrder(order)} className="bg-gray-700 text-gray-300 hover:text-white font-bold text-xs py-2 px-4 rounded-xl border border-gray-600 transition-all">Details</button>
                                            {order.status !== OrderStatus.PREPARED && 
                                                <button 
                                                    onClick={() => onStatusUpdate(order.id, OrderStatus.PREPARED)} 
                                                    className="bg-indigo-600 text-white font-black py-2 px-4 rounded-xl text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                                >
                                                    Start Preparing
                                                </button>
                                            }
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="py-20 text-center bg-gray-900/30 rounded-[2rem] border-2 border-dashed border-gray-700">
                    <p className="text-5xl mb-4 grayscale opacity-30">🍿</p>
                    <p className="text-gray-500 font-bold uppercase tracking-widest">All caught up!</p>
                    <p className="text-gray-600 text-sm mt-1 italic">Waiting for new verified orders...</p>
                </div>
            )}
        </div>
    );
};

const SeatView: React.FC<{ orders: Order[] }> = ({ orders }) => {
    const seatOrders = useMemo(() => 
        orders
            .filter(o => o.status === OrderStatus.SEAT_SELECTED)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), 
        [orders]
    );

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-2xl font-bold text-gray-200 mb-4">Seat Assignments 🪑</h2>
            <p className="text-sm text-gray-400 mb-4">Showing orders that are confirmed at a seat but not yet processed/paid.</p>
            
            {seatOrders.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Seat No.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Order ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Items Summary</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {seatOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xl font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/30">
                                            {order.seatNumber || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">...{order.id.slice(-6)}</td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-300">
                                        {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-200">₹{order.totalAmount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="text-center text-gray-400 py-8">No seat selections pending payment/confirmation.</p>}
        </div>
    );
};

const AnalyticsView: React.FC<{ salesSummary: SalesSummary; mostSellingItems: { name: string; count: number }[]; orderStatusSummary: { name: string; value: number }[]; }> = ({ salesSummary, mostSellingItems, orderStatusSummary }) => (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h3 className="font-bold mb-4 text-gray-200">Daily Sales Trend (Last 14 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesSummary.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="date" tick={{ fill: '#CBD5E0', fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#CBD5E0' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                    <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} name="Daily Sales (₹)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h3 className="font-bold mb-4 text-gray-200">Order Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={orderStatusSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{orderStatusSummary.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} /><Legend /></PieChart></ResponsiveContainer>
        </div>
        <div className="lg:col-span-5 bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h3 className="font-bold mb-4 text-gray-200">Top Performing Items</h3>
            <ResponsiveContainer width="100%" height={300}><BarChart data={mostSellingItems} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#4A5568" /><XAxis type="number" tick={{ fill: '#CBD5E0' }} /><YAxis type="category" dataKey="name" tick={{ fill: '#CBD5E0' }} width={100} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} /><Legend /><Bar dataKey="count" fill="#A78BFA" name="Units Sold" /></BarChart></ResponsiveContainer>
        </div>
    </div>
);

const ManagementView: React.FC<{ menu: MenuItem[]; customerPoints: StudentPoints[]; onAvailabilityChange: (itemId: string, isAvailable: boolean) => void; }> = ({ menu, customerPoints, onAvailabilityChange }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h3 className="font-bold mb-4 text-gray-200">Menu Availability</h3>
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">{menu.map(item => (<li key={item.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg"><span className="text-gray-200">{item.name}</span><button onClick={() => onAvailabilityChange(item.id, !item.isAvailable)} className={`${item.isAvailable ? 'bg-indigo-600' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none`} role="switch" aria-checked={item.isAvailable}><span className={`${item.isAvailable ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}/></button></li>))}</ul>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h3 className="font-bold mb-4 text-gray-200">Customer Loyalty Points</h3>
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">{customerPoints.map(sp => (<li key={sp.studentId} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg"><span className="text-gray-200">{sp.studentName}</span><span className="font-bold text-amber-400">{sp.points} pts</span></li>))}</ul>
        </div>
    </div>
);

const OrderHistoryView: React.FC<{ orders: Order[] }> = ({ orders }) => {
    const [filter, setFilter] = useState<'all' | OrderStatus>('all');
    
    const historyOrders = useMemo(() => 
        orders.filter(o => 
            o.status === OrderStatus.COLLECTED || 
            o.status === OrderStatus.DELIVERED || 
            o.status === OrderStatus.CANCELLED
        ), 
    [orders]);

    const filteredOrders = useMemo(() => 
        filter === 'all' ? historyOrders : historyOrders.filter(o => o.status === filter), 
    [historyOrders, filter]);

    const getBadge = (status: OrderStatus) => {
        switch(status) {
            case OrderStatus.COLLECTED:
            case OrderStatus.DELIVERED:
                return 'bg-green-500/20 text-green-300 border border-green-500/30';
            case OrderStatus.CANCELLED:
                return 'bg-red-500/20 text-red-300 border border-red-500/30';
            default:
                return 'bg-gray-500/20 text-gray-300 border border-gray-500/20';
        }
    }

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="font-black text-xl text-gray-200 uppercase tracking-tight">Order Audit Log 📜</h3>
                <div className="flex items-center gap-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Filter</label>
                    <select 
                        value={filter} 
                        onChange={e => setFilter(e.target.value as any)} 
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 p-2 outline-none"
                    >
                        <option value="all">Full History</option>
                        <option value={OrderStatus.COLLECTED}>Collected Only</option>
                        <option value={OrderStatus.CANCELLED}>Cancelled Only</option>
                    </select>
                </div>
            </div>
            
            <div className="overflow-x-auto max-h-[60vh] scrollbar-thin pr-2">
                {filteredOrders.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Receipt</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {filteredOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-700/20 transition-colors">
                                    <td className="px-4 py-4 align-top">
                                        <div className="font-black text-xs text-indigo-400">#{order.id.slice(-6).toUpperCase()}</div>
                                        <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase">
                                            {new Date(order.timestamp).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <div className="font-bold text-gray-200 text-sm">{order.studentName}</div>
                                        {order.deliveredByStaffName && (
                                            <div className="text-[10px] text-indigo-300 font-bold mt-1 uppercase">
                                                By: {order.deliveredByStaffName}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 align-top text-[11px] text-gray-400">
                                        {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <span className={`px-2 py-1 text-[10px] font-black rounded-md uppercase tracking-tighter border ${getBadge(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 align-top text-right text-sm font-black text-white">
                                        ₹{(order.totalAmount || 0).toFixed(0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="py-20 text-center bg-gray-900/30 rounded-[2rem] border-2 border-dashed border-gray-700">
                        <p className="text-4xl mb-4 opacity-20">🌫️</p>
                        <p className="text-gray-500 font-bold uppercase tracking-widest">No matching logs</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StaffManagementView: React.FC<{
    staff: User[];
    onAddStaff: (details: { name: string, phone: string, password: string }) => Promise<void>;
    onDeleteStaff: (userId: string) => Promise<void>;
}> = ({ staff, onAddStaff, onDeleteStaff }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (!/^\d{10}$/.test(phone)) {
            setError("Please enter a valid 10-digit phone number.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onAddStaff({ name, phone, password });
            setName('');
            setPhone('');
            setPassword('');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
                <h3 className="text-xl font-bold text-gray-200 mb-4">Create New Staff Account</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="text-sm font-medium text-gray-400 block mb-1">Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full input-field" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-sm font-medium text-gray-400 block mb-1">Phone</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full input-field" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-sm font-medium text-gray-400 block mb-1">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full input-field" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full btn-primary h-10">
                        {isSubmitting ? 'Creating...' : 'Add Staff'}
                    </button>
                    {error && <p className="text-red-400 text-sm md:col-span-4">{error}</p>}
                </form>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
                <h3 className="text-xl font-bold text-gray-200 mb-4">Current Staff ({staff.length})</h3>
                <div className="space-y-3">
                    {staff.map(s => (
                        <div key={s.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg">
                            <div>
                                <p className="font-semibold text-white">{s.username}</p>
                                <p className="text-sm text-gray-400">{s.phone}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteStaff(s.id); }} className="text-sm bg-red-800 text-white font-semibold px-3 py-1.5 rounded-md hover:bg-red-700">
                                Remove
                            </button>
                        </div>
                    ))}
                    {staff.length === 0 && <p className="text-gray-500 text-center py-4">No staff accounts created yet.</p>}
                </div>
            </div>
             <style>{`
                .input-field { padding: 0.5rem 0.75rem; border-radius: 0.375rem; border: 1px solid #4B5563; background-color: #1F2937; color: white; }
                .btn-primary { background-color: #4F46E5; color: white; font-weight: bold; padding: 0.5rem 1rem; border-radius: 0.375rem; }
                .btn-primary:hover { background-color: #4338CA; }
                .btn-primary:disabled { background-color: #4f46e580; cursor: not-allowed; }
            `}</style>
        </div>
    );
}

export const OwnerDashboard: React.FC = () => {
    const { user, registerStaffUser } = useAuth();
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [activeTab, setActiveTab] = useState<DashboardTab>('live');

    const [orders, setOrders] = useState<Order[]>([]);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [salesSummary, setSalesSummary] = useState<SalesSummary>({ daily: [], weekly: [] });
    const [mostSellingItems, setMostSellingItems] = useState<{ name: string; count: number }[]>([]);
    const [orderStatusSummary, setOrderStatusSummary] = useState<{ name: string; value: number }[]>([]);
    const [customerPoints, setCustomerPoints] = useState<StudentPoints[]>([]);
    const [todaysStats, setTodaysStats] = useState<TodaysDashboardStats>({ totalOrders: 0, totalIncome: 0, itemsSold: [] });
    const [staff, setStaff] = useState<User[]>([]);
    const [staffScanCounts, setStaffScanCounts] = useState<{ name: string; count: number }[]>([]);
    
    const [loading, setLoading] = useState(true);

    const isInitialLoad = useRef(true);

    const fetchData = useCallback(async (silent = false) => {
        if (!user) return;
        if (!silent && isInitialLoad.current) setLoading(true);
        try {
            const [
                ordersData, menuData, salesData, sellingItemsData, statusSummaryData,
                pointsData, todaysStatsData, staffData
            ] = await Promise.all([
                getOwnerOrders(), getMenu(), getSalesSummary(), getMostSellingItems(),
                getOrderStatusSummary(), getStudentPointsList(), getTodaysDashboardStats(), getScanTerminalStaff()
            ]);

            setOrders(ordersData);
            setMenu(menuData);
            setSalesSummary(salesData);
            setMostSellingItems(sellingItemsData);
            setOrderStatusSummary(statusSummaryData);
            setCustomerPoints(pointsData);
            setTodaysStats(todaysStatsData);
            setStaff(staffData);
            
            isInitialLoad.current = false;

            // FIX: Calculating staff leaderboard based on delivery time, not order creation time
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const collectedToday = ordersData.filter(o => 
                (o.status === OrderStatus.COLLECTED || o.status === OrderStatus.DELIVERED) && 
                o.deliveredAt && 
                new Date(o.deliveredAt) >= todayStart && 
                o.deliveredByStaffId
            );

            const scanCounts: { [key: string]: number } = {};
            
            for (const order of collectedToday) {
                if (order.deliveredByStaffId) {
                    scanCounts[order.deliveredByStaffId] = (scanCounts[order.deliveredByStaffId] || 0) + 1;
                }
            }
            
            const allScanners = user ? [...staffData, user] : staffData;
            
            const staffMap = new Map(allScanners.map(s => {
                return [s.id, s.username];
            }));

            const leaderboard = Object.entries(scanCounts)
                .map(([staffId, count]) => ({ name: staffMap.get(staffId) || 'Unknown Staff', count }))
                .sort((a, b) => b.count - a.count);

            setStaffScanCounts(leaderboard);

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
        
        const ordersSubscription = supabase
            .channel('owner-orders-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchData(true); 
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersSubscription);
        };
    }, [fetchData]);

    const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
        setOrders(prevOrders => 
            prevOrders.map(order => 
                order.id === orderId ? { ...order, status: newStatus } : order
            )
        );

        try {
            await updateOrderStatus(orderId, newStatus);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Order status updated!' } }));
        } catch (error) { 
            console.error("Failed to update status:", error);
            fetchData(true);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Failed to update status.' } }));
        }
    };

    const handleAvailabilityChange = async (itemId: string, isAvailable: boolean) => {
        setMenu(prev => prev.map(item => item.id === itemId ? { ...item, isAvailable } : item));
        try {
            await updateMenuAvailability(itemId, isAvailable);
        } catch (error) { 
            console.error("Failed to update availability", error);
            fetchData(true);
        }
    };

    const handleAddStaff = async (details: { name: string, phone: string, password: string }) => {
        await registerStaffUser(details.name, details.phone, details.password);
        fetchData(true);
    };

    const handleDeleteStaff = async (userId: string) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await deleteScanTerminalStaff(userId);
            setStaff(prevStaff => prevStaff.filter(s => s.id !== userId));
            fetchData(true);
        } catch (error) {
            console.error("Error removing staff:", error);
        }
    };
    
    const historicalOrders = useMemo(() => 
        orders.filter(o => o.status === OrderStatus.COLLECTED || o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED), 
    [orders]);

    const TabButton: React.FC<{ tab: DashboardTab, label: string, icon?: string }> = ({ tab, label, icon }) => (
        <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-semibold rounded-md text-sm transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-gray-300 hover:bg-gray-700'}`}>
            {icon && <span>{icon}</span>}
            {label}
        </button>
    );

    const renderOrderDetails = (order: Order) => {
      const { id, studentName, customerPhone, seatNumber, items, totalAmount, couponCode, discountAmount } = order;
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      return (
        <div className="text-sm text-gray-300 space-y-4">
          <div>
            <h3 className="font-bold text-lg text-white mb-2">Customer Details</h3>
            <p><strong>Name:</strong> {studentName}</p>
            {customerPhone && <p><strong>Phone:</strong> {customerPhone}</p>}
            {seatNumber && <p className="font-bold text-lg text-amber-400 mt-2">🪑 Seat Number: {seatNumber}</p>}
          </div>

          <div>
            <h3 className="font-bold text-lg text-white mb-2">Items Ordered</h3>
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.id} className="border-b border-gray-700 pb-2">
                  <div className="flex justify-between">
                    <span>{item.name} x {item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.notes && <p className="text-xs text-indigo-400 italic pl-2">Note: "{item.notes}"</p>}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg text-white mb-2">Payment Summary</h3>
            <div className="space-y-1">
              <div className="flex justify-between"><span>Subtotal:</span><span>₹{subtotal.toFixed(2)}</span></div>
              {discountAmount && discountAmount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount ({couponCode}):</span>
                  <span>- ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl pt-2 border-t border-gray-600">
                <span>Total Paid:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
        <div className="space-y-8">
            {viewingOrder && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-down" onClick={() => setViewingOrder(null)}>
                    <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full border border-gray-700 relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewingOrder(null)} className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                        <h2 className="text-2xl font-bold mb-4">Order ...{viewingOrder.id.slice(-6)}</h2>
                        <div className="overflow-y-auto scrollbar-thin max-h-[60vh] pr-2">
                            {renderOrderDetails(viewingOrder)}
                        </div>
                    </div>
                </div>
            )}
            
            {loading ? (
                 <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading Dashboard...</p>
                </div>
            ) : (
                <>
                    <DailyStats stats={todaysStats} />
                    
                    <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 p-2 rounded-lg flex flex-wrap gap-2 mb-6 sticky top-20 z-10">
                        <TabButton tab="live" label="Live View" />
                        <TabButton tab="seats" label="Seats" />
                        <TabButton tab="sales" label="Sales" icon="📊" />
                        <TabButton tab="analytics" label="Analytics" />
                        <TabButton tab="management" label="Management" />
                        <TabButton tab="history" label="History" />
                        <TabButton tab="staff" label="Staff" />
                    </div>

                    {activeTab === 'live' && (
                        <div className="space-y-6 animate-fade-in-down">
                            <OrdersManager orders={orders} onStatusUpdate={handleStatusUpdate} onViewOrder={setViewingOrder} />
                            <StaffScanLeaderboard counts={staffScanCounts} />
                        </div>
                    )}
                    {activeTab === 'seats' && <div className="animate-fade-in-down"><SeatView orders={orders} /></div>}
                    {activeTab === 'sales' && <div className="animate-fade-in-down"><SalesView /></div>}
                    {activeTab === 'analytics' && <div className="animate-fade-in-down"><AnalyticsView salesSummary={salesSummary} mostSellingItems={mostSellingItems} orderStatusSummary={orderStatusSummary} /></div>}
                    {activeTab === 'management' && <div className="animate-fade-in-down"><ManagementView menu={menu} customerPoints={customerPoints} onAvailabilityChange={handleAvailabilityChange} /></div>}
                    {activeTab === 'history' && <div className="animate-fade-in-down"><OrderHistoryView orders={historicalOrders} /></div>}
                    {activeTab === 'staff' && <div className="animate-fade-in-down"><StaffManagementView staff={staff} onAddStaff={handleAddStaff} onDeleteStaff={handleDeleteStaff} /></div>}
                </>
            )}
        </div>
    );
};
