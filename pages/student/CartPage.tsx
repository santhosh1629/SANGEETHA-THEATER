
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../../types';
import { OrderStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { placeOrder, createPaymentRecord, updateOrderStatus, updateOrderPaymentStatus, createRazorpayOrderApi, verifyRazorpayPaymentApi } from '../../services/mockApi';
import { CONFIG } from '../../config';

declare const Razorpay: any;

const getCartFromStorage = (): CartItem[] => {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
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
    
    const handleNotesChange = (itemId: string, notes: string) => updateCart(cart.map(item => item.id === itemId ? { ...item, notes } : item));
    
    const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
    
    const totalAmount = subtotal;

    const handlePayment = async (orderId: string) => {
        try {
            // STEP 1: Create Razorpay Order from Backend
            const rzpOrder = await createRazorpayOrderApi(totalAmount, user!.id);

            const options = {
                key: CONFIG.RAZORPAY_KEY_ID, // Using dynamic key from config
                amount: rzpOrder.amount, 
                currency: rzpOrder.currency,
                order_id: rzpOrder.id, 
                name: CONFIG.APP_NAME,
                description: "Food Order Payment",
                image: "/favicon.ico",
                handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                    // STEP 3: Verify Signature on Backend (MANDATORY)
                    setIsPlacingOrder(true);
                    try {
                        const isVerified = await verifyRazorpayPaymentApi(orderId, response);
                        
                        if (isVerified) {
                            await updateOrderPaymentStatus(orderId, true);
                            await updateOrderStatus(orderId, OrderStatus.PENDING);
                            await createPaymentRecord({
                                order_id: orderId,
                                student_id: user?.id,
                                amount: totalAmount,
                                method: 'Razorpay',
                                status: 'successful',
                                transaction_id: response.razorpay_payment_id,
                            });
                            updateCart([]);
                            navigate(`/customer/order-success/${orderId}`, { state: { showSuccessToast: true } });
                        } else {
                            throw new Error("Payment verification failed. Please contact support.");
                        }
                    } catch (error) {
                        window.dispatchEvent(new CustomEvent('show-toast', { 
                            detail: { 
                                message: error instanceof Error ? error.message : 'Payment verification failed.', 
                                type: 'payment-error' 
                            } 
                        }));
                        setIsPlacingOrder(false);
                    }
                },
                prefill: {
                    name: user?.username || 'Valued Customer',
                    email: user?.email || '',
                    contact: phoneNumber,
                },
                theme: {
                    color: "#FF0033",
                },
                modal: {
                    ondismiss: () => {
                        setIsPlacingOrder(false);
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Payment was cancelled. Order not confirmed.', type: 'cart-warn' } }));
                    }
                }
            };
            
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', (response: any) => {
                const errorMsg = response.error?.description || response.error?.reason || 'Payment was unsuccessful.';
                window.dispatchEvent(new CustomEvent('show-toast', { 
                    detail: { 
                        message: `Payment Error: ${errorMsg}`, 
                        type: 'payment-error' 
                    } 
                        }));
                setIsPlacingOrder(false);
            });
            rzp.open();

        } catch (err) {
            window.dispatchEvent(new CustomEvent('show-toast', { 
                detail: { 
                    message: 'Could not initialize secure payment. Try again.', 
                    type: 'payment-error' 
                } 
            }));
            setIsPlacingOrder(false);
        }
    };

    const handleConfirmOrder = async () => {
        if (!user) {
            promptForPhone();
            return;
        }
        if (!phoneNumber.trim()) {
            setValidationError('Please enter your phone number.');
            return;
        }
        if (!seatNumber.trim()) {
            setValidationError('Please enter your seat number (e.g., A12).');
            return;
        }
        if (!/^\d{10}$/.test(phoneNumber)) {
            setValidationError('Please enter a valid 10-digit phone number.');
            return;
        }
        setValidationError('');
        setIsPlacingOrder(true);

        try {
            if (user.phone !== phoneNumber) {
                try { await updateUser({ phone: phoneNumber }); } catch (e) { console.error(e); }
            }

            const orderPayload = {
                studentId: user.id, 
                studentName: user.username,
                customerPhone: phoneNumber,
                items: cart.map(({ id, name, quantity, price, notes, imageUrl }) => ({ id, name, quantity, price, notes, imageUrl })),
                totalAmount,
                seat_number: seatNumber.trim(),
                status: OrderStatus.SEAT_SELECTED 
            };
            
            const order = await placeOrder(orderPayload);
            handlePayment(order.id);

        } catch (error) {
            window.dispatchEvent(new CustomEvent('show-toast', { 
                detail: { 
                    message: error instanceof Error ? error.message : 'Failed to place order.', 
                    type: 'payment-error' 
                } 
            }));
            setIsPlacingOrder(false);
        }
    };


    if (!user) {
        return <div className="text-center py-16 text-textPrimary"><p>Please log in to view your cart.</p></div>;
    }


    return (
        <div className="text-textPrimary">
            <h1 className="text-3xl font-bold font-heading mb-6" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
                Your Cart 🛒
            </h1>
            {cart.length === 0 ? (
                <div className="text-center py-16 bg-surface/50 backdrop-blur-lg border border-surface-light rounded-lg shadow-md">
                    <p className="text-xl font-semibold">Your cart is empty.</p>
                    <p className="text-textSecondary mt-2">Looks like you haven't added anything yet!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="bg-surface/50 backdrop-blur-lg border border-surface-light rounded-lg p-4 flex gap-4 items-center shadow-md">
                                <img src={item.imageUrl} alt={item.name} className="w-24 h-24 object-cover rounded-md" />
                                <div className="flex-grow">
                                    <h3 className="font-bold font-heading text-lg">{item.name}</h3>
                                    <p className="font-bold font-heading text-primary">₹{item.price}</p>
                                    <input
                                        type="text"
                                        placeholder="Add cooking notes..."
                                        value={item.notes || ''}
                                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                        className="w-full text-sm mt-1 px-2 py-1 border border-white/30 bg-black/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-white/50"
                                    />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2 bg-black/30 rounded-full p-1">
                                        <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)} className="w-6 h-6 rounded-full bg-primary text-background font-bold flex items-center justify-center">-</button>
                                        <span className="font-bold w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)} className="w-6 h-6 rounded-full bg-primary text-background font-bold flex items-center justify-center">+</button>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.id)} className="text-xs text-white/70 hover:underline">Remove</button>
                                </div>
                            </div>
                        ))}
                        <div className="bg-surface/50 backdrop-blur-lg border border-surface-light rounded-lg p-4 mt-4 shadow-md space-y-4">
                            <h3 className="font-bold font-heading text-lg">Order Details</h3>
                            <div>
                                <label htmlFor="phone-number" className="block text-sm font-semibold text-textSecondary mb-1">Phone Number <span className="text-red-400">*</span></label>
                                <input type="tel" id="phone-number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary" placeholder="10-digit mobile number" required />
                            </div>
                            <div>
                                <label htmlFor="seat-number" className="block text-sm font-semibold text-textSecondary mb-1">Seat Number <span className="text-red-400">*</span></label>
                                <input type="text" id="seat-number" value={seatNumber} onChange={e => setSeatNumber(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., A12 or G5" required />
                                <p className="text-xs text-textSecondary mt-1">Please look for the seat number on your chair/table.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface/50 backdrop-blur-xl border border-surface-light rounded-lg p-6 h-fit sticky top-24 shadow-xl">
                        <h2 className="text-2xl font-bold font-heading mb-4">Summary</h2>
                        
                        <div className="space-y-2 pt-4">
                            <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold font-heading text-xl pt-2 mt-2 border-t border-white/20"><span>Total</span><span>₹{totalAmount.toFixed(2)}</span></div>
                        </div>

                        {validationError && <p className="text-red-400 text-sm text-center mt-4 bg-red-900/20 p-2 rounded">{validationError}</p>}

                        <button onClick={handleConfirmOrder} disabled={isPlacingOrder || !user} className="w-full mt-6 bg-primary text-background font-bold font-heading py-3 px-4 rounded-lg hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 disabled:bg-primary/50 disabled:cursor-not-allowed">
                            {isPlacingOrder ? 'Starting Secure Payment...' : 'Confirm Order & Pay'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartPage;
