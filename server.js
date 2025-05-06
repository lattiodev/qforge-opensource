// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { QubicHelper } = require('@qubic-lib/qubic-ts-library/dist/qubicHelper');
const Crypto = require('@qubic-lib/qubic-ts-library/dist/crypto').default; // Note the .default
const { SIGNATURE_LENGTH, PUBLIC_KEY_LENGTH, DIGEST_LENGTH } = require('@qubic-lib/qubic-ts-library/dist/crypto');
const { Buffer } = require('buffer');
const { QubicTransaction } = require('@qubic-lib/qubic-ts-library/dist/qubic-types/QubicTransaction'); // Potentially useful for constants
const { Long } = require('@qubic-lib/qubic-ts-library/dist/qubic-types/Long'); // For amount

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config(); // Load .env if .env.local doesn't exist or is incomplete

const app = express();
const PORT = process.env.BACKEND_PORT || 3001; // Use a different port than React

// --- Configuration ---
const FAUCET_CONFIG = {
    mainnet: {
        seed: process.env.FAUCET_MAINNET_SEED, 
        rpc: process.env.FAUCET_MAINNET_RPC || 'https://rpc.qubic.org',
        amount: 1000, // 1,000 Qubic
        label: "Mainnet",
        enabled: !!process.env.FAUCET_MAINNET_SEED
    },
    testnet: {
        seed: process.env.FAUCET_TESTNET_SEED,
        rpc: process.env.FAUCET_TESTNET_RPC || 'https://testnet-rpc.qubicdev.com/',
        amount: 1000000, // 1,000,000 Qubic
        label: "Testnet",
        enabled: !!process.env.FAUCET_TESTNET_SEED
    }
};

// --- Middleware ---
app.use(cors()); // Allow requests from your React app's origin
app.use(express.json()); // Parse JSON request bodies

// --- In-memory Cooldown Tracking (FOR LOCAL DEV ONLY) ---
const claimTimestamps = {}; // Simple object: { "network_address": timestamp }

// --- Helper Functions ---

function uint8ArrayToBase64(uint8Array) {
    return Buffer.from(uint8Array).toString('base64');
}

async function localSignTx(qHelper, privateKey, tx) {
    // Ensure Crypto is initialized (it's async)
    const qCrypto = await Crypto;
    if (!qCrypto || !qCrypto.schnorrq) {
        throw new Error("Crypto library or schnorrq not initialized correctly.");
    }
    const idPackage = await qHelper.createIdPackage(privateKey);
    const digest = new Uint8Array(qHelper.DIGEST_LENGTH);
    const toSign = tx.slice(0, tx.length - SIGNATURE_LENGTH);

    qCrypto.K12(toSign, digest, qHelper.DIGEST_LENGTH);

    const signature = qCrypto.schnorrq.sign(
        idPackage.privateKey,
        idPackage.publicKey,
        digest
    );
    tx.set(signature, tx.length - SIGNATURE_LENGTH);
    return tx;
}


async function broadcastTxBackend(tx, endpoint) {
    const url = `${endpoint}/v1/broadcast-transaction`;
    const txEncoded = uint8ArrayToBase64(tx);
    const body = { encodedTransaction: txEncoded };

    try {
        console.log(`[Server] Broadcasting TX to: ${endpoint}`);
        // Use node-fetch or undici if running older Node versions without built-in fetch
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const responseBody = await response.text();
        if (!response.ok) {
             console.error(`[Server] Broadcast failed (${response.status}): ${responseBody}`);
            throw new Error(`Faucet broadcast failed: ${response.status} ${responseBody || response.statusText}`);
        }

        const result = JSON.parse(responseBody);
        console.log("[Server] Broadcast result:", result);
        if (!result || !result.transactionId) {
             throw new Error("Faucet broadcast response did not include a transactionId.");
        }
        return result; // { txId: '...' }
    } catch (error) {
        console.error('[Server] Error broadcasting transaction:', error);
        throw new Error(error.message || 'Faucet broadcast failed due to a network or parsing error.');
    }
}

// --- API Endpoint ---
app.post('/api/faucet-claim', async (req, res) => {
    // Note: Endpoint path now includes '/api'
    let qHelper;
    try {
        const { network, targetAddress } = req.body;
        console.log(`[Server] Received POST /api/faucet-claim for network: ${network}, address: ${targetAddress}`);

        // --- Input Validation ---
        if (!network || !['mainnet', 'testnet'].includes(network)) {
            return res.status(400).json({ success: false, error: 'Invalid or missing network parameter.' });
        }
        
        console.log(`[Server] Validating targetAddress: "${targetAddress}" (Type: ${typeof targetAddress}, Length: ${targetAddress?.length})`);
        
        if (!targetAddress || typeof targetAddress !== 'string' || !/^[A-Z]{60}$/.test(targetAddress)) {
            console.error(`[Server] Target address validation FAILED for: "${targetAddress}"`);
            return res.status(400).json({ success: false, error: 'Invalid or missing targetAddress parameter (expected 60 uppercase letters).' });
        }

        const config = FAUCET_CONFIG[network];
        if (!config || !config.enabled || !config.seed) {
             console.warn(`[Server] Faucet request failed: ${network} faucet not configured or enabled.`);
            return res.status(400).json({ success: false, error: `${config.label} faucet is not configured or enabled.` });
        }

        // --- SERVER-SIDE Cooldown Check (In-Memory) ---
        const cooldownKey = `${network}_${targetAddress}`;
        const lastClaimTime = claimTimestamps[cooldownKey] || 0;
        const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Define cooldown here too

        if (Date.now() < lastClaimTime + FAUCET_COOLDOWN_MS) {
            console.warn(`[Server] Cooldown active for ${cooldownKey}. Last claim: ${new Date(lastClaimTime).toISOString()}`);
            const remainingMs = (lastClaimTime + FAUCET_COOLDOWN_MS) - Date.now();
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            return res.status(429).json({ success: false, error: `Cooldown active. Please wait ${hours}h ${minutes}m.` });
        }
        // --- End Cooldown Check ---

        console.log(`[Server] Processing ${network} faucet request for ${targetAddress}`);

        // --- Transaction Logic ---
        qHelper = new QubicHelper();
        console.log('[Server] QubicHelper initialized.'); // Removed method logging

        // 1. Get Faucet ID & Bytes
        const faucetIdPackage = await qHelper.createIdPackage(config.seed);
        const faucetPublicId = await qHelper.getIdentity(faucetIdPackage.publicKey);
        const faucetPublicKeyBytes = faucetIdPackage.publicKey; // Use the raw bytes
        console.log(`[Server] Faucet Public ID (${network}): ${faucetPublicId}`);

        // 2. Get Target ID Bytes
        const targetPublicKeyBytes = qHelper.getIdentityBytes(targetAddress);
        if (!targetPublicKeyBytes || targetPublicKeyBytes.length !== PUBLIC_KEY_LENGTH) {
            throw new Error("Failed to get valid target public key bytes.");
        }

        // 3. Get Current Tick
        console.log(`[Server] Fetching tick from ${config.rpc}...`);
        const tickResponse = await fetch(`${config.rpc}/v1/tick-info`);
         if (!tickResponse.ok) {
             const errorText = await tickResponse.text();
             throw new Error(`Failed to fetch tick from ${config.rpc}: ${tickResponse.status} ${errorText}`);
         }
        const tickData = await tickResponse.json();
        const currentTick = tickData?.tickInfo?.tick;
        if (typeof currentTick !== 'number') {
            throw new Error("Invalid tick data received from RPC.");
        }
        const finalTick = currentTick + 5; // Target next tick + offset
        console.log(`[Server] Current Tick: ${currentTick}, Target Tick: ${finalTick}`);

        // --- 4. Manually Build Transaction ---
        const inputType = 0; // Standard transfer
        const inputSize = 0; // No input data for simple transfer
        // Calculate amount in qus as BigInt
        const amountToSend = BigInt(config.amount);

        // Base size + input size
        const TX_SIZE = qHelper.TRANSACTION_SIZE + inputSize;
        const tx = new Uint8Array(TX_SIZE).fill(0);
        const dv = new DataView(tx.buffer);
        let offset = 0;

        // Source Public Key (32 bytes)
        tx.set(faucetPublicKeyBytes, offset);
        offset += PUBLIC_KEY_LENGTH;

        // Destination Public Key (32 bytes)
        tx.set(targetPublicKeyBytes, offset);
        offset += PUBLIC_KEY_LENGTH;

        // Amount (8 bytes) - Use BigInt directly with DataView
        // *** Ensure amountToSend (BigInt) is used here ***
        dv.setBigUint64(offset, amountToSend, true); // Use LE (true)
        offset += 8;

        // Tick (4 bytes)
        dv.setUint32(offset, finalTick, true); // Use LE (true)
        offset += 4;

        // Input Type (2 bytes)
        dv.setUint16(offset, inputType, true); // Use LE (true)
        offset += 2;

        // Input Size (2 bytes)
        dv.setUint16(offset, inputSize, true); // Use LE (true)
        offset += 2;

        // No Input Data needed for offset calculation

        console.log("[Server] Created unsigned transaction buffer manually.");
        console.log(`[Server] Buffer Size: ${tx.length}, Expected Signature Offset: ${offset}`);

        // 5. Sign Transaction
        const signedTx = await localSignTx(qHelper, config.seed, tx);
        console.log("[Server] Signed transaction.");

        // 6. Broadcast Transaction
        const broadcastResult = await broadcastTxBackend(signedTx, config.rpc);

        // --- Success --- 
        // Update in-memory timestamp
        claimTimestamps[cooldownKey] = Date.now(); 
        console.log(`[Server] Successfully processed ${network} faucet claim for ${targetAddress}, TxID: ${broadcastResult.transactionId}`);
        // Send back transactionId (lowercase i)
        return res.status(200).json({ success: true, txId: broadcastResult.transactionId }); 

    } catch (error) {
        console.error("[Server] Faucet Error:", error);
        const message = error.message.includes('broadcast failed') || error.message.includes('RPC') || error.message.includes('tick')
            ? "Faucet operation failed. Please try again later."
            : "An internal error occurred processing the faucet request.";
        return res.status(500).json({ success: false, error: message });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`[Server] Faucet backend listening on port ${PORT}`);
  if (!FAUCET_CONFIG.testnet.enabled) {
      console.warn("[Server] Testnet faucet seed not found in environment variables. Testnet faucet is DISABLED.");
  }
   if (!FAUCET_CONFIG.mainnet.enabled) {
      console.warn("[Server] Mainnet faucet seed not found in environment variables. Mainnet faucet is DISABLED.");
  } else {
       console.warn("[Server] 🚨 MAINNET FAUCET SEED IS CONFIGURED. ENSURE THIS IS NOT A PRODUCTION KEY WITH SIGNIFICANT VALUE.");
  }
});