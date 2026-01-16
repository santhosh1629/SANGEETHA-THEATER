
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
    const { user, promptForPhone } = useAuth();

    const handleAddToCartClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAvailable) return;
        
        // OPTIMISTIC: Instant feedback
        setIsAdding(true);
        onAddToCart(item);
        setTimeout(() => setIsAdding(false), 400); 
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const action = () => onToggleFavorite(id, !!isFavorited);

        if (user) action();
        else promptForPhone(action);
    };
    
    return (
        <div onClick={() => isAvailable && onCardClick(item)} className={`bg-surface/50 backdrop-blur-lg border border-surface-light rounded-2xl shadow-lg overflow-hidden transition-all duration-150 ${!isAvailable ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:bg-surface-light/30 hover:-translate-y-1'}`}>
            <div className="relative aspect-video overflow-hidden bg-black/20">
                <img src={imageUrl} alt={name} loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2">
                    {isCombo && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/90 text-background backdrop-blur-md">COMBO</span>}
                </div>
                <button 
                    onClick={handleFavoriteClick}
                    className="absolute top-2 right-2 bg-black/40 backdrop-blur-md p-2 rounded-full text-lg active:scale-90"
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                    {isFavorited ? '❤️' : '🤍'}
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
                        <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-lg border border-white/5">
                            {averageRating && averageRating > 0 ? (
                                <span className="text-xs font-bold text-white">⭐ {averageRating.toFixed(1)}</span>
                            ) : (
                                <span className="text-[10px] font-bold text-indigo-300">New ✨</span>
                            )}
                        </div>
                        {isAvailable && (
                            <button
                                onClick={handleAddToCartClick}
                                className={`bg-primary text-background font-black rounded-full p-2 shadow-lg transition-transform duration-100 active:scale-90 ${isAdding ? 'animate-cart-bounce' : ''}`}
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
    <div className="bg-surface/30 rounded-2xl overflow-hidden shadow-sm h-[260px]"></div>
);

const PromotionsBanner = React.memo(({ items, onCardClick }: { items: MenuItem[]; onCardClick: (item: MenuItem) => void; }) => {
    if (items.length === 0) return null;
    
    return (
        <section className="mb-8 overflow-hidden">
             <h2 className="text-xl font-bold font-heading mb-4 text-textPrimary flex items-center gap-2">🔥 Bestsellers</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-thin">
                {items.map(item => (
                    <div key={item.id} onClick={() => onCardClick(item)} className="snap-center shrink-0 w-64 h-36 bg-surface/50 backdrop-blur-lg border border-surface-light rounded-xl shadow-lg overflow-hidden cursor-pointer flex hover:bg-surface-light/20 transition-colors">
                        <div className="w-2/5 h-full relative">
                             <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3 flex flex-col justify-center w-3/5 text-textPrimary">
                            <h3 className="font-bold font-heading text-sm line-clamp-2">{item.name}</h3>
                            <p className="font-black font-heading text-primary text-lg mt-1">₹{item.price}</p>
                            <span className="text-accent text-[10px] font-bold mt-auto">Order &rarr;</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
});

const MenuPage: React.FC = () => {
    const { menuItems, loading: menuLoading, refreshMenu, updateMenuItemOptimistic } = useMenu();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isCanteenOnline, setIsCanteenOnline] = useState(true);
    
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const checkStatus = async () => {
            const status = await getOwnerStatus();
            setIsCanteenOnline(status.isOnline);
        };
        checkStatus();
    }, []);

    const filteredMenu = useMemo(() => {
        let items = menuItems;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item => item.name.toLowerCase().includes(term));
        }
        if (showFavoritesOnly) {
            items = items.filter(item => item.isFavorited);
        }
        return items;
    }, [menuItems, searchTerm, showFavoritesOnly]);

    const promotedItems = useMemo(() => {
        return menuItems
            .filter(item => item.isAvailable)
            .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
            .slice(0, 5);
    }, [menuItems]);

    const handleCardClick = useCallback((item: MenuItem) => {
        navigate(`/customer/menu/${item.id}`, { state: { item } });
    }, [navigate]);

    const handleToggleFavorite = useCallback(async (itemId: string, isFavorited: boolean) => {
        if (!user) return;
        
        const item = menuItems.find(i => i.id === itemId);
        if (item) {
            // OPTIMISTIC: Update local UI immediately
            updateMenuItemOptimistic({ 
                ...item, 
                isFavorited: !isFavorited, 
                favoriteCount: (item.favoriteCount || 0) + (!isFavorited ? 1 : -1) 
            });
        }
        
        try {
            await toggleFavoriteItem(user.id, itemId);
        } catch (error) {
            if (item) updateMenuItemOptimistic(item); // Rollback
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
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Item Added!', type: 'cart-add' } }));
    }, []);
    
    return (
        <div className="animate-fade-in">
            {isCanteenOnline ? (
            <>
            <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-white/5">
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Quick search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-grow px-4 py-2 bg-surface border border-surface-light text-textPrimary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-textSecondary/50 text-base"
                    />
                    <button 
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                        className={`flex items-center justify-center w-12 rounded-xl transition-all border ${showFavoritesOnly ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-surface border-surface-light text-textSecondary'}`}
                    >
                        {showFavoritesOnly ? '❤️' : '🤍'}
                    </button>
                </div>
            </div>

            <div className="pt-4 min-h-[60vh]">
                {!searchTerm && !showFavoritesOnly && <PromotionsBanner items={promotedItems} onCardClick={handleCardClick} />}

                {menuLoading && filteredMenu.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                        {[1, 2, 3, 4].map(i => <MenuItemSkeleton key={i} />)}
                    </div>
                ) : filteredMenu.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
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
                    <div className="flex flex-col items-center justify-center py-20 text-textSecondary opacity-50">
                        <div className="text-4xl mb-2">🍽️</div>
                        <p>No matches found</p>
                    </div>
                )}
            </div>
            </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
                    <div className="bg-surface/50 backdrop-blur-xl p-8 rounded-3xl border border-surface-light">
                        <span className="text-5xl mb-4 block">😴</span>
                        <h2 className="text-2xl font-bold text-textPrimary mb-2">Closed</h2>
                        <p className="text-textSecondary">We're offline right now.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuPage;
