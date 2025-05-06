import React from "react"
import lock from "../../../assets/lock.svg" // Corrected path
import unlocked from "../../../assets/unlocked.svg" // Corrected path
import ConnectModal from "./ConnectModal"
import { useQubicConnect } from "../../../context/QubicConnectContext" // Corrected path
// import { useHM25 } from "../../../contexts/HM25Context" // Removed HM25 context dependency
import { formatQubicAmount, truncateMiddle } from "../util" // Path should be correct relative to connect/

const ConnectLink = () => {
    // Consume balance state from context
    const {
        connected, 
        wallet, 
        showConnectModal, 
        toggleConnectModal, 
        balance, 
        isBalanceLoading, 
        balanceError 
    } = useQubicConnect();
    // Removed balance logic for now, can be added back if needed
    // const { balance, fetchBalance, walletPublicIdentity } = useHM25()

    // const handleBalanceClick = async (e) => {
    //     e.stopPropagation()
    //     if (walletPublicIdentity) {
    //         await fetchBalance(walletPublicIdentity)
    //     }
    // }

    const walletDisplay = wallet?.publicKey ? truncateMiddle(wallet.publicKey) : '...';

    return (
        <>
            {/* Temporarily remove absolute positioning for debugging */}
            {/* <div className="absolute top-4 right-4 flex gap-2 items-center cursor-pointer p-2 bg-gray-700 hover:bg-gray-600 rounded shadow" onClick={() => toggleConnectModal()}> */}
            <div 
                className="flex gap-3 items-center cursor-pointer p-2 bg-gray-700 hover:bg-gray-600 rounded shadow" 
                onClick={() => toggleConnectModal()}
                title={connected ? `Click to view wallet options (Connected as ${walletDisplay})` : "Click to connect wallet"}
            >
                {connected ? (
                    <>
                        <img src={lock} alt="Wallet Locked" className="w-5 h-5 flex-shrink-0"/>
                        <div className="flex flex-col text-white text-sm">
                           {/* Display Address */}
                           <span className="font-mono text-xs" title={wallet?.publicKey}>{walletDisplay}</span>
                            {/* --- Add Balance Display --- */}
                            <div className="text-xs text-gray-300 mt-0.5">
                                {isBalanceLoading && <span className="italic text-gray-400">Loading balance...</span>}
                                {balanceError && <span className="text-red-400" title={balanceError}>Error</span>}
                                {!isBalanceLoading && !balanceError && balance !== null && (
                                     <span className="font-semibold">{formatQubicAmount(balance)} Qubic</span>
                                )}
                                {!isBalanceLoading && !balanceError && balance === null && (
                                      <span className="text-gray-500">N/A</span> 
                                 )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Unlocked / Disconnected View */}
                        <img src={unlocked} alt="Wallet Unlocked" className="w-5 h-5" />
                        <span className="font-semibold text-sm text-white">
                            Connect Wallet
                        </span>
                    </>
                )}
            </div>

            <ConnectModal
                open={showConnectModal}
                onClose={() => toggleConnectModal()}
            />
        </>
    )
}

export default ConnectLink 