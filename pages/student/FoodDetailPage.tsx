
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getMenuItemById, getFeedbacks } from '../../services/mockApi';
import { useAuth } from '../../context/AuthContext';
import type { MenuItem, Feedback, CartItem } from '../../types';
import Button from '../../components/common/Button';

const getCartFromStorage = (): CartItem[] => {
    try {
        const cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    } catch { return []; }
};

const saveCartToStorage = (cart: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(cart));
};

const StarDisplay: React.FC<{ rating: number; reviewCount?: number }> = ({ rating, reviewCount }) => (
    <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full w-fit">
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-500'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588 1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
        <span className="text-sm text-white font-bold">{rating.toFixed(1)}</span>
        {reviewCount !== undefined && <span className="text-xs text-white/60">({reviewCount})</span>}
    </div>
);

const FoodDetailPage: React.FC = () => {
    const { itemId } = useParams<{ itemId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // PERFORMANCE: Initialize with data passed from previous screen for INSTANT LOAD
    const [item, setItem] = useState<MenuItem | null>(location.state?.item || null);
    const [reviews, setReviews] = useState<Feedback[]>([]);
    const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
    
    // Only show full screen loading if we don't have the item in state
    const [loading, setLoading] = useState(!item);

    useEffect(() => {
        const fetchData = async () => {
            if (!itemId) return;
            
            try {
                // Fetch fresh data in background to update availability/ratings/reviews
                const [itemData, allReviews] = await Promise.all([
                    getMenuItemById(itemId, user?.id),
                    getFeedbacks()
                ]);

                if (itemData) {
                    setItem(itemData); // This will refresh the UI with latest data
                    setReviews(allReviews.filter(r => r.itemId === itemId));
                } else {
                     navigate('/404');
                }
            } catch (error) {
                console.error("Failed to fetch item details", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [itemId, user, navigate]);

     const handleAddToCart = useCallback(() => {
        if (!item) return;

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
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Item Added to Cart', type: 'cart-add' } }));
    }, [item]);


    if (loading) {
        return (
            <div className="animate-pulse max-w-4xl mx-auto pt-6">
                <div className="bg-surface/50 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-surface-light">
                    <div className="h-64 bg-white/10 rounded-xl mb-6"></div>
                    <div className="h-8 bg-white/10 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-white/10 rounded w-1/2 mb-8"></div>
                    <div className="h-12 bg-white/10 rounded-xl w-full"></div>
                </div>
            </div>
        );
    }

    if (!item) return null;

    return (
        <div className="pb-24 animate-fade-in-right">
            <div className="flex items-center mb-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <span className="ml-2 font-bold text-lg text-white">Details</span>
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="bg-surface/50 backdrop-blur-xl border border-surface-light p-6 rounded-3xl shadow-2xl text-white overflow-hidden relative">
                    {/* Background Blob for aesthetics */}
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="rounded-2xl overflow-hidden shadow-lg aspect-video md:aspect-square bg-black/30">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"/>
                        </div>
                        
                        <div className="flex flex-col">
                            <div className="flex justify-between items-start">
                                <h1 className="text-3xl font-extrabold leading-tight">{item.emoji} {item.name}</h1>
                            </div>
                            
                            {item.averageRating != null && (
                                <div className="mt-3">
                                    <StarDisplay rating={item.averageRating} reviewCount={reviews.length} />
                                </div>
                            )}

                            <div className="mt-6 p-4 bg-black/20 rounded-xl border border-white/5">
                                <p className="text-sm text-gray-300 uppercase font-bold tracking-wider mb-1">Price</p>
                                <p className="text-4xl font-black text-primary">₹{item.price.toFixed(0)}</p>
                            </div>

                            <div className="mt-auto pt-6">
                                <Button 
                                    onClick={handleAddToCart} 
                                    fullWidth 
                                    disabled={!item.isAvailable}
                                    className="text-lg py-4"
                                >
                                    {item.isAvailable ? 'Add to Cart' : 'Currently Unavailable'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="flex space-x-1 bg-black/20 p-1 rounded-xl">
                            <button 
                                onClick={() => setActiveTab('description')} 
                                className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'description' ? 'bg-surface shadow-md text-white' : 'text-white/60 hover:text-white'}`}
                            >
                                Description
                            </button>
                            <button 
                                onClick={() => setActiveTab('reviews')} 
                                className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'reviews' ? 'bg-surface shadow-md text-white' : 'text-white/60 hover:text-white'}`}
                            >
                                Reviews ({reviews.length})
                            </button>
                        </div>

                        <div className="mt-6 min-h-[150px]">
                            {activeTab === 'description' && (
                                <div className="animate-fade-in-down text-white/90 leading-relaxed">
                                    <p className="text-lg">{item.description || 'No description available for this delicious item.'}</p>
                                    {item.isCombo && item.comboItems && (
                                        <div className="mt-6 bg-primary/10 p-4 rounded-xl border border-primary/20">
                                            <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                                                <span>🍱</span> Combo Includes:
                                            </h4>
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {item.comboItems.map(ci => (
                                                    <li key={ci.id} className="flex items-center gap-2 text-sm font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                                        {ci.name}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <div className="space-y-4 animate-fade-in-down">
                                    {reviews.length > 0 ? reviews.map(review => (
                                        <div key={review.id} className="bg-black/20 p-4 rounded-xl border border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="font-bold text-white">{review.studentName}</p>
                                                <StarDisplay rating={review.rating} />
                                            </div>
                                            {review.comment && <p className="text-white/80 italic text-sm">"{review.comment}"</p>}
                                            <p className="text-xs text-white/40 mt-2 text-right">{review.timestamp.toLocaleDateString()}</p>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 text-white/60">
                                            <p>No reviews yet. Be the first to try it!</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FoodDetailPage;
