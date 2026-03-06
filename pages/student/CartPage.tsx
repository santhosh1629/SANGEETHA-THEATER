
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../../types';
import { OrderStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
// Fix: Removed updateOrderPaymentStatus (not exported), createPaymentRecord and updateOrderStatus (unused)
import { placeOrder, createRazorpayOrderApi, verifyRazorpayPaymentApi } from '../../services/mockApi';
import { CONFIG } from '../../config';

declare const Razorpay: any;

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

const CartPage: React.FC = () => {
    const [cart, setCart] = useState<CartItem[]>(getCartFromStorage());
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    
    const { user, loading, promptForPhone, updateUser } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
    const [seatNumber, setSeatNumber] = useState('');
    const [validationError, setValidationError] = useState('');
    
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            promptForPhone();
        }
    }, [user, loading, promptForPhone]);
    
    useEffect(() => {
        if (user && user.phone) {
            setPhoneNumber(user.phone);
        }
    }, [user]);

    const updateCart = (newCart: CartItem[]) => {
        setCart(newCart);
        saveCartToStorage(newCart);
        window.dispatchEvent(new CustomEvent('cartUpdated'));
    };

    const handleQuantityChange = (itemId: string, newQuantity: number) => {
        if (newQuantity < 1) handleRemoveItem(itemId);
        else updateCart(cart.map(item => item.id === itemId ? { ...item, quantity: newQuantity } : item));
    };
    
    const handleRemoveItem = (itemId: string) => updateCart(cart.filter(item => item.id !== itemId));
    
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return sum + (price * qty);
        }, 0);
    }, [cart]);

    const totalAmount = Number(subtotal);

    const [razorpayLoaded, setRazorpayLoaded] = useState(false);

    useEffect(() => {
        const loadRazorpay = () => {
            if (typeof Razorpay !== 'undefined') {
                setRazorpayLoaded(true);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => {
                console.log("Razorpay SDK loaded successfully");
                setRazorpayLoaded(true);
            };
            script.onerror = () => {
                console.error("Failed to load Razorpay SDK");
            };
            document.body.appendChild(script);
        };

        loadRazorpay();
    }, []);

    const handlePayment = async (orderId: string, amount: number) => {
        console.log("Initiating payment for order:", orderId, "Amount:", amount);
        try {
            if (!razorpayLoaded && typeof Razorpay === 'undefined') {
                throw new Error("Razorpay SDK is not loaded. Please check your internet connection.");
            }

            const rzpOrder = await createRazorpayOrderApi(amount, user!.id);
            console.log("Razorpay Order Created:", rzpOrder);

            const options: any = {
                key: CONFIG.RAZORPAY_KEY_ID, 
                amount: rzpOrder.amount, 
                currency: rzpOrder.currency,
                name: CONFIG.APP_NAME,
                description: "Movie Snacks Payment",
                image: "/favicon.ico",
                handler: async (response: any) => {
                    console.log("Razorpay Payment Success Response:", response);
                    setIsPlacingOrder(true);
                    
                    const isVerified = await verifyRazorpayPaymentApi(orderId, response, user!.id);
                    
                    if (isVerified) {
                        updateCart([]);
                        navigate(`/customer/order-success/${orderId}`, { 
                            state: { showSuccessToast: true },
                            replace: true 
                        });
                    } else {
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Security Verification Failed.', type: 'payment-error' } }));
                        setIsPlacingOrder(false);
                    }
                },
                prefill: {
                    name: user?.username || 'Customer',
                    email: user?.email || '',
                    contact: phoneNumber,
                },
                theme: { color: "#FF0033" },
                modal: {
                    ondismiss: () => {
                        console.log("Razorpay modal dismissed");
                        setIsPlacingOrder(false);
                    }
                }
            };

            // ONLY add order_id if it's NOT a mock ID
            if (rzpOrder.id && !rzpOrder.id.includes('_MOCK_')) {
                options.order_id = rzpOrder.id;
            } else {
                console.warn("Using Standard Checkout fallback because Order ID is mock.");
                // For Live Keys, Razorpay might require an order_id.
                // If it fails, we should tell the user.
            }
            
            console.log("Opening Razorpay with options:", options);
            
            try {
                const rzp = new Razorpay(options);
                
                rzp.on('payment.failed', function (response: any) {
                    console.error("Razorpay Payment Failed:", response.error);
                    window.dispatchEvent(new CustomEvent('show-toast', { 
                        detail: { message: `Payment Failed: ${response.error.description}`, type: 'payment-error' } 
                    }));
                });

                rzp.open();
            } catch (rzpErr: any) {
                console.error("Razorpay Constructor/Open Error:", rzpErr);
                throw new Error(`Razorpay failed to open: ${rzpErr.message}`);
            }
        } catch (err: any) {
            console.error("Checkout System Error:", err);
            window.dispatchEvent(new CustomEvent('show-toast', { 
                detail: { message: `Payment System Error: ${err.message}`, type: 'payment-error' } 
            }));
            setIsPlacingOrder(false);
        }
    };

    const handleConfirmOrder = async () => {
        if (!user) { promptForPhone(); return; }
        if (!phoneNumber.trim() || !seatNumber.trim()) { setValidationError('Enter Your Seat Number'); return; }
        if (!/^\d{10}$/.test(phoneNumber)) { setValidationError('Invalid phone number.'); return; }
        
        setValidationError('');
        setIsPlacingOrder(true);

        try {
            const orderPayload = {
                studentId: user.id, 
                studentName: user.username,
                customerPhone: phoneNumber,
                items: cart.map(({ id, name, quantity, price, notes, imageUrl }) => ({ 
                    id, name, quantity: Number(quantity), price: Number(price), notes, imageUrl 
                })),
                totalAmount: Number(totalAmount),
                seat_number: seatNumber.trim(),
                status: OrderStatus.INITIATED // Secure start
            };
            
            const order = await placeOrder(orderPayload);
            await handlePayment(order.id, Number(order.totalAmount));

        } catch (error: any) {
            console.error("Order Record Failure:", error);
            window.dispatchEvent(new CustomEvent('show-toast', { 
                detail: { message: "Failed to initiate order.", type: 'payment-error' } 
            }));
            setIsPlacingOrder(false);
        }
    };

    if (!user) return <div className="text-center py-16 text-textPrimary"><p>Please login to continue.</p></div>;

    return (
        <div className="text-textPrimary">
            <h1 className="text-3xl font-bold font-heading mb-6">Your Cart 🛒</h1>
            {cart.length === 0 ? (
                <div className="text-center py-16 bg-surface/50 backdrop-blur-lg border border-surface-light rounded-2xl shadow-lg">
                    <p className="text-xl font-semibold">Your cart is empty.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="bg-surface/50 backdrop-blur-lg border border-surface-light rounded-2xl p-4 flex gap-4 items-center shadow-md">
                                <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-xl" />
                                <div className="flex-grow">
                                    <h3 className="font-bold text-lg">{item.name}</h3>
                                    <p className="font-bold text-primary">₹{item.price}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-3 bg-black/30 rounded-full p-1">
                                        <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-primary text-white font-bold">-</button>
                                        <span className="font-bold w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-primary text-white font-bold">+</button>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                                </div>
                            </div>
                        ))}
                        
                        <div className="bg-surface/50 border border-surface-light rounded-2xl p-6 shadow-md space-y-4">
                            <h3 className="font-bold text-lg">Delivery Information</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-textSecondary uppercase mb-1">Phone Number</label>
                                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-primary" placeholder="10-digit mobile" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-textSecondary uppercase mb-1">Theater Seat Number</label>
                                    <input type="text" value={seatNumber} onChange={e => setSeatNumber(e.target.value)} className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-primary" placeholder="e.g., Row B - 12" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface/50 backdrop-blur-xl border border-surface-light rounded-[2.5rem] p-8 h-fit lg:sticky lg:top-24 shadow-2xl">
                        <h2 className="text-2xl font-black font-heading mb-6 uppercase">Summary</h2>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-textSecondary"><span>Subtotal</span><span>₹{totalAmount.toFixed(2)}</span></div>
                            <div className="flex justify-between text-textSecondary"><span>Convenience Fee</span><span className="text-green-400">FREE</span></div>
                        </div>
                        <div className="flex justify-between font-black font-heading text-2xl pt-6 border-t border-white/10">
                            <span>Total</span>
                            <span className="text-primary">₹{totalAmount.toFixed(2)}</span>
                        </div>
                        
                        {validationError && <p className="text-red-400 text-sm text-center mt-6 font-bold">{validationError}</p>}
                        
                        <button onClick={handleConfirmOrder} disabled={isPlacingOrder} className="w-full mt-8 bg-primary text-white font-black py-5 px-4 rounded-2xl hover:bg-primary-dark transition-all transform active:scale-95 shadow-xl shadow-primary/20 disabled:opacity-50">
                            {isPlacingOrder ? 'Verifying...' : 'Confirm And Pay'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartPage;
