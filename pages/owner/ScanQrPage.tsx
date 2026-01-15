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
            false // verbose
        );

        const onScanSuccess = (decodedText: string, decodedResult: any) => {
            scanner.clear();
            handleVerifyQrCode(decodedText);
        };

        const onScanFailure = (error: any) => {
            // console.warn(`QR error = ${error}`);
        };

        scanner.render(onScanSuccess, onScanFailure);

        return () => {
            // Check if the scanner has a clear method and the element exists
            if (scanner && document.getElementById('reader')) {
                scanner.clear().catch((err: any) => {
                    console.error("Failed to clear html5-qrcode-scanner.", err);
                });
            }
        };
    }, [scanResult, isVerifying]);

    const handleVerifyQrCode = async (qrCodeData: string) => {
        setIsVerifying(true);
        if (!user) {
            setErrorMessage('User not authenticated. Please log in again.');
            setScanResult('error');
            setIsVerifying(false);
            return;
        }
        try {
            const order = await verifyQrCodeAndCollectOrder(qrCodeData, user.id);
            setScannedOrder(order);
            setScanResult('success');
        } catch (err) {
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
                 <div>
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-indigo-400">Verifying Order...</p>
                </div>
            ) : (
                <>
                    <div id="reader" className="w-full"></div>
                    <p className="text-gray-400 mt-4">Place the QR code inside the box to scan.</p>
                </>
            )}
        </div>
    );

    const renderSuccessState = () => (
        <div className="text-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-green-400 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-3xl font-bold text-green-300 mb-2">Order Confirmed ✅</h2>
            {scannedOrder && (
                <div className="text-left bg-gray-700/50 p-4 rounded-lg mt-6 text-gray-200">
                    <p><strong>Order ID:</strong> ...{scannedOrder.id.slice(-8)}</p>
                    <p className="mb-3"><strong>Customer:</strong> {scannedOrder.studentName}</p>
                    
                    <h4 className="font-semibold text-lg border-b border-gray-600 pb-1 mb-2">Ordered Items</h4>
                    <div className="space-y-2 mb-3">
                        {scannedOrder.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="text-gray-200 font-medium">{item.name}</p>
                                    <p className="text-gray-400 text-xs">
                                        {item.quantity} x ₹{item.price.toFixed(2)}
                                    </p>
                                </div>
                                <span className="font-semibold text-gray-100">
                                    ₹{(item.price * item.quantity).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-600 pt-2 flex justify-between items-center font-bold text-lg">
                        <span className="text-white">Total Amount:</span>
                        <span className="text-green-300">₹{scannedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            )}
            <button onClick={handleReset} className="w-full mt-6 bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                Scan Another Order
            </button>
        </div>
    );

    const renderErrorState = () => (
        <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-400 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-3xl font-bold text-red-400 mb-2">Scan Unsuccessful</h2>
            <p className="text-red-300 bg-red-500/20 p-3 rounded-md">{errorMessage}</p>
            <button onClick={handleReset} className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                Try Again
            </button>
        </div>
    );

    return (
        <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-md border border-gray-700">
            <h1 className="text-3xl font-bold mb-6 text-center text-white">Scan & Verify Order</h1>
            <div className="flex items-center justify-center min-h-[300px]">
                {scanResult === 'idle' && renderScanner()}
                {scanResult === 'success' && renderSuccessState()}
                {scanResult === 'error' && renderErrorState()}
            </div>
        </div>
    );
};

export default ScanQrPage;
