import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItem, CartItem } from '../../types';
import { toggleFavoriteItem, getOwnerStatus } from '../../services/mockApi';
import { useAuth } from '../../context/AuthContext';
import { useMenu } from '../../context/MenuContext';

const getCartFromStorage = (): CartItem[] => {
    try {
        const cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    } catch {
        return [];
    }
};

const saveCartToStorage = (cart: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(cart));
};

// --- Sub-components ---

const MenuItemCard = React.memo(({ 
    item, 
    onCardClick,
    onToggleFavorite,
    onAddToCart
}: { 
    item: MenuItem; 
    onCardClick: (item: MenuItem) => void;
    onToggleFavorite: (itemId: string, isFavorited: boolean) => void;
    onAddToCart: (item: MenuItem) => void;
}) => {
    const { id, name, price, isAvailable, imageUrl, averageRating, isFavorited, emoji, isCombo } = item;
    const [isAdding, setIsAdding] = useState(false);
    const [isAnimatingFavorite, setIsAnimatingFavorite] = useState(false);
    const { user, promptForPhone } = useAuth();

    const handleAddToCartClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAvailable) return;
        const action = () => {
            onAddToCart(item);
            setIsAdding(true);
            setTimeout(() => setIsAdding(false), 700); 
        };
        
        if (user) {
            action();
        } else {
            promptForPhone(action);
        }
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const action = () => {
            if (!isFavorited) { 
                setIsAnimatingFavorite(true);
                setTimeout(() => setIsAnimatingFavorite(false), 500);
            }
            onToggleFavorite(id, isFavorited ?? false);
        };

        if (user) {
            action();
        } else {
            promptForPhone(action);
        }
    };
    
    return (
        <div onClick={() => isAvailable ? onCardClick(item) : window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Currently Out of Stock!', type: 'stock-out' } }))} className={`bg-surface/50 backdrop-blur-lg border border-surface-light rounded-2xl shadow-lg overflow-hidden transition-all duration-200 hover:shadow-2xl hover:bg-surface-light/30 hover:-translate-y-1 ${!isAvailable ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
            <div className="relative aspect-video overflow-hidden bg-black/20">
                <img src={imageUrl} alt={name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-white ${isAvailable ? 'bg-green-600/90' : 'bg-red-600/90'} backdrop-blur-md shadow-sm`}>
                        {isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
                    </span>
                    {isCombo && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/90 text-background backdrop-blur-md shadow-sm">COMBO</span>}
                </div>
                <button 
                    onClick={handleFavoriteClick}
                    className="absolute top-2 right-2 bg-black/40 backdrop-blur-md p-2 rounded-full text-lg transition-transform active:scale-90 hover:bg-black/60"
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <span className={isAnimatingFavorite ? 'animate-heart-pop block' : 'block'}>
                        {isFavorited ? '❤️' : '🤍'}
                    </span>
                </button>
                {!isAvailable && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-bold font-heading text-lg tracking-wider">SOLD OUT</span>
                    </div>
                )}
            </div>
            <div className="p-4 text-textPrimary">
                <h3 className="font-bold font-heading text-lg truncate mb-1">{emoji} {name}</h3>
                <div className="flex justify-between items-center mt-2">
                    <p className="font-black font-heading text-primary text-xl">₹{price}</p>
                    <div className="flex items-center gap-3">
                        {/* Improved Rating Display */}
                        <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-lg border border-white/5">
                            {averageRating && averageRating > 0 ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588 1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    <span className="text-xs font-bold text-white">{averageRating.toFixed(1)}</span>
                                </>
                            ) : (
                                <span className="text-[10px] font-bold text-indigo-300">New ✨</span>
                            )}
                        </div>
                        {isAvailable && (
                            <button
                                onClick={handleAddToCartClick}
                                className={`bg-primary text-background font-black rounded-full p-2 shadow-lg shadow-primary/20 transition-transform duration-200 hover:scale-110 active:scale-95 ${isAdding ? 'animate-cart-bounce' : ''}`}
                                aria-label="Add to cart"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

const MenuItemSkeleton = () => (
    <div className="bg-surface/30 rounded-2xl overflow-hidden shadow-sm animate-pulse">
        <div className="aspect-video bg-white/10"></div>
        <div className="p-4 space-y-3">
            <div className="h-6 bg-white/10 rounded w-3/4"></div>
            <div className="flex justify-between items-center">
                <div className="h-6 bg-white/10 rounded w-1/4"></div>
                <div className="h-8 w-8 bg-white/10 rounded-full"></div>
            </div>
        </div>
    </div>
);

const PromotionsBanner = React.memo(({ items, onCardClick }: { items: MenuItem[]; onCardClick: (item: MenuItem) => void; }) => {
    if (items.length === 0) return null;
    
    return (
        <section className="mb-8 overflow-hidden animate-fade-in-down">
             <h2 className="text-xl font-bold font-heading mb-4 text-textPrimary flex items-center gap-2">
                <span className="text-2xl">🔥</span> Bestsellers
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
                {items.map(item => (
                    <div key={item.id} onClick={() => onCardClick(item)} className="snap-center shrink-0 w-72 h-40 bg-surface/50 backdrop-blur-lg border border-surface-light rounded-xl shadow-lg overflow-hidden cursor-pointer group flex hover:bg-surface-light/20 transition-colors">
                        <div className="w-2/5 h-full relative">
                             <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3 flex flex-col justify-center w-3/5 text-textPrimary">
                            <h3 className="font-bold font-heading text-base line-clamp-2">{item.name}</h3>
                            <p className="font-black font-heading text-primary text-xl mt-1">₹{item.price}</p>
                            <span className="text-accent text-xs font-bold mt-auto group-hover:translate-x-1 transition-transform">Order Now &rarr;</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
});

const MenuPage: React.FC = () => {
    const { menuItems, loading: menuLoading, refreshMenu, updateMenuItemOptimistic } = useMenu();
    
    const [filteredMenu, setFilteredMenu] = useState<MenuItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isCanteenOnline, setIsCanteenOnline] = useState(true);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullPosition, setPullPosition] = useState(0);
    const touchStartRef = useRef<number | null>(null);
    const PULL_THRESHOLD = 80;

    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const checkStatus = async () => {
            const status = await getOwnerStatus();
            setIsCanteenOnline(status.isOnline);
        };
        checkStatus();
    }, []);

    useEffect(() => {
        let items = menuItems;
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item => item.name.toLowerCase().includes(term));
        }
        
        if (showFavoritesOnly) {
            items = items.filter(item => item.isFavorited);
        }
        
        setFilteredMenu(items);
    }, [menuItems, searchTerm, showFavoritesOnly]);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) {
                touchStartRef.current = e.touches[0].clientY;
            } else {
                touchStartRef.current = null;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (touchStartRef.current === null || isRefreshing) return;
            const pullDistance = e.touches[0].clientY - touchStartRef.current;
            if (pullDistance > 0) {
                setPullPosition(pullDistance);
            }
        };

        const handleTouchEnd = () => {
            if (touchStartRef.current === null) return;
            const finalPullPosition = pullPosition;
            touchStartRef.current = null;
            
            if (finalPullPosition > PULL_THRESHOLD && !isRefreshing) {
                setIsRefreshing(true);
                refreshMenu().finally(() => {
                    setTimeout(() => {
                        setIsRefreshing(false);
                        setPullPosition(0);
                    }, 500);
                });
            } else if (!isRefreshing) {
                setPullPosition(0);
            }
        };

        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
        
        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [refreshMenu, isRefreshing, pullPosition]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            refreshMenu();
        }, 5000); 

        return () => clearInterval(intervalId);
    }, [refreshMenu]);

    const handleCardClick = useCallback((item: MenuItem) => {
        navigate(`/customer/menu/${item.id}`, { state: { item } });
    }, [navigate]);

    const handleToggleFavorite = useCallback(async (itemId: string, isFavorited: boolean) => {
        if (!user) return;
        
        const item = menuItems.find(i => i.id === itemId);
        if (item) {
            updateMenuItemOptimistic({ 
                ...item, 
                isFavorited: !isFavorited, 
                favoriteCount: (item.favoriteCount || 0) + (!isFavorited ? 1 : -1) 
            });
        }
        
        try {
            await toggleFavoriteItem(user.id, itemId);
        } catch (error) {
            console.error("Failed to toggle favorite", error);
            if (item) {
                updateMenuItemOptimistic(item);
            }
        }
    }, [user, menuItems, updateMenuItemOptimistic]);

    const handleAddToCart = useCallback((item: MenuItem) => {
        const cart = getCartFromStorage();
        const existingItem = cart.find(cartItem => cartItem.id === item.id);
        
        let newCart;
        if (existingItem) {
            newCart = cart.map(cartItem => 
                cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
            );
        } else {
            newCart = [...cart, { ...item, quantity: 1 }];
        }
        saveCartToStorage(newCart);

        window.dispatchEvent(new CustomEvent('itemAddedToCart'));
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Item Added to Cart!', type: 'cart-add' } }));
    }, []);

    const promotedItems = useMemo(() => {
        return menuItems
            .filter(item => item.isAvailable)
            .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
            .slice(0, 5);
    }, [menuItems]);
    
    return (
        <div>
            <div style={{ transform: `translateY(${Math.min(pullPosition, PULL_THRESHOLD)}px)`, transition: isRefreshing || pullPosition === 0 ? 'transform 0.3s' : 'none' }} className="fixed top-16 left-0 right-0 z-20 flex justify-center items-center pointer-events-none">
                <div className={`bg-surface/80 backdrop-blur-lg p-2 rounded-full shadow-lg border border-surface-light ${pullPosition > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {isRefreshing ? (
                        <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg style={{ transform: `rotate(${Math.min(pullPosition / PULL_THRESHOLD, 1) * 360}deg)` }} className="h-6 w-6 text-white transition-transform" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    )}
                </div>
            </div>

            {isCanteenOnline ? (
            <>
            <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-white/5 shadow-sm transition-all duration-300">
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Search food..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-grow px-4 py-2 bg-surface border border-surface-light text-textPrimary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-textSecondary/50 text-base"
                    />
                    <button 
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                        className={`flex items-center justify-center w-12 rounded-xl transition-all border ${showFavoritesOnly ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-surface border-surface-light text-textSecondary hover:bg-surface-light'}`}
                        aria-label="Filter Favorites"
                    >
                        {showFavoritesOnly ? '❤️' : '🤍'}
                    </button>
                </div>
            </div>

            <div className="pt-4 min-h-[60vh]">
                {!searchTerm && !showFavoritesOnly && <PromotionsBanner items={promotedItems} onCardClick={handleCardClick} />}

                {menuLoading && filteredMenu.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => <MenuItemSkeleton key={i} />)}
                    </div>
                ) : filteredMenu.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 animate-fade-in-up">
                        {filteredMenu.map(item => (
                            <MenuItemCard 
                                key={item.id} 
                                item={item} 
                                onCardClick={handleCardClick}
                                onToggleFavorite={handleToggleFavorite}
                                onAddToCart={handleAddToCart}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-textSecondary opacity-70">
                        <div className="text-4xl mb-2">🍽️</div>
                        <p className="font-medium">No items found</p>
                    </div>
                )}
            </div>
            </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
                    <div className="bg-surface/50 backdrop-blur-xl p-8 rounded-3xl border border-surface-light shadow-2xl">
                        <span className="text-5xl mb-4 block">😴</span>
                        <h2 className="text-2xl font-bold text-textPrimary mb-2">Canteen is Offline</h2>
                        <p className="text-textSecondary">We are currently closed. Please check back later!</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuPage;