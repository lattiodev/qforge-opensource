import { queryContract, executeTransaction } from './contractApi';
import { executeTransactionWithWallet } from './transactionApi';
import { encodeParams } from './contractUtils';

const QSWAP_CONTRACT_INDEX = 13;
const QSWAP_ADDRESS = "NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAML";

// QSWAP FUNCTIONS (view functions)
const QSWAP_GET_FEE = 1;
const QSWAP_GET_POOL_BASIC_STATE = 2;
const QSWAP_GET_LIQUIDITY_OF = 3;
const QSWAP_QUOTE_EXACT_QU_INPUT = 4;
const QSWAP_QUOTE_EXACT_QU_OUTPUT = 5;
const QSWAP_QUOTE_EXACT_ASSET_INPUT = 6;
const QSWAP_QUOTE_EXACT_ASSET_OUTPUT = 7;

// QSWAP PROCEDURES (transactions)
const QSWAP_ISSUE_ASSET = 1;
const QSWAP_TRANSFER_SHARE = 2;
const QSWAP_CREATE_POOL = 3;
const QSWAP_ADD_LIQUIDITY = 4;
const QSWAP_REMOVE_LIQUIDITY = 5;
const QSWAP_SWAP_EXACT_QU_FOR_ASSET = 6;
const QSWAP_SWAP_QU_FOR_EXACT_ASSET = 7;
const QSWAP_SWAP_EXACT_ASSET_FOR_QU = 8;
const QSWAP_SWAP_ASSET_FOR_EXACT_QU = 9;

// View Functions
export async function getQswapFees(httpEndpoint) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_GET_FEE,
    {},
    [],
    {
      name: 'Fees',
      outputs: [
        { name: 'assetIssuanceFee', type: 'uint32' },
        { name: 'poolCreationFee', type: 'uint32' },
        { name: 'transferFee', type: 'uint32' },
        { name: 'swapFee', type: 'uint32' },
        { name: 'protocolFee', type: 'uint32' }
      ]
    }
  );
  return result;
}

export async function getPoolBasicState(httpEndpoint, assetIssuer, assetName) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_GET_POOL_BASIC_STATE,
    { assetIssuer, assetName },
    [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' }
    ],
    {
      name: 'GetPoolBasicState',
      outputs: [
        { name: 'poolExists', type: 'sint64' },
        { name: 'reservedQuAmount', type: 'sint64' },
        { name: 'reservedAssetAmount', type: 'sint64' },
        { name: 'totalLiquidity', type: 'sint64' }
      ]
    }
  );
  return result;
}

export async function getLiquidityOf(httpEndpoint, assetIssuer, assetName, account) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_GET_LIQUIDITY_OF,
    { assetIssuer, assetName, account },
    [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'account', type: 'id' }
    ],
    {
      name: 'GetLiquidityOf',
      outputs: [
        { name: 'liquidity', type: 'sint64' }
      ]
    }
  );
  return result;
}

// Quote functions
export async function quoteExactQuInput(httpEndpoint, assetIssuer, assetName, quAmountIn) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_QU_INPUT,
    { assetIssuer, assetName, quAmountIn },
    [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'quAmountIn', type: 'sint64' }
    ],
    {
      name: 'QuoteExactQuInput',
      outputs: [
        { name: 'assetAmountOut', type: 'sint64' }
      ]
    }
  );
  return result;
}

export async function quoteExactQuOutput(httpEndpoint, assetIssuer, assetName, quAmountOut) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_QU_OUTPUT,
    { assetIssuer, assetName, quAmountOut },
    [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'quAmountOut', type: 'sint64' }
    ],
    {
      name: 'QuoteExactQuOutput',
      outputs: [
        { name: 'assetAmountIn', type: 'sint64' }
      ]
    }
  );
  return result;
}

export async function quoteExactAssetInput(httpEndpoint, assetIssuer, assetName, assetAmountIn) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_ASSET_INPUT,
    { assetIssuer, assetName, assetAmountIn },
    [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'assetAmountIn', type: 'sint64' }
    ],
    {
      name: 'QuoteExactAssetInput',
      outputs: [
        { name: 'quAmountOut', type: 'sint64' }
      ]
    }
  );
  return result;
}

export async function quoteExactAssetOutput(httpEndpoint, assetIssuer, assetName, assetAmountOut) {
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_ASSET_OUTPUT,
    { assetIssuer, assetName, assetAmountOut },
    [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'assetAmountOut', type: 'sint64' }
    ],
    {
      name: 'QuoteExactAssetOutput',
      outputs: [
        { name: 'quAmountIn', type: 'sint64' }
      ]
    }
  );
  return result;
}

// Transaction Functions
export async function issueAsset(qubicConnect, assetName, numberOfShares, unitOfMeasurement, numberOfDecimalPlaces) {
  const txDetails = {
    qubicConnect,
    contractIndex: QSWAP_CONTRACT_INDEX,
    procedureIndex: QSWAP_ISSUE_ASSET,
    params: { assetName, numberOfShares, unitOfMeasurement, numberOfDecimalPlaces },
    inputFields: [
      { name: 'assetName', type: 'uint64' },
      { name: 'numberOfShares', type: 'sint64' },
      { name: 'unitOfMeasurement', type: 'uint64' },
      { name: 'numberOfDecimalPlaces', type: 'sint8' }
    ],
    amount: '1000000000', // 1 billion qus fee
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: QSWAP_ADDRESS,
    functionName: 'IssueAsset',
    functionParams: { assetName, numberOfShares, unitOfMeasurement, numberOfDecimalPlaces }
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function createPool(qubicConnect, assetIssuer, assetName) {
  const txDetails = {
    qubicConnect,
    contractIndex: QSWAP_CONTRACT_INDEX,
    procedureIndex: QSWAP_CREATE_POOL,
    params: { assetIssuer, assetName },
    inputFields: [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' }
    ],
    amount: '1000000000', // 1 billion qus fee
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: QSWAP_ADDRESS,
    functionName: 'CreatePool',
    functionParams: { assetIssuer, assetName }
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function addLiquidity(qubicConnect, assetIssuer, assetName, quAmountDesired, assetAmountDesired, quAmountMin, assetAmountMin) {
  const txDetails = {
    qubicConnect,
    contractIndex: QSWAP_CONTRACT_INDEX,
    procedureIndex: QSWAP_ADD_LIQUIDITY,
    params: { assetIssuer, assetName, assetAmountDesired, quAmountMin, assetAmountMin },
    inputFields: [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'assetAmountDesired', type: 'sint64' },
      { name: 'quAmountMin', type: 'sint64' },
      { name: 'assetAmountMin', type: 'sint64' }
    ],
    amount: quAmountDesired.toString(), // Amount of QU to add
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: QSWAP_ADDRESS,
    functionName: 'AddLiquidity',
    functionParams: { assetIssuer, assetName, assetAmountDesired, quAmountMin, assetAmountMin }
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function removeLiquidity(qubicConnect, assetIssuer, assetName, burnLiquidity, quAmountMin, assetAmountMin) {
  const txDetails = {
    qubicConnect,
    contractIndex: QSWAP_CONTRACT_INDEX,
    procedureIndex: QSWAP_REMOVE_LIQUIDITY,
    params: { assetIssuer, assetName, burnLiquidity, quAmountMin, assetAmountMin },
    inputFields: [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'burnLiquidity', type: 'sint64' },
      { name: 'quAmountMin', type: 'sint64' },
      { name: 'assetAmountMin', type: 'sint64' }
    ],
    amount: '0', // No QU needed
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: QSWAP_ADDRESS,
    functionName: 'RemoveLiquidity',
    functionParams: { assetIssuer, assetName, burnLiquidity, quAmountMin, assetAmountMin }
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function swapExactQuForAsset(qubicConnect, assetIssuer, assetName, quAmountIn, assetAmountOutMin) {
  const txDetails = {
    qubicConnect,
    contractIndex: QSWAP_CONTRACT_INDEX,
    procedureIndex: QSWAP_SWAP_EXACT_QU_FOR_ASSET,
    params: { assetIssuer, assetName, assetAmountOutMin },
    inputFields: [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'assetAmountOutMin', type: 'sint64' }
    ],
    amount: quAmountIn.toString(), // QU to swap
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: QSWAP_ADDRESS,
    functionName: 'SwapExactQuForAsset',
    functionParams: { assetIssuer, assetName, assetAmountOutMin }
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function transferShareOwnershipAndPossession(qubicConnect, assetIssuer, assetName, newOwnerAndPossessor, amount) {
  const txDetails = {
    qubicConnect,
    contractIndex: QSWAP_CONTRACT_INDEX,
    procedureIndex: QSWAP_TRANSFER_SHARE,
    params: { assetIssuer, assetName, newOwnerAndPossessor, amount },
    inputFields: [
      { name: 'assetIssuer', type: 'id' },
      { name: 'assetName', type: 'uint64' },
      { name: 'newOwnerAndPossessor', type: 'id' },
      { name: 'amount', type: 'sint64' }
    ],
    amount: '1000000', // 1M qus transfer fee
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: QSWAP_ADDRESS,
    functionName: 'TransferShareOwnershipAndPossession',
    functionParams: { assetIssuer, assetName, newOwnerAndPossessor, amount }
  };
  
  return await executeTransactionWithWallet(txDetails);
}

// Helper function to convert asset name string to uint64
export function assetNameToUint64(assetName) {
  // Convert string to bytes and pack into uint64
  let value = 0n;
  for (let i = 0; i < Math.min(assetName.length, 8); i++) {
    value |= BigInt(assetName.charCodeAt(i)) << BigInt(i * 8);
  }
  return value.toString();
}

// Helper to convert uint64 back to asset name string
export function uint64ToAssetName(uint64Value) {
  const value = BigInt(uint64Value);
  let name = '';
  for (let i = 0; i < 8; i++) {
    const byte = Number((value >> BigInt(i * 8)) & 0xFFn);
    if (byte === 0) break;
    name += String.fromCharCode(byte);
  }
  return name;
} 