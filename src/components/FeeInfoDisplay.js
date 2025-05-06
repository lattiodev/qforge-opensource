import React from 'react';
import { mightRequireFee } from '../utils/contractApi';

const FeeInfoDisplay = ({ contractFees, contractName, functionName }) => {
  if (!contractFees || !contractName) return null;
  
  const feeInfo = contractFees[contractName];
  if (!feeInfo) return null;
  
  // Check if the function might require fees
  const mayRequireFee = mightRequireFee(functionName);
  
  // Collect fee information
  const feeItems = [];
  
  // Add data from API calls and constants
  if (feeInfo.feeInfo) {
    Object.entries(feeInfo.feeInfo).forEach(([key, value]) => {
      // Only include if it seems fee-related
      if (key.toLowerCase().includes('fee') || 
          key.toLowerCase().includes('minimum') ||
          key.toLowerCase().includes('min')) {
        feeItems.push({
          name: key // Exact fee name from contract
        });
      }
    });
  }
  
  // Function-specific requirements from code analysis
  if (feeInfo.procedureConstants && feeInfo.procedureConstants[functionName]) {
    const proc = feeInfo.procedureConstants[functionName];
    if (proc.fee) {
      feeItems.push({ name: 'Required Fee' });
    }
    if (proc.minimumAmount) {
      feeItems.push({ name: 'Minimum Amount' });
    }
  }
  
  // If no specific fees found and the function likely doesn't require fees
  if (feeItems.length === 0 && !mayRequireFee) {
    return null;
  }
  
  return (
    <div style={{ 
      marginTop: '10px', 
      padding: '10px', 
      backgroundColor: '#fff8e1', 
      borderRadius: '4px',
      border: '1px solid #ffe082'
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>Function Requirements</h4>
      
      {feeItems.length > 0 ? (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#ffecb3' }}>
                <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ffd54f' }}>Fee Type</th>
                <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ffd54f' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {feeItems.map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : '#fff3e0' }}>
                  <td style={{ padding: '8px', border: '1px solid #ffd54f', fontWeight: 'bold' }}>
                    {item.name} {/* Using exact fee name from contract */}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #ffd54f', fontStyle: 'italic' }}>
                    Varies based on contract state
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div style={{ padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
          <strong>Note:</strong> This function may require fees based on its operation.
        </div>
      )}
      
      <p style={{ margin: '10px 0 0 0', fontStyle: 'italic', color: '#856404' }}>
        Actual fee values are determined by the contract's current state.
        Please ensure sufficient funds before executing.
      </p>
    </div>
  );
};

export default FeeInfoDisplay;
