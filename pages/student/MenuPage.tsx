
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItem, CartItem } from '../../types';
import { toggleFavoriteItem, getOwnerStatus } from '../../services/mockApi';
import { useAuth } from '../../context/AuthContext';
import { useMenu } from '../../context/MenuContext';

const getCartFromStorage = (): CartItem[] => {
    try {
        const cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    } catch { return []; }
};

const saveCartToStorage = (cart: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(cart));
};

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
        setIsAdding(true);
        onAddToCart(item);
        setTimeout(() => setIsAdding(false), 400); 
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (user) onToggleFavorite(id, !!isFavorited);
        else promptForPhone(() => onToggleFavorite(id, !!isFavorited));
    };
    
    return (
        <div 
            onClick={() => isAvailable && onCardClick(item)} 
            className={`bg-surface/50 backdrop-blur-lg border border-surface-light rounded-2xl shadow-lg overflow-hidden transition-all duration-150 transform ${!isAvailable ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:bg-surface-light/30 active:scale-[0.98]'}`}
        >
            <div className="relative aspect-video overflow-hidden bg-black/20">
                <img 
                    src={imageUrl} 
                    alt={name} 
                    loading="lazy" 
                    className="w-full h-full object-cover transition-transform duration-300"
                />
                <div className="absolute top-2 left-2">
                    {isCombo && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/90 text-background backdrop-blur-md">COMBO</span>}
                </div>
                <button 
                    onClick={handleFavoriteClick}
                    className="absolute top-2 right-2 bg-black/40 backdrop-blur-md p-2 rounded-full text-lg active:scale-90"
                >
                    {isFavorited ? '❤️' : '🤍'}
                </button>
            </div>
            <div className="p-4">
                <h3 className="font-bold font-heading text-lg truncate mb-1 text-white">{emoji} {name}</h3>
                <div className="flex justify-between items-center mt-2">
                    <p className="font-black font-heading text-primary text-xl">₹{price}</p>
                    <div className="flex items-center gap-3">
                        {isAvailable && (
                            <button
                                onClick={handleAddToCartClick}
                                className={`bg-primary text-background font-black rounded-full p-2 shadow-lg transition-transform duration-100 active:scale-90 ${isAdding ? 'animate-cart-bounce' : ''}`}
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
    <div className="bg-surface/30 rounded-2xl h-[260px] animate-pulse border border-white/5"></div>
);

const MenuPage: React.FC = () => {
    const { menuItems, loading: menuLoading, updateMenuItemOptimistic } = useMenu();
    const [searchTerm, setSearchTerm] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isCanteenOnline, setIsCanteenOnline] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        getOwnerStatus().then(status => setIsCanteenOnline(status.isOnline));
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
            if (item) updateMenuItemOptimistic(item);
        }
    }, [user, menuItems, updateMenuItemOptimistic]);

    const handleAddToCart = useCallback((item: MenuItem) => {
        const cart = getCartFromStorage();
        const existingItem = cart.find(cartItem => cartItem.id === item.id);
        const newCart = existingItem 
            ? cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
            : [...cart, { ...item, quantity: 1 }];
        saveCartToStorage(newCart);
        window.dispatchEvent(new CustomEvent('itemAddedToCart'));
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Item Added!', type: 'cart-add' } }));
    }, []);
    
    return (
        <div className="animate-fade-in-up">
            {isCanteenOnline ? (
                <>
                    <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-white/5">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Search foods..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-grow px-4 py-2 bg-surface border border-surface-light text-textPrimary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-base"
                            />
                            <button 
                                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                                className={`flex items-center justify-center w-12 rounded-xl transition-all border ${showFavoritesOnly ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-surface border-surface-light text-textSecondary'}`}
                            >
                                {showFavoritesOnly ? '❤️' : '🤍'}
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 pb-20">
                        {menuLoading && filteredMenu.length === 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(i => <MenuItemSkeleton key={i} />)}
                            </div>
                        ) : filteredMenu.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                            <div className="text-center py-20 text-textSecondary">
                                <p className="text-4xl mb-2">🤷‍♂️</p>
                                <p>No items found</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <div className="bg-surface/50 backdrop-blur-xl p-10 rounded-3xl border border-surface-light">
                        <span className="text-6xl mb-4 block">💤</span>
                        <h2 className="text-2xl font-bold text-white mb-2">Canteen Offline</h2>
                        <p className="text-textSecondary">We're closed right now.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuPage;
