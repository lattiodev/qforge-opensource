import React, { useState, useEffect } from "react"
// Vault is now in context
// import { QubicVault } from "@qubic-lib/qubic-ts-vault-library"
import Card from "../ui/Card" // Path should be correct relative to connect/
import QubicConnectLogo from "../../../assets/qubic-connect.svg" // Corrected path
import CloseIcon from "../../../assets/close.svg" // Corrected path
import metamaskIcon from "../../../assets/metamask.svg" // Corrected path
import walletConnectIcon from "../../../assets/wallet-connect.svg" // Corrected path
import QRCode from "qrcode"
import { useQubicConnect } from "../../../context/QubicConnectContext" // Corrected path
import { truncateMiddle, formatQubicAmount } from "../util" // Path should be correct relative to connect/
// Removed HM25, WalletConnectContext, MetamaskContext, ConfigContext dependencies as logic is moved to QubicConnectContext
import PropTypes from 'prop-types';

const ConnectModal = ({ open, onClose }) => {
    console.log("[ConnectModal] Rendering. Open prop:", open);
    const [selectedMode, setSelectedMode] = useState("none")

    // Use context state and functions
    const {
        connect,
        disconnect,
        connected,
        wallet, // Get wallet info for display
        vault, // Get vault instance from context
        // WC
        wcClient,
        wcUri,
        wcQrCode,
        wcIsConnecting,
        startWalletConnect,
        // MM
        mmInstalledSnap,
        mmIsConnecting,
        mmError,
        connectSnap,
        getSnap,
        // Endpoint
        httpEndpoint,
        updateHttpEndpoint,
        // Others
        qHelper,
        // Add balance states
        balance,
        isBalanceLoading,
        balanceError,
    } = useQubicConnect();

    // Local state for input fields
    const [privateSeed, setPrivateSeed] = useState("")
    const [errorMsgSeed, setErrorMsgSeed] = useState("")
    const [vaultFile, setVaultFile] = useState(null)
    const [vaultPassword, setVaultPassword] = useState("")
    const [errorMsgVault, setErrorMsgVault] = useState("")
    const [httpEndpointInput, setHttpEndpointInput] = useState(httpEndpoint); // Initialize with current endpoint
    const [errorMsgEndpoint, setErrorMsgEndpoint] = useState("");
    const [copied, setCopied] = useState(false);

    // Local state for WC approval function
    const [wcApproval, setWcApproval] = useState(null);

    // --- Check if on Mainnet RPC --- 
    const mainnetRpcUrl = 'https://rpc.qubic.org'; // Define the mainnet URL
    // Normalize URLs by removing trailing slashes for comparison
    const normalizeUrl = (url) => url?.replace(/\/$/, '') || ''; 
    const isOnMainnetRpc = normalizeUrl(httpEndpoint) === normalizeUrl(mainnetRpcUrl);

    // Reset local state when modal closes or connection type changes
    useEffect(() => {
        console.log("[ConnectModal] useEffect triggered. Open:", open);
        if (!open) {
            setSelectedMode("none");
            setPrivateSeed("");
            setErrorMsgSeed("");
            setVaultFile(null);
            setVaultPassword("");
            setErrorMsgVault("");
            setHttpEndpointInput(httpEndpoint);
            setErrorMsgEndpoint("");
        }
    }, [open, httpEndpoint]);

    // ---- Private Seed Approaches ----
    const handleSeedChange = (seed) => {
        setPrivateSeed(seed)
        if (seed.length !== 55) {
            setErrorMsgSeed("Seed must be 55 characters long")
        } else if (seed.match(/[^a-z]/)) {
            setErrorMsgSeed("Seed must contain only lowercase letters (a-z)")
        } else {
            setErrorMsgSeed("")
        }
    }

    const connectPrivateSeed = async () => {
        if (!errorMsgSeed && privateSeed.length === 55) {
             // Public key will be derived in context's connect function
            await connect({ 
                connectType: "privateKey",
                privateKey: privateSeed,
            })
            // closeModal() // connect function now handles closing
        }
    }

    // ---- Vault File Approaches ----
    const handleVaultFileChange = (event) => {
        setVaultFile(event.target.files?.[0] || null)
    }

    const connectVaultFile = () => {
        if (!vaultFile || !vaultPassword) {
            setErrorMsgVault("Please select a vault file and enter a password.")
            return
        }
        const fileReader = new FileReader()
        fileReader.onload = async () => {
            try {
                // Use vault instance from context
                await vault.importAndUnlock(
                    true,
                    vaultPassword,
                    null,
                    vaultFile
                )
                const seeds = vault.getSeeds().filter((acc) => !acc.isOnlyWatch)
                if (seeds.length === 0) {
                    setErrorMsgVault("No valid seeds found in vault (only watch-only?).")
                    return
                }
                // Connect with the first seed
                const pkSeed = await vault.revealSeed(seeds[0].publicId)
                await connect({ // Use connect from context
                    connectType: "vaultFile",
                    publicKey: seeds[0].publicId,
                    privateKey: pkSeed,
                })
                // setSelectedVaultFileState() // State reset handled by useEffect/closeModal
                // closeModal() // connect function now handles closing
            } catch (err) { 
                console.error("Error unlocking vault:", err)
                setErrorMsgVault("Failed to unlock the vault. Check your password or file.")
            }
        }
        fileReader.onerror = (err) => {
            console.error("Error reading file:", err)
            setErrorMsgVault("File reading error, please try again")
        }
        fileReader.readAsArrayBuffer(vaultFile)
    }

   // No longer needed, state reset handled elsewhere
    // const setSelectedVaultFileState = () => { ... }

    const closeModal = () => {
        // setSelectedMode("none") // Reset happens in useEffect
        // Clear errors/inputs if needed, but useEffect covers closing
        onClose(); // Call the prop function
    }

    const handleCopyClick = () => {
        if (wallet?.publicKey) {
            navigator.clipboard.writeText(wallet.publicKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500); // Adjusted timeout
        }
    }

    // ---- MetaMask Snap Approach ----
    const connectMetamask = async () => {
        try {
            const installedSnap = mmInstalledSnap || await connectSnap(); // Ensure snap is connected/installed
            if (!installedSnap) {
                throw new Error("Snap installation failed or was cancelled.");
            }
            // Get public ID from the snap
            // Use invokeSnap from context if needed, or directly call window.ethereum
            const pubId = await window.ethereum.request({
                method: "wallet_invokeSnap",
                params: {
                    snapId: installedSnap.id,
                    request: {
                        method: "getPublicId",
                        params: { accountIdx: 0, confirm: false }, // Adjust params as needed
                    },
                },
            });
            await connect({ // Use connect from context
                connectType: "mmSnap",
                publicKey: pubId,
            })
            // closeModal() // connect closes modal
        } catch (err) {
            console.error("Failed to connect metamask snap:", err)
            // Error display can be handled via mmError state from context
        }
    }

    // --- Updated WalletConnect Click Handler ---
    const handleWalletConnectClick = async () => {
         if (!wcClient) { 
            alert("WalletConnect client is not ready yet.");
            return; 
         }
         setSelectedMode("walletconnect"); // Switch view immediately
         setWcApproval(null); // Clear previous approval function
         try {
            const result = await startWalletConnect(); // Get promise with uri/approve
            if (result?.approve) {
                setWcApproval(() => result.approve); // Store the approve function
                // URI/QR code state is set within startWalletConnect
            } else {
                 // Handle case where startWalletConnect might fail before returning
                 console.error("startWalletConnect did not return an approval function.");
                 setErrorMsgWC("Failed to initiate WalletConnect session."); // Need error state
                 setSelectedMode("none"); // Go back if init fails
            }
         } catch (error) {
            console.error("Error starting WalletConnect:", error);
             // Handle errors from startWalletConnect (e.g., user closes modal early)
             setErrorMsgWC(`Error: ${error.message}`); // Need error state
             setSelectedMode("none"); // Go back on error
         }
    };

    // --- New state for WC errors --- 
    const [errorMsgWC, setErrorMsgWC] = useState("");

    // Automatically trigger approval when modal shows QR and approval fn is ready
    // This handles the flow after QR is shown/scanned
    useEffect(() => {
        if (selectedMode === "walletconnect" && wcApproval) {
            console.log("Attempting to run WC approval function...");
            wcApproval() // Call the stored approval function
                .then(() => {
                    console.log("WC Approval successful (modal side)");
                    // Connection state is handled within the connect function called by approval
                    // Modal will close automatically via connect() -> setShowConnectModal(false)
                })
                .catch((err) => {
                    console.error("WC Approval failed (modal side):", err);
                    setErrorMsgWC(`Approval failed: ${err.message}`);
                    // Don't go back immediately, let user see error and cancel
                    // setSelectedMode("none"); 
                })
                .finally(() => {
                    setWcApproval(null); // Clear approval function after attempt
                    // wcIsConnecting state should be handled by context
                });
        }
    }, [selectedMode, wcApproval]);

    // --- Endpoint Update ---
    const handleUpdateEndpoint = () => {
        if (!httpEndpointInput) {
            setErrorMsgEndpoint("Please enter an HTTP Endpoint.");
            return;
        }
        try {
            // Basic URL validation
            new URL(httpEndpointInput);
        } catch (_) {
             setErrorMsgEndpoint("Please enter a valid URL (e.g., https://rpc.example.com).");
            return;
        }
        const updated = updateHttpEndpoint(httpEndpointInput);
        if (updated) {
           setErrorMsgEndpoint("");
           // Optionally: Provide feedback that endpoint was updated
           // Consider if reload is necessary - maybe not if context updates dynamically?
           // window.location.reload();
           setSelectedMode("none"); // Go back to main view after update
        } else {
            setErrorMsgEndpoint("Failed to update endpoint."); // Should not happen with current logic
        }
    }

    const walletDisplay = wallet?.publicKey ? truncateMiddle(wallet.publicKey) : '...';

    if (!open) {
        console.log("[ConnectModal] Not rendering because open is false.");
        return null; // Don't render if not open
    }
    
    console.log("[ConnectModal] Rendering modal content because open is true.");

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={closeModal} // Close on overlay click
        >
            <Card
                className="relative p-6 w-full max-w-md m-auto flex flex-col bg-gray-800 text-white shadow-xl rounded-xl"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside card
            >
                {/* Header with close button */}
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-600">
                    <img src={QubicConnectLogo} alt="Qubic Connect" className="h-6" />
                    <button onClick={closeModal} className="text-gray-400 hover:text-white">
                       <img src={CloseIcon} alt="Close" className="w-5 h-5" />
                    </button>
                </div>

                {/* --- Conditional Content based on connection status --- */}
                {!connected && selectedMode === "none" && (
                    // --- Show Connection Options --- 
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-center mb-4">Connect Wallet</h3>
                        {/* MetaMask Button */}
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg w-full flex items-center justify-center gap-3 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={connectMetamask}
                            disabled={mmIsConnecting || !window.ethereum?.isMetaMask}
                        >
                            <img src={metamaskIcon} alt="MetaMask" className="w-6 h-6"/> 
                            {mmIsConnecting ? 'Connecting...' : (mmInstalledSnap ? 'Connect MetaMask Snap' : 'Install MetaMask Snap')}
                        </button>
                        {mmError && <p className="text-xs text-red-400 text-center">Error: {mmError}</p>}

                        {/* WalletConnect Button - Now triggers handleWalletConnectClick */}
                        <button
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg w-full flex items-center justify-center gap-3 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleWalletConnectClick} 
                            disabled={!wcClient || wcIsConnecting} // Disable if client not ready OR connecting
                        >
                           <img src={walletConnectIcon} alt="WalletConnect" className="w-6 h-6"/>
                           {/* Text depends on client readiness */} 
                           {!wcClient ? 'Initializing WC...' : 'WalletConnect'}
                        </button>

                        {/* Manual Options Divider */}
                        <div className="relative flex items-center justify-center my-6">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-600"></div>
                            </div>
                            <div className="relative bg-gray-800 px-3 text-sm text-gray-400">MANUAL / UNSAFE</div>
                        </div>

                        {/* Informational message if on mainnet */}
                        {isOnMainnetRpc && (
                            <p className="text-xs text-center text-yellow-400 bg-yellow-900 bg-opacity-40 p-2 rounded border border-yellow-700 -mt-2 mb-3">
                                Private Seed and Vault File options are disabled on the default mainnet RPC ({mainnetRpcUrl}) for security. Please switch to a testnet or local endpoint in Server Configuration to use these methods.
                            </p>
                        )}

                        {/* Private Seed Button - Conditionally disabled */}
                        <button 
                            className={`bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg w-full transition duration-150 ease-in-out ${isOnMainnetRpc ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !isOnMainnetRpc && setSelectedMode("privateSeed")} 
                            disabled={isOnMainnetRpc}
                            title={isOnMainnetRpc ? "Disabled on mainnet RPC for security" : "Connect using a private seed"}
                        >
                            Private Seed
                        </button>

                        {/* Vault File Button - Conditionally disabled */} 
                        <button 
                            className={`bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg w-full transition duration-150 ease-in-out ${isOnMainnetRpc ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !isOnMainnetRpc && setSelectedMode("vaultFile")} 
                            disabled={isOnMainnetRpc}
                            title={isOnMainnetRpc ? "Disabled on mainnet RPC for security" : "Connect using a vault file"}
                        >
                            Vault File
                        </button>

                         {/* Server Config Link */} 
                         <div className="text-center pt-2">
                            <button onClick={() => setSelectedMode("endpoint")} className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                                Server Configuration
                            </button>
                         </div>
                    </div>
                )}
                
                {/* --- Show Connected State --- */}
                {connected && selectedMode === "none" && (
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-center mb-1">Wallet Connected</h3>
                         <p className="text-xs text-center text-gray-400 mb-4">({wallet?.connectType})</p>

                         <div className="text-center mb-4">
                            <p className="text-xs text-gray-400 mb-1">Balance:</p>
                             <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm font-semibold min-h-[2.5rem] flex items-center justify-center">
                                {isBalanceLoading && <span className="text-gray-400 italic text-xs">Loading...</span>}
                                {balanceError && <span className="text-red-400 text-xs" title={balanceError}>Error loading balance</span>}
                                {!isBalanceLoading && !balanceError && balance !== null && (
                                     <span>{formatQubicAmount(balance)} Qubic</span>
                                )}
                                 {!isBalanceLoading && !balanceError && balance === null && (
                                      <span className="text-gray-500">N/A</span> 
                                 )}
                            </div>
                         </div>

                         <div className="text-center mb-4">
                            <p className="text-xs text-gray-400 mb-1">Connected as:</p>
                            <div className="bg-gray-700 rounded-lg px-3 py-2 flex items-center justify-between text-sm font-mono">
                                <span>{walletDisplay}</span>
                                <button onClick={handleCopyClick} title="Copy Address" className="text-gray-400 hover:text-white ml-2 p-1 rounded hover:bg-gray-600">
                                    {copied ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                         </div>

                         <button 
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg w-full transition duration-150 ease-in-out"
                            onClick={disconnect}
                         >
                             Disconnect Wallet
                         </button>

                         {/* Server Config Link */} 
                         <div className="text-center pt-2">
                            <button onClick={() => setSelectedMode("endpoint")} className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                                Server Configuration
                            </button>
                         </div>
                    </div>
                )}

                {/* --- Other Modes (Seed, Vault, Endpoint, WC QR) --- */}
                {selectedMode === "privateSeed" && (
                    <div className="text-white space-y-4">
                        <h3 className="text-lg font-semibold mb-3">Connect with Private Seed</h3>
                         <p className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-50 p-2 rounded border border-yellow-600">⚠️ <span className="font-bold">Warning:</span> Exposing your private seed is risky. Prefer using MetaMask Snap or WalletConnect.</p>
                        <label className="block text-sm font-medium text-gray-300">Enter 55-char seed (a-z):</label>
                        <input
                            type="password" // Use password type for obfuscation
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                            value={privateSeed}
                            onChange={(e) => handleSeedChange(e.target.value)}
                            maxLength={55}
                            autoComplete="off"
                        />
                        {errorMsgSeed && <p className="text-red-500 text-xs">{errorMsgSeed}</p>}
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
                                onClick={() => setSelectedMode("none")}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={connectPrivateSeed}
                                disabled={!!errorMsgSeed || privateSeed.length !== 55}
                            >
                                Unlock
                            </button>
                        </div>
                    </div>
                )}

                {selectedMode === "vaultFile" && (
                    <div className="text-white space-y-4">
                         <h3 className="text-lg font-semibold mb-3">Connect with Vault File</h3>
                         <p className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-50 p-2 rounded border border-yellow-600">⚠️ <span className="font-bold">Warning:</span> Keep your vault file and password secure. Prefer using MetaMask Snap or WalletConnect if possible.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Select Vault File (.qvault):</label>
                            <input
                                type="file"
                                onChange={handleVaultFileChange}
                                accept=".qvault"
                                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Vault Password:</label>
                            <input
                                type="password"
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={vaultPassword}
                                onChange={(e) => setVaultPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>
                        {errorMsgVault && <p className="text-red-500 text-xs">{errorMsgVault}</p>}
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
                                onClick={() => setSelectedMode("none")}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={connectVaultFile}
                                disabled={!vaultFile || !vaultPassword}
                            >
                                Unlock Vault
                            </button>
                        </div>
                    </div>
                )}

                {selectedMode === "endpoint" && (
                    <div className="text-white space-y-4">
                        <h3 className="text-lg font-semibold">Server Configuration</h3>
                        <p className="text-xs text-gray-400">Connect to a custom Qubic node endpoint. Use the official RPC unless you know what you are doing.</p>
                         <div>
                            <label htmlFor="httpEndpoint" className="block text-sm font-medium text-gray-300 mb-1">Current Endpoint:</label>
                            <input
                                id="httpEndpoint"
                                type="text"
                                className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-gray-400 text-sm font-mono"
                                value={httpEndpoint}
                                readOnly // Display only
                            />
                         </div>
                         <div>
                             <label htmlFor="newHttpEndpoint" className="block text-sm font-medium text-gray-300 mb-1">New HTTP Endpoint:</label>
                            <input
                                id="newHttpEndpoint"
                                type="text"
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., https://rpc.example.com"
                                value={httpEndpointInput}
                                onChange={(e) => {
                                    setHttpEndpointInput(e.target.value);
                                    setErrorMsgEndpoint(""); // Clear error on change
                                }}
                            />
                        </div>
                        {errorMsgEndpoint && <p className="text-red-500 text-xs">{errorMsgEndpoint}</p>}
                         <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
                                onClick={() => setSelectedMode("none")}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleUpdateEndpoint}
                                disabled={!httpEndpointInput || httpEndpointInput === httpEndpoint}
                            >
                                Update Endpoint
                            </button>
                        </div>
                    </div>
                )}

                {/* --- WalletConnect QR/Waiting Mode --- */} 
                {selectedMode === "walletconnect" && (
                     <div className="text-white space-y-4 text-center">
                          <h3 className="text-lg font-semibold mb-3">WalletConnect</h3>
                         {wcIsConnecting && !wcQrCode && (
                             <div className="flex flex-col items-center justify-center space-y-2 py-4">
                                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                 <p className="text-sm text-gray-400">Generating session...</p>
                             </div>
                         )}
                          {wcQrCode && (
                             <div className="w-full flex flex-col items-center space-y-3">
                                  <p className="text-sm">Scan QR code with your Qubic Wallet:</p>
                                 <img
                                     src={wcQrCode}
                                     alt="WalletConnect QR Code"
                                     className="mx-auto mb-2 p-2 bg-white rounded"
                                     width="200" height="200"
                                 />
                                  <p className="text-xs text-gray-400 break-all">Or copy URI: {wcUri}</p>
                                  <p className="text-sm text-gray-400 mt-2">Waiting for approval in your wallet...</p>
                             </div>
                         )}
                         {errorMsgWC && <p className="text-red-500 text-xs mt-2">{errorMsgWC}</p>}
                          <button
                             className="mt-6 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out w-full"
                             onClick={() => { 
                                 setSelectedMode("none"); 
                                 setErrorMsgWC(""); 
                                 // Optional: Add disconnect logic if pairing started but not approved?
                                 // disconnect(); 
                             }}
                         >
                             Cancel
                         </button>
                     </div>
                 )}
            </Card>
        </div>
    )
}

ConnectModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ConnectModal 