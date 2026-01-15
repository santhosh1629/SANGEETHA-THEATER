import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

// --- Icon Components ---
const MenuIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>);
const MenuBoardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>);
const ScanIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 21v-2M17 21v-2M7 3v2M17 3v2" /></svg>);
const FeedbackDrawerIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>);
const PopularityIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>);
const RewardsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" /><path d="M9 11l3-3m0 0l3 3m-3-3v8m-9 5a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>);
const LogoutIcon: React.FC<{className?: string}> = ({ className = "h-5 w-5 mr-3" }) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);
const OffersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4a2 2 0 00-2-2H6a2 2 0 00-2 2v8l6 6 6-6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M11 7h.01" /></svg>);

const OwnerLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const location = useLocation();
    const [toastInfo, setToastInfo] = useState<{ id: number, message: string } | null>(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [centerToast, setCenterToast] = useState<{ message: string } | null>(null);

    // Redirect staff users (who don't have a canteenName) to their specific page.
    if (user && user.role === Role.CANTEEN_OWNER && !user.canteenName) {
        return <Navigate to="/scan-terminal/home" replace />;
    }

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        setCenterToast({ message: 'Logged out successfully!' });
        setTimeout(() => {
            logout();
            navigate('/'); // Redirect to Home Page
            setCenterToast(null);
        }, 3000);
    };
    
    // Toast notification with hardened message extraction
    useEffect(() => {
        const handleShowToast = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail) return;

            let message = detail.message;

            // Deep message extraction for various error object formats
            if (typeof message === 'object' && message !== null) {
                if (message instanceof Error) {
                    message = message.message;
                } else {
                    message = message.message || 
                              message.error?.message || 
                              message.details ||
                              message.hint ||
                              (typeof message.error === 'string' ? message.error : null) ||
                              'System Notification';
                }
            }

            if (!message || message === '{}' || typeof message !== 'string') {
                message = 'Notice';
            }

            setToastInfo({ id: Date.now(), message: String(message) });
        };
        window.addEventListener('show-owner-toast', handleShowToast);
        return () => window.removeEventListener('show-owner-toast', handleShowToast);
    }, []);

    const primaryNavLinks = [
        { to: "/owner/dashboard", icon: <DashboardIcon />, label: "Dashboard" },
        { to: "/owner/menu", icon: <MenuBoardIcon />, label: "Menu Mgmt" },
        { to: "/owner/scan", icon: <ScanIcon />, label: "Scan QR" },
    ];

    const drawerNavLinks = [
        { to: "/owner/popularity", icon: <PopularityIcon />, label: "Popularity" },
        { to: "/owner/rewards", icon: <RewardsIcon />, label: "Rewards" },
        { to: "/owner/offers", icon: <OffersIcon />, label: "Offers" },
        { to: "/owner/feedback", icon: <FeedbackDrawerIcon />, label: "Feedback" },
    ];
    
    const DrawerNavLink: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => (
        <NavLink
            to={to}
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
            }
        >
            {icon} {label}
        </NavLink>
    );
    
    return (
        <div className="flex flex-col min-h-screen font-sans bg-gray-900 text-white">
            {/* Toast Notification */}
            {toastInfo && (
                <div key={toastInfo.id} className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm pointer-events-none">
                    <div 
                        onAnimationEnd={() => setToastInfo(null)}
                        className="flex items-center gap-4 p-3 pr-4 rounded-full shadow-lg text-white font-bold bg-indigo-600 border border-white/20 animate-toast"
                    >
                        <span className="flex-shrink-0 h-8 w-8 rounded-full bg-black/20 flex items-center justify-center text-xl">
                        🔔
                        </span>
                        <p className="flex-grow text-sm">{toastInfo.message}</p>
                    </div>
                </div>
             )}

            {/* Center Toast for Logout */}
            {centerToast && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[101] flex items-center justify-center animate-fade-in-down">
                    <div className="bg-gradient-to-br from-indigo-600 to-red-600 p-8 rounded-2xl shadow-2xl w-64 h-64 flex flex-col items-center justify-center text-center">
                        <span className="text-4xl mb-4">👋</span>
                        <p className="text-white text-xl font-bold">{centerToast.message}</p>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in-down">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-sm w-full">
                        <div className="p-8 text-center">
                            <h2 className="text-2xl font-bold font-heading text-white mb-2">Log Out</h2>
                            <p className="text-gray-300 mb-6">Are you sure you want to log out? This will close your canteen and set all items as unavailable.</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setShowLogoutConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button onClick={confirmLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                    Yes, Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Drawer Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsDrawerOpen(false)}
            />

            {/* Side Drawer */}
            <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700 h-16">
                    <h2 className="text-xl font-bold text-indigo-400">Owner Panel</h2>
                    <button onClick={() => setIsDrawerOpen(false)} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                <div className="p-4 flex flex-col h-[calc(100%-4rem)]">
                    <div className="flex-grow space-y-2">
                        {drawerNavLinks.map(link => <DrawerNavLink key={link.to} {...link} />)}
                    </div>
                    <div className="mt-auto pt-4 border-t border-gray-700">
                        <button
                            onClick={() => { setIsDrawerOpen(false); setShowLogoutConfirm(true); }}
                            className="flex items-center w-full px-4 py-3 rounded-lg text-lg font-medium text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        >
                            <LogoutIcon />
                            Logout
                        </button>
                    </div>
                </div>
            </aside>
            
            {/* Header */}
            <header className="bg-gray-800/80 backdrop-blur-lg sticky top-0 z-40 h-16 border-b border-gray-700">
                <div className="container mx-auto h-full flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsDrawerOpen(true)} className="text-gray-300 hover:text-white">
                            <MenuIcon />
                        </button>
                        <h1 className="text-xl font-bold text-white">{user?.canteenName}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400 hidden sm:inline">Welcome, {user?.username}</span>
                        <button onClick={() => setShowLogoutConfirm(true)} className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Logout">
                            <LogoutIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

             {/* Desktop Primary Nav */}
            <nav className="hidden sm:flex bg-gray-800/50 backdrop-blur-lg py-3 sticky top-16 z-30 border-b border-gray-700 shadow-md">
                <div className="container mx-auto flex justify-center items-center gap-8">
                    {primaryNavLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) =>
                                `flex items-center gap-2 font-semibold text-lg transition-colors pb-1 border-b-2 ${
                                isActive ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'
                                }`
                            }
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                <div key={location.pathname} className="animate-fade-in-down">
                    <Outlet />
                </div>
            </main>
            
             {/* Bottom Nav for mobile */}
            <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-lg border-t border-gray-700 shadow-lg z-30">
                <div className="flex justify-around items-center h-16">
                    {primaryNavLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-1 w-full transition-colors relative ${
                                isActive ? 'text-indigo-400' : 'text-gray-400 hover:text-indigo-400'
                                }`
                            }
                        >
                            {link.icon}
                            <span className="text-xs font-medium">{link.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default OwnerLayout;