# Dynamic Contract UI for Qubic

A React-based UI for interacting with Qubic smart contracts. This application provides a dynamic interface for deploying and interacting with Qubic contracts, with support for both mainnet and testnet environments.

## Features

- Dynamic contract loading and interaction with Qubic Smart Contracts
- Support for any HTTP endpoint, including local node deployment
- Built-in faucet for testnet (optional)
- Metamask Snap & WalletConnect integration
- Real-time transaction status updates

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Qubic wallet (for mainnet usage)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/lattiodev/qforge.git
cd qforge
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables (optional, only needed for faucet):
```env
FAUCET_TESTNET_SEED=your_testnet_seed
FAUCET_TESTNET_RPC=https://testnet-rpc.qubicdev.com/
FAUCET_MAINNET_SEED=your_mainnet_seed
FAUCET_MAINNET_RPC=https://rpc.qubic.org
```

## Running the Application

1. Start the development server:
```bash
npm start
```

This will start both the React frontend (port 3000) and the backend server (port 3001).

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── public/
│   └── contracts/           # Contract definition files
│       └── contractsList.json
├── src/
│   ├── components/         # Reusable UI components
│   ├── context/           # React context providers
│   ├── pages/            # Page components
│   ├── utils/            # Utility functions
│   └── App.js            # Main application component
├── server.js             # Backend server (faucet)
└── package.json
```

## Adding New Contracts

1. Place your contract definition file (e.g., `MyContract.abi`) in the `public/contracts/` directory.
2. Add the filename to `public/contracts/contractsList.json`.
3. The contract will be automatically parsed and indexed using the `parseContract()` function from `contractUtils.js`.
4. Contract functions will be available through the `CONTRACT_INDEXES` mapping.

## Faucet (Optional)

The application includes a built-in faucet for testnet development. The faucet is disabled by default and requires configuration through environment variables.

To enable the faucet:
1. Set up the environment variables as described in the Installation section
2. The faucet will be available at `http://localhost:3001/api/faucet-claim`

Note: The faucet is not required for the main functionality of the application. You can run the application without the faucet by simply not configuring the environment variables.

## Building for Production

```bash
npm run build
```

This creates a production build in the `build` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

- Never commit your `.env` file or expose your seed phrases
- The faucet is for development purposes only
- Always verify transactions before signing

## Support

For issues and feature requests, please use the GitHub issue tracker.
