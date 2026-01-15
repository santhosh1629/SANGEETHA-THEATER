
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import type { Order, CartItem, MenuItem } from '../../types';
import { OrderStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getStudentOrders, getMenu } from '../../services/mockApi';

const getCartFromStorage = (): CartItem[] => {
    const cart = localStorage.getItem('cart');
    const parsedCart = cart ? JSON.parse(cart) : [];
    return parsedCart;
};

const saveCartToStorage = (cart: CartItem[]) => {
    localStorage.setItem('cart', JSON.stringify(cart));
};


const getStatusDisplay = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.PENDING:
      return { text: 'Preparing', icon: '⏳', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' };
    case OrderStatus.PREPARED:
      return { text: 'Ready for Pickup', icon: '🍴', className: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
    case OrderStatus.COLLECTED:
      return { text: 'Collected', icon: '✅', className: 'bg-green-500/20 text-green-300 border-green-400/30' };
    case OrderStatus.CANCELLED:
      return { text: 'Cancelled', icon: '❌', className: 'bg-red-500/20 text-red-300 border-red-400/30' };
    default:
      return { text: status, icon: '❓', className: 'bg-gray-500/20 text-gray-300 border-gray-400/30' };
  }
};

const OrderCard: React.FC<{ order: Order; onReorder: (order: Order) => void; }> = ({ order, onReorder }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const statusInfo = getStatusDisplay(order.status);
    
    return (
        <div className="bg-surface backdrop-blur-lg border border-surface-light rounded-2xl shadow-md overflow-hidden transition-all duration-300 mb-4 text-textPrimary">
            <div 
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-surface-light/30"
                onClick={() => setIsExpanded(!isExpanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={`order-details-${order.id}`}
            >
                <div>
                    <p className="font-bold font-heading text-lg flex items-center gap-2">
                        Order #{order.id.slice(-6)}
                    </p>
                    <p className="text-sm text-textSecondary">{order.timestamp.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-4">
                    <p className="font-black font-heading text-2xl text-primary">₹{(order.totalAmount || 0).toFixed(2)}</p>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-textSecondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isExpanded && (
                <div id={`order-details-${order.id}`} className="p-4 bg-background/50 border-t border-surface-light animate-fade-in-down">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow">
                            <h4 className="font-semibold mb-2 text-textPrimary/90">Order Details</h4>
                            <div className="space-y-2">
                                {order.items.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                        <div>
                                            <p className="text-textPrimary/90">{item.name} <span className="text-textSecondary">x {item.quantity}</span></p>
                                            {item.notes && <p className="text-xs text-primary/80 italic pl-2">Note: "{item.notes}"</p>}
                                        </div>
                                        <p className="text-textSecondary">₹{(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-surface-light my-2"></div>
                             <div className="flex justify-between font-bold font-heading text-textPrimary">
                                <span>Total</span>
                                <span>₹{(order.totalAmount || 0).toFixed(2)}</span>
                            </div>

                            {order.status === OrderStatus.COLLECTED && order.deliveredByStaffName && (
                                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <p className="text-sm font-bold text-green-300 flex items-center gap-2">
                                        <span>🤝</span> Delivered by: {order.deliveredByStaffName} (Staff)
                                    </p>
                                    {order.deliveredAt && (
                                        <p className="text-xs text-green-400/70 mt-1">
                                            Delivered time: {new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex-shrink-0 sm:w-48 text-center sm:border-l sm:border-surface-light sm:pl-4">
                            <h4 className="font-semibold mb-2 text-textPrimary/90">Status</h4>
                            <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${statusInfo.className}`}>
                                {statusInfo.icon} {statusInfo.text}
                            </div>
                            {(order.status === OrderStatus.PENDING || order.status === OrderStatus.PREPARED) && (
                                <div className="mt-4 flex flex-col items-center">
                                    <p className="text-sm text-textSecondary mb-2">Show this QR code at the counter for pickup:</p>
                                    <div className="p-2 bg-white rounded-lg"><QRCodeSVG value={order.qrToken} size={128} /></div>
                                </div>
                            )}
                            {order.status === OrderStatus.CANCELLED && order.refundAmount != null && (
                                <p className="mt-4 text-sm text-red-400 bg-red-500/20 p-2 rounded-md">
                                    A refund of ₹{(order.refundAmount || 0).toFixed(2)} has been processed.
                                </p>
                            )}
                        </div>
                    </div>
                     { (order.status === OrderStatus.COLLECTED || order.status === OrderStatus.CANCELLED) && (
                        <div className="mt-4 pt-4 border-t border-surface-light">
                            <button
                                onClick={() => onReorder(order)}
                                className="w-full bg-primary text-background font-semibold py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                                <span>Reorder</span>
                            </button>
                        </div>
                     )}
                </div>
            )}
        </div>
    );
};

const OrderHistoryPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, loading: authLoading, promptForPhone } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
        if (!authLoading && !user) {
            promptForPhone();
        }
    }, [user, authLoading, promptForPhone]);

    const fetchOrdersAndMenu = useCallback(async () => {
        if (user) {
            setLoading(true);
            try {
                const [data, menuData] = await Promise.all([
                    getStudentOrders(user.id),
                    getMenu()
                ]);
                setOrders(data);
                setMenu(menuData);
            } catch (error) {
                console.error("Failed to fetch order history or menu", error);
            } finally {
                setLoading(false);
            }
        } else {
            setOrders([]);
            setMenu([]);
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOrdersAndMenu();
    }, [fetchOrdersAndMenu]);
    
    const handleReorder = (orderToReorder: Order) => {
        const currentCart = getCartFromStorage();
        const unavailableItems: string[] = [];
        let itemsAdded = 0;

        orderToReorder.items.forEach(orderItem => {
            const fullMenuItem = menu.find(menuItem => menuItem.id === orderItem.id);

            if (fullMenuItem && fullMenuItem.isAvailable) {
                const cartItemIndex = currentCart.findIndex(ci => ci.id === orderItem.id);
                if (cartItemIndex > -1) {
                    currentCart[cartItemIndex].quantity += orderItem.quantity;
                } else {
                    const newCartItem: CartItem = {
                        ...fullMenuItem,
                        quantity: orderItem.quantity,
                        notes: orderItem.notes,
                    };
                    currentCart.push(newCartItem);
                }
                itemsAdded++;
            } else {
                unavailableItems.push(orderItem.name);
            }
        });

        if (itemsAdded > 0) {
            saveCartToStorage(currentCart);
            window.dispatchEvent(new CustomEvent('itemAddedToCart'));
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `${itemsAdded} item(s) re-added to cart!`, type: 'cart-add' } }));
            
            if (unavailableItems.length > 0) {
                setTimeout(() => window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `Some items were out of stock.`, type: 'stock-out' } })), 500);
            }

            navigate('/customer/cart');
        } else {
             window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'All items are currently out of stock.', type: 'stock-out' } }));
        }
    };


    if (loading || !user) {
        return (
            <div>
                <div className="h-9 bg-surface rounded-lg w-1/2 mb-6 animate-pulse"></div>
                <div className="space-y-4 animate-pulse">
                    <div className="h-20 bg-surface rounded-2xl"></div>
                    <div className="h-20 bg-surface rounded-2xl"></div>
                    <div className="h-20 bg-surface rounded-2xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold font-heading mb-6 text-textPrimary" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>Order History 🧾</h1>
            {orders.length > 0 ? (
                <div>
                    {orders.map(order => (
                        <OrderCard key={order.id} order={order} onReorder={handleReorder} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-surface backdrop-blur-lg border border-surface-light rounded-2xl shadow-md">
                    <p className="text-xl font-semibold text-textPrimary">No Order History Found</p>
                    <p className="text-textSecondary mt-2">You haven't placed any orders yet.</p>
                </div>
            )}
        </div>
    );
};

export default OrderHistoryPage;
