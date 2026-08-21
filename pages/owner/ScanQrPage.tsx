import React, { useState, useEffect, useRef } from 'react';
import { verifyQrCodeAndCollectOrder } from '../../services/mockApi';
import type { Order } from '../../types';
import { useAuth } from '../../context/AuthContext';

declare const Html5QrcodeScanner: any;

const ScanQrPage: React.FC<{ onSuccess?: (order: Order) => void }> = ({ onSuccess }) => {
    const { user } = useAuth();
    const [scanResult, setScanResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [showManualInput, setShowManualInput] = useState(false);
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        if (scanResult !== 'idle' || isVerifying || showManualInput) {
            return;
        }

        let isMounted = true;

        try {
            if (typeof Html5QrcodeScanner !== 'undefined') {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        rememberLastUsedCamera: true
                    },
                    false
                );
                scannerRef.current = scanner;

                const onScanSuccess = (decodedText: string) => {
                    if (!isMounted) return;
                    try {
                        scanner.clear().catch(() => {});
                    } catch (e) {}
                    handleVerifyQrCode(decodedText);
                };

                const onScanFailure = () => {
                    // Silently ignore frame scan misses
                };

                scanner.render(onScanSuccess, onScanFailure);
            }
        } catch (e) {
            console.warn("Could not start HTML5 QR Scanner:", e);
        }

        return () => {
            isMounted = false;
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch(() => {});
                } catch (e) {}
            }
        };
    }, [scanResult, isVerifying, showManualInput]);

    const playSuccessChime = () => {
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
            }
        } catch (e) {}
    };

    const handleVerifyQrCode = async (qrCodeData: string) => {
        if (!qrCodeData || !qrCodeData.trim()) return;
        setIsVerifying(true);
        setErrorMessage('');

        if (!user) {
            setErrorMessage('User identity not authenticated. Please log in.');
            setScanResult('error');
            setIsVerifying(false);
            return;
        }

        try {
            const order = await verifyQrCodeAndCollectOrder(qrCodeData.trim(), user.id);
            setScannedOrder(order);
            setScanResult('success');
            playSuccessChime();
            if (onSuccess) onSuccess(order);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { 
                detail: { message: `✅ Order #${order.id.slice(-6).toUpperCase()} collected successfully!` } 
            }));
        } catch (err: any) {
            setErrorMessage(err.message || 'QR verification failed.');
            setScannedOrder(null);
            setScanResult('error');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualToken.trim()) return;
        handleVerifyQrCode(manualToken.trim());
    };

    const handleReset = () => {
        setScanResult('idle');
        setScannedOrder(null);
        setErrorMessage('');
        setManualToken('');
    };
    
    const renderScanner = () => (
        <div className="w-full space-y-4">
            {isVerifying ? (
                <div className="py-16 text-center bg-gray-900/60 rounded-3xl border border-white/10 p-6 space-y-4">
                    <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
                    <p className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                        Verifying QR Code with Database...
                    </p>
                </div>
            ) : showManualInput ? (
                <div className="bg-gray-900/80 p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">Manual Token Entry</h3>
                        <button 
                            onClick={() => setShowManualInput(false)}
                            className="text-xs text-indigo-400 font-bold hover:underline"
                        >
                            Use Camera
                        </button>
                    </div>
                    <p className="text-xs text-gray-400">Enter the customer's QR token string (e.g. SECURE-ORD-XXXX):</p>
                    <form onSubmit={handleManualSubmit} className="space-y-3">
                        <input 
                            type="text"
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                            placeholder="Enter QR Token or Token ID..."
                            className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                            autoFocus
                            required
                        />
                        <button 
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
                        >
                            Verify & Complete Delivery
                        </button>
                    </form>
                </div>
            ) : (
                <div className="bg-black/40 p-4 rounded-3xl border border-white/10 shadow-2xl space-y-3">
                    <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-2xl"></div>
                    <div className="flex justify-between items-center pt-2 px-1">
                        <p className="text-gray-400 text-xs font-medium">Point camera at customer's order QR code</p>
                        <button 
                            onClick={() => setShowManualInput(true)}
                            className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                        >
                            Enter Code Manually
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    const renderSuccessState = () => (
        <div className="text-center animate-pop-in space-y-5">
            <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/50 shadow-xl shadow-emerald-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            </div>

            <div>
                <h2 className="text-2xl font-black text-emerald-300 uppercase tracking-tight">Delivery Confirmed!</h2>
                <p className="text-gray-400 text-xs mt-1">
                    Order #{scannedOrder?.id.slice(-6).toUpperCase()} verified and handed over.
                </p>
            </div>
            
            {scannedOrder && (
                <div className="text-left bg-gray-900/90 border border-emerald-500/30 p-5 rounded-2xl shadow-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Customer</span>
                            <p className="font-bold text-white text-base uppercase">{scannedOrder.studentName || 'Customer'}</p>
                            {scannedOrder.customerPhone && <p className="text-xs text-gray-400 font-mono">{scannedOrder.customerPhone}</p>}
                        </div>
                        {scannedOrder.seatNumber ? (
                            <div className="bg-amber-500 text-black font-black px-3 py-1.5 rounded-xl text-sm shadow-md">
                                SEAT {scannedOrder.seatNumber}
                            </div>
                        ) : (
                            <div className="bg-gray-800 text-gray-300 font-bold px-2.5 py-1 rounded-lg text-xs">
                                COUNTER
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Delivered Items</span>
                        <div className="bg-black/30 rounded-xl p-3 space-y-1.5 border border-white/5">
                            {scannedOrder.items.map((item, idx) => (
                                <div key={`success-item-${idx}`} className="flex justify-between text-xs items-center">
                                    <span className="text-gray-200">{item.name}</span>
                                    <span className="text-emerald-400 font-black">x{item.quantity}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                        <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                            Delivered By: {scannedOrder.deliveredByStaffName || user?.username || 'Staff'}
                        </p>
                    </div>
                </div>
            )}

            <button 
                onClick={handleReset} 
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/25 text-xs uppercase tracking-wider"
            >
                Scan Next Order
            </button>
        </div>
    );

    const renderErrorState = () => (
        <div className="text-center animate-shake space-y-5">
            <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-red-500/50 shadow-xl shadow-red-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </div>
            <div>
                <h2 className="text-2xl font-black text-red-400 uppercase tracking-tight">Verification Failed</h2>
                <p className="text-gray-400 text-xs mt-1">This QR code could not be verified for collection.</p>
            </div>
            <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 text-left">
                <p className="text-red-300 font-bold text-xs">{errorMessage}</p>
            </div>
            <div className="space-y-2">
                <button 
                    onClick={handleReset} 
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-2xl transition-all text-xs uppercase tracking-wider"
                >
                    Try Another Scan
                </button>
                <button 
                    onClick={() => { setErrorMessage(''); setScanResult('idle'); setShowManualInput(true); }}
                    className="w-full bg-transparent hover:bg-white/5 text-gray-400 hover:text-white font-bold py-2.5 rounded-2xl transition-all text-xs"
                >
                    Try Manual Token Entry
                </button>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-sm mx-auto">
            {scanResult === 'idle' && renderScanner()}
            {scanResult === 'success' && renderSuccessState()}
            {scanResult === 'error' && renderErrorState()}
        </div>
    );
};

export default ScanQrPage;
