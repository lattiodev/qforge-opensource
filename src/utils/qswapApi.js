import { Buffer } from 'buffer';
import { queryContract, executeTransaction } from './contractApi';
import { executeTransactionWithWallet } from './transactionApi';
import { encodeParams, decodeContractResponse } from './contractUtils';

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
export async function getQswapFees(httpEndpoint, qHelper = null) {
  console.log('[QSwap] Getting fees from endpoint:', httpEndpoint);
  
  const selectedFunction = {
    name: 'getFees',
    outputs: [
      { name: 'assetIssuanceFee', type: 'uint32' },
      { name: 'poolCreationFee', type: 'uint32' },
      { name: 'transferFee', type: 'uint32' },
      { name: 'swapRate', type: 'uint32' },
      { name: 'protocolRate', type: 'uint32' }
    ]
  };
  
  console.log('[QSwap] Making query contract call...');
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_GET_FEE,
    {}, // No input parameters
    [], // No input fields
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper (but not needed for this function)
  );
  
  console.log('[QSwap] Fees query result:', result);
  
  // Debug: Let's also check what the raw API call would return
  if (result && result.rawResponse) {
    console.log('[QSwap] Raw response data:', result.rawResponse.responseData);
    
    // Try to manually decode like the test function does
    if (result.rawResponse.responseData) {
      try {
        const binaryString = atob(result.rawResponse.responseData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        if (bytes.length >= 20) { // 5 uint32 values = 20 bytes
          const dv = new DataView(bytes.buffer);
          const manualDecode = {
            assetIssuanceFee: dv.getUint32(0, true),
            poolCreationFee: dv.getUint32(4, true),
            transferFee: dv.getUint32(8, true),
            swapRate: dv.getUint32(12, true),
            protocolRate: dv.getUint32(16, true)
          };
          console.log('[QSwap] Manual decode of fees:', manualDecode);
        }
      } catch (decodeError) {
        console.error('[QSwap] Manual decode failed:', decodeError);
      }
    }
  }
  
  if (result && result.success && result.decodedFields) {
    return {
      success: true,
      decodedFields: {
        assetIssuanceFee: result.decodedFields.assetIssuanceFee || 0,
        poolCreationFee: result.decodedFields.poolCreationFee || 0,
        transferFee: result.decodedFields.transferFee || 0,
        swapFee: result.decodedFields.swapRate || 0,
        protocolFee: result.decodedFields.protocolRate || 0
      }
    };
  }
  
  return result;
}

export async function getPoolBasicState(httpEndpoint, assetIssuer, assetName, qHelper = null) {
  console.log('[QSwap] Getting pool state for:', { assetIssuer, assetName });
  
  const selectedFunction = {
    name: 'getPoolBasicState',
    outputs: [
      { name: 'poolExists', type: 'sint64' },
      { name: 'reservedQuAmount', type: 'sint64' },
      { name: 'reservedAssetAmount', type: 'sint64' },
      { name: 'totalLiquidity', type: 'sint64' }
    ]
  };
  
  const inputFields = [
    { name: 'assetIssuer', type: 'id' },
    { name: 'assetName', type: 'uint64' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_GET_POOL_BASIC_STATE,
    { assetIssuer, assetName },
    inputFields,
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper
  );
  
  console.log('[QSwap] Pool state result:', result);
  return result;
}

export async function getLiquidityOf(httpEndpoint, assetIssuer, assetName, account, qHelper = null) {
  console.log('[QSwap] Getting liquidity for:', { assetIssuer, assetName, account });
  
  const selectedFunction = {
    name: 'getLiquidityOf',
    outputs: [
      { name: 'liquidity', type: 'sint64' }
    ]
  };
  
  const inputFields = [
    { name: 'assetIssuer', type: 'id' },
    { name: 'assetName', type: 'uint64' },
    { name: 'account', type: 'id' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_GET_LIQUIDITY_OF,
    { assetIssuer, assetName, account },
    inputFields,
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper
  );
  
  console.log('[QSwap] Liquidity result:', result);
  return result;
}

// Quote functions
export async function quoteExactQuInput(httpEndpoint, assetIssuer, assetName, quAmountIn, qHelper = null) {
  console.log('[QSwap] Getting quote for QU input:', { assetIssuer, assetName, quAmountIn });
  
  const selectedFunction = {
    name: 'quoteExactQuInput',
    outputs: [
      { name: 'assetAmountOut', type: 'sint64' }
    ]
  };
  
  const inputFields = [
    { name: 'assetIssuer', type: 'id' },
    { name: 'assetName', type: 'uint64' },
    { name: 'quAmountIn', type: 'sint64' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_QU_INPUT,
    { assetIssuer, assetName, quAmountIn },
    inputFields,
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper
  );
  
  console.log('[QSwap] Quote QU input result:', result);
  return result;
}

export async function quoteExactQuOutput(httpEndpoint, assetIssuer, assetName, quAmountOut, qHelper = null) {
  console.log('[QSwap] Getting quote for QU output:', { assetIssuer, assetName, quAmountOut });
  
  const selectedFunction = {
    name: 'quoteExactQuOutput',
    outputs: [
      { name: 'assetAmountIn', type: 'sint64' }
    ]
  };
  
  const inputFields = [
    { name: 'assetIssuer', type: 'id' },
    { name: 'assetName', type: 'uint64' },
    { name: 'quAmountOut', type: 'sint64' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_QU_OUTPUT,
    { assetIssuer, assetName, quAmountOut },
    inputFields,
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper
  );
  
  console.log('[QSwap] Quote QU output result:', result);
  return result;
}

export async function quoteExactAssetInput(httpEndpoint, assetIssuer, assetName, assetAmountIn, qHelper = null) {
  console.log('[QSwap] Getting quote for asset input:', { assetIssuer, assetName, assetAmountIn });
  
  const selectedFunction = {
    name: 'quoteExactAssetInput',
    outputs: [
      { name: 'quAmountOut', type: 'sint64' }
    ]
  };
  
  const inputFields = [
    { name: 'assetIssuer', type: 'id' },
    { name: 'assetName', type: 'uint64' },
    { name: 'assetAmountIn', type: 'sint64' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_ASSET_INPUT,
    { assetIssuer, assetName, assetAmountIn },
    inputFields,
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper
  );
  
  console.log('[QSwap] Quote asset input result:', result);
  return result;
}

export async function quoteExactAssetOutput(httpEndpoint, assetIssuer, assetName, assetAmountOut, qHelper = null) {
  console.log('[QSwap] Getting quote for asset output:', { assetIssuer, assetName, assetAmountOut });
  
  const selectedFunction = {
    name: 'quoteExactAssetOutput',
    outputs: [
      { name: 'quAmountIn', type: 'sint64' }
    ]
  };
  
  const inputFields = [
    { name: 'assetIssuer', type: 'id' },
    { name: 'assetName', type: 'uint64' },
    { name: 'assetAmountOut', type: 'sint64' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    QSWAP_CONTRACT_INDEX,
    QSWAP_QUOTE_EXACT_ASSET_OUTPUT,
    { assetIssuer, assetName, assetAmountOut },
    inputFields,
    selectedFunction,
    null, // customIndexes
    qHelper // Pass qHelper
  );
  
  console.log('[QSwap] Quote asset output result:', result);
  return result;
}

// Transaction Functions - using executeTransactionWithWallet pattern
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
    destinationId: QSWAP_ADDRESS
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
    destinationId: QSWAP_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function addLiquidity(qubicConnect, assetIssuer, assetName, quAmountDesired, assetAmountDesired, quAmountMin, assetAmountMin) {
  console.log('[QSwap] AddLiquidity - Contract expects:', {
    transactionAmount: quAmountDesired,
    parameters: {
      assetIssuer,
      assetName, 
      assetAmountDesired,
      quAmountMin,
      assetAmountMin
    }
  });
  
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
    destinationId: QSWAP_ADDRESS
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
    destinationId: QSWAP_ADDRESS
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
    destinationId: QSWAP_ADDRESS
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
    destinationId: QSWAP_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

// Helper function to convert asset name string to uint64
export function assetNameToUint64(assetName) {
  // In the C++ code, asset names are stored as 8-byte char arrays
  // We need to convert the string to match this format
  const paddedName = assetName.padEnd(8, '\0').substring(0, 8);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(paddedName);
  
  // Pack bytes into uint64 (little-endian)
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value |= BigInt(bytes[i] || 0) << BigInt(i * 8);
  }
  
  return value.toString();
}

// Helper to convert uint64 back to asset name string
export function uint64ToAssetName(uint64Value) {
  const value = BigInt(uint64Value);
  const bytes = [];
  
  for (let i = 0; i < 8; i++) {
    const byte = Number((value >> BigInt(i * 8)) & 0xFFn);
    if (byte === 0) break;
    bytes.push(byte);
  }
  
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes)).trim();
} 