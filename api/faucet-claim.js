// /api/faucet-claim.js
const dotenv = require('dotenv');
const { QubicHelper } = require('@qubic-lib/qubic-ts-library/dist/qubicHelper');
const Crypto = require('@qubic-lib/qubic-ts-library/dist/crypto').default;
const { SIGNATURE_LENGTH, PUBLIC_KEY_LENGTH, DIGEST_LENGTH } = require('@qubic-lib/qubic-ts-library/dist/crypto'); // Added DIGEST_LENGTH
const { Buffer } = require('buffer');

// Load environment variables (Vercel injects these)
dotenv.config({ path: '.env.local' });
dotenv.config();

// --- Configuration (reads from process.env) ---
const FAUCET_CONFIG = {
    mainnet: {
        seed: process.env.FAUCET_MAINNET_SEED,
        rpc: process.env.FAUCET_MAINNET_RPC || 'https://rpc.qubic.org',
        amount: 1000n, // BigInt for amount
        label: "Mainnet",
        enabled: !!process.env.FAUCET_MAINNET_SEED
    },
    testnet: {
        seed: process.env.FAUCET_TESTNET_SEED,
        rpc: process.env.FAUCET_TESTNET_RPC || 'https://testnet-nostromo.qubicdev.com/', // Using official for backend
        amount: 1500000000n, // BigInt for amount
        label: "Testnet",
        enabled: !!process.env.FAUCET_TESTNET_SEED
    }
};
const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// NOTE: Serverless functions are stateless. Reliable cooldown needs external storage (DB, Vercel KV).
// This simple example relies mainly on the client-side check for cooldown.

// --- Helper Functions ---
function uint8ArrayToBase64(uint8Array) {
    return Buffer.from(uint8Array).toString('base64');
}

async function localSignTx(qHelper, privateKey, tx) {
    const qCrypto = await Crypto;
    if (!qCrypto || !qCrypto.schnorrq) {
        throw new Error("Crypto library or schnorrq not initialized correctly.");
    }
    const idPackage = await qHelper.createIdPackage(privateKey);
    const digest = new Uint8Array(qHelper.DIGEST_LENGTH);
    const toSign = tx.slice(0, tx.length - SIGNATURE_LENGTH);
    qCrypto.K12(toSign, digest, qHelper.DIGEST_LENGTH);
    const signature = qCrypto.schnorrq.sign(idPackage.privateKey, idPackage.publicKey, digest);
    tx.set(signature, tx.length - SIGNATURE_LENGTH);
    return tx;
}

async function broadcastTxBackend(tx, endpoint) {
    const url = `${endpoint}/v1/broadcast-transaction`;
    const txEncoded = uint8ArrayToBase64(tx);
    const body = { encodedTransaction: txEncoded };

    try {
        console.log(`[Serverless] Broadcasting TX to: ${endpoint}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const responseBody = await response.text(); // Read body first
        if (!response.ok) {
             console.error(`[Serverless] Broadcast failed (${response.status}): ${responseBody}`);
            throw new Error(`Faucet broadcast failed: ${response.status} ${responseBody || response.statusText}`);
        }
        const result = JSON.parse(responseBody); // Parse after checking ok
        console.log("[Serverless] Broadcast result:", result);
        if (!result || !result.transactionId) {
             throw new Error("Faucet broadcast response did not include a transactionId.");
        }
        return result;
    } catch (error) {
        console.error('[Serverless] Error broadcasting transaction:', error);
         throw new Error(error.message.includes('Faucet broadcast failed') ? error.message : 'Faucet broadcast failed due to a network or parsing error.');
    }
}

// --- Vercel Serverless Function Handler ---
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    let qHelper;
    try {
        const { network, targetAddress } = req.body; // Vercel automatically parses JSON body
        console.log(`[Serverless] Received POST /api/faucet-claim for network: ${network}, address: ${targetAddress}`);

        // --- Input Validation ---
        if (!network || !['mainnet', 'testnet'].includes(network)) {
             console.error('[Serverless] Invalid network:', network);
            return res.status(400).json({ success: false, error: 'Invalid or missing network parameter.' });
        }
         if (!targetAddress || typeof targetAddress !== 'string' || !/^[A-Z]{60}$/.test(targetAddress)) {
             console.error(`[Serverless] Invalid targetAddress: "${targetAddress}"`);
             return res.status(400).json({ success: false, error: 'Invalid or missing targetAddress parameter (expected 60 uppercase letters).' });
        }

        const config = FAUCET_CONFIG[network];
        if (!config || !config.enabled || !config.seed) {
            console.warn(`[Serverless] Faucet request failed: ${network} faucet not configured or enabled.`);
            return res.status(400).json({ success: false, error: `${config.label} faucet is not configured or enabled.` });
        }

        // --- SERVER-SIDE Cooldown Check Placeholder ---
        // console.warn("[Serverless] Skipping server-side cooldown check (stateless environment).");
        // --- End Cooldown Check ---


        console.log(`[Serverless] Processing ${network} faucet request for ${targetAddress}`);

        // --- Transaction Logic ---
        qHelper = new QubicHelper();
        console.log('[Serverless] QubicHelper initialized.');

        const faucetIdPackage = await qHelper.createIdPackage(config.seed);
        const faucetPublicId = await qHelper.getIdentity(faucetIdPackage.publicKey);
        const faucetPublicKeyBytes = faucetIdPackage.publicKey;
        console.log(`[Serverless] Faucet Public ID (${network}): ${faucetPublicId}`);

        const targetPublicKeyBytes = qHelper.getIdentityBytes(targetAddress);
         if (!targetPublicKeyBytes || targetPublicKeyBytes.length !== PUBLIC_KEY_LENGTH) {
            throw new Error("Failed to get valid target public key bytes.");
        }

         console.log(`[Serverless] Fetching tick from ${config.rpc}...`);
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
        const finalTick = currentTick + 5;
        console.log(`[Serverless] Current Tick: ${currentTick}, Target Tick: ${finalTick}`);

        const inputType = 1;
        const inputSize = 0;
        const amountToSend = config.amount; // Already BigInt

        // Use const for TX_SIZE if QubicHelper doesn't have it readily available
        const BASE_TX_SIZE = 32 + 32 + 8 + 4 + 2 + 2; // Size without payload or signature
        const TX_SIZE = BASE_TX_SIZE + inputSize + SIGNATURE_LENGTH; // Total size including signature space
        const tx = new Uint8Array(TX_SIZE).fill(0);
        const dv = new DataView(tx.buffer);
        let offset = 0;

        tx.set(faucetPublicKeyBytes, offset); offset += PUBLIC_KEY_LENGTH;
        tx.set(targetPublicKeyBytes, offset); offset += PUBLIC_KEY_LENGTH;
        dv.setBigUint64(offset, amountToSend, true); offset += 8; // LE
        dv.setUint32(offset, finalTick, true); offset += 4; // LE
        dv.setUint16(offset, inputType, true); offset += 2; // LE
        dv.setUint16(offset, inputSize, true); offset += 2; // LE
        // Signature space is already included in TX_SIZE

        console.log("[Serverless] Created unsigned transaction buffer manually.");

        const signedTx = await localSignTx(qHelper, config.seed, tx);
        console.log("[Serverless] Signed transaction.");

        const broadcastResult = await broadcastTxBackend(signedTx, config.rpc);

        // --- Success ---
        console.log(`[Serverless] Successfully processed ${network} faucet claim for ${targetAddress}, TxID: ${broadcastResult.transactionId}`);
        return res.status(200).json({ success: true, txId: broadcastResult.transactionId });

    } catch (error) {
        console.error("[Serverless] Faucet Error:", error);
        const clientMessage = "Faucet operation failed. Please try again later.";
        // Add CORS headers even for errors if not handled globally by vercel.json
        res.setHeader('Access-Control-Allow-Origin', '*'); // Or specific origin
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(500).json({ success: false, error: clientMessage });
    }
} 