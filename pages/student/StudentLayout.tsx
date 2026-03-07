import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import DynamicBackground from '../../components/student/DynamicBackground';
import { useAuth } from '../../context/AuthContext';
import { getStudentOrders } from '../../services/mockApi';
import { Order, OrderStatus } from '../../types';

type ToastType = 'cart-add' | 'cart-warn' | 'stock-out' | 'payment-success' | 'payment-error' | 'logout-success' | 'info';
interface ToastInfo {
  id: number;
  message: string;
  type: ToastType;
}

const getCartCountFromStorage = () => {
    try {
        const cart = localStorage.getItem('cart');
        const parsedCart: { quantity: number }[] = cart ? JSON.parse(cart) : [];
        return parsedCart.reduce((total, item) => total + item.quantity, 0);
    } catch {
        return 0;
    }
};

const ActiveOrderTracker: React.FC<{ order: Order }> = ({ order }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (order.status !== OrderStatus.NEW) {
            setTimeLeft('');
            return;
        }

        const PREPARATION_TIME_MS = 15 * 60 * 1000;
        const orderTimestamp = new Date(order.timestamp).getTime();
        const estimatedReadyTime = orderTimestamp + PREPARATION_TIME_MS;

        const timer = setInterval(() => {
            const now = Date.now();
            const distance = estimatedReadyTime - now;

            if (distance > 0) {
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setTimeLeft('00:00');
                clearInterval(timer);
            }
        }, 1000);
        
        const initialDistance = estimatedReadyTime - Date.now();
        if (initialDistance > 0) {
            const minutes = Math.floor((initialDistance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((initialDistance % (1000 * 60)) / 1000);
            setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        } else {
             setTimeLeft('00:00');
        }

        return () => clearInterval(timer);
    }, [order]);
    
    const isPrepared = order.status === OrderStatus.READY;
    const isPending = order.status === OrderStatus.NEW;

    return (
        <div className={`
            ${isPrepared ? 'bg-green-500/80 text-white' : 'bg-primary/80 text-background'}
            backdrop-blur-sm animate-fade-in-down shadow-lg
        `}>
            <div className="container mx-auto px-4 py-2 text-center">
                {isPrepared && (
                    <p className="font-black">
                        🔥 Your order #{order.id.slice(-6)} is ready for pickup!
                    </p>
                )}
                {isPending && (
                    <p className="font-semibold">
                        🧑‍🍳 Your order #{order.id.slice(-6)} is being prepared. Estimated time remaining: {timeLeft}
                    </p>
                )}
            </div>
        </div>
    );
};

// --- Icon Components ---
const MenuIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const MenuBoardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>);
const CartIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);
const HistoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>);
const ProfileIcon: React.FC<{className?: string}> = ({ className = "h-5 w-5 mr-3" }) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const FeedbackDrawerIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>);
const LogoutIcon: React.FC<{className?: string}> = ({ className = "h-6 w-6" }) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);

// --- Toast Icons ---
const ToastCartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const AnimatedCheckIcon = () => (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
        strokeDasharray="24" strokeDashoffset="24" className="animate-draw-check" />
    </svg>
);

const greetings = [
    "HUNGRY?",
    "ORDER. EAT. REPEAT.",
    "WHAT'S THE CRAVING?",
    "FEED THE BEAST.",
];

const CustomerLayout: React.FC = () => {
  const { user, logout, promptForPhone } = useAuth();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const [activeToast, setActiveToast] = useState<ToastInfo | null>(null);
  const location = useLocation();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [centerToast, setCenterToast] = useState<ToastInfo | null>(null);
  const [cartCount, setCartCount] = useState(0);

  const greeting = useMemo(() => greetings[Math.floor(Math.random() * greetings.length)], []);

  const updateCartCount = useCallback(() => {
    const count = getCartCountFromStorage();
    setCartCount(count);
  }, []);

  useEffect(() => {
    updateCartCount(); 

    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'cart') {
            updateCartCount();
        }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('itemAddedToCart', updateCartCount);
    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('itemAddedToCart', updateCartCount);
        window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, [updateCartCount]);

  useEffect(() => {
    const handleItemAdded = () => {
        setIsCartAnimating(true);
        setTimeout(() => setIsCartAnimating(false), 600);
    };
    window.addEventListener('itemAddedToCart', handleItemAdded);
    return () => window.removeEventListener('itemAddedToCart', handleItemAdded);
  }, []);

   useEffect(() => {
    const handleShowToast = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;

        let message = detail.message;
        
        // Deep message extraction with specific Error instance handling
        if (typeof message === 'object' && message !== null) {
            if (message instanceof Error) {
                message = message.message;
            } else {
                message = message.message || 
                          message.error?.description || // Razorpay style
                          message.error?.message || 
                          message.details ||
                          message.hint ||
                          (typeof message.error === 'string' ? message.error : null) ||
                          'An unexpected error occurred.';
            }
        }

        if (!message || message === '{}' || typeof message !== 'string') {
            message = 'Action processed.';
        }

        setActiveToast({ 
            id: Date.now(), 
            type: detail.type || 'info',
            message: String(message)
        }); 
    };
    window.addEventListener('show-toast', handleShowToast);
    return () => window.removeEventListener('show-toast', handleShowToast);
  }, []);

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setCenterToast({ id: Date.now(), message: 'Logged out successfully!', type: 'logout-success' });
    setTimeout(() => {
        logout();
        navigate('/');
    }, 3000);
  };

  const primaryNavLinks = [
    { to: "/customer/menu", icon: <MenuBoardIcon />, label: "Menu" },
    { to: "/customer/cart", icon: <CartIcon />, label: "Cart" },
    { to: "/customer/history", icon: <HistoryIcon />, label: "History" },
  ];
  
  const drawerNavLinks = [
    { to: "/customer/profile", icon: <ProfileIcon />, label: "Profile", protected: true },
    { to: "/customer/feedback", icon: <FeedbackDrawerIcon />, label: "Feedback", protected: true },
  ];
  
  const handleProtectedLinkClick = (e: React.MouseEvent, to: string) => {
      if (!user) {
          e.preventDefault();
          promptForPhone(() => navigate(to));
      }
  };

  const DrawerNavLink: React.FC<{ to: string, icon: React.ReactNode, label: string, isProtected?: boolean }> = ({ to, icon, label, isProtected }) => (
    <NavLink
        to={to}
        onClick={(e) => {
            if (isProtected) handleProtectedLinkClick(e, to);
            setIsDrawerOpen(false);
        }}
        className={({ isActive }) =>
            `flex items-center px-4 py-3 rounded-lg text-lg font-medium transition-colors ${
            isActive ? 'bg-primary text-background font-black' : 'text-textSecondary hover:bg-surface hover:text-textPrimary'
            }`
        }
    >
        {icon} {label}
    </NavLink>
  );

  const fetchActiveOrder = useCallback(async () => {
    if (user) {
        try {
            const orders = await getStudentOrders(user.id);
            const currentActiveOrder = orders.find(o => o.status === OrderStatus.NEW || o.status === OrderStatus.READY) || null;

            setActiveOrder(prevActiveOrder => {
                if (
                    Notification.permission === 'granted' &&
                    currentActiveOrder &&
                    prevActiveOrder &&
                    currentActiveOrder.id === prevActiveOrder.id &&
                    prevActiveOrder.status === OrderStatus.NEW &&
                    currentActiveOrder.status === OrderStatus.READY
                ) {
                    new Notification('Order is ready for pickup!', {
                        body: `Your order #${currentActiveOrder.id.slice(-6)} is prepared.`,
                        icon: '/favicon.ico'
                    });
                }
                return currentActiveOrder;
            });
        } catch (error) { 
             console.warn("Failed to fetch active order in background.");
        }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
        fetchActiveOrder();
        const intervalId = setInterval(fetchActiveOrder, 5000);
        return () => clearInterval(intervalId);
    } else {
        setActiveOrder(null);
    }
  }, [user, fetchActiveOrder]);

  const getToastStyles = (type: ToastType) => {
    switch(type) {
      case 'cart-add': return { bg: 'bg-toast-cart-add', icon: <div className="animate-cart-icon-slide"><ToastCartIcon/></div>, glow: 'shadow-[0_0_20px_rgba(190,24,93,0.5)]' };
      case 'cart-warn': return { bg: 'bg-toast-cart-warn', icon: '⚠️', glow: 'shadow-[0_0_20px_rgba(252,163,17,0.5)]' };
      case 'stock-out': return { bg: 'bg-toast-stock-out', icon: '❌', glow: 'shadow-[0_0_20px_rgba(185,28,28,0.5)]' };
      case 'payment-success': return { bg: 'bg-toast-payment-success backdrop-blur-md', icon: <AnimatedCheckIcon />, glow: 'shadow-[0_0_20px_rgba(34,197,94,0.6)]' };
      case 'payment-error': return { bg: 'bg-toast-payment-error', icon: '🚫', glow: 'shadow-[0_0_20px_rgba(185,28,28,0.5)]' };
      case 'logout-success': return { bg: 'bg-gradient-to-r from-violet-600 to-red-600', icon: '👋', glow: 'shadow-[0_0_20px_rgba(190,24,93,0.5)]' };
      default: return { bg: 'bg-gray-700', icon: '🔔', glow: '' };
    }
  };


  return (
    <div className="flex flex-col min-h-screen font-sans text-textPrimary">
      <DynamicBackground />
      <div className="absolute inset-0 bg-background/40 -z-40"></div>

       {/* Global Toast Notification */}
      {activeToast && (
        <div key={activeToast.id} className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm pointer-events-none">
          <div 
            onAnimationEnd={() => setActiveToast(null)}
            className={`
              flex items-center gap-4 p-3 pr-4 rounded-full shadow-lg text-white font-bold 
              border border-white/20 animate-toast ${getToastStyles(activeToast.type).bg} ${getToastStyles(activeToast.type).glow}
            `}
          >
            <span className="flex-shrink-0 h-8 w-8 rounded-full bg-black/20 flex items-center justify-center text-xl">
              {getToastStyles(activeToast.type).icon}
            </span>
            <p className="flex-grow text-sm">{activeToast.message}</p>
          </div>
        </div>
      )}

      {/* Center Toast for Logout */}
        {centerToast && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[101] flex items-center justify-center animate-fade-in-down">
                <div className="bg-gradient-to-br from-violet-600 to-red-600 p-8 rounded-2xl shadow-2xl w-64 h-64 flex flex-col items-center justify-center text-center">
                    <span className="text-4xl mb-4">👋</span>
                    <p className="text-white text-xl font-bold">{centerToast.message}</p>
                </div>
            </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
            <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in-down">
                <div className="bg-energetic-gradient p-1 rounded-2xl shadow-2xl max-w-sm w-full">
                    <div className="bg-background rounded-xl p-8 text-center">
                        <h2 className="text-2xl font-bold font-heading text-textPrimary mb-2">Log Out</h2>
                        <p className="text-textSecondary mb-6">Are you sure you want to log out?</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowLogoutConfirm(false)} className="bg-surface hover:bg-surface-light text-textPrimary font-bold py-2 px-6 rounded-lg transition-colors">
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
      <aside className={`fixed top-0 left-0 h-full w-64 bg-background/90 backdrop-blur-xl border-r border-surface-light shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-surface-light h-16">
              <h2 className="text-xl font-bold font-heading text-primary">SANGEETHA THEATER</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-gray-400 hover:text-white">
                  <CloseIcon />
              </button>
          </div>
          <div className="p-4 flex flex-col h-[calc(100%-4rem)]">
              <div className="flex-grow space-y-2">
                  {drawerNavLinks.map(link => <DrawerNavLink key={link.to} to={link.to} icon={link.icon} label={link.label} isProtected={link.protected} />)}
              </div>
              <div className="mt-auto pt-4 border-t border-surface-light">
                  {user && (
                    <button
                        onClick={() => { setIsDrawerOpen(false); setShowLogoutConfirm(true); }}
                        className="flex items-center w-full px-4 py-3 rounded-lg text-lg font-medium text-textSecondary hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    >
                        <LogoutIcon className="h-5 w-5 mr-3" />
                        Logout
                    </button>
                  )}
              </div>
          </div>
      </aside>

       {/* Header */}
      <header className="bg-background/60 backdrop-blur-lg sticky top-0 z-40 h-16 border-b border-surface-light">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsDrawerOpen(true)} className="text-gray-300 hover:text-white">
                  <MenuIcon />
                </button>
                <h1 className="text-xl font-black font-heading text-textPrimary" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>{greeting}</h1>
            </div>
             {user && (
                <button onClick={() => setShowLogoutConfirm(true)} className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Logout">
                    <LogoutIcon />
                </button>
             )}
        </div>
      </header>
      
      {activeOrder && <ActiveOrderTracker order={activeOrder} />}
       
       {/* Desktop Primary Nav */}
       <nav className="hidden sm:flex bg-background/70 backdrop-blur-lg py-3 sticky top-16 z-30 border-b border-surface-light shadow-md">
            <div className="container mx-auto flex justify-around items-center">
                {primaryNavLinks.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={(e) => handleProtectedLinkClick(e, link.to)}
                        className={({ isActive }) =>
                            `flex items-center gap-2 font-semibold text-lg transition-colors pb-1 border-b-2 ${
                            isActive ? 'border-primary text-primary' : 'border-transparent text-textSecondary hover:text-textPrimary'
                            }`
                        }
                    >
                        <div className={link.to === '/customer/cart' && isCartAnimating ? 'animate-cart-bounce' : ''}>
                            {link.icon}
                        </div>
                        <span>{link.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>

        {/* Main Content */}
        <main className="flex-grow container mx-auto px-4 pt-6 pb-24 sm:pb-6">
            <div key={location.pathname} className="animate-fade-in-down">
                <Outlet />
            </div>
        </main>

        {/* Floating Cart Button */}
        {location.pathname !== '/customer/cart' && cartCount > 0 && (
            <button
                onClick={() => {
                    if (!user) {
                        promptForPhone(() => navigate('/customer/cart'));
                    } else {
                        navigate('/customer/cart');
                    }
                }}
                className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 z-40 h-16 w-16 rounded-full bg-accent text-white shadow-lg flex items-center justify-center text-3xl animate-fade-in-up transform transition-transform duration-200 ease-in-out hover:scale-110 active:scale-90 group"
                aria-label={`View cart with ${cartCount} items`}
            >
                <span className="group-hover:animate-shake">🛒</span>
                <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-background animate-pulse">
                    {cartCount}
                </span>
            </button>
        )}

        {/* Bottom Nav for mobile */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-surface-light shadow-lg z-30">
            <div className="flex justify-around items-center h-16">
                {primaryNavLinks.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={(e) => handleProtectedLinkClick(e, link.to)}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center gap-1 w-full transition-colors relative ${
                            isActive ? 'text-primary' : 'text-textSecondary hover:text-primary'
                            }`
                        }
                    >
                        <div className={link.to === '/customer/cart' && isCartAnimating ? 'animate-cart-bounce' : ''}>
                            {link.icon}
                        </div>
                        <span className="text-xs font-medium">{link.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    </div>
  );
};

export default CustomerLayout;