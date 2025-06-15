import { Buffer } from 'buffer';
import { queryContract, executeTransaction } from './contractApi';
import { executeTransactionWithWallet } from './transactionApi';
import { encodeParams, decodeContractResponse } from './contractUtils';

const NOSTROMO_CONTRACT_INDEX = 13; 
const NOSTROMO_ADDRESS = "NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAML";

// NOSTROMO CONSTANTS
export const NOSTROMO_TIERS = {
  1: { name: 'FACEHUGGER', stake: 20000000, poolWeight: 55, unstakeFee: 5 },    // 20M base units
  2: { name: 'CHESTBURST', stake: 100000000, poolWeight: 300, unstakeFee: 4 },  // 100M base units  
  3: { name: 'DOG', stake: 200000000, poolWeight: 750, unstakeFee: 3 },         // 200M base units
  4: { name: 'XENOMORPH', stake: 800000000, poolWeight: 3050, unstakeFee: 2 },  // 800M base units
  5: { name: 'WARRIOR', stake: 3200000000, poolWeight: 13750, unstakeFee: 1 }   // 3.2B base units
};

export const NOSTROMO_FEES = {
  QX_TOKEN_ISSUANCE: 1000000000,  // 1B base units
  CREATE_PROJECT: 100000000,       // 100M base units
  TRANSFER_RIGHTS: 1000000         // 1M base units
};

// NOSTROMO FUNCTIONS (view functions)
const NOSTROMO_GET_STATS = 1;
const NOSTROMO_GET_TIER_LEVEL_BY_USER = 2;
const NOSTROMO_GET_USER_VOTE_STATUS = 3;
const NOSTROMO_CHECK_TOKEN_CREATABILITY = 4;
const NOSTROMO_GET_NUMBER_OF_INVESTED_AND_CLAIMED_PROJECTS = 5;
const NOSTROMO_GET_PROJECT_BY_INDEX = 6;
const NOSTROMO_GET_FUNDARASING_BY_INDEX = 7;
const NOSTROMO_GET_PROJECT_INDEX_LIST_BY_CREATOR = 8;

// NOSTROMO PROCEDURES (transactions)
const NOSTROMO_REGISTER_IN_TIER = 1;
const NOSTROMO_LOGOUT_FROM_TIER = 2;
const NOSTROMO_CREATE_PROJECT = 3;
const NOSTROMO_VOTE_IN_PROJECT = 4;
const NOSTROMO_CREATE_FUNDARAISING = 5;
const NOSTROMO_INVEST_IN_PROJECT = 6;
const NOSTROMO_CLAIM_TOKEN = 7;
const NOSTROMO_TRANSFER_SHARE_MANAGEMENT_RIGHTS = 8;

// View Functions
export async function getStats(httpEndpoint, qHelper = null) {
  console.log('[Nostromo] Getting platform stats from endpoint:', httpEndpoint);
  
  const selectedFunction = {
    name: 'getStats',
    outputs: [
      { name: 'epochRevenue', type: 'uint64' },
      { name: 'totalPoolWeight', type: 'uint64' },
      { name: 'numberOfRegister', type: 'uint32' },
      { name: 'numberOfCreatedProject', type: 'uint32' },
      { name: 'numberOfFundaraising', type: 'uint32' }
    ]
  };
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_STATS,
    {},
    [],
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Stats result:', result);
  return result;
}

export async function getTierLevelByUser(httpEndpoint, userId, qHelper = null) {
  console.log('[Nostromo] Getting tier level for user:', userId);
  
  const selectedFunction = {
    name: 'getTierLevelByUser',
    outputs: [
      { name: 'tierLevel', type: 'uint8' }
    ]
  };
  
  const inputFields = [
    { name: 'userId', type: 'id' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_TIER_LEVEL_BY_USER,
    { userId },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Tier level result:', result);
  return result;
}

export async function getUserVoteStatus(httpEndpoint, userId, qHelper = null) {
  console.log('[Nostromo] Getting vote status for user:', userId);
  
  const selectedFunction = {
    name: 'getUserVoteStatus',
    outputs: [
      { name: 'numberOfVotedProjects', type: 'uint32' },
      { name: 'projectIndexList', type: 'uint32[64]' } // Array of uint32 with size 64
    ]
  };
  
  const inputFields = [
    { name: 'userId', type: 'id' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_USER_VOTE_STATUS,
    { userId },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Vote status result:', result);
  return result;
}

export async function getProjectByIndex(httpEndpoint, indexOfProject, qHelper = null) {
  console.log('[Nostromo] Getting project by index:', indexOfProject);
  
  const selectedFunction = {
    name: 'getProjectByIndex',
    outputs: [
      { name: 'creator', type: 'id' },
      { name: 'tokenName', type: 'uint64' },
      { name: 'supplyOfToken', type: 'uint64' },
      { name: 'startDate', type: 'uint32' },
      { name: 'endDate', type: 'uint32' },
      { name: 'numberOfYes', type: 'uint32' },
      { name: 'numberOfNo', type: 'uint32' },
      { name: 'isCreatedFundarasing', type: 'bit' }
    ]
  };
  
  const inputFields = [
    { name: 'indexOfProject', type: 'uint32' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_PROJECT_BY_INDEX,
    { indexOfProject },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Raw project result for index', indexOfProject, ':', result);
  if (result && result.rawResponseData) {
    console.log('[Nostromo] Raw response data:', result.rawResponseData);
  }
  if (result && result.decodedFields) {
    console.log('[Nostromo] Decoded fields:', result.decodedFields);
    console.log('[Nostromo] Decoded fields keys:', Object.keys(result.decodedFields));
    console.log('[Nostromo] Decoded fields values:', Object.values(result.decodedFields));
  }
  
  return result;
}

export async function getFundarasingByIndex(httpEndpoint, indexOfFundarasing, qHelper = null) {
  console.log('[Nostromo] Getting fundraising by index:', indexOfFundarasing);
  
  const selectedFunction = {
    name: 'getFundarasingByIndex',
    outputs: [
      { name: 'tokenPrice', type: 'uint64' },
      { name: 'soldAmount', type: 'uint64' },
      { name: 'requiredFunds', type: 'uint64' },
      { name: 'raisedFunds', type: 'uint64' },
      { name: 'indexOfProject', type: 'uint32' },
      { name: 'firstPhaseStartDate', type: 'uint32' },
      { name: 'firstPhaseEndDate', type: 'uint32' },
      { name: 'secondPhaseStartDate', type: 'uint32' },
      { name: 'secondPhaseEndDate', type: 'uint32' },
      { name: 'thirdPhaseStartDate', type: 'uint32' },
      { name: 'thirdPhaseEndDate', type: 'uint32' },
      { name: 'listingStartDate', type: 'uint32' },
      { name: 'cliffEndDate', type: 'uint32' },
      { name: 'vestingEndDate', type: 'uint32' },
      { name: 'threshold', type: 'uint8' },
      { name: 'TGE', type: 'uint8' },
      { name: 'stepOfVesting', type: 'uint8' },
      { name: 'isCreatedToken', type: 'bit' }
    ]
  };
  
  const inputFields = [
    { name: 'indexOfFundarasing', type: 'uint32' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_FUNDARASING_BY_INDEX,
    { indexOfFundarasing },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Raw fundraising result for index', indexOfFundarasing, ':', result);
  if (result && result.rawResponseData) {
    console.log('[Nostromo] Raw fundraising response data:', result.rawResponseData);
  }
  if (result && result.decodedFields) {
    console.log('[Nostromo] Decoded fundraising fields:', result.decodedFields);
  }
  
  return result;
}

export async function checkTokenCreatability(httpEndpoint, tokenName, qHelper = null) {
  console.log('[Nostromo] Checking token creatability for:', tokenName);
  
  const selectedFunction = {
    name: 'checkTokenCreatability',
    outputs: [
      { name: 'result', type: 'bit' }
    ]
  };
  
  const inputFields = [
    { name: 'tokenName', type: 'uint64' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_CHECK_TOKEN_CREATABILITY,
    { tokenName },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Token creatability result:', result);
  return result;
}

export async function getNumberOfInvestedAndClaimedProjects(httpEndpoint, userId, qHelper = null) {
  console.log('[Nostromo] Getting investment stats for user:', userId);
  
  const selectedFunction = {
    name: 'getNumberOfInvestedAndClaimedProjects',
    outputs: [
      { name: 'numberOfInvestedProjects', type: 'uint32' },
      { name: 'numberOfClaimedProjects', type: 'uint32' }
    ]
  };
  
  const inputFields = [
    { name: 'userId', type: 'id' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_NUMBER_OF_INVESTED_AND_CLAIMED_PROJECTS,
    { userId },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Investment stats result:', result);
  return result;
}

export async function getProjectIndexListByCreator(httpEndpoint, creator, qHelper = null) {
  console.log('[Nostromo] Getting projects by creator:', creator);
  
  const selectedFunction = {
    name: 'getProjectIndexListByCreator',
    outputs: [
      { name: 'indexListForProjects', type: 'uint32[64]' }
    ]
  };
  
  const inputFields = [
    { name: 'creator', type: 'id' }
  ];
  
  const result = await queryContract(
    httpEndpoint,
    NOSTROMO_CONTRACT_INDEX,
    NOSTROMO_GET_PROJECT_INDEX_LIST_BY_CREATOR,
    { creator },
    inputFields,
    selectedFunction,
    null,
    qHelper
  );
  
  console.log('[Nostromo] Creator projects result:', result);
  return result;
}

// Transaction Functions
export async function registerInTier(qubicConnect, tierLevel) {
  console.log('[Nostromo] registerInTier called with tierLevel:', tierLevel);
  console.log('[Nostromo] tierLevel type:', typeof tierLevel);
  
  const stakeAmount = NOSTROMO_TIERS[tierLevel].stake;
  console.log('[Nostromo] stakeAmount for tierLevel', tierLevel, ':', stakeAmount);
  console.log('[Nostromo] NOSTROMO_CONTRACT_INDEX value:', NOSTROMO_CONTRACT_INDEX);
  console.log('[Nostromo] NOSTROMO_CONTRACT_INDEX type:', typeof NOSTROMO_CONTRACT_INDEX);
  
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_REGISTER_IN_TIER,
    params: { tierLevel },
    inputFields: [
      { name: 'tierLevel', type: 'uint32' }
    ],
    amount: stakeAmount.toString(),
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS,
    contractIndexes: null // Ensure we don't use string-based lookup for numeric index
  };
  
  console.log('[Nostromo] txDetails:', txDetails);
  console.log('[Nostromo] About to call executeTransactionWithWallet with contractIndex:', txDetails.contractIndex);
  
  return await executeTransactionWithWallet(txDetails);
}

export async function logoutFromTier(qubicConnect) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_LOGOUT_FROM_TIER,
    params: {},
    inputFields: [],
    amount: '0',
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function upgradeTier(qubicConnect, newTierLevel) {
  console.log('[Nostromo] upgradeTier called with newTierLevel:', newTierLevel);
  
  // Calculate the upgrade cost (difference between current and new tier)
  const upgradeCosts = {
    2: NOSTROMO_TIERS[2].stake - NOSTROMO_TIERS[1].stake, // CHESTBURST - FACEHUGGER
    3: NOSTROMO_TIERS[3].stake - NOSTROMO_TIERS[2].stake, // DOG - CHESTBURST  
    4: NOSTROMO_TIERS[4].stake - NOSTROMO_TIERS[3].stake, // XENOMORPH - DOG
    5: NOSTROMO_TIERS[5].stake - NOSTROMO_TIERS[4].stake  // WARRIOR - XENOMORPH
  };
  
  const upgradeAmount = upgradeCosts[newTierLevel];
  console.log('[Nostromo] upgradeAmount for tier', newTierLevel, ':', upgradeAmount);
  
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: 8, // upgradeTier procedure index
    params: { newTierLevel },
    inputFields: [
      { name: 'newTierLevel', type: 'uint32' }
    ],
    amount: upgradeAmount.toString(),
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  console.log('[Nostromo] upgradeTier txDetails:', txDetails);
  
  return await executeTransactionWithWallet(txDetails);
}

export async function createProject(qubicConnect, projectData) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_CREATE_PROJECT,
    params: projectData,
    inputFields: [
      { name: 'tokenName', type: 'uint64' },
      { name: 'supply', type: 'uint64' },
      { name: 'startYear', type: 'uint32' },
      { name: 'startMonth', type: 'uint32' },
      { name: 'startDay', type: 'uint32' },
      { name: 'startHour', type: 'uint32' },
      { name: 'endYear', type: 'uint32' },
      { name: 'endMonth', type: 'uint32' },
      { name: 'endDay', type: 'uint32' },
      { name: 'endHour', type: 'uint32' }
    ],
    amount: NOSTROMO_FEES.CREATE_PROJECT.toString(),
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  console.log('DEBUG projectData', JSON.stringify(txDetails.params, null, 2));
  
  return await executeTransactionWithWallet(txDetails);
}

export async function voteInProject(qubicConnect, indexOfProject, decision) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_VOTE_IN_PROJECT,
    params: { indexOfProject, decision },
    inputFields: [
      { name: 'indexOfProject', type: 'uint32' },
      { name: 'decision', type: 'bit' }
    ],
    amount: '0',
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function createFundaraising(qubicConnect, fundraisingData) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_CREATE_FUNDARAISING,
    params: fundraisingData,
    inputFields: [
      { name: 'tokenPrice', type: 'uint64' },
      { name: 'soldAmount', type: 'uint64' },
      { name: 'requiredFunds', type: 'uint64' },
      { name: 'indexOfProject', type: 'uint32' },
      { name: 'firstPhaseStartYear', type: 'uint32' },
      { name: 'firstPhaseStartMonth', type: 'uint32' },
      { name: 'firstPhaseStartDay', type: 'uint32' },
      { name: 'firstPhaseStartHour', type: 'uint32' },
      { name: 'firstPhaseEndYear', type: 'uint32' },
      { name: 'firstPhaseEndMonth', type: 'uint32' },
      { name: 'firstPhaseEndDay', type: 'uint32' },
      { name: 'firstPhaseEndHour', type: 'uint32' },
      { name: 'secondPhaseStartYear', type: 'uint32' },
      { name: 'secondPhaseStartMonth', type: 'uint32' },
      { name: 'secondPhaseStartDay', type: 'uint32' },
      { name: 'secondPhaseStartHour', type: 'uint32' },
      { name: 'secondPhaseEndYear', type: 'uint32' },
      { name: 'secondPhaseEndMonth', type: 'uint32' },
      { name: 'secondPhaseEndDay', type: 'uint32' },
      { name: 'secondPhaseEndHour', type: 'uint32' },
      { name: 'thirdPhaseStartYear', type: 'uint32' },
      { name: 'thirdPhaseStartMonth', type: 'uint32' },
      { name: 'thirdPhaseStartDay', type: 'uint32' },
      { name: 'thirdPhaseStartHour', type: 'uint32' },
      { name: 'thirdPhaseEndYear', type: 'uint32' },
      { name: 'thirdPhaseEndMonth', type: 'uint32' },
      { name: 'thirdPhaseEndDay', type: 'uint32' },
      { name: 'thirdPhaseEndHour', type: 'uint32' },
      { name: 'listingStartYear', type: 'uint32' },
      { name: 'listingStartMonth', type: 'uint32' },
      { name: 'listingStartDay', type: 'uint32' },
      { name: 'listingStartHour', type: 'uint32' },
      { name: 'cliffEndYear', type: 'uint32' },
      { name: 'cliffEndMonth', type: 'uint32' },
      { name: 'cliffEndDay', type: 'uint32' },
      { name: 'cliffEndHour', type: 'uint32' },
      { name: 'vestingEndYear', type: 'uint32' },
      { name: 'vestingEndMonth', type: 'uint32' },
      { name: 'vestingEndDay', type: 'uint32' },
      { name: 'vestingEndHour', type: 'uint32' },
      { name: 'threshold', type: 'uint8' },
      { name: 'TGE', type: 'uint8' },
      { name: 'stepOfVesting', type: 'uint8' }
    ],
    amount: NOSTROMO_FEES.QX_TOKEN_ISSUANCE.toString(),
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function investInProject(qubicConnect, indexOfFundaraising, amount) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_INVEST_IN_PROJECT,
    params: { indexOfFundaraising },
    inputFields: [
      { name: 'indexOfFundaraising', type: 'uint32' }
    ],
    amount: amount.toString(),
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function claimToken(qubicConnect, indexOfFundaraising, amount) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_CLAIM_TOKEN,
    params: { amount, indexOfFundaraising },
    inputFields: [
      { name: 'amount', type: 'uint64' },
      { name: 'indexOfFundaraising', type: 'uint32' }
    ],
    amount: '0',
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

export async function transferShareManagementRights(qubicConnect, asset, numberOfShares, newManagingContractIndex) {
  const txDetails = {
    qubicConnect,
    contractIndex: NOSTROMO_CONTRACT_INDEX,
    procedureIndex: NOSTROMO_TRANSFER_SHARE_MANAGEMENT_RIGHTS,
    params: {
      asset,
      numberOfShares,
      newManagingContractIndex
    },
    inputFields: [
      { name: 'asset', type: 'Asset' },
      { name: 'numberOfShares', type: 'sint64' },
      { name: 'newManagingContractIndex', type: 'uint32' }
    ],
    amount: NOSTROMO_FEES.TRANSFER_RIGHTS.toString(),
    sourceId: qubicConnect.wallet.publicKey,
    destinationId: NOSTROMO_ADDRESS
  };
  
  return await executeTransactionWithWallet(txDetails);
}

// Helper functions
export function formatQU(amount) {
  if (!amount) return '0 QU';
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  return (num / 1000000).toLocaleString() + ' M QU';
}

export function isValidProject(project) {
  return project && 
    project.creator && 
    project.tokenName && 
    project.supplyOfToken && 
    project.startDate && 
    project.endDate &&
    typeof project.isCreatedFundarasing === 'boolean';
}

export function isValidFundraising(fundraising) {
  return fundraising &&
    fundraising.requiredFunds && fundraising.requiredFunds !== '0' &&
    fundraising.indexOfProject !== undefined && fundraising.indexOfProject !== 0 &&
    fundraising.tokenPrice && fundraising.tokenPrice !== '0' &&
    typeof fundraising.isCreatedToken === 'boolean';
}

export async function checkTransactionStatus(httpEndpoint, transactionId) {
  try {
    const endpoint = formatEndpoint(httpEndpoint);
    const response = await fetch(`${endpoint}/v1/transactions/${transactionId}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[Nostromo] Transaction status:', data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('[Nostromo] Error checking transaction status:', error);
    return null;
  }
}

function formatEndpoint(endpoint) {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `http://${endpoint}`;
}

export function tokenNameToUint64(tokenName) {
  const paddedName = tokenName.padEnd(8, '\0').substring(0, 8);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(paddedName);
  
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value |= BigInt(bytes[i] || 0) << BigInt(i * 8);
  }
  
  return value.toString();
}

export function uint64ToTokenName(uint64Value) {
  if (!uint64Value || uint64Value === '0' || uint64Value === 0) {
    return 'N/A';
  }
  
  try {
    const value = BigInt(uint64Value);
    const bytes = [];
    
    for (let i = 0; i < 8; i++) {
      const byte = Number((value >> BigInt(i * 8)) & 0xFFn);
      if (byte === 0) break;
      bytes.push(byte);
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(bytes)).trim() || 'N/A';
  } catch (error) {
    console.error('Error converting uint64 to token name:', error);
    return 'N/A';
  }
}

export function dateToQubicDate(date) {
  return {
    year: date.getFullYear() % 100,
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours()
  };
}

export function qubicDateToString(qubicDate) {
  // This would need the QUOTTERY date unpacking function
  // For now, return a placeholder
  return new Date().toISOString();
}

export function getTierInfo(tierLevel) {
  return NOSTROMO_TIERS[tierLevel] || null;
}

export function calculatePoolShare(tierLevel, totalPoolWeight) {
  const tier = NOSTROMO_TIERS[tierLevel];
  if (!tier || !totalPoolWeight) return 0;
  return (tier.poolWeight / totalPoolWeight) * 100;
} 