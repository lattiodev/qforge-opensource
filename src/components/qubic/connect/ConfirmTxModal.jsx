import React, { useEffect, useState } from 'react' // Keep React import
import Card from '../ui/Card' // Path should be correct relative to connect/
import { useQubicConnect } from '../../../context/QubicConnectContext' // Corrected path
import { formatQubicAmount, byteArrayToHexString, truncateMiddle } from "../util"; // Adjusted path
// Removed HM25 and ConfigContext dependencies
import CloseIcon from '../../../assets/close.svg'; // Adjust path if needed
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Default TICK_OFFSET if not provided by context or elsewhere
const DEFAULT_TICK_OFFSET = 5;

const ConfirmTxModal = () => {
    // Get modal state and details from context
    const {
        showConfirmModal,
        confirmTxDetails,
        handleConfirm,
        handleCancel,
        getTick,
        wallet // Need wallet to display source ID
    } = useQubicConnect();

    // Local state for tick progress (if needed, example code didn't use it extensively)
    const [currentTick, setCurrentTick] = useState(null);
    const [tickFetchInterval, setTickFetchInterval] = useState(null);
    const [targetTickDisplay, setTargetTickDisplay] = useState(null);

    // State for potential errors during confirmation/broadcast
    const [error, setError] = useState(null);
    const [isConfirming, setIsConfirming] = useState(false);

    // Example: Fetch tick periodically if modal is open and transaction is pending confirmation
    // This part is less critical if we don't show a progress bar like the example
    // useEffect(() => {
    //     if (showConfirmModal && !isConfirming) {
    //         const fetchTick = async () => {
    //             try {
    //                 const t = await getTick();
    //                 setCurrentTick(t);
    //                 if (confirmTxDetails?.tick) {
    //                    setTargetTickDisplay(confirmTxDetails.tick + DEFAULT_TICK_OFFSET);
    //                 }
    //             } catch (err) { 
    //                 console.error("Failed to fetch tick for confirmation modal:", err);
    //             }
    //         };
    //         fetchTick(); // Initial fetch
    //         const intervalId = setInterval(fetchTick, 5000); // Fetch every 5 seconds
    //         setTickFetchInterval(intervalId);
    //         return () => clearInterval(intervalId); // Cleanup interval
    //     } else if (tickFetchInterval) {
    //         clearInterval(tickFetchInterval);
    //         setTickFetchInterval(null);
    //     }
    // }, [showConfirmModal, isConfirming, confirmTxDetails, getTick]);

    const handleConfirmClick = async () => {
        setError(null);
        setIsConfirming(true);
        try {
            await handleConfirm(); // This now triggers the signing/broadcasting
            // Success is handled by the calling component via promise resolution
            // Modal will be closed by handleConfirm in context on success/error
        } catch (err) { 
            console.error("Transaction confirmation/broadcast failed:", err);
            setError(err.message || "Failed to send transaction.");
        } finally {
            setIsConfirming(false);
        }
    };

    const handleCancelClick = () => {
        setError(null);
        setIsConfirming(false);
        handleCancel(); // Call context cancel handler
    };

    // Format details for display
    const details = confirmTxDetails || {};
    
    // --- Display amount in QUS --- 
    // 1. Get amount in qus (as string or 0)
    const amountInQusString = details.amount || '0';
    // 2. Format the QUS value with commas (no division)
    const displayTxValueInQus = Number(amountInQusString).toLocaleString('en-US');
    // -------------------------------
    
    const displaySource = details.sourceId ? truncateMiddle(details.sourceId) : (wallet?.publicKey ? truncateMiddle(wallet.publicKey) : 'N/A');
    const displayDestination = details.destinationId ? truncateMiddle(details.destinationId) : 'N/A';

    // Extract function parameters for display
    const functionParams = details.functionParams || {};
    const paramEntries = Object.entries(functionParams).filter(([key, value]) => value !== undefined && value !== null && value !== ''); // Don't show empty params

    if (!showConfirmModal) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={handleCancelClick} // Close on overlay click
        >
            <Card
                className="relative p-6 w-full max-w-lg m-auto flex flex-col bg-gray-800 text-white shadow-xl rounded-xl"
                onClick={(e) => e.stopPropagation()} // Prevent closing
            >
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-600">
                    <h3 className="text-xl font-semibold">Confirm{details.functionName ? ` ${details.functionName}` : ''} Transaction</h3>
                    <button onClick={handleCancelClick} className="text-gray-400 hover:text-white">
                         {/* Simple X for close */} 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3 text-sm mb-6">
                    <div className="flex justify-between">
                        <span className="font-medium text-gray-400">From:</span>
                        <span className="font-mono" title={details.sourceId || wallet?.publicKey}>{displaySource}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="font-medium text-gray-400">To (Contract):</span>
                        <span className="font-mono" title={details.destinationId}>{displayDestination}</span>
                    </div>
                     {details.amount && BigInt(details.amount) > 0n && (
                        <div className="flex justify-between">
                            <span className="font-medium text-gray-400">Transaction Value:</span>
                            <span className="font-semibold">{displayTxValueInQus} qus</span>
                        </div>
                     )}
                     <div className="flex justify-between">
                        <span className="font-medium text-gray-400">Contract Index:</span>
                        <span>{details.contractIndex ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium text-gray-400">Function Index:</span>
                        <span>{details.procedureIndex ?? 'N/A'}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="font-medium text-gray-400">Target Tick:</span>
                        <span>{details.tick ? details.tick + DEFAULT_TICK_OFFSET : 'N/A'}</span>
                    </div>
                    
                    {paramEntries.length > 0 && (
                        <div className="pt-3 border-t border-gray-600">
                            <h4 className="font-medium text-gray-300 mb-2">Input Parameters:</h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto pr-2 text-xs">
                                {paramEntries.map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                        <span className="text-gray-400 mr-2">{key}:</span>
                                        {(key.toLowerCase().includes('amount') || key.toLowerCase().startsWith('amt')) && typeof value === 'string' && /^[0-9]+$/.test(value) ? (
                                            <span className="font-mono text-gray-200 font-semibold">{formatQubicAmount(value)} Qus</span>
                                        ) : (
                                             <span className="font-mono text-gray-200 break-all max-w-[70%]">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-red-500 bg-red-900 bg-opacity-50 p-3 rounded border border-red-700 text-center text-sm mb-4">{error}</p>
                )}

                <div className="flex justify-end gap-4">
                    <button
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition duration-150 ease-in-out"
                        onClick={handleCancelClick}
                        disabled={isConfirming}
                    >
                        Cancel
                    </button>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleConfirmClick}
                        disabled={isConfirming}
                    >
                        {isConfirming ? (
                             <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Confirming...
                            </div>
                        ) : 'Confirm'}
                    </button>
                </div>
            </Card>
        </div>
    );
}

export default ConfirmTxModal; 