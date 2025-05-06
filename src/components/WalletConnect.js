// src/components/WalletConnect.js
import React, { useState } from 'react';
import { useQubicConnect } from '../context/QubicConnectContext';

const WalletConnect = () => {
  const { connected, wallet, connect, disconnect } = useQubicConnect();
  const [privateKey, setPrivateKey] = useState('');

  const handleConnect = (e) => {
    e.preventDefault();
    if (!privateKey.trim()) {
      alert('Please enter a private key');
      return;
    }
    
    connect({
      connectType: 'privateKey',
      privateKey: privateKey.trim()
    });
    
    setPrivateKey('');
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
      <h3>Wallet Connection</h3>
      
      {connected ? (
        <div>
          <div style={{ marginBottom: '10px' }}>
            Connected with: {wallet.connectType}
            {wallet.connectType === 'privateKey' && (
              <span> (Key: {wallet.privateKey.substring(0, 6)}...{wallet.privateKey.substring(wallet.privateKey.length - 4)})</span>
            )}
          </div>
          <button 
            onClick={disconnect}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Private Key:
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                style={{ marginLeft: '10px', width: '300px' }}
              />
            </label>
          </div>
          <button 
            type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Connect Wallet
          </button>
        </form>
      )}
    </div>
  );
};

export default WalletConnect;