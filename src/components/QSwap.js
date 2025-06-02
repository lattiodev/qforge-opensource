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
import './QSwap.css';

function QSwap() {
  const { qubicConnect, isConnected, httpEndpoint } = useContext(WalletContext);
  const [activeTab, setActiveTab] = useState('pools');
  const [fees, setFees] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form states
  const [assetName, setAssetName] = useState('');
  const [assetIssuer, setAssetIssuer] = useState('');
  const [poolInfo, setPoolInfo] = useState(null);
  const [userLiquidity, setUserLiquidity] = useState(null);
  
  // Issue Asset form
  const [issueForm, setIssueForm] = useState({
    assetName: '',
    numberOfShares: '',
    unitOfMeasurement: '',
    numberOfDecimalPlaces: ''
  });
  
  // Add Liquidity form
  const [liquidityForm, setLiquidityForm] = useState({
    quAmountDesired: '',
    assetAmountDesired: '',
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
      const feeData = await getQswapFees(endpoint);
      console.log('Raw fee data:', feeData);
      
      // Check if the response has the expected structure
      if (feeData && feeData.success && feeData.decodedFields) {
        setFees(feeData.decodedFields);
        setMessage(''); // Clear any error messages
      } else if (feeData && feeData.success === false) {
        console.error('Failed to load fees:', feeData.error);
        setMessage('Failed to load protocol fees: ' + feeData.error);
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
      
      const info = await getPoolBasicState(httpEndpoint, assetIssuer, assetNameUint64);
      console.log('Pool info response:', info);
      
      if (info && info.success && info.decodedFields) {
        setPoolInfo(info.decodedFields);
        
        // Load user liquidity if connected and pool exists
        if (isConnected && info.decodedFields.poolExists > 0) {
          const liquidity = await getLiquidityOf(
            httpEndpoint, 
            assetIssuer, 
            assetNameUint64, 
            qubicConnect.wallet.publicKey
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
      const uomUint64 = assetNameToUint64(issueForm.unitOfMeasurement);
      
      const result = await issueAsset(
        qubicConnect,
        assetNameUint64,
        issueForm.numberOfShares,
        uomUint64,
        parseInt(issueForm.numberOfDecimalPlaces)
      );
      
      setMessage(`Asset issued successfully! TX: ${result.txHash}`);
      setIssueForm({
        assetName: '',
        numberOfShares: '',
        unitOfMeasurement: '',
        numberOfDecimalPlaces: ''
      });
    } catch (error) {
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
    
    setLoading(true);
    try {
      const assetNameUint64 = assetNameToUint64(assetName);
      const result = await addLiquidity(
        qubicConnect,
        assetIssuer,
        assetNameUint64,
        liquidityForm.quAmountDesired,
        liquidityForm.assetAmountDesired,
        liquidityForm.quAmountMin,
        liquidityForm.assetAmountMin
      );
      
      setMessage(`Liquidity added successfully! TX: ${result.txHash}`);
      setLiquidityForm({
        quAmountDesired: '',
        assetAmountDesired: '',
        quAmountMin: '',
        assetAmountMin: ''
      });
      setTimeout(() => loadPoolInfo(), 2000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
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
      
      if (swapForm.inputType === 'qu') {
        quote = await quoteExactQuInput(
          httpEndpoint,
          assetIssuer,
          assetNameUint64,
          swapForm.inputAmount
        );
      } else {
        quote = await quoteExactAssetInput(
          httpEndpoint,
          assetIssuer,
          assetNameUint64,
          swapForm.inputAmount
        );
      }
      
      setSwapForm({ ...swapForm, quote });
      setMessage('Quote received');
    } catch (error) {
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
      
      setMessage(`Swap successful! TX: ${result.txHash}`);
      setSwapForm({
        inputType: 'qu',
        inputAmount: '',
        outputMin: '',
        quote: null
      });
      setTimeout(() => loadPoolInfo(), 2000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
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
      
      {/* Debug section - remove in production */}
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#333', borderRadius: '8px' }}>
        <button 
          onClick={async () => {
            try {
              console.log('Testing QSwap API with endpoint:', httpEndpoint);
              const response = await fetch(`${httpEndpoint}/v1/querySmartContract`, {
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
              console.log('Raw API Response:', data);
              
              // Decode the base64 response
              if (data.responseData) {
                const binaryString = atob(data.responseData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Parse as 5 uint32 values (4 bytes each)
                const dv = new DataView(bytes.buffer);
                const decoded = {
                  assetIssuanceFee: dv.getUint32(0, true),
                  poolCreationFee: dv.getUint32(4, true),
                  transferFee: dv.getUint32(8, true),
                  swapRate: dv.getUint32(12, true),
                  protocolRate: dv.getUint32(16, true)
                };
                console.log('Decoded fees:', decoded);
                alert('Check console for decoded fees');
              }
            } catch (err) {
              console.error('Direct API test failed:', err);
              alert('API test failed: ' + err.message);
            }
          }}
          style={{ marginRight: '1rem' }}
        >
          Test Direct API
        </button>
        <button onClick={loadFees}>
          Reload Fees
        </button>
        <span style={{ marginLeft: '1rem', color: '#888' }}>
          Endpoint: {httpEndpoint || 'Not set'}
        </span>
      </div>
      
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
            <h2>Pool Information</h2>
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
                Load Pool Info
              </button>
              {poolInfo && (!poolInfo.poolExists || poolInfo.poolExists === 0 || poolInfo.poolExists === '0') && (
                <button onClick={handleCreatePool} disabled={loading}>
                  Create Pool
                </button>
              )}
            </div>
            
            {poolInfo && (
              <div className="pool-info">
                {poolInfo.poolExists && poolInfo.poolExists > 0 ? (
                  <>
                    <h3>Pool Details</h3>
                    <div className="info-grid">
                      <div>QU Reserve: {poolInfo.reservedQuAmount ? poolInfo.reservedQuAmount.toLocaleString() : '0'}</div>
                      <div>Asset Reserve: {poolInfo.reservedAssetAmount ? poolInfo.reservedAssetAmount.toLocaleString() : '0'}</div>
                      <div>Total Liquidity: {poolInfo.totalLiquidity ? poolInfo.totalLiquidity.toLocaleString() : '0'}</div>
                      {userLiquidity && (
                        <div>Your Liquidity: {userLiquidity.liquidity ? userLiquidity.liquidity.toLocaleString() : '0'}</div>
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
            {poolInfo && poolInfo.poolExists && poolInfo.poolExists > 0 ? (
              <form onSubmit={handleAddLiquidity}>
                <h3>Add Liquidity</h3>
                <input
                  type="number"
                  placeholder="QU Amount Desired"
                  value={liquidityForm.quAmountDesired}
                  onChange={(e) => setLiquidityForm({...liquidityForm, quAmountDesired: e.target.value})}
                  required
                />
                <input
                  type="number"
                  placeholder="Asset Amount Desired"
                  value={liquidityForm.assetAmountDesired}
                  onChange={(e) => setLiquidityForm({...liquidityForm, assetAmountDesired: e.target.value})}
                  required
                />
                <input
                  type="number"
                  placeholder="QU Amount Min"
                  value={liquidityForm.quAmountMin}
                  onChange={(e) => setLiquidityForm({...liquidityForm, quAmountMin: e.target.value})}
                  required
                />
                <input
                  type="number"
                  placeholder="Asset Amount Min"
                  value={liquidityForm.assetAmountMin}
                  onChange={(e) => setLiquidityForm({...liquidityForm, assetAmountMin: e.target.value})}
                  required
                />
                <button type="submit" disabled={loading}>Add Liquidity</button>
              </form>
            ) : (
              <div>Please load a pool first from the Pools tab</div>
            )}
          </div>
        )}
        
        {activeTab === 'swap' && (
          <div className="swap-section">
            <h2>Swap Tokens</h2>
            {poolInfo && poolInfo.poolExists && poolInfo.poolExists > 0 ? (
              <div className="swap-form">
                <div className="swap-type">
                  <label>
                    <input
                      type="radio"
                      value="qu"
                      checked={swapForm.inputType === 'qu'}
                      onChange={(e) => setSwapForm({...swapForm, inputType: e.target.value, quote: null})}
                    />
                    QU → Asset
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="asset"
                      checked={swapForm.inputType === 'asset'}
                      onChange={(e) => setSwapForm({...swapForm, inputType: e.target.value, quote: null})}
                    />
                    Asset → QU
                  </label>
                </div>
                
                <input
                  type="number"
                  placeholder={`${swapForm.inputType === 'qu' ? 'QU' : 'Asset'} Amount`}
                  value={swapForm.inputAmount}
                  onChange={(e) => setSwapForm({...swapForm, inputAmount: e.target.value, quote: null})}
                />
                
                <button onClick={handleGetQuote} disabled={loading}>
                  Get Quote
                </button>
                
                {swapForm.quote && (
                  <div className="quote-info">
                    <div>Expected Output: {
                      swapForm.inputType === 'qu' 
                        ? swapForm.quote.assetAmountOut 
                        : swapForm.quote.quAmountOut
                    }</div>
                    <input
                      type="number"
                      placeholder="Minimum Output (optional)"
                      value={swapForm.outputMin}
                      onChange={(e) => setSwapForm({...swapForm, outputMin: e.target.value})}
                    />
                    <button onClick={handleSwap} disabled={loading}>
                      Execute Swap
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>Please load a pool first from the Pools tab</div>
            )}
          </div>
        )}
        
        {activeTab === 'issue' && (
          <div className="issue-section">
            <h2>Issue New Asset</h2>
            <form onSubmit={handleIssueAsset}>
              <input
                type="text"
                placeholder="Asset Name (max 8 chars)"
                value={issueForm.assetName}
                onChange={(e) => setIssueForm({...issueForm, assetName: e.target.value})}
                maxLength={8}
                required
              />
              <input
                type="number"
                placeholder="Number of Shares"
                value={issueForm.numberOfShares}
                onChange={(e) => setIssueForm({...issueForm, numberOfShares: e.target.value})}
                required
              />
              <input
                type="text"
                placeholder="Unit of Measurement"
                value={issueForm.unitOfMeasurement}
                onChange={(e) => setIssueForm({...issueForm, unitOfMeasurement: e.target.value})}
                maxLength={7}
                required
              />
              <input
                type="number"
                placeholder="Decimal Places"
                value={issueForm.numberOfDecimalPlaces}
                onChange={(e) => setIssueForm({...issueForm, numberOfDecimalPlaces: e.target.value})}
                min="0"
                max="10"
                required
              />
              <button type="submit" disabled={loading}>Issue Asset</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default QSwap; 