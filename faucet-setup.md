# Faucet Setup Guide

## Environment Variables Required

Create a `.env.local` file in your project root with these variables:

```bash
# Testnet faucet (works for both regular testnet and Nostromo testnet)
FAUCET_TESTNET_SEED=your_55_character_testnet_seed_here

# Mainnet faucet (use with caution - real money!)
# FAUCET_MAINNET_SEED=your_55_character_mainnet_seed_here  

# Backend port (optional)
BACKEND_PORT=3001
```

## How It Works

The faucet now **automatically detects** which network to use based on your current RPC endpoint:

- **Mainnet**: `https://rpc.qubic.org` → Uses `FAUCET_MAINNET_SEED`
- **Regular Testnet**: `https://testnet-rpc.qubicdev.com` → Uses `FAUCET_TESTNET_SEED`  
- **Nostromo Testnet**: `https://testnet-nostromo.qubicdev.com` → Uses `FAUCET_TESTNET_SEED`

No need to configure separate networks - just set your endpoint and the faucet adapts!

## How to Get a Testnet Seed

1. Generate a new Qubic identity for testing
2. Use a seed that has some testnet QU for the faucet
3. **NEVER use a mainnet seed with real funds**

## Testing the Faucet

1. Set up environment variables
2. Start your development server: `npm start`
3. Connect a wallet
4. Click the "Faucet" button
5. Try claiming testnet tokens

## Troubleshooting

- Check browser console for detailed error messages
- Check server logs for backend errors  
- Verify environment variables are set correctly
- Make sure the RPC endpoints are accessible

## Common Issues

1. **"Faucet not configured"** - Missing environment variables
2. **"Network error"** - RPC endpoint down or wrong URL
3. **"Crypto initialization failed"** - Library loading issue
4. **"Transaction broadcast failed"** - Network congestion or invalid transaction 