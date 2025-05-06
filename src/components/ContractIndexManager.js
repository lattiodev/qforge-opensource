import React, { useState, useEffect } from 'react';
import { useQubicConnect } from '../context/QubicConnectContext';

const ContractIndexManager = () => {
  const { httpEndpoint, contractIndexes, updateContractIndexes } = useQubicConnect();
  const [indexes, setIndexes] = useState(JSON.stringify(contractIndexes, null, 2));
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIndexes(JSON.stringify(contractIndexes, null, 2));
  }, [contractIndexes]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(indexes);
      if (typeof parsed !== 'object') {
        throw new Error('Invalid JSON format');
      }
      updateContractIndexes(parsed);
      setIsEditing(false);
      setError('');
    } catch (e) {
      setError('Invalid JSON format');
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 mb-2">
        Current endpoint: {httpEndpoint}
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            className="w-full h-64 p-2 bg-gray-700 border border-gray-600 rounded text-white font-mono text-xs"
            value={indexes}
            onChange={(e) => setIndexes(e.target.value)}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIndexes(JSON.stringify(contractIndexes, null, 2));
                setIsEditing(false);
                setError('');
              }}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <pre className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white font-mono text-xs overflow-x-auto">
            {JSON.stringify(contractIndexes, null, 2)}
          </pre>
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default ContractIndexManager; 