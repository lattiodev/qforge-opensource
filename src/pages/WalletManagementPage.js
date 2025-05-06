import React, { useState, useEffect, useMemo } from 'react';
import { useQubicConnect } from '../context/QubicConnectContext';
import EndpointSetting from '../components/EndpointSetting'; // Reuse the existing component
import { InformationCircleIcon, WalletIcon, PaperAirplaneIcon, ExclamationTriangleIcon, CheckCircleIcon, LinkIcon } from '@heroicons/react/24/outline';
import { sendQubicTransaction } from '../utils/transactionApi'; // Import the new function

// Placeholder for balance fetching - replace with actual API call
async function fetchBalance(endpoint, publicKey) {
    // TODO: Implement actual balance fetching logic using the endpoint and public key
    // This might involve a direct fetch or using a method from qHelper if available
    console.log(`Fetching balance for ${publicKey} from ${endpoint}`);
    // Simulate network delay and return a dummy balance
    await new Promise(resolve => setTimeout(resolve, 500));
    // Dummy data - replace with actual API response structure
    // Assuming the API returns balance in qus
    const dummyBalance = (Math.random() * 1000000000000).toFixed(0); 
    return { balance: dummyBalance }; 
}

const WalletManagementPage = () => {
    // Get the full context object first
    const fullQubicConnectContext = useQubicConnect();
    
    // Destructure for local use as needed
    const { 
        connected, 
        wallet, 
        httpEndpoint, 
        qHelper, 
        balance: contextBalance, 
        isBalanceLoading, 
        balanceError: contextBalanceError,
        ownedAssets,
        isAssetsLoading,
        assetsError,
        possessedAssets,
        isPossessedAssetsLoading,
        possessedAssetsError
    } = fullQubicConnectContext; 

    // State for the Send QUBIC form
    const [destinationAddress, setDestinationAddress] = useState('');
    const [sendAmount, setSendAmount] = useState(''); // Amount in QUBIC (string)
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState(null);
    const [sendResult, setSendResult] = useState(null);

    // Format the balance from the context (assuming NO conversion)
    const formattedBalance = useMemo(() => {
        if (contextBalance !== null && contextBalance !== undefined) {
            try {
                // Display the raw balance number directly
                return BigInt(contextBalance).toString(); 
            } catch (e) {
                 console.error("Error formatting balance:", e);
                 return 'Error'; 
            }
        }
        return null;
    }, [contextBalance]);

    const handleSendQubic = async (e) => {
        e.preventDefault();
        // Use the destructured variables for checks
        if (!connected || !wallet) {
            setSendError("Wallet not connected.");
            return;
        }
        if (!destinationAddress || !sendAmount) {
            setSendError("Please fill in both destination address and amount.");
            return;
        }

        setIsSending(true);
        setSendError(null);
        setSendResult(null);

        try {
            // Treat input directly as the amount (no conversion)
            let amountQus;
            try {
                 amountQus = BigInt(sendAmount.trim()); // Convert input directly to BigInt
            } catch (e) {
                 throw new Error("Invalid amount. Please enter a whole number.");
            }

            if (amountQus <= 0n) {
                 throw new Error("Amount must be positive.");
             }
             if (contextBalance && amountQus > BigInt(contextBalance)) {
                 // Balance check still uses raw contextBalance vs raw amountQus
                 console.log(`[WalletManagementPage] Balance Check - Amount: ${amountQus}, Context Balance: ${contextBalance}`);
                 throw new Error("Insufficient balance.");
             }

            console.log(`Sending ${amountQus} (raw units) to ${destinationAddress}`); // Changed log message

            // Call the transaction API function
            const result = await sendQubicTransaction({
                qubicConnect: fullQubicConnectContext, // Pass the full context object
                destinationPublicKey: destinationAddress.trim(),
                amountQus: amountQus.toString(), 
            });

            console.log("Send Qubic Result:", result);
            setSendResult(result);
            setDestinationAddress(''); // Clear form on success
            setSendAmount('');

        } catch (error) {
            console.error("Error sending QUBIC:", error);
            setSendError(error.message || 'An unexpected error occurred during sending.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-4 md:p-6 font-sans">
            <h1 className="text-2xl font-bold text-white mb-6">Wallet Management</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: RPC Endpoint & Send QUBIC */}
                <div className="space-y-6">
                    {/* RPC Endpoint Settings */}
                     <div className="bg-gray-800 p-4 rounded-lg shadow">
                        <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">RPC Endpoint</h2>
                         <div className="text-sm">
                            <EndpointSetting /> 
                         </div>
                     </div>

                     {/* Send QUBIC Form */}
                     <div className="bg-gray-800 p-4 rounded-lg shadow">
                        <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2 flex items-center">
                             <PaperAirplaneIcon className="h-5 w-5 mr-2 transform rotate-45" /> Send QUBIC
                        </h2>
                        {!connected ? (
                             <div className="flex items-center p-3 bg-yellow-900 bg-opacity-40 border border-yellow-700 rounded-lg text-yellow-200 text-sm">
                               <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0"/> Connect wallet to send QUBIC.
                            </div>
                        ) : (
                             <form onSubmit={handleSendQubic} className="space-y-4 text-sm">
                                <div>
                                    <label htmlFor="destination" className="block text-gray-400 mb-1 font-medium">Destination Address</label>
                                    <input 
                                        type="text" 
                                        id="destination" 
                                        value={destinationAddress}
                                        onChange={(e) => setDestinationAddress(e.target.value)}
                                        placeholder="Paste Qubic Public Key (60 chars)" 
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-200 placeholder-gray-500 font-mono text-xs"
                                        maxLength={60}
                                        required 
                                    />
                                </div>
                                 <div>
                                    <label htmlFor="amount" className="block text-gray-400 mb-1 font-medium">Amount (QUBIC)</label>
                                    <input 
                                        type="number" // Change to number, enforce integer input
                                        id="amount" 
                                        value={sendAmount}
                                        onChange={(e) => {
                                             // Allow only whole numbers
                                             const value = e.target.value;
                                             if (/^\d*$/.test(value)) { // Only digits allowed
                                                 setSendAmount(value);
                                             }
                                        }}
                                        placeholder="e.g., 50" // Update placeholder
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-200 placeholder-gray-500"
                                        step="1" // Ensure whole number steps if browser supports it
                                        required 
                                    />
                                    {/* Dust Limit Disclaimer */}
                                    <p className="text-xs text-gray-500 mt-1">
                                        Note: The Qubic network may enforce a minimum transaction amount (dust limit). Transactions below this limit might fail even if broadcast successfully.
                                    </p>
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={isSending || !destinationAddress || !sendAmount || isBalanceLoading}
                                    className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                                >
                                    {isSending ? (
                                         <>
                                             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                             </svg>
                                             Sending...
                                         </>
                                    ) : (
                                         'Send QUBIC'
                                    )}
                                </button>
                                 {/* Sending Status Messages */}
                                {sendError && (
                                    <div className="flex items-center p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg text-red-300 text-xs mt-3">
                                        <ExclamationTriangleIcon className="h-4 w-4 mr-2 flex-shrink-0"/> 
                                        <span><strong>Error:</strong> {sendError}</span>
                                    </div>
                                )}
                                {sendResult && sendResult.success && (
                                    <div className="flex items-start p-3 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg text-green-300 text-xs mt-3 space-x-2">
                                        <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0"/> 
                                        <div className="flex-grow">
                                            <span>{sendResult.message}</span>
                                            {sendResult.txHash && sendResult.txHash !== 'N/A' && (
                                                 <a 
                                                    href={sendResult.explorerLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="block mt-1 text-blue-400 hover:text-blue-300 underline truncate"
                                                >
                                                   <LinkIcon className="h-3 w-3 inline-block mr-1" /> Tx: {sendResult.txHash}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                             </form>
                        )}
                     </div>
                </div>

                {/* Column 2: Wallet Information */}
                <div className="bg-gray-800 p-4 rounded-lg shadow">
                     <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2 flex items-center">
                        <WalletIcon className="h-5 w-5 mr-2"/> Wallet Info
                    </h2>
                    
                    {!connected ? (
                        <div className="flex items-center p-3 bg-yellow-900 bg-opacity-40 border border-yellow-700 rounded-lg text-yellow-200 text-sm">
                           <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0"/> Please connect your wallet to see details.
                        </div>
                    ) : (
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-400">Status:</span>
                                <span className="ml-2 text-green-400">Connected</span>
                            </div>
                             <div>
                                <span className="font-medium text-gray-400">Public Key:</span>
                                <span className="ml-2 font-mono break-all">{wallet.publicKey}</span>
                            </div>
                             <div>
                                <span className="font-medium text-gray-400">Balance:</span>
                                {isBalanceLoading ? (
                                    <span className="ml-2 text-gray-400 italic">Loading...</span>
                                ) : contextBalanceError ? (
                                    <span className="ml-2 text-red-400">{contextBalanceError}</span>
                                ) : formattedBalance !== null ? (
                                     <span className="ml-2 font-semibold text-lg">{formattedBalance} QUBIC</span>
                                ) : (
                                    <span className="ml-2 text-gray-500 italic">N/A</span>
                                )}
                            </div>
                            {/* --- Display Owned Assets --- */}
                             <div>
                                <span className="font-medium text-gray-400">Owned Assets:</span>
                                {isAssetsLoading ? (
                                    <span className="ml-2 text-gray-400 italic">Loading...</span>
                                ) : assetsError ? (
                                    <span className="ml-2 text-red-400">{assetsError}</span>
                                ) : ownedAssets && ownedAssets.length > 0 ? (
                                    <ul className="ml-2 list-none space-y-1 mt-1">
                                        {ownedAssets.map((asset, index) => (
                                            <li key={index} className="font-mono text-xs bg-gray-700 px-2 py-1 rounded break-all">
                                                {/* Display asset details - adjust based on actual asset structure */}
                                                {asset.assetId ? asset.assetId : JSON.stringify(asset)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="ml-2 text-gray-500 italic">No assets found.</span>
                                )}
                            </div>
                            {/* --- Display Possessed Assets --- */}
                             <div>
                                <span className="font-medium text-gray-400">Possessed Assets:</span>
                                {isPossessedAssetsLoading ? (
                                    <span className="ml-2 text-gray-400 italic">Loading...</span>
                                ) : possessedAssetsError ? (
                                    <span className="ml-2 text-red-400">{possessedAssetsError}</span>
                                ) : possessedAssets && possessedAssets.length > 0 ? (
                                    <ul className="ml-2 list-none space-y-1 mt-1">
                                        {possessedAssets.map((asset, index) => (
                                            <li key={index} className="font-mono text-xs bg-gray-700 px-2 py-1 rounded break-all">
                                                {/* Display asset details - adjust based on actual asset structure */}
                                                {asset.assetId ? asset.assetId : JSON.stringify(asset)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="ml-2 text-gray-500 italic">No possessed assets found.</span>
                                )}
                            </div>
                            {/* Add more wallet actions here in the future */}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Placeholder for future wallet commands */}
            {/* <div className="mt-6 bg-gray-800 p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Other Actions</h2>
                 <p className="text-sm text-gray-400 italic">More wallet functions will be added here...</p>
            </div> */}
        </div>
    );
};

export default WalletManagementPage; 