import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../App';
import { 
  getQswapFees, 
  getPoolBasicState, 
  getLiquidityOf,
  quoteExactQuInput,
  quoteExactAssetInput,
  issueAsset,
  createPool,
  addLiquidity,
  removeLiquidity,
  swapExactQuForAsset,
  transferShareOwnershipAndPossession,
  assetNameToUint64,
  uint64ToAssetName
} from '../utils/qswapApi';
import existingPoolsData from '../data/existingPools.json';
import './QSwap.css';

function QSwap() {
  const { qubicConnect, isConnected, httpEndpoint } = useContext(WalletContext);
  const [activeTab, setActiveTab] = useState('pools');
  const [fees, setFees] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPoolId, setLoadingPoolId] = useState(null);
  const [message, setMessage] = useState('');
  const [existingPools, setExistingPools] = useState(existingPoolsData);
  
  // Form states
  const [assetName, setAssetName] = useState('');
  const [assetIssuer, setAssetIssuer] = useState('');
  const [poolInfo, setPoolInfo] = useState(null);
  const [userLiquidity, setUserLiquidity] = useState(null);
  
  // Issue Asset form
  const [issueForm, setIssueForm] = useState({
    assetName: '',
    numberOfShares: '',
    unitOfMeasurement: 'TOKENS',
    numberOfDecimalPlaces: ''
  });
  
  // Add Liquidity form
  const [liquidityForm, setLiquidityForm] = useState({
    quAmountDesired: '',
    assetAmountDesired: '',
    quAmountMin: '',
    assetAmountMin: ''
  });
  
  // Remove Liquidity form
  const [removeLiquidityForm, setRemoveLiquidityForm] = useState({
    burnLiquidity: '',
    quAmountMin: '',
    assetAmountMin: ''
  });
  
  // Swap form
  const [swapForm, setSwapForm] = useState({
    inputType: 'qu', // 'qu' or 'asset'
    inputAmount: '',
    outputMin: '',
    quote: null
  });

  // Helper function to format endpoint
  const formatEndpoint = (endpoint) => {
    if (!endpoint) return null;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      return 'https://' + endpoint;
    }
    return endpoint;
  };

  // Test function to check if QSwap contract exists
  const testQSwapContract = async () => {
    try {
      const endpoint = formatEndpoint(httpEndpoint);
      if (!endpoint) {
        console.error('No endpoint configured');
        return;
      }

      console.log('Testing QSwap contract existence...');
      
      // Test direct API call to see what we get
      const response = await fetch(`${endpoint}/v1/querySmartContract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractIndex: 13,
          inputType: 1,
          inputSize: 0,
          requestData: ''
        })
      });
      
      const data = await response.json();
      console.log('Direct QSwap API response:', data);
      
      if (data.responseData) {
        const binaryString = atob(data.responseData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('Response has data, length:', bytes.length);
        
        if (bytes.length >= 20) { // 5 uint32 values = 20 bytes
          const dv = new DataView(bytes.buffer);
          const decoded = {
            assetIssuanceFee: dv.getUint32(0, true),
            poolCreationFee: dv.getUint32(4, true),
            transferFee: dv.getUint32(8, true),
            swapRate: dv.getUint32(12, true),
            protocolRate: dv.getUint32(16, true)
          };
          console.log('Manually decoded fees:', decoded);
          setMessage('Contract found! Check console for fees');
        } else {
          console.log('Response too short for fee data');
        }
      } else {
        console.log('No responseData in API response - contract might not exist');
        setMessage('QSwap contract not found at index 13 on this network');
      }
    } catch (error) {
      console.error('Test failed:', error);
      setMessage('Error testing contract: ' + error.message);
    }
  };

  useEffect(() => {
    if (httpEndpoint) {
      loadFees();
    }
  }, [httpEndpoint]);

  const loadFees = async () => {
    try {
      const endpoint = formatEndpoint(httpEndpoint);
      if (!endpoint) {
        setMessage('No endpoint configured');
        return;
      }
      
      console.log('Loading fees from endpoint:', endpoint);
      const feeData = await getQswapFees(endpoint, qubicConnect?.qHelper);
      console.log('Raw fee data:', feeData);
      
      // Debug: Check what's in the raw response
      if (feeData && feeData.rawResponse) {
        console.log('Raw API response from QSwap contract:', feeData.rawResponse);
        console.log('Response data field:', feeData.rawResponse.responseData);
      }
      
      // Check if the response has the expected structure
      if (feeData && feeData.success && feeData.decodedFields) {
        setFees(feeData.decodedFields);
        setMessage(''); // Clear any error messages
      } else if (feeData && feeData.success === false) {
        console.error('Failed to load fees:', feeData.error);
        setMessage('Failed to load protocol fees: ' + feeData.error);
      } else if (feeData && feeData.message === 'No data returned from contract') {
        setMessage('QSwap contract not found or getFees function not implemented on this network');
      } else {
        console.warn('Unexpected fee data format:', feeData);
        setMessage('Unable to load fees - unexpected response format');
      }
    } catch (error) {
      console.error('Failed to load fees:', error);
      setMessage('Error loading protocol fees: ' + error.message);
    }
  };

  const loadPoolInfo = async () => {
    if (!assetIssuer || !assetName) {
      setMessage('Please enter asset issuer and name');
      return;
    }
    
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      console.log('Loading pool for:', { assetIssuer, assetName, assetNameUint64 });
      
      const info = await getPoolBasicState(httpEndpoint, assetIssuer, assetNameUint64, qubicConnect?.qHelper);
      console.log('Pool info response:', info);
      
      if (info && info.success && info.decodedFields) {
        setPoolInfo(info.decodedFields);
        
        // Load user liquidity if connected and pool exists
        if (isConnected && info.decodedFields.poolExists > 0) {
          const liquidity = await getLiquidityOf(
            httpEndpoint, 
            assetIssuer, 
            assetNameUint64, 
            qubicConnect.wallet.publicKey,
            qubicConnect?.qHelper
          );
          console.log('Liquidity response:', liquidity);
          
          if (liquidity && liquidity.success && liquidity.decodedFields) {
            setUserLiquidity(liquidity.decodedFields);
          }
        }
        
        setMessage('Pool info loaded');
      } else if (info && info.success === false) {
        setMessage(`Error: ${info.error}`);
        setPoolInfo(null);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      setPoolInfo(null);
    }
    setLoading(false);
  };

  const handleIssueAsset = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      setMessage('Please connect wallet first');
      return;
    }
    
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(issueForm.assetName);
      const uomUint64 = assetNameToUint64('TOKENS'); // Always use TOKENS
      
      console.log('Issuing asset with params:', {
        assetName: issueForm.assetName,
        assetNameUint64,
        numberOfShares: issueForm.numberOfShares,
        unitOfMeasurement: 'TOKENS',
        uomUint64,
        numberOfDecimalPlaces: parseInt(issueForm.numberOfDecimalPlaces)
      });
      
      const result = await issueAsset(
        qubicConnect,
        assetNameUint64,
        issueForm.numberOfShares,
        uomUint64,
        parseInt(issueForm.numberOfDecimalPlaces)
      );
      
      console.log('Asset issuance result:', result);
      
      if (result.success) {
        setMessage(`🎉 Asset "${issueForm.assetName}" issued successfully! 

Issuing token - please refresh in 30 seconds and check your balance on the left to see if the token was issued.

📋 Transaction Details:
• Asset Name: ${issueForm.assetName}
• Total Supply: ${parseInt(issueForm.numberOfShares).toLocaleString()} TOKENS
• Decimal Places: ${issueForm.numberOfDecimalPlaces}
• Transaction ID: ${result.txHash}
• Issuer: ${qubicConnect.wallet.publicKey}

You can now create a pool for this asset!`);
        
        // Reset form
        setIssueForm({
          assetName: '',
          numberOfShares: '',
          unitOfMeasurement: 'TOKENS',
          numberOfDecimalPlaces: ''
        });
      } else {
        setMessage(`Error issuing asset: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Asset issuance error:', error);
      setMessage(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleCreatePool = async () => {
    if (!isConnected) {
      setMessage('Please connect wallet first');
      return;
    }
    
    if (!assetIssuer || !assetName) {
      setMessage('Please enter asset issuer and name');
      return;
    }
    
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      const result = await createPool(qubicConnect, assetIssuer, assetNameUint64);
      setMessage(`Pool created successfully! TX: ${result.txHash}`);
      setTimeout(() => loadPoolInfo(), 2000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleAddLiquidity = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      setMessage('Please connect wallet first');
      return;
    }
    
    // Validation
    if (!assetName || !assetIssuer) {
      setMessage('Please select a pool first');
      return;
    }
    
    if (!liquidityForm.quAmountDesired || !liquidityForm.assetAmountDesired || 
        !liquidityForm.quAmountMin || !liquidityForm.assetAmountMin) {
      setMessage('Please fill in all liquidity amounts');
      return;
    }
    
    // Check if amounts are valid numbers
    const quDesired = parseFloat(liquidityForm.quAmountDesired);
    const assetDesired = parseFloat(liquidityForm.assetAmountDesired);
    const quMin = parseFloat(liquidityForm.quAmountMin);
    const assetMin = parseFloat(liquidityForm.assetAmountMin);
    
    if (quDesired <= 0 || assetDesired <= 0 || quMin <= 0 || assetMin <= 0) {
      setMessage('All amounts must be positive numbers');
      return;
    }
    
    if (quMin > quDesired || assetMin > assetDesired) {
      setMessage('Minimum amounts cannot be greater than desired amounts');
      return;
    }
    
    setLoading(true);
    setMessage('Adding liquidity... This may take a few moments.');
    
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      
      console.log('Add Liquidity Parameters:', {
        assetIssuer,
        assetName,
        assetNameUint64,
        quAmountDesired: liquidityForm.quAmountDesired,
        assetAmountDesired: liquidityForm.assetAmountDesired,
        quAmountMin: liquidityForm.quAmountMin,
        assetAmountMin: liquidityForm.assetAmountMin
      });
      
      const result = await addLiquidity(
        qubicConnect,
        assetIssuer,
        assetNameUint64,
        liquidityForm.quAmountDesired,
        liquidityForm.assetAmountDesired,
        liquidityForm.quAmountMin,
        liquidityForm.assetAmountMin
      );
      
      console.log('Add Liquidity Result:', result);
      
      if (result && result.success) {
        setMessage(`✅ Liquidity added successfully! 
        
Transaction ID: ${result.txHash}
Added: ${parseInt(liquidityForm.quAmountDesired).toLocaleString()} QU + ${parseInt(liquidityForm.assetAmountDesired).toLocaleString()} ${assetName}

Please wait 30-60 seconds for the transaction to be confirmed, then refresh the pool to see your new liquidity position.`);
        
        // Reset form
        setLiquidityForm({
          quAmountDesired: '',
          assetAmountDesired: '',
          quAmountMin: '',
          assetAmountMin: ''
        });
        
        // Reload pool info after a delay
        setTimeout(() => {
          setMessage('Refreshing pool data...');
          loadPoolInfo();
        }, 5000);
      } else {
        setMessage(`❌ Transaction failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Add Liquidity Error:', error);
      setMessage(`❌ Error adding liquidity: ${error.message}`);
    }
    setLoading(false);
  };

  const handleRemoveLiquidity = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      setMessage('Please connect wallet first');
      return;
    }
    
    // Validation
    if (!assetName || !assetIssuer) {
      setMessage('Please select a pool first');
      return;
    }
    
    if (!removeLiquidityForm.burnLiquidity || !removeLiquidityForm.quAmountMin || !removeLiquidityForm.assetAmountMin) {
      setMessage('Please fill in all removal amounts');
      return;
    }
    
    // Check if amounts are valid numbers
    const burnAmount = parseFloat(removeLiquidityForm.burnLiquidity);
    const quMin = parseFloat(removeLiquidityForm.quAmountMin);
    const assetMin = parseFloat(removeLiquidityForm.assetAmountMin);
    
    if (burnAmount <= 0 || quMin < 0 || assetMin < 0) {
      setMessage('Burn amount must be positive, minimums cannot be negative');
      return;
    }
    
    // Check if user has enough liquidity
    if (userLiquidity && userLiquidity.liquidity && burnAmount > userLiquidity.liquidity) {
      setMessage(`You only have ${userLiquidity.liquidity} liquidity tokens. Cannot burn ${burnAmount}.`);
      return;
    }
    
    setLoading(true);
    setMessage('Removing liquidity... This may take a few moments.');
    
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      
      console.log('Remove Liquidity Parameters:', {
        assetIssuer,
        assetName,
        assetNameUint64,
        burnLiquidity: removeLiquidityForm.burnLiquidity,
        quAmountMin: removeLiquidityForm.quAmountMin,
        assetAmountMin: removeLiquidityForm.assetAmountMin
      });
      
      const result = await removeLiquidity(
        qubicConnect,
        assetIssuer,
        assetNameUint64,
        removeLiquidityForm.burnLiquidity,
        removeLiquidityForm.quAmountMin,
        removeLiquidityForm.assetAmountMin
      );
      
      console.log('Remove Liquidity Result:', result);
      
      if (result && result.success) {
        setMessage(`✅ Liquidity removed successfully! 
        
Transaction ID: ${result.txHash}
Burned: ${parseInt(removeLiquidityForm.burnLiquidity).toLocaleString()} LP tokens

You will receive your QU and ${assetName} tokens back. Please wait 30-60 seconds for the transaction to be confirmed, then refresh the pool to see your updated position.`);
        
        // Reset form
        setRemoveLiquidityForm({
          burnLiquidity: '',
          quAmountMin: '',
          assetAmountMin: ''
        });
        
        // Reload pool info after a delay
        setTimeout(() => {
          setMessage('Refreshing pool data...');
          loadPoolInfo();
        }, 5000);
      } else {
        setMessage(`❌ Transaction failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Remove Liquidity Error:', error);
      setMessage(`❌ Error removing liquidity: ${error.message}`);
    }
    setLoading(false);
  };

  const handleGetQuote = async () => {
    if (!assetIssuer || !assetName || !swapForm.inputAmount) {
      setMessage('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      let quote;
      
      console.log('Getting quote for:', {
        inputType: swapForm.inputType,
        inputAmount: swapForm.inputAmount,
        assetName,
        assetNameUint64,
        assetIssuer
      });
      
      if (swapForm.inputType === 'qu') {
        quote = await quoteExactQuInput(
          httpEndpoint,
          assetIssuer,
          assetNameUint64,
          swapForm.inputAmount,
          qubicConnect?.qHelper
        );
        console.log('QU → Asset quote response:', quote);
      } else {
        quote = await quoteExactAssetInput(
          httpEndpoint,
          assetIssuer,
          assetNameUint64,
          swapForm.inputAmount,
          qubicConnect?.qHelper
        );
        console.log('Asset → QU quote response:', quote);
      }
      
      if (quote && quote.success && quote.decodedFields) {
        console.log('Quote decoded fields:', quote.decodedFields);
        setSwapForm({ ...swapForm, quote: quote.decodedFields });
        setMessage('Quote received successfully');
      } else {
        console.error('Quote failed or has unexpected structure:', quote);
        setMessage(`Quote failed: ${quote?.error || 'Unexpected response structure'}`);
      }
    } catch (error) {
      console.error('Quote error:', error);
      setMessage(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleSwap = async () => {
    if (!isConnected) {
      setMessage('Please connect wallet first');
      return;
    }
    
    if (!swapForm.quote) {
      setMessage('Please get a quote first');
      return;
    }
    
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      let result;
      
      if (swapForm.inputType === 'qu') {
        result = await swapExactQuForAsset(
          qubicConnect,
          assetIssuer,
          assetNameUint64,
          swapForm.inputAmount,
          swapForm.outputMin || '0'
        );
      } else {
        // Add swapExactAssetForQu implementation when available
        setMessage('Asset to QU swap not yet implemented');
        setLoading(false);
        return;
      }
      
      if (result && result.success) {
        setMessage(`✅ Swap successful! You now have ${assetName} tokens. 
        
Transaction ID: ${result.txHash}
Swapped: ${parseInt(swapForm.inputAmount).toLocaleString()} QU for ${assetName}

🎉 You can now add liquidity below! Your wallet will update in 30-60 seconds.`);
        
        // Reset swap form
        setSwapForm({
          inputType: 'qu',
          inputAmount: '',
          outputMin: '',
          quote: null
        });
        
        // Refresh pool info after a delay to show updated reserves
        setTimeout(() => {
          setMessage('Refreshing pool data...');
          loadPoolInfo();
        }, 5000);
      } else {
        setMessage(`❌ Swap failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleSelectExistingPool = async (pool) => {
    setAssetName(pool.assetName);
    setAssetIssuer(pool.assetIssuer);
    setMessage(`Loading ${pool.assetName} pool data...`);
    
    // Set loading state for this specific pool
    setLoadingPoolId(pool.id);
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(pool.assetName);
      console.log('Loading pool for:', { assetIssuer: pool.assetIssuer, assetName: pool.assetName, assetNameUint64 });
      
      const info = await getPoolBasicState(httpEndpoint, pool.assetIssuer, assetNameUint64, qubicConnect?.qHelper);
      console.log('Pool info response:', info);
      
      if (info && info.success && info.decodedFields) {
        setPoolInfo(info.decodedFields);
        
        // Load user liquidity if connected and pool exists
        if (isConnected && info.decodedFields.poolExists > 0) {
          const liquidity = await getLiquidityOf(
            httpEndpoint, 
            pool.assetIssuer, 
            assetNameUint64, 
            qubicConnect.wallet.publicKey,
            qubicConnect?.qHelper
          );
          console.log('Liquidity response:', liquidity);
          
          if (liquidity && liquidity.success && liquidity.decodedFields) {
            setUserLiquidity(liquidity.decodedFields);
          }
        }
        
        if (info.decodedFields.poolExists > 0) {
          setMessage(`✅ ${pool.assetName} pool loaded successfully! You can now add liquidity or swap tokens.`);
        } else {
          setMessage(`⚠️ ${pool.assetName} pool doesn't exist yet. You can create it using the button below.`);
        }
      } else if (info && info.success === false) {
        setMessage(`❌ Error loading ${pool.assetName}: ${info.error}`);
        setPoolInfo(null);
      }
    } catch (error) {
      setMessage(`❌ Error loading ${pool.assetName}: ${error.message}`);
      setPoolInfo(null);
    }
    setLoadingPoolId(null);
    setLoading(false);
  };

  return (
    <div className="qswap-container">
      <h1>QSwap DEX</h1>
      
      {!isConnected && (
        <div className="warning-box">
          Please connect your wallet to use QSwap
        </div>
      )}
      
      {!fees ? (
        <div className="fees-info">
          <h3>Protocol Fees</h3>
          <div className="fee-grid">
            <div>Asset Issuance: Loading...</div>
            <div>Pool Creation: Loading...</div>
            <div>Transfer Fee: Loading...</div>
            <div>Swap Fee: Loading...</div>
            <div>Protocol Fee: Loading...</div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={loadFees} style={{ marginRight: '1rem' }}>
              Reload Fees
            </button>
            <button onClick={testQSwapContract}>
              Test Contract
            </button>
          </div>
          {message && message.includes('fees') && (
            <div className="fee-error">{message}</div>
          )}
        </div>
      ) : (
        <div className="fees-info">
          <h3>Protocol Fees</h3>
          <div className="fee-grid">
            <div>Asset Issuance: {fees.assetIssuanceFee ? fees.assetIssuanceFee.toLocaleString() : '0'} QU</div>
            <div>Pool Creation: {fees.poolCreationFee ? fees.poolCreationFee.toLocaleString() : '0'} QU</div>
            <div>Transfer Fee: {fees.transferFee ? fees.transferFee.toLocaleString() : '0'} QU</div>
            <div>Swap Fee: {fees.swapFee ? (fees.swapFee / 10000).toFixed(2) : '0.00'}%</div>
            <div>Protocol Fee: {fees.protocolFee ? (fees.protocolFee / 100).toFixed(2) : '0.00'}%</div>
          </div>
        </div>
      )}
      
      <div className="tabs">
        <button 
          className={activeTab === 'pools' ? 'active' : ''}
          onClick={() => setActiveTab('pools')}
        >
          Pools
        </button>
        <button 
          className={activeTab === 'liquidity' ? 'active' : ''}
          onClick={() => setActiveTab('liquidity')}
        >
          Liquidity
        </button>
        <button 
          className={activeTab === 'swap' ? 'active' : ''}
          onClick={() => setActiveTab('swap')}
        >
          Swap
        </button>
        <button 
          className={activeTab === 'issue' ? 'active' : ''}
          onClick={() => setActiveTab('issue')}
        >
          Issue Asset
        </button>
      </div>
      
      {message && (
        <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      
      <div className="tab-content">
        {activeTab === 'pools' && (
          <div className="pools-section">
            <h2>Pool Information & Discovery</h2>
            
            {/* Existing/Community Pools Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>🏊 Popular Pools</h3>
              <div style={{ 
                background: '#1e3a8a', 
                border: '1px solid #3b82f6', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginBottom: '1rem' 
              }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#93c5fd', fontSize: '0.9rem' }}>
                  <strong>What are pools?</strong> Pools contain pairs of QU (Qubic's native currency) and other tokens. 
                  They enable trading between QU and tokens, and let you earn fees by providing liquidity.
                </p>
                <p style={{ margin: '0', color: '#93c5fd', fontSize: '0.9rem' }}>
                  💡 <strong>Want your pool listed?</strong> Contact us to add your pool to this list for easier discovery!
                </p>
              </div>
              
              <div className="existing-pools-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {existingPools.map((pool) => (
                  <div key={pool.id} style={{
                    background: loadingPoolId === pool.id ? '#1e3a8a' : '#374151',
                    border: loadingPoolId === pool.id ? '1px solid #61f0fe' : '1px solid #4b5563',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: loadingPoolId === pool.id ? 'wait' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: loadingPoolId && loadingPoolId !== pool.id ? 0.5 : 1,
                    pointerEvents: loadingPoolId ? 'none' : 'auto'
                  }}
                  onClick={() => !loadingPoolId && handleSelectExistingPool(pool)}
                  onMouseEnter={(e) => {
                    if (!loadingPoolId) {
                      e.target.style.borderColor = '#61f0fe';
                      e.target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loadingPoolId) {
                      e.target.style.borderColor = '#4b5563';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: '0', color: '#61f0fe', fontSize: '1.1rem' }}>
                        {pool.assetName}
                        {loadingPoolId === pool.id && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#93c5fd' }}>
                            Loading...
                          </span>
                        )}
                      </h4>
                      <span style={{ 
                        background: loadingPoolId === pool.id ? '#61f0fe' : '#10b981', 
                        color: loadingPoolId === pool.id ? '#111827' : 'white', 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {loadingPoolId === pool.id ? 'LOADING' : pool.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#d1d5db', fontSize: '0.9rem' }}>{pool.description}</p>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      <div>Added by: {pool.addedBy}</div>
                      <div>Est. Liquidity: {parseInt(pool.estimatedLiquidity).toLocaleString()} QU</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manual Pool Search Section */}
            <div>
              <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>🔍 Search Any Pool</h3>
              <div style={{ 
                background: '#1e3a8a', 
                border: '1px solid #3b82f6', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginBottom: '1rem' 
              }}>
                <p style={{ margin: '0', color: '#93c5fd', fontSize: '0.9rem' }}>
                  Know a specific pool? Enter the asset details below to load any pool on the network.
                </p>
              </div>
              
              <div className="pool-search">
                <input
                  type="text"
                  placeholder="Asset Name (max 8 chars)"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  maxLength={8}
                />
                <input
                  type="text"
                  placeholder="Asset Issuer (60 char Qubic address)"
                  value={assetIssuer}
                  onChange={(e) => setAssetIssuer(e.target.value)}
                />
                <button onClick={loadPoolInfo} disabled={loading}>
                  {loading ? 'Loading...' : 'Load Pool Info'}
                </button>
              </div>
              
              {/* Pool Actions Section */}
              <div style={{ 
                background: '#374151', 
                border: '1px solid #4b5563', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1rem' }}>🔄 Pool Actions</h4>
                  <p style={{ margin: '0 0 1rem 0', color: '#9ca3af', fontSize: '0.85rem' }}>
                    {assetName && assetIssuer ? 
                      `Ready to work with ${assetName} pool` : 
                      'Enter asset details above or select from popular pools'
                    }
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                    onClick={handleCreatePool} 
                    disabled={loading || !assetName || !assetIssuer || !isConnected}
                    style={{
                      padding: '0.5rem 1rem',
                      background: !isConnected ? '#6b7280' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: !isConnected || loading || !assetName || !assetIssuer ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      opacity: !isConnected || loading || !assetName || !assetIssuer ? 0.6 : 1,
                      transition: 'background-color 0.3s ease'
                    }}
                    title={!isConnected ? 'Connect wallet to create pools' : 
                           (!assetName || !assetIssuer) ? 'Enter asset details first' : 
                           'Create a new trading pool'}
                  >
                    {loading ? 'Creating...' : '+ Create Pool'}
                  </button>
                  {!isConnected && (
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      (Connect wallet)
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {poolInfo && (
              <div className="pool-info">
                {poolInfo.poolExists && poolInfo.poolExists > 0 ? (
                  <>
                    <h3>Pool Details for {assetName}</h3>
                    <div className="info-grid">
                      <div>QU Reserve: {poolInfo.reservedQuAmount ? poolInfo.reservedQuAmount.toLocaleString() : '0'}</div>
                      <div>Asset Reserve: {poolInfo.reservedAssetAmount ? poolInfo.reservedAssetAmount.toLocaleString() : '0'}</div>
                      <div>Total Liquidity: {poolInfo.totalLiquidity ? poolInfo.totalLiquidity.toLocaleString() : '0'}</div>
                      {userLiquidity && (
                        <div>Your Liquidity: {userLiquidity.liquidity ? userLiquidity.liquidity.toLocaleString() : '0'}</div>
                      )}
                    </div>

                    {/* Quick Swap Section */}
                    <div style={{ 
                      background: '#1e3a8a', 
                      border: '1px solid #3b82f6', 
                      borderRadius: '8px', 
                      padding: '1.5rem', 
                      marginTop: '1.5rem' 
                    }}>
                      <h3 style={{ margin: '0 0 1rem 0', color: '#93c5fd' }}>🔄 Swap {assetName} ↔ QU</h3>
                      
                      <div className="swap-type" style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginRight: '1rem', marginBottom: '0.5rem' }}>
                          <input
                            type="radio"
                            value="qu"
                            checked={swapForm.inputType === 'qu'}
                            onChange={(e) => setSwapForm({...swapForm, inputType: e.target.value, quote: null})}
                            style={{ marginRight: '0.5rem' }}
                          />
                          QU → {assetName} <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>(Buy {assetName})</span>
                        </label>
                        <label style={{ display: 'block' }}>
                          <input
                            type="radio"
                            value="asset"
                            checked={swapForm.inputType === 'asset'}
                            onChange={(e) => setSwapForm({...swapForm, inputType: e.target.value, quote: null})}
                            style={{ marginRight: '0.5rem' }}
                          />
                          {assetName} → QU <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>(Sell {assetName})</span>
                        </label>
                      </div>
                      
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                          Amount to Swap
                        </label>
                        <input
                          type="number"
                          placeholder={`${swapForm.inputType === 'qu' ? 'QU' : assetName} Amount`}
                          value={swapForm.inputAmount}
                          onChange={(e) => setSwapForm({...swapForm, inputAmount: e.target.value, quote: null})}
                          style={{ marginBottom: '0.5rem' }}
                        />
                        <small style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem' }}>
                          Amount of {swapForm.inputType === 'qu' ? 'QU' : assetName} you want to swap
                        </small>
                      </div>
                      
                      <button 
                        onClick={handleGetQuote} 
                        disabled={loading || !swapForm.inputAmount}
                        style={{
                          marginRight: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: loading || !swapForm.inputAmount ? '#6b7280' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading || !swapForm.inputAmount ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {loading ? 'Getting Quote...' : 'Get Quote'}
                      </button>
                      
                      {swapForm.quote && (
                        <div style={{ 
                          background: '#064e3b', 
                          border: '1px solid #059669', 
                          borderRadius: '6px', 
                          padding: '1rem', 
                          marginTop: '1rem' 
                        }}>
                          <div style={{ color: '#6ee7b7', marginBottom: '1rem' }}>
                            <strong>Quote: {swapForm.inputAmount} {swapForm.inputType === 'qu' ? 'QU' : assetName} → ~{swapForm.inputType === 'qu' ? swapForm.quote.assetAmountOut : swapForm.quote.quAmountOut} {swapForm.inputType === 'qu' ? assetName : 'QU'}</strong>
                          </div>
                          
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                              Minimum Output (Slippage Protection)
                            </label>
                            <input
                              type="number"
                              placeholder="Leave empty for 5% tolerance"
                              value={swapForm.outputMin}
                              onChange={(e) => setSwapForm({...swapForm, outputMin: e.target.value})}
                              style={{ marginBottom: '0.5rem' }}
                            />
                            <small style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem' }}>
                              If output falls below this amount, transaction will fail. 
                              Recommended: {Math.round((swapForm.inputType === 'qu' ? swapForm.quote.assetAmountOut : swapForm.quote.quAmountOut) * 0.95)} (5% tolerance)
                            </small>
                          </div>
                          
                          <button 
                            onClick={handleSwap} 
                            disabled={loading || !isConnected}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: loading || !isConnected ? '#6b7280' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: loading || !isConnected ? 'not-allowed' : 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            {loading ? 'Swapping...' : `Swap ${swapForm.inputAmount} ${swapForm.inputType === 'qu' ? 'QU' : assetName} for ${swapForm.inputType === 'qu' ? assetName : 'QU'}`}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>Pool does not exist. Click "Create Pool" to create it.</div>
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'liquidity' && (
          <div className="liquidity-section">
            <h2>Manage Liquidity</h2>
            
            {/* Liquidity Explanation */}
            <div style={{ 
              background: '#1e3a8a', 
              border: '1px solid #3b82f6', 
              borderRadius: '8px', 
              padding: '1.5rem', 
              marginBottom: '2rem' 
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#93c5fd' }}>💧 What is Liquidity?</h3>
              <div style={{ color: '#93c5fd', fontSize: '0.9rem', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 1rem 0' }}>
                  <strong>Liquidity</strong> means putting your QU and tokens into a pool so others can trade. 
                  When you add liquidity, you become a "liquidity provider" and earn fees from every trade!
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
                  <div style={{ background: '#064e3b', padding: '1rem', borderRadius: '6px', border: '1px solid #059669' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#6ee7b7' }}>✅ Benefits</h4>
                    <ul style={{ margin: '0', paddingLeft: '1.2rem', color: '#a7f3d0' }}>
                      <li>Earn trading fees (passive income)</li>
                      <li>Support the ecosystem</li>
                      <li>Help enable trading for others</li>
                    </ul>
                  </div>
                  
                  <div style={{ background: '#7f1d1d', padding: '1rem', borderRadius: '6px', border: '1px solid #dc2626' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#fca5a5' }}>⚠️ Risks</h4>
                    <ul style={{ margin: '0', paddingLeft: '1.2rem', color: '#fbb' }}>
                      <li>Impermanent loss (if prices change)</li>
                      <li>Both assets are locked together</li>
                      <li>Can't withdraw only one asset type</li>
                    </ul>
                  </div>
                </div>
                
                <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  💡 <strong>How it works:</strong> You deposit equal values of QU and tokens. 
                  The pool gives you LP (Liquidity Provider) tokens representing your share. 
                  When you want to exit, you trade back your LP tokens for your portion of the pool.
                </p>
              </div>
            </div>

            {poolInfo && poolInfo.poolExists && poolInfo.poolExists > 0 ? (
              <>
                {/* Current Pool Status */}
                <div style={{ 
                  background: '#374151', 
                  border: '1px solid #4b5563', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffffff' }}>Current Pool: {assetName}/QU</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div style={{ color: '#d1d5db' }}>QU Reserve: {poolInfo.reservedQuAmount ? poolInfo.reservedQuAmount.toLocaleString() : '0'}</div>
                    <div style={{ color: '#d1d5db' }}>Asset Reserve: {poolInfo.reservedAssetAmount ? poolInfo.reservedAssetAmount.toLocaleString() : '0'}</div>
                    {userLiquidity && (
                      <div style={{ color: '#61f0fe', fontWeight: 'bold' }}>Your Liquidity: {userLiquidity.liquidity ? userLiquidity.liquidity.toLocaleString() : '0'}</div>
                    )}
                  </div>
                </div>

                {/* Asset Ownership Warning */}
                <div style={{ 
                  background: '#7f1d1d', 
                  border: '1px solid #dc2626', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#fca5a5' }}>⚠️ Important: Check Your Assets First!</h4>
                  <div style={{ color: '#fecaca', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>You must own {assetName} tokens before adding liquidity.</strong> Check your wallet's "Possessed Assets" section to see what you own.
                    </p>
                    <p style={{ margin: '0' }}>
                      Don't have {assetName}? Go to the Pools tab and use the swap section to buy some with QU first.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddLiquidity}>
                  <h3>Add Liquidity</h3>
                  <div style={{ 
                    background: '#451a03', 
                    border: '1px solid #d97706', 
                    borderRadius: '6px', 
                    padding: '0.75rem', 
                    marginBottom: '1rem' 
                  }}>
                    <p style={{ margin: '0', color: '#fbbf24', fontSize: '0.85rem' }}>
                      ⚖️ <strong>Important:</strong> You must provide equal USD values of both tokens. 
                      The pool will automatically calculate the ratio. If prices have changed since pool creation, 
                      you might need to adjust your amounts.
                    </p>
                  </div>
                  
                  {/* Example calculations */}
                  {poolInfo && poolInfo.reservedQuAmount > 0 && poolInfo.reservedAssetAmount > 0 && (
                    <div style={{ 
                      background: '#064e3b', 
                      border: '1px solid #059669', 
                      borderRadius: '6px', 
                      padding: '1rem', 
                      marginBottom: '1rem' 
                    }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#6ee7b7', fontSize: '0.9rem' }}>💡 Current Pool Ratio</h4>
                      <div style={{ color: '#a7f3d0', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          Current rate: 1 {assetName} = {(poolInfo.reservedQuAmount / poolInfo.reservedAssetAmount).toFixed(2)} QU
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Examples for different amounts:</strong>
                        </div>
                        <div style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>
                          <div>• Add 1,000 QU → Need ~{Math.round(1000 / (poolInfo.reservedQuAmount / poolInfo.reservedAssetAmount))} {assetName}</div>
                          <div>• Add 100 {assetName} → Need ~{Math.round(100 * (poolInfo.reservedQuAmount / poolInfo.reservedAssetAmount))} QU</div>
                          <div>• Add 10,000 QU → Need ~{Math.round(10000 / (poolInfo.reservedQuAmount / poolInfo.reservedAssetAmount))} {assetName}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                      QU Amount Desired
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1000"
                      value={liquidityForm.quAmountDesired}
                      onChange={(e) => {
                        const quAmount = e.target.value;
                        setLiquidityForm({...liquidityForm, quAmountDesired: quAmount});
                        
                        // Auto-calculate asset amount based on pool ratio
                        if (quAmount && poolInfo && poolInfo.reservedQuAmount > 0 && poolInfo.reservedAssetAmount > 0) {
                          const ratio = poolInfo.reservedAssetAmount / poolInfo.reservedQuAmount;
                          const suggestedAssetAmount = Math.round(parseFloat(quAmount) * ratio);
                          setLiquidityForm(prev => ({...prev, 
                            quAmountDesired: quAmount,
                            assetAmountDesired: suggestedAssetAmount.toString()
                          }));
                        }
                      }}
                      required
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                      Amount of QU tokens you want to add to the pool
                    </small>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                      {assetName} Amount Desired
                    </label>
                    <input
                      type="number"
                      placeholder={poolInfo && poolInfo.reservedQuAmount > 0 ? 
                        `Auto-calculated based on pool ratio` : 
                        `e.g. ${Math.round(Math.random() * 100)}`}
                      value={liquidityForm.assetAmountDesired}
                      onChange={(e) => {
                        const assetAmount = e.target.value;
                        setLiquidityForm({...liquidityForm, assetAmountDesired: assetAmount});
                        
                        // Auto-calculate QU amount based on pool ratio
                        if (assetAmount && poolInfo && poolInfo.reservedQuAmount > 0 && poolInfo.reservedAssetAmount > 0) {
                          const ratio = poolInfo.reservedQuAmount / poolInfo.reservedAssetAmount;
                          const suggestedQuAmount = Math.round(parseFloat(assetAmount) * ratio);
                          setLiquidityForm(prev => ({...prev, 
                            assetAmountDesired: assetAmount,
                            quAmountDesired: suggestedQuAmount.toString()
                          }));
                        }
                      }}
                      required
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                      Amount of {assetName} tokens you want to add to the pool
                    </small>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                      QU Amount Min (Slippage Protection)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 950 (5% below desired)"
                      value={liquidityForm.quAmountMin}
                      onChange={(e) => setLiquidityForm({...liquidityForm, quAmountMin: e.target.value})}
                      required
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                      Minimum QU you'll accept (recommended: 95% of desired amount)
                      {liquidityForm.quAmountDesired && (
                        <span style={{ color: '#61f0fe', marginLeft: '0.5rem' }}>
                          Suggested: {Math.round(parseFloat(liquidityForm.quAmountDesired) * 0.95)}
                        </span>
                      )}
                    </small>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                      {assetName} Amount Min (Slippage Protection)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 95 (5% below desired)"
                      value={liquidityForm.assetAmountMin}
                      onChange={(e) => setLiquidityForm({...liquidityForm, assetAmountMin: e.target.value})}
                      required
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                      Minimum {assetName} you'll accept (recommended: 95% of desired amount)
                      {liquidityForm.assetAmountDesired && (
                        <span style={{ color: '#61f0fe', marginLeft: '0.5rem' }}>
                          Suggested: {Math.round(parseFloat(liquidityForm.assetAmountDesired) * 0.95)}
                        </span>
                      )}
                    </small>
                  </div>
                  
                  {/* Pre-flight check */}
                  {liquidityForm.quAmountDesired && liquidityForm.assetAmountDesired && (
                    <div style={{ 
                      background: '#1e3a8a', 
                      border: '1px solid #3b82f6', 
                      borderRadius: '6px', 
                      padding: '1rem', 
                      marginBottom: '1rem' 
                    }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#93c5fd', fontSize: '0.9rem' }}>📋 Transaction Summary</h4>
                      <div style={{ color: '#93c5fd', fontSize: '0.85rem', lineHeight: '1.3' }}>
                        <div>You're adding: {parseInt(liquidityForm.quAmountDesired).toLocaleString()} QU + {parseInt(liquidityForm.assetAmountDesired).toLocaleString()} {assetName}</div>
                        <div>Minimum acceptable: {liquidityForm.quAmountMin || '0'} QU + {liquidityForm.assetAmountMin || '0'} {assetName}</div>
                        {poolInfo && poolInfo.reservedQuAmount > 0 && (
                          <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                            This will give you ~{((parseFloat(liquidityForm.quAmountDesired) / poolInfo.reservedQuAmount) * 100).toFixed(2)}% of the pool
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <button type="submit" disabled={loading}>
                    {loading ? 'Adding Liquidity...' : 'Add Liquidity'}
                  </button>
                </form>

                {/* Remove Liquidity Section */}
                {userLiquidity && userLiquidity.liquidity && userLiquidity.liquidity > 0 && (
                  <div style={{ marginTop: '3rem' }}>
                    <h3>Remove Liquidity</h3>
                    
                    <div style={{ 
                      background: '#451a03', 
                      border: '1px solid #d97706', 
                      borderRadius: '6px', 
                      padding: '0.75rem', 
                      marginBottom: '1rem' 
                    }}>
                      <p style={{ margin: '0', color: '#fbbf24', fontSize: '0.85rem' }}>
                        💼 <strong>Your Position:</strong> You have {userLiquidity.liquidity.toLocaleString()} liquidity tokens in this pool.
                        Removing liquidity will give you back both QU and {assetName} proportionally.
                      </p>
                    </div>

                    <form onSubmit={handleRemoveLiquidity}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                          Liquidity Tokens to Burn
                        </label>
                        <input
                          type="number"
                          placeholder={`Max: ${userLiquidity.liquidity} (your total position)`}
                          value={removeLiquidityForm.burnLiquidity}
                          onChange={(e) => setRemoveLiquidityForm({...removeLiquidityForm, burnLiquidity: e.target.value})}
                          max={userLiquidity.liquidity}
                          required
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button 
                            type="button"
                            onClick={() => setRemoveLiquidityForm({...removeLiquidityForm, burnLiquidity: Math.round(userLiquidity.liquidity * 0.25).toString()})}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            25%
                          </button>
                          <button 
                            type="button"
                            onClick={() => setRemoveLiquidityForm({...removeLiquidityForm, burnLiquidity: Math.round(userLiquidity.liquidity * 0.5).toString()})}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            50%
                          </button>
                          <button 
                            type="button"
                            onClick={() => setRemoveLiquidityForm({...removeLiquidityForm, burnLiquidity: Math.round(userLiquidity.liquidity * 0.75).toString()})}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            75%
                          </button>
                          <button 
                            type="button"
                            onClick={() => setRemoveLiquidityForm({...removeLiquidityForm, burnLiquidity: userLiquidity.liquidity.toString()})}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            MAX
                          </button>
                        </div>
                        <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                          Number of LP tokens to burn. This determines how much of your position to remove.
                        </small>
                      </div>

                      {/* Estimated output calculation */}
                      {removeLiquidityForm.burnLiquidity && poolInfo && (
                        <div style={{ 
                          background: '#1e3a8a', 
                          border: '1px solid #3b82f6', 
                          borderRadius: '6px', 
                          padding: '1rem', 
                          marginBottom: '1rem' 
                        }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: '#93c5fd', fontSize: '0.9rem' }}>📊 Estimated Output</h4>
                          <div style={{ color: '#93c5fd', fontSize: '0.85rem', lineHeight: '1.3' }}>
                            {(() => {
                              const burnAmount = parseFloat(removeLiquidityForm.burnLiquidity);
                              const userShare = burnAmount / poolInfo.totalLiquidity;
                              const estimatedQU = Math.floor(poolInfo.reservedQuAmount * userShare);
                              const estimatedAsset = Math.floor(poolInfo.reservedAssetAmount * userShare);
                              return (
                                <>
                                  <div>You'll receive approximately:</div>
                                  <div style={{ margin: '0.5rem 0', fontWeight: 'bold' }}>
                                    • {estimatedQU.toLocaleString()} QU ({(userShare * 100).toFixed(2)}% of pool)
                                  </div>
                                  <div style={{ fontWeight: 'bold' }}>
                                    • {estimatedAsset.toLocaleString()} {assetName}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                          Minimum QU (Slippage Protection)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 900 (minimum QU you'll accept)"
                          value={removeLiquidityForm.quAmountMin}
                          onChange={(e) => setRemoveLiquidityForm({...removeLiquidityForm, quAmountMin: e.target.value})}
                          required
                        />
                        <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                          Minimum QU you'll accept (recommended: 95% of estimated amount)
                        </small>
                      </div>
                      
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                          Minimum {assetName} (Slippage Protection)
                        </label>
                        <input
                          type="number"
                          placeholder={`e.g. 90 (minimum ${assetName} you'll accept)`}
                          value={removeLiquidityForm.assetAmountMin}
                          onChange={(e) => setRemoveLiquidityForm({...removeLiquidityForm, assetAmountMin: e.target.value})}
                          required
                        />
                        <small style={{ display: 'block', marginTop: '0.25rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                          Minimum {assetName} you'll accept (recommended: 95% of estimated amount)
                        </small>
                      </div>
                      
                      <button 
                        type="submit" 
                        disabled={loading}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: loading ? '#6b7280' : '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {loading ? 'Removing Liquidity...' : 'Remove Liquidity'}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div style={{ 
                background: '#374151', 
                border: '1px solid #4b5563', 
                borderRadius: '8px', 
                padding: '2rem', 
                textAlign: 'center' 
              }}>
                <h3 style={{ color: '#9ca3af', margin: '0 0 1rem 0' }}>No Pool Selected</h3>
                <p style={{ color: '#6b7280', margin: '0' }}>
                  Please select a pool from the Pools tab first, then come back here to manage liquidity.
                </p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'swap' && (
          <div className="swap-section">
            <h2>Swap Tokens</h2>
            
            {/* Swap Explanation */}
            <div style={{ 
              background: '#1e3a8a', 
              border: '1px solid #3b82f6', 
              borderRadius: '8px', 
              padding: '1.5rem', 
              marginBottom: '2rem' 
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#93c5fd' }}>🔄 What is Swapping?</h3>
              <div style={{ color: '#93c5fd', fontSize: '0.9rem', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 1rem 0' }}>
                  <strong>Swapping</strong> lets you exchange one token for another instantly using liquidity pools. 
                  No need to find someone to trade with - the pool handles everything automatically!
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
                  <div style={{ background: '#064e3b', padding: '1rem', borderRadius: '6px', border: '1px solid #059669' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#6ee7b7' }}>How it Works</h4>
                    <ol style={{ margin: '0', paddingLeft: '1.2rem', color: '#a7f3d0' }}>
                      <li>Choose what to swap (QU ↔ Token)</li>
                      <li>Enter amount you want to trade</li>
                      <li>Get instant quote</li>
                      <li>Confirm and execute swap</li>
                    </ol>
                  </div>
                  
                  <div style={{ background: '#451a03', padding: '1rem', borderRadius: '6px', border: '1px solid #d97706' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#fbbf24' }}>⚠️ Things to Know</h4>
                    <ul style={{ margin: '0', paddingLeft: '1.2rem', color: '#fed7aa' }}>
                      <li>Each swap pays a small fee</li>
                      <li>Large swaps may get worse rates</li>
                      <li>Prices update constantly</li>
                      <li>Set slippage tolerance wisely</li>
                    </ul>
                  </div>
                </div>
                
                <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  💡 <strong>Slippage:</strong> The difference between expected and actual price due to price movement during your transaction. 
                  Higher slippage tolerance = transaction more likely to succeed but potentially worse price.
                </p>
              </div>
            </div>

            {/* Pool Selection */}
            {(!poolInfo || !poolInfo.poolExists || poolInfo.poolExists === 0) && (
              <div style={{ 
                background: '#374151', 
                border: '1px solid #4b5563', 
                borderRadius: '8px', 
                padding: '2rem', 
                textAlign: 'center',
                marginBottom: '2rem'
              }}>
                <h3 style={{ color: '#9ca3af', margin: '0 0 1rem 0' }}>Select a Pool First</h3>
                <p style={{ color: '#6b7280', margin: '0 0 1rem 0' }}>
                  You need to select a trading pool before you can swap. Go to the Pools tab to choose one.
                </p>
                <button
                  onClick={() => setActiveTab('pools')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Go to Pools
                </button>
              </div>
            )}

            {poolInfo && poolInfo.poolExists && poolInfo.poolExists > 0 ? (
              <>
                {/* Current Pool Status */}
                <div style={{ 
                  background: '#374151', 
                  border: '1px solid #4b5563', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffffff' }}>Trading Pair: {assetName}/QU</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div style={{ color: '#d1d5db' }}>Available QU: {poolInfo.reservedQuAmount ? poolInfo.reservedQuAmount.toLocaleString() : '0'}</div>
                    <div style={{ color: '#d1d5db' }}>Available {assetName}: {poolInfo.reservedAssetAmount ? poolInfo.reservedAssetAmount.toLocaleString() : '0'}</div>
                    <div style={{ color: '#61f0fe' }}>
                      Current Rate: {poolInfo.reservedQuAmount && poolInfo.reservedAssetAmount ? 
                        (poolInfo.reservedQuAmount / poolInfo.reservedAssetAmount).toFixed(4) : '0'} QU per {assetName}
                    </div>
                  </div>
                </div>

                <div className="swap-form">
                  <h3>Choose Swap Direction</h3>
                  <div className="swap-type">
                    <label>
                      <input
                        type="radio"
                        value="qu"
                        checked={swapForm.inputType === 'qu'}
                        onChange={(e) => setSwapForm({...swapForm, inputType: e.target.value, quote: null})}
                      />
                      QU → {assetName} <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>(Buy {assetName} with QU)</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="asset"
                        checked={swapForm.inputType === 'asset'}
                        onChange={(e) => setSwapForm({...swapForm, inputType: e.target.value, quote: null})}
                      />
                      {assetName} → QU <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>(Sell {assetName} for QU)</span>
                    </label>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                      Amount to Swap
                    </label>
                    <input
                      type="number"
                      placeholder={`${swapForm.inputType === 'qu' ? 'QU' : assetName} Amount`}
                      value={swapForm.inputAmount}
                      onChange={(e) => setSwapForm({...swapForm, inputAmount: e.target.value, quote: null})}
                    />
                  </div>
                  
                  <button onClick={handleGetQuote} disabled={loading || !swapForm.inputAmount}>
                    {loading ? 'Getting Quote...' : 'Get Quote'}
                  </button>
                  
                  {swapForm.quote && (
                    <div className="quote-info">
                      <h4 style={{ margin: '0 0 1rem 0', color: '#61f0fe' }}>Quote Results</h4>
                      <div style={{ marginBottom: '1rem' }}>
                        <strong>You'll receive approximately: </strong>
                        {swapForm.inputType === 'qu' 
                          ? `${swapForm.quote.assetAmountOut} ${assetName}`
                          : `${swapForm.quote.quAmountOut} QU`
                        }
                      </div>
                      
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontWeight: '500' }}>
                          Minimum Output (Slippage Protection)
                        </label>
                        <input
                          type="number"
                          placeholder="Leave empty for 5% tolerance"
                          value={swapForm.outputMin}
                          onChange={(e) => setSwapForm({...swapForm, outputMin: e.target.value})}
                          style={{ marginBottom: '0.5rem' }}
                        />
                        <small style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem' }}>
                          If the actual output falls below this amount, the transaction will fail. 
                          Recommended: Set 5-10% below expected output.
                        </small>
                      </div>
                      
                      <button onClick={handleSwap} disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Executing Swap...' : `Confirm Swap`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
        
        {activeTab === 'issue' && (
          <div className="issue-section">
            <h2>Issue New Asset</h2>
            <div className="asset-info">
              <p><strong>Create a new digital asset on the Qubic network.</strong></p>
              <p>Note: Asset issuance requires a fee of {fees ? fees.assetIssuanceFee?.toLocaleString() : 'Loading...'} QU</p>
            </div>
            
            <form onSubmit={handleIssueAsset}>
              <div className="form-field">
                <label htmlFor="assetName">Asset Name *</label>
                <input
                  id="assetName"
                  type="text"
                  placeholder="e.g., TESTCOIN, MYTOKEN"
                  value={issueForm.assetName}
                  onChange={(e) => setIssueForm({...issueForm, assetName: e.target.value})}
                  maxLength={8}
                  required
                />
                <small>Maximum 8 characters. This is your asset's unique identifier.</small>
              </div>

              <div className="form-field">
                <label htmlFor="numberOfShares">Total Supply *</label>
                <input
                  id="numberOfShares"
                  type="number"
                  placeholder="e.g., 1000000 (1 million)"
                  value={issueForm.numberOfShares}
                  onChange={(e) => setIssueForm({...issueForm, numberOfShares: e.target.value})}
                  min="1"
                  required
                />
                <small>Total number of units/shares to create. Cannot be changed after issuance.</small>
              </div>

              <div className="form-field">
                <label htmlFor="unitOfMeasurement">Unit of Measurement *</label>
                <input
                  id="unitOfMeasurement"
                  type="text"
                  value="TOKENS"
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
                <small>Fixed as "TOKENS" for consistency across all assets.</small>
              </div>

              <div className="form-field">
                <label htmlFor="numberOfDecimalPlaces">Decimal Places *</label>
                <select
                  id="numberOfDecimalPlaces"
                  value={issueForm.numberOfDecimalPlaces}
                  onChange={(e) => setIssueForm({...issueForm, numberOfDecimalPlaces: e.target.value})}
                  required
                >
                  <option value="">Select decimal places</option>
                  <option value="0">0 (whole numbers only: 1, 2, 3...)</option>
                  <option value="1">1 (0.1 precision: 1.0, 1.1, 1.2...)</option>
                  <option value="2">2 (0.01 precision: 1.00, 1.01, 1.02...)</option>
                  <option value="3">3 (0.001 precision: 1.000, 1.001...)</option>
                  <option value="4">4 (0.0001 precision)</option>
                  <option value="5">5 (0.00001 precision)</option>
                  <option value="6">6 (0.000001 precision)</option>
                  <option value="8">8 (like Bitcoin: 0.00000001)</option>
                </select>
                <small>How many decimal places your asset can be divided into. Common choices: 0 (whole units), 2 (like USD cents), 8 (like Bitcoin).</small>
              </div>

              <div className="form-examples">
                <h4>Examples:</h4>
                <div className="example">
                  <strong>Gaming Token:</strong> Name: GAMETKN, Supply: 10000000, Unit: TOKENS, Decimals: 0
                </div>
                <div className="example">
                  <strong>Stablecoin:</strong> Name: MYSTABLE, Supply: 1000000, Unit: TOKENS, Decimals: 2
                </div>
                <div className="example">
                  <strong>Utility Token:</strong> Name: UTILITY, Supply: 500000, Unit: TOKENS, Decimals: 3
                </div>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Issuing Asset...' : 'Issue Asset'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default QSwap; 