
import React, { useState, useEffect } from 'react';
import { verifyQrCodeAndCollectOrder } from '../../services/mockApi';
import type { Order } from '../../types';
import { useAuth } from '../../context/AuthContext';

declare const Html5QrcodeScanner: any;

const ScanQrPage: React.FC = () => {
    const { user } = useAuth();
    const [scanResult, setScanResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (scanResult !== 'idle' || isVerifying) {
            return;
        }

        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
            },
            false
        );

        const onScanSuccess = (decodedText: string) => {
            scanner.clear();
            handleVerifyQrCode(decodedText);
        };

        const onScanFailure = () => {
            // Silently ignore failures to scan (camera noise)
        };

        scanner.render(onScanSuccess, onScanFailure);

        return () => {
            if (scanner && document.getElementById('reader')) {
                scanner.clear().catch((err: any) => {
                    console.error("Scanner cleanup failed.", err);
                });
            }
        };
    }, [scanResult, isVerifying]);

    const handleVerifyQrCode = async (qrCodeData: string) => {
        setIsVerifying(true);
        if (!user) {
            setErrorMessage('User not authenticated.');
            setScanResult('error');
            setIsVerifying(false);
            return;
        }
        try {
            const order = await verifyQrCodeAndCollectOrder(qrCodeData, user.id);
            setScannedOrder(order);
            setScanResult('success');
        } catch (err) {
            // This will show specific errors like "Order not prepared" or "Payment not completed"
            setErrorMessage((err as Error).message);
            setScannedOrder(null);
            setScanResult('error');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleReset = () => {
        setScanResult('idle');
        setScannedOrder(null);
        setErrorMessage('');
    };
    
    const renderScanner = () => (
        <div className="w-full text-center">
            {isVerifying ? (
                 <div className="py-12">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-indigo-400">Verifying Order...</p>
                </div>
            ) : (
                <div className="bg-black/20 p-4 rounded-3xl border border-white/5">
                    <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-2xl"></div>
                    <p className="text-gray-400 mt-4 text-sm">Align QR code to verify and deliver</p>
                </div>
            )}
        </div>
    );

    const renderSuccessState = () => (
        <div className="text-center animate-pop-in">
             <div className="bg-green-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
             </div>
            <h2 className="text-3xl font-black text-green-300 mb-2">Delivery Success!</h2>
            <p className="text-gray-400 text-sm mb-6">Order #{scannedOrder?.id.slice(-6)} has been handed over.</p>
            
            {scannedOrder && (
                <div className="text-left bg-gray-800 border border-green-500/20 p-5 rounded-2xl mb-6 shadow-xl">
                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                         <p className="font-bold text-white uppercase">{scannedOrder.studentName}</p>
                         <div className="bg-amber-500 text-black text-[10px] font-black px-2 py-1 rounded">
                            SEAT {scannedOrder.seatNumber || 'N/A'}
                         </div>
                    </div>
                    
                    <div className="space-y-1 mb-4">
                        {scannedOrder.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-gray-400">{item.name} x{item.quantity}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-green-500/10 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Confirmed & Delivered</p>
                    </div>
                </div>
            )}
            <button onClick={handleReset} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
                Scan Next Order
            </button>
        </div>
    );

    const renderErrorState = () => (
        <div className="text-center animate-shake">
            <div className="bg-red-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </div>
            <h2 className="text-2xl font-black text-red-400 mb-2">Verification Failed</h2>
            <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 mb-6">
                <p className="text-red-300 font-medium">{errorMessage}</p>
            </div>
            <button onClick={handleReset} className="w-full bg-gray-700 text-white font-bold py-4 rounded-2xl hover:bg-gray-600 transition-all">
                Try Another Scan
            </button>
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
