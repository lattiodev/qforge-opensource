import React, { useState, useEffect } from 'react';
import { useQubicConnect } from '../context/QubicConnectContext';
import { CheckCircleIcon, BeakerIcon, CloudIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import { RPC_CONFIGS } from '../context/QubicConnectContext';

// Define standard endpoints
const MAINNET_URL = 'https://rpc.qubic.org';
const TESTNET_URL = 'https://testnet-rpc.qubicdev.com'; // Use the user's proxy URL
const NOSTROMO_TESTNET_URL = 'https://testnet-nostromo.qubicdev.com';

const EndpointSetting = () => {
  const { httpEndpoint, updateHttpEndpoint } = useQubicConnect();
  const [rpcInputValue, setRpcInputValue] = useState(httpEndpoint);
  const [rpcSaveStatus, setRpcSaveStatus] = useState('');

  useEffect(() => {
    setRpcInputValue(httpEndpoint);
  }, [httpEndpoint]);

  const handleSaveRpcEndpoint = () => {
    try {
      let endpointToSave = rpcInputValue.trim();
      if (!/^https?:\/\//i.test(endpointToSave)) {
        if (endpointToSave.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}/.test(endpointToSave.split(':')[0])) {
            endpointToSave = 'http://' + endpointToSave;
        } else {
             endpointToSave = 'https://' + endpointToSave;
        }
      }
      const savedEndpoint = updateHttpEndpoint(endpointToSave);
      setRpcSaveStatus('saved');
      setTimeout(() => setRpcSaveStatus(''), 2000);
    } catch (error) {
      console.error("Failed to save RPC endpoint:", error);
      setRpcSaveStatus('error');
      setTimeout(() => setRpcSaveStatus(''), 3000);
    }
  };

  const handleSetTestnetEndpoint = () => {
    const testnetUrl = TESTNET_URL; // Use the constant
    setRpcInputValue(testnetUrl);
    try {
      updateHttpEndpoint(testnetUrl);
      setRpcSaveStatus('saved');
      setTimeout(() => setRpcSaveStatus(''), 2000);
    } catch (error) {
      console.error("Failed to save Testnet RPC endpoint:", error);
      setRpcSaveStatus('error');
      setTimeout(() => setRpcSaveStatus(''), 3000);
    }
  };

  // --- Add handler for Mainnet button ---
  const handleSetMainnetEndpoint = () => {
    const mainnetUrl = MAINNET_URL; // Use the constant
    setRpcInputValue(mainnetUrl);
    try {
      updateHttpEndpoint(mainnetUrl);
      setRpcSaveStatus('saved');
      setTimeout(() => setRpcSaveStatus(''), 2000);
    } catch (error) {
      console.error("Failed to save Mainnet RPC endpoint:", error);
      setRpcSaveStatus('error');
      setTimeout(() => setRpcSaveStatus(''), 3000);
    }
  };

  // --- Add handler for Nostromo Testnet button ---
  const handleSetNostromoTestnetEndpoint = () => {
    const nostromoTestnetUrl = NOSTROMO_TESTNET_URL;
    setRpcInputValue(nostromoTestnetUrl);
    try {
      updateHttpEndpoint(nostromoTestnetUrl);
      setRpcSaveStatus('saved');
      setTimeout(() => setRpcSaveStatus(''), 2000);
    } catch (error) {
      console.error("Failed to save Nostromo Testnet RPC endpoint:", error);
      setRpcSaveStatus('error');
      setTimeout(() => setRpcSaveStatus(''), 3000);
    }
  };

  const getCurrentRpcConfig = () => {
    return RPC_CONFIGS[httpEndpoint];
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="rpcEndpointInput" className="block text-sm font-medium text-gray-300 mb-1">RPC Endpoint URL</label>
        <input
          type="text"
          id="rpcEndpointInput"
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          value={rpcInputValue}
          onChange={(e) => setRpcInputValue(e.target.value)}
          placeholder="e.g., https://rpc.qubic.org"
        />
        {getCurrentRpcConfig() ? (
          <p className="text-xs text-green-400 mt-1">
            Using {getCurrentRpcConfig().name} configuration
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">Using custom configuration</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={handleSetMainnetEndpoint}
          title={`Set to Mainnet RPC (${MAINNET_URL})`}
          className="px-2 py-1.5 rounded text-sm bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1"
        >
          <CloudIcon className="h-4 w-4" />
          Mainnet
        </button>
        <button
          onClick={handleSetTestnetEndpoint}
          title={`Set to Testnet RPC (${TESTNET_URL})`}
          className="px-2 py-1.5 rounded text-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-1"
        >
          <BeakerIcon className="h-4 w-4" />
          Testnet
        </button>
        <button
          onClick={handleSetNostromoTestnetEndpoint}
          title={`Set to Nostromo Testnet RPC (${NOSTROMO_TESTNET_URL})`}
          className="px-2 py-1.5 rounded text-sm bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1"
        >
          <RocketLaunchIcon className="h-4 w-4" />
          Nostromo
        </button>
        <button
          onClick={handleSaveRpcEndpoint}
          disabled={rpcInputValue === httpEndpoint || rpcSaveStatus === 'saved'}
          className={`px-2 py-1.5 rounded text-sm flex items-center justify-center gap-1 ${
            rpcSaveStatus === 'saved' 
              ? 'bg-green-600 hover:bg-green-700' 
              : rpcSaveStatus === 'error' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-purple-600 hover:bg-purple-700'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {rpcSaveStatus === 'saved' && <CheckCircleIcon className="h-4 w-4" />}
          {rpcSaveStatus === 'error' ? 'Error' : rpcSaveStatus === 'saved' ? 'Saved!' : 'Save'}
        </button>
      </div>

      {rpcSaveStatus === 'error' && (
        <p className="text-xs text-red-400">Error saving endpoint. Check console.</p>
      )}
    </div>
  );
};

export default EndpointSetting;
