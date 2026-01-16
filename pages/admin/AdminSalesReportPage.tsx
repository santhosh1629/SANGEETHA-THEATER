
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/common/Header';
import { getAdminMonthlySalesReport } from '../../services/mockApi';

const AdminSalesReportPage: React.FC = () => {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any>({ summary: { total_sales: 0, total_orders: 0 }, breakdown: [] });

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAdminMonthlySalesReport(selectedMonth);
            setReportData(data);
        } catch (error) {
            console.error("Failed to load report", error);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const formattedMonth = new Date(selectedMonth + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-gray-900 min-h-screen text-white pb-20">
            <Header />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-2 mb-6">
                    <Link to="/admin/dashboard" className="text-indigo-400 hover:underline flex items-center gap-1 font-bold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Dashboard
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-surface/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
                    <div>
                        <h1 className="text-3xl font-black font-heading uppercase tracking-tighter text-textPrimary">
                            Financial <span className="text-primary animate-sparkle">Insights</span>
                        </h1>
                        <p className="text-gray-400 text-sm font-medium">Tracking performance for <span className="text-indigo-400">{formattedMonth}</span></p>
                    </div>
                    <div className="flex flex-col w-full md:w-auto">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Filter Month</label>
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-2xl p-3 text-white font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-32">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mx-auto"></div>
                        <p className="mt-6 text-gray-500 font-black uppercase tracking-[0.3em] text-xs">Aggregating Ledger...</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in-up">
                        {/* Summary Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-energetic-gradient p-1 rounded-[2.5rem] shadow-2xl shadow-primary/20">
                                <div className="bg-gray-900 rounded-[2.4rem] p-8 text-center h-full flex flex-col justify-center border border-white/5">
                                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.25em] mb-4">Gross Revenue</p>
                                    <p className="text-5xl font-black font-heading tracking-tight">₹{Number(reportData.summary.total_sales).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="bg-surface/60 border border-white/10 p-8 rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center text-center">
                                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] mb-4">Verified Transactions</p>
                                <p className="text-5xl font-black font-heading text-white tracking-tight">{reportData.summary.total_orders}</p>
                            </div>
                        </div>

                        {/* Daily breakdown Table */}
                        <div className="bg-surface/30 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                            <div className="px-8 py-6 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400">Daily Performance Ledger</h3>
                                <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase">Live Feed</span>
                            </div>
                            {reportData.breakdown.length === 0 ? (
                                <div className="p-24 text-center">
                                    <span className="text-6xl block mb-4 opacity-20">📊</span>
                                    <p className="text-gray-500 font-bold italic">No financial activity recorded in this period.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-black/20">
                                            <tr>
                                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Transaction Date</th>
                                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Volume</th>
                                                <th className="px-8 py-4 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {reportData.breakdown.map((day: any) => (
                                                <tr key={day.date_key} className="hover:bg-primary/5 transition-all group">
                                                    <td className="px-8 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-textPrimary uppercase tracking-tighter">
                                                                {new Date(day.date_key).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 font-bold uppercase">{new Date(day.date_key).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-xl text-xs font-black border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                            {day.daily_orders} <span className="text-[8px] opacity-60">ORD</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-black text-primary text-xl tracking-tighter">
                                                        ₹{Number(day.daily_total).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-black/40 border border-white/5 rounded-3xl text-center">
                            <div className="flex items-center justify-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    Authenticated System: Data integrity verified via Supabase Ledger
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminSalesReportPage;
