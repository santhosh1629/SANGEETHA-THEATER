
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/common/Header';
import type { User, AdminStats } from '../../types';
import { getUsers, getFeedbacks, getAdminDashboardStats } from '../../services/mockApi';
import type { Feedback } from '../../types';

const StatCard: React.FC<{ title: string; value: number | string; icon: string; }> = ({ title, value, icon }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md flex items-center gap-4 border border-gray-700">
        <div className="bg-indigo-500/20 text-indigo-400 p-4 rounded-full text-3xl">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const StarDisplay: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
            <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-600'}`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588 1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        ))}
    </div>
);

const getRoleBadgeClass = (role: string) => {
    switch (role) {
        case 'STUDENT': return 'bg-green-500/20 text-green-300';
        case 'CANTEEN_OWNER': return 'bg-yellow-500/20 text-yellow-300';
        case 'ADMIN': return 'bg-indigo-500/20 text-indigo-300';
        default: return 'bg-gray-500/20 text-gray-300';
    }
};

const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersData, feedbacksData, statsData] = await Promise.all([
                    getUsers(),
                    getFeedbacks(),
                    getAdminDashboardStats()
                ]);
                setUsers(usersData);
                setFeedbacks(feedbacksData);
                setStats(statsData);
            } catch (error) {
                console.error("Error fetching admin data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="bg-gray-900 min-h-screen text-white">
                <Header />
                <main className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
                    <div className="h-10 bg-gray-700 rounded w-1/3 mb-6"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
                        <div className="bg-gray-800 p-6 rounded-lg h-32"></div>
                        <div className="bg-gray-800 p-6 rounded-lg h-32"></div>
                        <div className="bg-gray-800 p-6 rounded-lg h-32"></div>
                        <div className="bg-gray-800 p-6 rounded-lg h-32"></div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white pb-20">
            <Header />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <h1 className="text-4xl font-bold text-white mb-6 animate-fade-in-down">Admin Dashboard</h1>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                    <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon="👥" />
                    <StatCard title="Customers" value={stats?.totalCustomers ?? 0} icon="🎓" />
                    <StatCard title="Owners" value={stats?.totalOwners ?? 0} icon="🏠" />
                    <StatCard title="Pending Approvals" value={stats?.pendingApprovals ?? 0} icon="⏳" />
                    <StatCard title="Total Feedbacks" value={stats?.totalFeedbacks ?? 0} icon="💬" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sales Report Access (NEW) */}
                    <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-600/20 animate-pop-in">
                        <span className="text-4xl block mb-4">📈</span>
                        <h2 className="text-2xl font-black mb-2 uppercase">Sales Reports</h2>
                        <p className="text-indigo-100 mb-6 text-sm">Monitor revenue growth and order volume month-by-month.</p>
                        <Link to="/admin/sales-report" className="inline-block bg-white text-indigo-600 font-bold px-6 py-2 rounded-xl hover:bg-indigo-50 transition-colors">
                            View Full Report
                        </Link>
                    </div>

                    {/* Owner Approvals */}
                    <div className="bg-gray-800 p-8 rounded-3xl border border-gray-700 animate-pop-in" style={{ animationDelay: '100ms' }}>
                        <span className="text-4xl block mb-4">🛡️</span>
                        <h2 className="text-2xl font-black mb-2 uppercase">Approvals</h2>
                        <p className="text-gray-400 mb-6 text-sm">Review pending partner registration requests.</p>
                        <Link to="/admin/approvals" className="inline-block bg-indigo-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
                            Manage ({stats?.pendingApprovals ?? 0})
                        </Link>
                    </div>
                    
                    {/* Recent Feedback */}
                    <div className="bg-gray-800 p-8 rounded-3xl border border-gray-700 animate-pop-in" style={{ animationDelay: '200ms' }}>
                         <h2 className="text-xl font-bold mb-4 text-indigo-400 uppercase tracking-wider">Customer Voices</h2>
                         <div className="space-y-4 max-h-48 overflow-y-auto scrollbar-thin pr-2">
                            {feedbacks.slice(0, 5).map(fb => (
                                <div key={fb.id} className="p-3 bg-gray-700/50 rounded-xl">
                                    <p className="font-bold text-gray-200 text-xs">{fb.studentName}</p>
                                    <StarDisplay rating={fb.rating} />
                                </div>
                            ))}
                         </div>
                    </div>

                    {/* User Management */}
                    <div className="lg:col-span-3 bg-gray-800 p-8 rounded-3xl border border-gray-700 animate-pop-in" style={{ animationDelay: '300ms' }}>
                        <h2 className="text-2xl font-black mb-4 uppercase">User Directory</h2>
                        <div className="overflow-x-auto max-h-96 scrollbar-thin">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700/50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Username</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Contact</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {users.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-700/20">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-200 font-medium">{user.username}</td>
                                            <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-[10px] leading-5 font-black rounded-full uppercase tracking-widest border ${getRoleBadgeClass(user.role)}`}>{user.role}</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">{user.phone || user.email}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
