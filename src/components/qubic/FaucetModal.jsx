// src/components/qubic/FaucetModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useQubicConnect } from '../../context/QubicConnectContext'; // Adjust path if needed
import Card from './ui/Card'; // Adjust path if needed
import CloseIcon from '../../assets/close.svg'; // Adjust path if needed
import { ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'; // Adjust path if needed
import { formatQubicAmount } from './util'; // Adjust path if needed

// --- Faucet Constants (Copied from App.js) ---
const MAINNET_FAUCET_AMOUNT = 1000n ; // 1,000 Qubic in qus
const TESTNET_FAUCET_AMOUNT = 1000000n ; // 1,000,000 Qubic in qus
const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper to get/set localStorage timestamps (Copied from App.js)
const getFaucetLastClaimTime = (network, address) => {
    if (!address) return 0;
    const key = `faucet_claim_${network}_${address}`;
    return parseInt(localStorage.getItem(key) || '0', 10);
};

const setFaucetLastClaimTime = (network, address) => {
    if (!address) return;
    const key = `faucet_claim_${network}_${address}`;
    localStorage.setItem(key, Date.now().toString());
};

const FaucetModal = ({ open, onClose }) => {
    const { connected, wallet } = useQubicConnect();
    const [faucetState, setFaucetState] = useState({
        mainnet: { loading: false, error: null, success: null, cooldownEnds: 0 },
        testnet: { loading: false, error: null, success: null, cooldownEnds: 0 }
    });

    // Simplified faucet config for UI (Copied from App.js)
     const faucetUiConfig = {
        mainnet: { amount: MAINNET_FAUCET_AMOUNT, label: "Mainnet" },
        testnet: { amount: TESTNET_FAUCET_AMOUNT, label: "Testnet" }
    };

    // Update Cooldowns (Copied and adapted from App.js)
    const updateFaucetCooldowns = useCallback(() => {
        if (!connected || !wallet?.publicKey) {
             setFaucetState(prev => ({
                mainnet: { ...prev.mainnet, cooldownEnds: 0 },
                testnet: { ...prev.testnet, cooldownEnds: 0 }
             }));
            return;
        }
        const now = Date.now();
        const mainnetLastClaim = getFaucetLastClaimTime('mainnet', wallet.publicKey);
        const testnetLastClaim = getFaucetLastClaimTime('testnet', wallet.publicKey);

        setFaucetState(prev => ({
            mainnet: { ...prev.mainnet, cooldownEnds: mainnetLastClaim + FAUCET_COOLDOWN_MS },
            testnet: { ...prev.testnet, cooldownEnds: testnetLastClaim + FAUCET_COOLDOWN_MS }
        }));
    }, [connected, wallet?.publicKey]);

    useEffect(() => {
        if (open) { // Only update/check cooldowns when modal is open
            updateFaucetCooldowns();
            const intervalId = setInterval(updateFaucetCooldowns, 60000);
            return () => clearInterval(intervalId);
        }
    }, [open, updateFaucetCooldowns]);

     // Handle Claim Faucet (Copied and adapted from App.js)
    const handleClaimFaucet = async (network) => {
        if (!connected || !wallet?.publicKey) {
            setFaucetState(prev => ({ ...prev, [network]: { ...prev[network], error: "Wallet not connected." }})); // Error should ideally not happen if modal requires connection
            return;
        }
        const lastClaim = getFaucetLastClaimTime(network, wallet.publicKey);
        if (Date.now() < lastClaim + FAUCET_COOLDOWN_MS) {
            setFaucetState(prev => ({ ...prev, [network]: { ...prev[network], error: "Cooldown active." }}));
            return;
        }

        setFaucetState(prev => ({ ...prev, [network]: { loading: true, error: null, success: null, cooldownEnds: prev[network].cooldownEnds }}));

        try {
            const response = await fetch('/api/faucet-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ network: network, targetAddress: wallet.publicKey }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Faucet API request failed with status ${response.status}`);
            }
            setFaucetLastClaimTime(network, wallet.publicKey);
            setFaucetState(prev => ({ ...prev, [network]: { loading: false, error: null, success: `Faucet claim successful!`, cooldownEnds: Date.now() + FAUCET_COOLDOWN_MS }}));
        } catch (error) {
            console.error(`Faucet claim failed (${network}):`, error);
            setFaucetState(prev => ({ ...prev, [network]: { loading: false, error: error.message, success: null, cooldownEnds: prev[network].cooldownEnds }}));
        }
    };

    // Render Cooldown (Copied from App.js)
    const renderCooldown = (cooldownEnds) => {
        const now = Date.now();
        if (now >= cooldownEnds) return <span className="text-green-400">Ready</span>;
        const remainingMs = cooldownEnds - now;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return (
            <span className="text-yellow-400">
                <ClockIcon className="h-4 w-4 inline-block mr-1 mb-px" /> {`${hours}h ${minutes}m remaining`}
            </span>
        );
    };

    // Render Faucet Button (Copied and adapted from App.js)
    const renderFaucetButton = (network) => {
        const config = faucetUiConfig[network];
        const state = faucetState[network];
        const now = Date.now();
        const isOnCooldown = now < state.cooldownEnds;
        const isDisabled = !connected || state.loading || isOnCooldown;

        let buttonText = `Claim ${formatQubicAmount(config.amount)} ${config.label} Qubic`;
        if (state.loading) buttonText = "Processing...";
        else if (isOnCooldown) buttonText = "Cooldown Active";
        // No need for "Connect Wallet" text as modal should require connection

        return (
             <div className="space-y-2">
                 <button
                     onClick={() => handleClaimFaucet(network)}
                     disabled={isDisabled}
                     className={`w-full px-4 py-2 rounded font-semibold text-white transition duration-150 ease-in-out flex items-center justify-center gap-2 ${isDisabled ? 'bg-gray-600 opacity-70 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}
                 >
                     <CurrencyDollarIcon className="h-5 w-5" /> {buttonText}
                 </button>
                 {connected && !state.loading && (
                     <p className="text-xs text-gray-400 text-center"> Status: {renderCooldown(state.cooldownEnds)} </p>
                 )}
                 {state.error && <p className="text-xs text-red-400 text-center mt-1">Error: {state.error}</p>}
                 {state.success && <p className="text-xs text-green-400 text-center mt-1">{state.success}</p>}
             </div>
         );
    };

    // Render Modal
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={onClose} // Close on overlay click
        >
            <Card
                className="relative p-6 w-full max-w-md m-auto flex flex-col bg-gray-800 text-white shadow-xl rounded-xl"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside card
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-600">
                    <h3 className="text-lg font-semibold">Faucet</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                       <img src={CloseIcon} alt="Close" className="w-5 h-5" />
                    </button>
                </div>

                {/* Faucet Options */}
                <div className="space-y-4">
                    {renderFaucetButton('testnet')}
                    <hr className="border-gray-600 my-4"/>
                    {renderFaucetButton('mainnet')}
                </div>
            </Card>
        </div>
    );
};

export default FaucetModal;