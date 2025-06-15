import React, { useState, useEffect, useContext, useRef } from 'react';
import './Nostromo.css';
import { WalletContext } from '../App';
import {
  getStats,
  getTierLevelByUser,
  getUserVoteStatus,
  getProjectByIndex,
  getFundarasingByIndex,
  checkTokenCreatability,
  getNumberOfInvestedAndClaimedProjects,
  getProjectIndexListByCreator,
  registerInTier,
  logoutFromTier,
  upgradeTier,
  createProject,
  voteInProject,
  createFundaraising,
  investInProject,
  claimToken,
  NOSTROMO_TIERS,
  NOSTROMO_FEES,
  formatQU,
  tokenNameToUint64,
  uint64ToTokenName,
  dateToQubicDate,
  getTierInfo,
  calculatePoolShare,
  checkTransactionStatus,
  isValidProject,
  isValidFundraising
} from '../utils/nostromoApi';

function Nostromo() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Get wallet context from App.js
  const { qubicConnect, isConnected, httpEndpoint, qHelper } = useContext(WalletContext);
  
  // Platform data
  const [platformStats, setPlatformStats] = useState(null);
  const [userTier, setUserTier] = useState(0);
  const [userVoteStatus, setUserVoteStatus] = useState(null);
  const [userInvestmentStats, setUserInvestmentStats] = useState(null);
  
  // Projects data
  const [projects, setProjects] = useState([]);
  const [fundraisings, setFundraisings] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  
  // Form data
  const [selectedTier, setSelectedTier] = useState(1);
  const [projectForm, setProjectForm] = useState({
    tokenName: '',
    supply: '',
    startDate: '',
    endDate: ''
  });
  const [fundraisingForm, setFundraisingForm] = useState({
    tokenPrice: '',
    soldAmount: '',
    requiredFunds: '',
    indexOfProject: '',
    threshold: '10',
    TGE: '20',
    stepOfVesting: '12',
    // Phase 1 dates
    firstPhaseStartDate: '',
    firstPhaseEndDate: '',
    // Phase 2 dates  
    secondPhaseStartDate: '',
    secondPhaseEndDate: '',
    // Phase 3 dates
    thirdPhaseStartDate: '',
    thirdPhaseEndDate: '',
    // Listing and vesting dates
    listingStartDate: '',
    cliffEndDate: '',
    vestingEndDate: ''
  });

  // New: per-tab loaded state
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [tiersLoaded, setTiersLoaded] = useState(false);
  const [votingLoaded, setVotingLoaded] = useState(false);
  const [fundraisingLoaded, setFundraisingLoaded] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);

  // Add refs for loader locks
  const loadingUserDataRef = useRef(false);
  const loadingPlatformDataRef = useRef(false);

  // New: handleTabClick for lazy loading
  const handleTabClick = async (tab) => {
    setActiveTab(tab);
    setLoading(true);
    try {
      if (tab === 'dashboard' && !dashboardLoaded) {
        await loadPlatformData();
        if (isConnected && qubicConnect?.wallet?.publicKey) await loadUserData();
        setDashboardLoaded(true);
      }
      if (tab === 'tiers' && !tiersLoaded) {
        if (isConnected && qubicConnect?.wallet?.publicKey) await loadUserData();
        setTiersLoaded(true);
      }
      if (tab === 'voting' && !votingLoaded) {
        await loadProjectsData();
        setVotingLoaded(true);
      }
      if (tab === 'fundraising' && !fundraisingLoaded) {
        await loadProjectsData();
        setFundraisingLoaded(true);
      }
      if (tab === 'projects' && !projectsLoaded) {
        // Only load user data (for tier and user's own projects), not all projects/fundraisings
        if (isConnected && qubicConnect?.wallet?.publicKey) await loadUserData();
        setProjectsLoaded(true);
      }
      if (tab === 'portfolio' && !portfolioLoaded) {
        if (isConnected && qubicConnect?.wallet?.publicKey) await loadUserData();
        setPortfolioLoaded(true);
      }
    } catch (e) {
      // error already handled in loaders
    } finally {
      setLoading(false);
    }
  };

  // On initial mount, load dashboard only
  useEffect(() => {
    handleTabClick('dashboard');
    // eslint-disable-next-line
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 5000);
  };

  const formatEndpoint = (endpoint) => {
    if (!endpoint) return '';
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    return `http://${endpoint}`;
  };

  const loadPlatformData = async () => {
    if (loadingPlatformDataRef.current) return;
    loadingPlatformDataRef.current = true;
    try {
      setLoading(true);
      const endpoint = formatEndpoint(httpEndpoint || localStorage.getItem('httpEndpoint') || 'localhost:8080');
      
      console.log('[Nostromo] loadPlatformData - qHelper:', qHelper);
      
      const statsResult = await getStats(endpoint, qHelper);
      console.log('[Nostromo] Raw stats result:', statsResult);
      
      if (statsResult && statsResult.success) {
        console.log('[Nostromo] Platform stats decoded:', statsResult.decodedFields);
        setPlatformStats(statsResult.decodedFields);
      } else {
        console.log('[Nostromo] Failed to get platform stats');
      }
    } catch (error) {
      console.error('Error loading platform data:', error);
      showMessage('Failed to load platform data', 'error');
    } finally {
      setLoading(false);
      loadingPlatformDataRef.current = false;
    }
  };

  const loadProjectsData = async () => {
    try {
      const endpoint = formatEndpoint(httpEndpoint || localStorage.getItem('httpEndpoint') || 'localhost:8080');
      
      // First check platform stats to see if any projects exist
      if (platformStats) {
        console.log('[Nostromo] Platform stats show', platformStats.numberOfCreatedProject, 'created projects');
        if (platformStats.numberOfCreatedProject === 0) {
          console.log('[Nostromo] No projects exist according to platform stats, skipping project loading');
          setProjects([]);
          setFundraisings([]);
          return;
        }
      } else {
        console.log('[Nostromo] Platform stats not available yet');
      }
      
      // Only fetch first 5 projects and fundraisings, in parallel
      const NUM_TO_FETCH = 5;
      const projectIndexes = Array.from({ length: NUM_TO_FETCH }, (_, i) => i);
      const fundraisingIndexes = Array.from({ length: NUM_TO_FETCH }, (_, i) => i);
      
      // Parallel fetch for projects
      const projectPromises = projectIndexes.map(i => getProjectByIndex(endpoint, i, qHelper));
      const projectResults = await Promise.allSettled(projectPromises);
      const projectsData = [];
      projectResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value && result.value.success && result.value.decodedFields) {
          const project = result.value.decodedFields;
          if (isValidProject(project)) {
            projectsData.push({ index: projectIndexes[i], ...project });
          }
        }
      });
      
      // Parallel fetch for fundraisings
      const fundraisingPromises = fundraisingIndexes.map(i => getFundarasingByIndex(endpoint, i, qHelper));
      const fundraisingResults = await Promise.allSettled(fundraisingPromises);
      const fundraisingsData = [];
      fundraisingResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value && result.value.success && result.value.decodedFields) {
          const fundraising = result.value.decodedFields;
          if (isValidFundraising(fundraising)) {
            fundraisingsData.push({ index: fundraisingIndexes[i], ...fundraising });
          }
        }
      });
      
      console.log('[Nostromo] Final results - Projects:', projectsData.length, 'Fundraisings:', fundraisingsData.length);
      console.log('[Nostromo] Valid projects:', projectsData);
      console.log('[Nostromo] Valid fundraisings:', fundraisingsData);
      
      setProjects(projectsData);
      setFundraisings(fundraisingsData);
      
    } catch (error) {
      console.error('Error loading projects data:', error);
    }
  };

  const loadUserData = async () => {
    if (loadingUserDataRef.current) return;
    loadingUserDataRef.current = true;
    try {
      const endpoint = formatEndpoint(httpEndpoint || localStorage.getItem('httpEndpoint') || 'localhost:8080');
      const userPublicKey = qubicConnect?.wallet?.publicKey;
      
      if (!userPublicKey) return;
      
      console.log('[Nostromo] loadUserData - qHelper:', qHelper);
      console.log('[Nostromo] loadUserData - userPublicKey:', userPublicKey);
      
      // Get user tier
      const tierResult = await getTierLevelByUser(endpoint, userPublicKey, qHelper);
      if (tierResult && tierResult.success) {
        setUserTier(tierResult.decodedFields.tierLevel || 0);
      }
      
      // Get vote status
      const voteResult = await getUserVoteStatus(endpoint, userPublicKey, qHelper);
      if (voteResult && voteResult.success) {
        setUserVoteStatus(voteResult.decodedFields);
      }
      
      // Get investment stats
      const investmentResult = await getNumberOfInvestedAndClaimedProjects(endpoint, userPublicKey, qHelper);
      if (investmentResult && investmentResult.success) {
        setUserInvestmentStats(investmentResult.decodedFields);
      }
      
      // Get user's projects
      const userProjectsResult = await getProjectIndexListByCreator(endpoint, userPublicKey, qHelper);
      if (userProjectsResult && userProjectsResult.success) {
        setUserProjects(userProjectsResult.decodedFields.indexListForProjects || []);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      loadingUserDataRef.current = false;
    }
  };

  const checkTransactionStatus = async (txId) => {
    try {
      setLoading(true);
      showMessage(`Checking transaction ${txId.substring(0, 16)}...`, 'info');
      
      const endpoint = httpEndpoint || localStorage.getItem('httpEndpoint') || 'http://46.17.103.110:8000';
      const response = await fetch(`${endpoint}/v1/transactions/${txId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Nostromo] Transaction status data:', data);
        
        if (data.transaction) {
          showMessage(`Transaction found! Status: ${data.transaction.executed ? 'EXECUTED' : 'PENDING'}`, 'success');
          
          if (data.transaction.executed) {
            // If executed, refresh user data
            setTimeout(() => {
              loadUserData();
              showMessage('Transaction executed! Refreshing tier status...', 'success');
            }, 2000);
          }
        } else {
          showMessage('Transaction not found or still pending...', 'warning');
        }
      } else {
        showMessage('Error checking transaction status', 'error');
      }
    } catch (error) {
      console.error('[Nostromo] Error checking transaction:', error);
      showMessage('Error checking transaction status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterInTier = async () => {
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    // Debug logging
    console.log('[Nostromo] handleRegisterInTier called with selectedTier:', selectedTier);
    console.log('[Nostromo] NOSTROMO_TIERS[selectedTier]:', NOSTROMO_TIERS[selectedTier]);

    try {
      setLoading(true);
      const result = await registerInTier(qubicConnect, selectedTier);
      
      if (result && result.success && result.transactionId) {
        const txId = result.transactionId;
        showMessage(`Transaction broadcast successfully! TX ID: ${txId.substring(0, 16)}... Registering in ${NOSTROMO_TIERS[selectedTier].name} tier. Please wait 1-2 minutes for confirmation...`);
        
        // Monitor transaction status
        const monitorTransaction = async () => {
          try {
            const endpoint = httpEndpoint || localStorage.getItem('httpEndpoint') || 'localhost:8080';
            const txStatus = await checkTransactionStatus(txId);
            
            if (txStatus && txStatus.transaction) {
              showMessage(`Transaction confirmed! Checking tier status...`, 'info');
              loadUserData();
              
              // Final check after a bit more time
              setTimeout(() => {
                loadUserData();
                showMessage(`Tier registration should be complete. If status hasn't updated, please refresh manually.`, 'info');
              }, 15000);
            } else {
              showMessage(`Transaction still processing... Please wait or check manually.`, 'info');
              setTimeout(() => {
                loadUserData();
              }, 30000);
            }
          } catch (error) {
            console.error('Error monitoring transaction:', error);
            showMessage(`Transaction broadcast complete. Please check status manually in 1-2 minutes.`, 'info');
            setTimeout(() => {
              loadUserData();
            }, 60000);
          }
        };
        
        // Start monitoring after 30 seconds
        setTimeout(monitorTransaction, 30000);
        
      } else {
        showMessage(result?.error || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showMessage('Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutFromTier = async () => {
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await logoutFromTier(qubicConnect);
      
      if (result && result.success) {
        showMessage('Successfully logged out from tier!');
        loadUserData();
      } else {
        showMessage(result?.error || 'Logout failed', 'error');
      }
    } catch (error) {
      console.error('Logout error:', error);
      showMessage('Logout failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeTier = async (newTierLevel) => {
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (userTier === 0) {
      showMessage('You need to register in a tier first', 'error');
      return;
    }

    if (newTierLevel <= userTier) {
      showMessage('You can only upgrade to a higher tier', 'error');
      return;
    }

    try {
      setLoading(true);
      const tierInfo = getTierInfo(newTierLevel);
      const currentTierInfo = getTierInfo(userTier);
      const upgradeCost = tierInfo.stake - currentTierInfo.stake;
      
      showMessage(`Upgrading to ${tierInfo.name}... Cost: ${formatQU(upgradeCost)}`, 'info');
      
      const result = await upgradeTier(qubicConnect, newTierLevel);
      console.log('[Nostromo] Upgrade tier result:', result);
      
      if (result && result.success) {
        showMessage(`Successfully upgraded to ${tierInfo.name}!`);
        loadUserData();
        loadPlatformData();
      } else {
        showMessage(result?.error || 'Upgrade failed', 'error');
      }
    } catch (error) {
      console.error('Upgrade tier error:', error);
      showMessage('Upgrade failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (userTier < 4) {
      showMessage('You need to be Tier 4 (XENOMORPH) or higher to create projects', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const startDate = new Date(projectForm.startDate);
      const endDate = new Date(projectForm.endDate);
      
      const projectData = {
        tokenName: tokenNameToUint64(projectForm.tokenName),
        supply: projectForm.supply,
        startYear: startDate.getFullYear() % 100,
        startMonth: startDate.getMonth() + 1,
        startDay: startDate.getDate(),
        startHour: startDate.getHours(),
        endYear: endDate.getFullYear() % 100,
        endMonth: endDate.getMonth() + 1,
        endDay: endDate.getDate(),
        endHour: endDate.getHours()
      };
      
      const projectResult = await createProject(qubicConnect, projectData);
      
      if (projectResult && projectResult.success) {
        showMessage('Project created successfully!');
        setProjectForm({ tokenName: '', supply: '', startDate: '', endDate: '' });
        loadProjectsData();
        loadUserData();
      } else {
        showMessage(projectResult?.error || 'Project creation failed', 'error');
      }
    } catch (error) {
      console.error('Create project error:', error);
      showMessage('Project creation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFundraising = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (userTier < 4) {
      showMessage('You need to be Tier 4 (XENOMORPH) or higher to create fundraising', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Convert all dates to Qubic date format
      const firstPhaseStart = new Date(fundraisingForm.firstPhaseStartDate);
      const firstPhaseEnd = new Date(fundraisingForm.firstPhaseEndDate);
      const secondPhaseStart = new Date(fundraisingForm.secondPhaseStartDate);
      const secondPhaseEnd = new Date(fundraisingForm.secondPhaseEndDate);
      const thirdPhaseStart = new Date(fundraisingForm.thirdPhaseStartDate);
      const thirdPhaseEnd = new Date(fundraisingForm.thirdPhaseEndDate);
      const listingStart = new Date(fundraisingForm.listingStartDate);
      const cliffEnd = new Date(fundraisingForm.cliffEndDate);
      const vestingEnd = new Date(fundraisingForm.vestingEndDate);
      
      const fundraisingData = {
        tokenPrice: fundraisingForm.tokenPrice,
        soldAmount: fundraisingForm.soldAmount,
        requiredFunds: fundraisingForm.requiredFunds,
        indexOfProject: parseInt(fundraisingForm.indexOfProject),
        
        // Phase 1 dates
        firstPhaseStartYear: firstPhaseStart.getFullYear() % 100,
        firstPhaseStartMonth: firstPhaseStart.getMonth() + 1,
        firstPhaseStartDay: firstPhaseStart.getDate(),
        firstPhaseStartHour: firstPhaseStart.getHours(),
        firstPhaseEndYear: firstPhaseEnd.getFullYear() % 100,
        firstPhaseEndMonth: firstPhaseEnd.getMonth() + 1,
        firstPhaseEndDay: firstPhaseEnd.getDate(),
        firstPhaseEndHour: firstPhaseEnd.getHours(),
        
        // Phase 2 dates
        secondPhaseStartYear: secondPhaseStart.getFullYear() % 100,
        secondPhaseStartMonth: secondPhaseStart.getMonth() + 1,
        secondPhaseStartDay: secondPhaseStart.getDate(),
        secondPhaseStartHour: secondPhaseStart.getHours(),
        secondPhaseEndYear: secondPhaseEnd.getFullYear() % 100,
        secondPhaseEndMonth: secondPhaseEnd.getMonth() + 1,
        secondPhaseEndDay: secondPhaseEnd.getDate(),
        secondPhaseEndHour: secondPhaseEnd.getHours(),
        
        // Phase 3 dates
        thirdPhaseStartYear: thirdPhaseStart.getFullYear() % 100,
        thirdPhaseStartMonth: thirdPhaseStart.getMonth() + 1,
        thirdPhaseStartDay: thirdPhaseStart.getDate(),
        thirdPhaseStartHour: thirdPhaseStart.getHours(),
        thirdPhaseEndYear: thirdPhaseEnd.getFullYear() % 100,
        thirdPhaseEndMonth: thirdPhaseEnd.getMonth() + 1,
        thirdPhaseEndDay: thirdPhaseEnd.getDate(),
        thirdPhaseEndHour: thirdPhaseEnd.getHours(),
        
        // Listing and vesting dates
        listingStartYear: listingStart.getFullYear() % 100,
        listingStartMonth: listingStart.getMonth() + 1,
        listingStartDay: listingStart.getDate(),
        listingStartHour: listingStart.getHours(),
        cliffEndYear: cliffEnd.getFullYear() % 100,
        cliffEndMonth: cliffEnd.getMonth() + 1,
        cliffEndDay: cliffEnd.getDate(),
        cliffEndHour: cliffEnd.getHours(),
        vestingEndYear: vestingEnd.getFullYear() % 100,
        vestingEndMonth: vestingEnd.getMonth() + 1,
        vestingEndDay: vestingEnd.getDate(),
        vestingEndHour: vestingEnd.getHours(),
        
        // Parameters
        threshold: parseInt(fundraisingForm.threshold),
        TGE: parseInt(fundraisingForm.TGE),
        stepOfVesting: parseInt(fundraisingForm.stepOfVesting)
      };
      
      const result = await createFundaraising(qubicConnect, fundraisingData);
      
      if (result && result.success) {
        showMessage('Fundraising created successfully!');
        setFundraisingForm({
          tokenPrice: '',
          soldAmount: '',
          requiredFunds: '',
          indexOfProject: '',
          threshold: '10',
          TGE: '20',
          stepOfVesting: '12',
          firstPhaseStartDate: '',
          firstPhaseEndDate: '',
          secondPhaseStartDate: '',
          secondPhaseEndDate: '',
          thirdPhaseStartDate: '',
          thirdPhaseEndDate: '',
          listingStartDate: '',
          cliffEndDate: '',
          vestingEndDate: ''
        });
        loadProjectsData();
        loadUserData();
      } else {
        showMessage(result?.error || 'Fundraising creation failed', 'error');
      }
    } catch (error) {
      console.error('Create fundraising error:', error);
      showMessage('Fundraising creation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (projectIndex, decision) => {
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (userTier === 0) {
      showMessage('You need to register in a tier to vote', 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await voteInProject(qubicConnect, projectIndex, decision);
      
      if (result && result.success) {
        showMessage(`Vote ${decision ? 'YES' : 'NO'} submitted successfully!`);
        loadProjectsData();
        loadUserData();
      } else {
        showMessage(result?.error || 'Vote failed', 'error');
      }
    } catch (error) {
      console.error('Vote error:', error);
      showMessage('Vote failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInvest = async (fundraisingIndex, amount) => {
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    if (userTier === 0) {
      showMessage('You need to register in a tier to invest', 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await investInProject(qubicConnect, fundraisingIndex, amount);
      
      if (result && result.success) {
        showMessage('Investment successful!');
        loadProjectsData();
        loadUserData();
      } else {
        showMessage(result?.error || 'Investment failed', 'error');
      }
    } catch (error) {
      console.error('Investment error:', error);
      showMessage('Investment failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = () => {
    if (!message) return null;
    return (
      <div className={`message ${message.type}`}>
        {message.text}
      </div>
    );
  };

  const renderPlatformStats = () => {
    if (!platformStats) return null;

    return (
      <div className="platform-stats">
        <h3>🛸 Platform Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{platformStats.numberOfRegister || 0}</div>
            <div className="stat-label">Registered Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{platformStats.numberOfCreatedProject || 0}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{platformStats.numberOfFundaraising || 0}</div>
            <div className="stat-label">Active Fundraisings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatQU(platformStats.epochRevenue)}</div>
            <div className="stat-label">Epoch Revenue</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{platformStats.totalPoolWeight || 0}</div>
            <div className="stat-label">Total Pool Weight</div>
          </div>
        </div>
      </div>
    );
  };

  const renderUserTierStatus = () => {
    if (!isConnected) {
      return (
        <div className="alien-warning">
          Connect your wallet to access Nostromo tier system
        </div>
      );
    }

    const tierInfo = getTierInfo(userTier);
    
    return (
      <div className="tier-status-card">
        {userTier > 0 ? (
          <>
            <div className="tier-name">👽 {tierInfo.name} (Tier {userTier})</div>
            <div className="tier-details">
              <div className="tier-detail">
                <strong>Staked:</strong><br />
                {formatQU(tierInfo.stake)}
              </div>
              <div className="tier-detail">
                <strong>Pool Weight:</strong><br />
                {tierInfo.poolWeight}
              </div>
              <div className="tier-detail">
                <strong>Unstake Fee:</strong><br />
                {tierInfo.unstakeFee}%
              </div>
              <div className="tier-detail">
                <strong>Pool Share:</strong><br />
                {platformStats ? calculatePoolShare(userTier, platformStats.totalPoolWeight).toFixed(2) : 0}%
              </div>
            </div>
            {/* Upgrade Section - prominently displayed */}
            {userTier < 5 && (
              <div className="tier-upgrade-prominent" style={{ 
                background: 'linear-gradient(135deg, #1a3a1a, #2a4a2a)', 
                border: '2px solid #00ff88', 
                borderRadius: '12px', 
                padding: '1rem', 
                margin: '1rem 0',
                textAlign: 'center'
              }}>
                <h4 style={{ color: '#00ff88', margin: '0 0 0.5rem 0' }}>⬆️ Upgrade Available!</h4>
                {Object.entries(NOSTROMO_TIERS)
                  .filter(([tier]) => parseInt(tier) === userTier + 1) // Show only next tier
                  .map(([tier, info]) => {
                    const currentTierInfo = getTierInfo(userTier);
                    const upgradeCost = info.stake - currentTierInfo.stake;
                    
                    return (
                      <div key={tier} style={{ marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                          👽 {info.name} (Tier {tier})
                        </div>
                        <div style={{ color: '#ccc', marginBottom: '0.5rem' }}>
                          Cost: {formatQU(upgradeCost)} | +{info.poolWeight - currentTierInfo.poolWeight} Pool Weight
                        </div>
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleUpgradeTier(parseInt(tier))}
                          disabled={loading}
                          style={{ 
                            background: '#00ff88', 
                            color: '#000', 
                            fontWeight: 'bold',
                            border: 'none',
                            padding: '0.5rem 1rem'
                          }}
                        >
                          {loading ? 'Upgrading...' : `⬆️ Upgrade to ${info.name}`}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="btn-group">
              <button 
                className="btn btn-secondary" 
                onClick={loadUserData}
                disabled={loading}
              >
                🔄 Refresh Status
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleLogoutFromTier}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Logout from Tier'}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="tier-name">🚫 Not Registered</div>
            <p>Register in a tier to access Nostromo features</p>
            <div className="btn-group">
              <button 
                className="btn btn-secondary" 
                onClick={loadUserData}
                disabled={loading}
              >
                🔄 Check Status
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => (
    <div>
      {renderPlatformStats()}
      {renderUserTierStatus()}
      
      {isConnected && userInvestmentStats && (
        <div className="platform-stats">
          <h3>💼 Your Portfolio</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{userInvestmentStats.numberOfInvestedProjects || 0}</div>
              <div className="stat-label">Invested Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userInvestmentStats.numberOfClaimedProjects || 0}</div>
              <div className="stat-label">Claimed Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userVoteStatus?.numberOfVotedProjects || 0}</div>
              <div className="stat-label">Voted Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userProjects.length || 0}</div>
              <div className="stat-label">Created Projects</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTierManagement = () => (
    <div>
      {renderUserTierStatus()}
      
      <div className="tier-progression">
        <h3>🛸 Choose Your Tier</h3>
        <p>Select a tier to stake QU and gain access to platform features</p>
        
        {userTier === 0 && (
          <div className="message info" style={{ marginBottom: '1rem' }}>
            <strong>ℹ️ Registration Process:</strong><br />
            After clicking register, your transaction will be broadcast to the network. 
            It may take 1-2 minutes for the transaction to be processed and your tier status to update.
            Use the "Check Status" button to manually refresh if needed.
          </div>
        )}
        
        <div className="tier-grid">
          {Object.entries(NOSTROMO_TIERS).map(([tier, info]) => (
            <div 
              key={tier}
              className={`tier-card ${selectedTier == tier ? 'active' : ''} ${userTier > 0 ? 'disabled' : ''}`}
              onClick={() => userTier === 0 && setSelectedTier(parseInt(tier))}
            >
              <h4>👽 {info.name}</h4>
              <div><strong>Tier {tier}</strong></div>
              <div>Stake: {formatQU(info.stake)}</div>
              <div>Pool Weight: {info.poolWeight}</div>
              <div>Unstake Fee: {info.unstakeFee}%</div>
              
              <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                <strong>Benefits:</strong>
                <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
                  <li>✓ Vote on projects</li>
                  <li>✓ Earn revenue share</li>
                  {parseInt(tier) >= 4 && <li>✓ Create projects</li>}
                  {parseInt(tier) >= 4 && <li>✓ Phase 1 & 2 investment</li>}
                </ul>
              </div>
            </div>
          ))}
        </div>
        
        {userTier === 0 && (
          <div className="btn-group">
            <button 
              className="btn btn-primary" 
              onClick={handleRegisterInTier}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Register in ${NOSTROMO_TIERS[selectedTier].name} Tier`}
            </button>
          </div>
        )}

        {userTier > 0 && userTier < 5 && (
          <div className="upgrade-section" style={{ border: '2px solid #00ff00', padding: '1rem', margin: '1rem 0' }}>
            <h3>⬆️ Upgrade Your Tier</h3>
            <p>Upgrade to a higher tier for more benefits and higher pool weight</p>
            
            <div className="upgrade-options">
              {Object.entries(NOSTROMO_TIERS)
                .filter(([tier]) => parseInt(tier) > userTier)
                .map(([tier, info]) => {
                  const currentTierInfo = getTierInfo(userTier);
                  const upgradeCost = info.stake - currentTierInfo.stake;
                  
                  return (
                    <div key={tier} className="upgrade-option">
                      <div className="upgrade-info">
                        <strong>👽 {info.name} (Tier {tier})</strong>
                        <div>Upgrade Cost: {formatQU(upgradeCost)}</div>
                        <div>Additional Pool Weight: +{info.poolWeight - currentTierInfo.poolWeight}</div>
                      </div>
                      <button 
                        className="btn btn-accent" 
                        onClick={() => handleUpgradeTier(parseInt(tier))}
                        disabled={loading}
                      >
                        {loading ? 'Processing...' : `Upgrade to ${info.name}`}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        
        {/* Transaction Checker */}
        <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #333', borderRadius: '8px' }}>
          <h4>🔍 Check Last Transaction</h4>
          <p>If your tier didn't update after registration, check your last transaction status:</p>
          <button 
            className="btn btn-secondary" 
            onClick={() => checkTransactionStatus('szpbmxcoyeeuqcggpuyyprhbevmgmhilqaumindgghqgunkbyjfrszghjfxk')}
            disabled={loading}
          >
            Check TX: szpb...xk (Latest)
          </button>
        </div>
      </div>
    </div>
  );

  const renderProjects = () => (
    <div>
      <div className="nostromo-form">
        <h3>🚀 Create New Project</h3>
        <div className="message info" style={{ marginBottom: '1rem' }}>
          <strong>📋 Two-Step Process:</strong><br />
          1. First create a project with voting period<br />
          2. After voting passes, create fundraising with detailed parameters
        </div>
        
        <div className="message info" style={{ marginBottom: '1rem' }}>
          <strong>⏰ All times are in UTC.</strong> Your local time will be converted to UTC for the contract.<br />
        </div>
        
        {userTier < 4 ? (
          <div className="message warning">
            You need to be Tier 4 (XENOMORPH) or higher to create projects
          </div>
        ) : (
          <form onSubmit={handleCreateProject}>
            <div className="form-row">
              <div className="form-field">
                <label>Token Name</label>
                <input
                  type="text"
                  value={projectForm.tokenName}
                  onChange={(e) => setProjectForm({...projectForm, tokenName: e.target.value})}
                  placeholder="e.g., MYTOKEN"
                  maxLength="8"
                  required
                />
              </div>
              <div className="form-field">
                <label>Token Supply</label>
                <input
                  type="number"
                  value={projectForm.supply}
                  onChange={(e) => setProjectForm({...projectForm, supply: e.target.value})}
                  placeholder="e.g., 1000000"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Voting Start Date</label>
                <input
                  type="datetime-local"
                  value={projectForm.startDate}
                  onChange={(e) => setProjectForm({...projectForm, startDate: e.target.value})}
                  required
                />
                {projectForm.startDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(projectForm.startDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Voting End Date</label>
                <input
                  type="datetime-local"
                  value={projectForm.endDate}
                  onChange={(e) => setProjectForm({...projectForm, endDate: e.target.value})}
                  required
                />
                {projectForm.endDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(projectForm.endDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : `Create Project (${formatQU(NOSTROMO_FEES.CREATE_PROJECT)} fee)`}
            </button>
          </form>
        )}
      </div>

      <div className="nostromo-form">
        <h3>💰 Create Fundraising</h3>
        <div className="message info" style={{ marginBottom: '1rem' }}>
          <strong>⚠️ Requirements:</strong><br />
          • Project must exist and voting must have passed (YES &gt; NO)<br />
          • Voting period must be completed<br />
          • Only project creator can create fundraising
        </div>
        
        <div className="message info" style={{ marginBottom: '1rem' }}>
          <strong>⏰ All times are in UTC.</strong> Your local time will be converted to UTC for the contract.<br />
        </div>
        
        {userTier < 4 ? (
          <div className="message warning">
            You need to be Tier 4 (XENOMORPH) or higher to create fundraising
          </div>
        ) : (
          <form onSubmit={handleCreateFundraising}>
            {/* Basic Fundraising Info */}
            <h4>💼 Basic Information</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Project Index</label>
                <input
                  type="number"
                  value={fundraisingForm.indexOfProject}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, indexOfProject: e.target.value})}
                  placeholder="e.g., 0"
                  required
                />
                <small>Index of your approved project</small>
              </div>
              <div className="form-field">
                <label>Token Price (QU per token)</label>
                <input
                  type="number"
                  value={fundraisingForm.tokenPrice}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, tokenPrice: e.target.value})}
                  placeholder="e.g., 1000000"
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-field">
                <label>Tokens for Sale</label>
                <input
                  type="number"
                  value={fundraisingForm.soldAmount}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, soldAmount: e.target.value})}
                  placeholder="e.g., 500000"
                  required
                />
              </div>
              <div className="form-field">
                <label>Required Funds (QU)</label>
                <input
                  type="number"
                  value={fundraisingForm.requiredFunds}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, requiredFunds: e.target.value})}
                  placeholder="e.g., 500000000000"
                  required
                />
              </div>
            </div>

            {/* Tokenomics */}
            <h4>📊 Tokenomics</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Threshold (%)</label>
                <input
                  type="number"
                  value={fundraisingForm.threshold}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, threshold: e.target.value})}
                  min="0"
                  max="50"
                  required
                />
                <small>Max cap = required funds + threshold%</small>
              </div>
              <div className="form-field">
                <label>TGE (%)</label>
                <input
                  type="number"
                  value={fundraisingForm.TGE}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, TGE: e.target.value})}
                  min="0"
                  max="50"
                  required
                />
                <small>Token Generation Event unlock</small>
              </div>
              <div className="form-field">
                <label>Vesting Steps</label>
                <input
                  type="number"
                  value={fundraisingForm.stepOfVesting}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, stepOfVesting: e.target.value})}
                  min="1"
                  max="12"
                  required
                />
                <small>Number of vesting periods</small>
              </div>
            </div>

            {/* Phase 1 - Tier-based */}
            <h4>🥇 Phase 1 (All Tiers)</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Phase 1 Start</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.firstPhaseStartDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, firstPhaseStartDate: e.target.value})}
                  required
                />
                {fundraisingForm.firstPhaseStartDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.firstPhaseStartDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Phase 1 End</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.firstPhaseEndDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, firstPhaseEndDate: e.target.value})}
                  required
                />
                {fundraisingForm.firstPhaseEndDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.firstPhaseEndDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Phase 2 - High tiers only */}
            <h4>🥈 Phase 2 (Tier 4+ Only)</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Phase 2 Start</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.secondPhaseStartDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, secondPhaseStartDate: e.target.value})}
                  required
                />
                {fundraisingForm.secondPhaseStartDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.secondPhaseStartDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Phase 2 End</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.secondPhaseEndDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, secondPhaseEndDate: e.target.value})}
                  required
                />
                {fundraisingForm.secondPhaseEndDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.secondPhaseEndDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Phase 3 - Public */}
            <h4>🥉 Phase 3 (Public)</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Phase 3 Start</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.thirdPhaseStartDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, thirdPhaseStartDate: e.target.value})}
                  required
                />
                {fundraisingForm.thirdPhaseStartDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.thirdPhaseStartDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Phase 3 End</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.thirdPhaseEndDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, thirdPhaseEndDate: e.target.value})}
                  required
                />
                {fundraisingForm.thirdPhaseEndDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.thirdPhaseEndDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Listing and Vesting */}
            <h4>📈 Listing & Vesting Schedule</h4>
            <div className="form-row">
              <div className="form-field">
                <label>Listing Start</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.listingStartDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, listingStartDate: e.target.value})}
                  required
                />
                {fundraisingForm.listingStartDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.listingStartDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
                <small>When TGE tokens unlock</small>
              </div>
              <div className="form-field">
                <label>Cliff End</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.cliffEndDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, cliffEndDate: e.target.value})}
                  required
                />
                {fundraisingForm.cliffEndDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.cliffEndDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
                <small>When vesting starts</small>
              </div>
              <div className="form-field">
                <label>Vesting End</label>
                <input
                  type="datetime-local"
                  value={fundraisingForm.vestingEndDate}
                  onChange={(e) => setFundraisingForm({...fundraisingForm, vestingEndDate: e.target.value})}
                  required
                />
                {fundraisingForm.vestingEndDate && (
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    UTC: {(() => {
                      const d = new Date(fundraisingForm.vestingEndDate);
                      return d.toISOString().replace('T', ' ').substring(0, 16);
                    })()}
                  </div>
                )}
                <small>When all tokens unlock</small>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : `Create Fundraising (${formatQU(NOSTROMO_FEES.QX_TOKEN_ISSUANCE)} fee)`}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const renderVoting = () => (
    <div>
      <h3>🗳️ Projects Awaiting Your Vote</h3>
      <div className="message info" style={{ marginBottom: '1rem' }}>
        <strong>ℹ️ How Voting Works:</strong><br />
        • All tier holders can vote on projects<br />
        • Projects need YES &gt; NO to proceed to fundraising<br />
        • You can vote on up to 64 projects per epoch
      </div>
      
      {!isConnected ? (
        <div className="message warning">
          Connect your wallet to vote on projects
        </div>
      ) : userTier === 0 ? (
        <div className="message warning">
          You need to register in a tier to vote on projects
        </div>
      ) : projects.length === 0 ? (
        <div className="message">
          <p>No projects available for voting at the moment.</p>
          <p>Projects need to be created by Tier 4+ users before voting can begin.</p>
          <small>Loaded {projects.length} projects from contract</small>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.filter(project => project && typeof project === 'object').map((project) => {
            // Add debugging info
            console.log('[Nostromo] Rendering project:', project);
            
            return (
              <div key={project.index} className="project-card">
                <div className="project-header">
                  <div className="project-name">
                    {uint64ToTokenName(project.tokenName)}
                  </div>
                  <div className="project-status status-voting">
                    🗳️ Voting Active
                  </div>
                </div>
                
                <div>
                  <strong>Creator:</strong> {project.creator ? `${project.creator.substring(0, 8)}...${project.creator.substring(project.creator.length - 8)}` : 'Unknown'}
                </div>
                <div>
                  <strong>Supply:</strong> {project.supplyOfToken ? project.supplyOfToken.toLocaleString() : 'N/A'}
                </div>
                <div>
                  <strong>Voting Period:</strong> Active
                </div>
                
                <div className="project-votes">
                  <div className="vote-count vote-yes">
                    <div className="vote-number">{project.numberOfYes || 0}</div>
                    <div>YES</div>
                  </div>
                  <div className="vote-count vote-no">
                    <div className="vote-number">{project.numberOfNo || 0}</div>
                    <div>NO</div>
                  </div>
                </div>
                
                {project.isCreatedFundarasing && (
                  <div className="message success" style={{ fontSize: '0.8rem', margin: '0.5rem 0' }}>
                    ✅ Fundraising Created - Check Fundraising tab!
                  </div>
                )}
                
                <div className="btn-group">
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleVote(project.index, true)}
                    disabled={loading}
                  >
                    👍 Vote YES
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleVote(project.index, false)}
                    disabled={loading}
                  >
                    👎 Vote NO
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderFundraising = () => (
    <div>
      <h3>💰 Active Fundraisings - Invest Now!</h3>
      <div className="message info" style={{ marginBottom: '1rem' }}>
        <strong>💡 Investment Phases:</strong><br />
        • <strong>Phase 1:</strong> All tiers (tier-weighted allocation)<br />
        • <strong>Phase 2:</strong> Tier 4+ only (XENOMORPH/WARRIOR)<br />
        • <strong>Phase 3:</strong> Public (no restrictions)
      </div>
      
      {!isConnected ? (
        <div className="message warning">
          Connect your wallet to invest in fundraisings
        </div>
      ) : userTier === 0 ? (
        <div className="message warning">
          You need to register in a tier to invest in fundraisings
        </div>
      ) : fundraisings.length === 0 ? (
        <div className="message">
          <p>No active fundraisings found.</p>
          <p>Fundraisings are created after projects pass the voting stage (YES &gt; NO votes).</p>
          <p>Check back later or vote on projects to help them reach fundraising stage!</p>
          <small>Loaded {fundraisings.length} fundraisings from contract</small>
        </div>
      ) : (
        <div className="projects-grid">
          {fundraisings.filter(fundraising => fundraising && typeof fundraising === 'object').map((fundraising) => {
            console.log('[Nostromo] Rendering fundraising:', fundraising);
            
            const progress = fundraising.requiredFunds && fundraising.requiredFunds > 0 
              ? (fundraising.raisedFunds / fundraising.requiredFunds) * 100 
              : 0;
            
            return (
              <div key={fundraising.index} className="fundraising-card">
                <div className="fundraising-header">
                  <div className="project-name">
                    Fundraising #{fundraising.index}
                  </div>
                  <div className="project-status status-voting">
                    💰 Live Investment
                  </div>
                </div>
                
                <div>
                  <strong>Token Price:</strong> {formatQU(fundraising.tokenPrice)}
                </div>
                <div>
                  <strong>Required:</strong> {formatQU(fundraising.requiredFunds)}
                </div>
                <div>
                  <strong>TGE:</strong> {fundraising.TGE || 0}% | <strong>Vesting:</strong> {fundraising.stepOfVesting || 0} steps
                </div>
                
                <div className="fundraising-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {formatQU(fundraising.raisedFunds)} / {formatQU(fundraising.requiredFunds)} ({progress.toFixed(1)}%)
                  </div>
                </div>
                
                <div className="btn-group">
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      const amount = prompt('Enter investment amount (QU):');
                      if (amount) handleInvest(fundraising.index, amount);
                    }}
                    disabled={loading}
                  >
                    💰 Invest Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPortfolio = () => (
    <div>
      <h3>💼 Your Investment Portfolio</h3>
      {!isConnected ? (
        <div className="message warning">
          Connect your wallet to view your portfolio
        </div>
      ) : (
        <div className="loading-overlay">
          <div>Portfolio functionality coming soon...</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="nostromo-container">
      <h1>🛸 NOSTROMO - Project Funding Platform</h1>
      
      <div className="alien-warning">
        Welcome to the Nostromo platform. Stake QU, vote on projects, and earn rewards.
        Higher tiers unlock exclusive benefits and investment opportunities.
      </div>

      {renderMessage()}

      <div className="tabs">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''} 
          onClick={() => handleTabClick('dashboard')}
        >
          🏠 Dashboard
        </button>
        <button 
          className={activeTab === 'tiers' ? 'active' : ''} 
          onClick={() => handleTabClick('tiers')}
        >
          👽 Tier Management
        </button>
        <button 
          className={activeTab === 'voting' ? 'active' : ''} 
          onClick={() => handleTabClick('voting')}
        >
          🗳️ Vote on Projects
        </button>
        <button 
          className={activeTab === 'fundraising' ? 'active' : ''} 
          onClick={() => handleTabClick('fundraising')}
        >
          💰 Invest in Fundraising
        </button>
        <button 
          className={activeTab === 'projects' ? 'active' : ''} 
          onClick={() => handleTabClick('projects')}
        >
          🚀 Create Projects
        </button>
        <button 
          className={activeTab === 'portfolio' ? 'active' : ''} 
          onClick={() => handleTabClick('portfolio')}
        >
          💼 Portfolio
        </button>
      </div>

      <div className="tab-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <span style={{ marginLeft: '1rem' }}>Loading...</span>
          </div>
        )}
        
        {!loading && activeTab === 'dashboard' && renderDashboard()}
        {!loading && activeTab === 'tiers' && renderTierManagement()}
        {!loading && activeTab === 'voting' && renderVoting()}
        {!loading && activeTab === 'fundraising' && renderFundraising()}
        {!loading && activeTab === 'projects' && renderProjects()}
        {!loading && activeTab === 'portfolio' && renderPortfolio()}
      </div>
    </div>
  );
}

export default Nostromo; 