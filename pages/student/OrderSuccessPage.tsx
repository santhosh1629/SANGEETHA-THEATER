
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import type { Order } from '../../types';
import { OrderStatus } from '../../types';
import { getOrderById, updateOrderSeatNumber } from '../../services/mockApi';

const TemporaryPopup: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(onClose, 10000); // 10 seconds
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" 
                onClick={onClose}
            ></div>
            
            {/* Modal Content */}
            <div className="relative bg-surface border-2 border-primary/50 rounded-3xl shadow-[0_20px_50px_rgba(255,0,51,0.3)] p-8 max-w-sm w-full text-center animate-pop-in">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-primary rounded-full flex items-center justify-center text-4xl shadow-lg border-4 border-surface">
                    ✅
                </div>
                
                <h2 className="text-2xl font-black font-heading text-white mt-6 mb-4">
                    Order Verified!
                </h2>
                
                <div className="space-y-4 text-textPrimary text-sm sm:text-base leading-relaxed">
                    <p className="font-semibold text-primary/90 text-lg">🎉 Payment Confirmed!</p>
                    <p>Your Pickup QR Code is now live and secured ✅</p>
                    
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left space-y-1">
                        <p className="text-textSecondary flex gap-2">
                            <span className="flex-shrink-0 text-white">📌</span>
                            <span>Staff can now see your order. Please show the QR at the counter.</span>
                        </p>
                    </div>
                    
                    <p className="font-heading text-2xl text-white pt-2 animate-pulse tracking-tight">
                        Enjoy your show 🍿✨
                    </p>
                </div>
                
                <button 
                    onClick={onClose}
                    className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                >
                    Dismiss (10s)
                </button>
            </div>
        </div>
    );
};

const CompactPermanentBanner: React.FC = () => (
    <div className="bg-primary/5 border border-white/10 rounded-xl p-3 mb-4 text-center animate-pop-in">
        <p className="text-xs sm:text-sm text-textPrimary font-medium leading-tight">
            Please save this QR Code to collect your food faster.
        </p>
        <p className="text-[11px] sm:text-xs text-textSecondary italic mt-1 opacity-70">
            Staff will only prepare your food after this step.
        </p>
    </div>
);

const OrderSuccessPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [seatNumber, setSeatNumber] = useState('');
  const [seatSubmitted, setSeatSubmitted] = useState(false);
  const location = useLocation();
  const [currentStatus, setCurrentStatus] = useState<OrderStatus | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (orderId) {
        try {
          const orderData = await getOrderById(orderId);
          setOrder(orderData);
          setCurrentStatus(orderData.status);
          if (orderData.seatNumber) {
            setSeatNumber(orderData.seatNumber);
            setSeatSubmitted(true);
          }
          
          // Only show popup when transitioning to a "Ready" state
          if (location.state?.showSuccessToast && (orderData.status === OrderStatus.QR_GENERATED)) {
              setShowPopup(true);
              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Verification Successful!', type: 'payment-success' } }));
          }
        } catch (error) {
          console.error("Order Load Error:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchOrder();

    if (orderId) {
        const intervalId = setInterval(async () => {
            try {
                const updatedOrder = await getOrderById(orderId);
                const newStatus = updatedOrder.status;
                
                if (newStatus !== currentStatus) {
                    setCurrentStatus(newStatus);
                    setOrder(updatedOrder);
                    
                    if (newStatus === OrderStatus.QR_GENERATED) {
                        setShowPopup(true);
                    }
                    
                    if (newStatus === OrderStatus.COLLECTED) {
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Order Collected!', type: 'payment-success' } }));
                    }
                }
            } catch (e) {
                console.warn(`[Order Polling] status check failed.`);
            }
        }, 3000);

        return () => clearInterval(intervalId);
    }
  }, [orderId, currentStatus, location.state]);

  const handleSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seatNumber.trim() && orderId) {
      try {
        await updateOrderSeatNumber(orderId, seatNumber.trim());
        setSeatSubmitted(true);
      } catch(error) {
        console.error("Failed to submit seat number", error);
      }
    }
  };

  if (loading) {
    return (
        <div className="max-w-md mx-auto bg-surface/50 backdrop-blur-lg border border-surface-light p-6 sm:p-8 rounded-2xl shadow-xl animate-pulse">
            <div className="h-10 bg-white/5 rounded-xl mb-4"></div>
            <div className="h-40 bg-white/5 rounded-2xl mb-8"></div>
            <div className="h-64 bg-white/5 rounded-2xl"></div>
        </div>
    );
  }

  if (!order) {
    return <div className="text-center text-lg text-red-400 bg-surface/50 backdrop-blur-lg rounded-lg p-8">Order not found.</div>;
  }

  const isVerified = currentStatus !== OrderStatus.INITIATED && currentStatus !== OrderStatus.PAYMENT_PENDING && currentStatus !== OrderStatus.PAYMENT_FAILED;
  const isCollected = currentStatus === OrderStatus.COLLECTED;

  return (
    <div className="max-w-md mx-auto relative min-h-[80vh] flex flex-col justify-center">
      <TemporaryPopup isOpen={showPopup} onClose={() => setShowPopup(false)} />
      
      <div className="bg-surface/50 backdrop-blur-lg border border-surface-light p-6 sm:p-8 rounded-3xl shadow-2xl text-textPrimary w-full">
        
        <div className="text-center mb-8">
            <h1 className="text-3xl font-black font-heading text-white drop-shadow-lg">
                {!isVerified ? "Verifying Payment..." : isCollected ? "Order Collected!" : "Payment Verified!" }
            </h1>
            <p className="text-xs text-textSecondary mt-2 tracking-widest uppercase">
                Order <span className="font-bold text-primary">#{order.id.slice(-6)}</span>
            </p>
        </div>

        {isVerified && <CompactPermanentBanner />}

        {/* ORDER SUMMARY */}
        <div className="animate-slide-in-up">
          <h3 className="text-sm font-black font-heading mb-4 text-primary uppercase tracking-[0.2em] border-b border-white/10 pb-2">
            Order Summary
          </h3>
          <div className="space-y-3">
            {order.items.map(item => (
                <div key={item.id} className="py-1">
                    <div className="flex justify-between text-textPrimary/90 font-medium text-sm">
                        <span>{item.name} <span className="text-textSecondary/60 ml-1">x{item.quantity}</span></span>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-4">
              <div className="flex justify-between font-black font-heading text-2xl text-white">
                  <span>Total Paid</span>
                  <span className="text-primary">₹{order.totalAmount.toFixed(2)}</span>
              </div>
          </div>
        </div>

        {/* QR CODE SECTION - ONLY AFTER VERIFICATION */}
        <div className="mt-10 pt-8 border-t-2 border-dashed border-white/5 flex flex-col items-center">
          {!isVerified ? (
              <div className="flex flex-col items-center py-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-primary mb-4"></div>
                  <p className="text-sm text-textSecondary font-bold animate-pulse">Checking Gateway Verification...</p>
              </div>
          ) : (
            <div className="animate-fade-in-down w-full flex flex-col items-center">
              <div className="text-center mb-6">
                  <h2 className="text-xl font-bold font-heading mb-1 text-white">Pickup QR Code</h2>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-textSecondary/50">
                    {isCollected ? "Status: Redeemed" : "Counter Scan Ready"}
                  </p>
              </div>
              
              <div className={`relative p-5 bg-white rounded-[2rem] border-8 border-primary/20 shadow-2xl transition-all ${isCollected ? 'grayscale opacity-30 scale-95' : 'hover:scale-105 active:scale-95 cursor-pointer shadow-primary/20'}`}>
                <QRCode value={order.qrToken} size={180} fgColor="#1E293B" bgColor="#FFFFFF" />
                {isCollected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-[1.5rem]">
                      <span className="text-black font-black text-3xl -rotate-12 border-4 border-black px-3 py-1">COLLECTED</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
         {/* DINE-IN SERVICE (SEAT NUMBER) */}
         {isVerified && (
            <div className="mt-10 pt-8 border-t-2 border-dashed border-white/5 animate-pop-in">
                <h2 className="text-xs font-black font-heading text-center mb-4 text-white/40 uppercase tracking-[0.3em]">Dine-In Service</h2>
                {seatSubmitted ? (
                    <div className="text-center bg-green-500/5 border border-green-400/20 p-4 rounded-2xl">
                        <p className="font-bold text-green-400 text-lg">Seat {seatNumber}</p>
                        <p className="text-[10px] text-green-400/50 mt-1 uppercase tracking-wider font-bold">Staff will deliver to you</p>
                    </div>
                ) : (
                    <form onSubmit={handleSeatSubmit} className="flex flex-col items-center gap-3">
                        <input
                            id="seatNumber"
                            type="text"
                            value={seatNumber}
                            onChange={(e) => setSeatNumber(e.target.value)}
                            placeholder="Enter Seat (e.g. A12)"
                            className="w-full text-center text-xl font-black p-4 bg-black/30 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-primary transition-all placeholder:text-white/10"
                            required
                        />
                        <button type="submit" className="w-full bg-primary text-background font-black py-4 px-6 rounded-2xl hover:bg-primary-dark transition-all transform active:scale-95 shadow-xl shadow-primary/20">
                            Confirm Seat
                        </button>
                    </form>
                )}
            </div>
         )}
      </div>
    </div>
  );
};

export default OrderSuccessPage;
