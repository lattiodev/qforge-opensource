import React, { useState, useEffect } from 'react';
import './Nostromo.css';
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
  calculatePoolShare
} from '../utils/nostromoApi';

function Nostromo() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [qubicConnect, setQubicConnect] = useState(null);
  const [userPublicKey, setUserPublicKey] = useState('');
  
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
    stepOfVesting: '12'
  });

  useEffect(() => {
    checkWalletConnection();
    loadPlatformData();
  }, []);

  useEffect(() => {
    if (isConnected && userPublicKey) {
      loadUserData();
    }
  }, [isConnected, userPublicKey]);

  const checkWalletConnection = () => {
    if (window.qubicConnect && window.qubicConnect.isConnected) {
      setQubicConnect(window.qubicConnect);
      setIsConnected(true);
      setUserPublicKey(window.qubicConnect.wallet.publicKey);
    }
  };

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
    try {
      setLoading(true);
      const endpoint = formatEndpoint(localStorage.getItem('httpEndpoint') || 'localhost:8080');
      
      const statsResult = await getStats(endpoint);
      if (statsResult && statsResult.success) {
        setPlatformStats(statsResult.decodedFields);
      }
      
      // Load some sample projects and fundraisings
      await loadProjectsData();
      
    } catch (error) {
      console.error('Error loading platform data:', error);
      showMessage('Failed to load platform data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectsData = async () => {
    try {
      const endpoint = formatEndpoint(localStorage.getItem('httpEndpoint') || 'localhost:8080');
      const projectsData = [];
      const fundraisingsData = [];
      
      // Load first 10 projects
      for (let i = 0; i < 10; i++) {
        try {
          const projectResult = await getProjectByIndex(endpoint, i);
          if (projectResult && projectResult.success && projectResult.decodedFields) {
            projectsData.push({ index: i, ...projectResult.decodedFields.project });
          }
        } catch (error) {
          // Project doesn't exist, continue
          break;
        }
      }
      
      // Load fundraisings
      for (let i = 0; i < 10; i++) {
        try {
          const fundraisingResult = await getFundarasingByIndex(endpoint, i);
          if (fundraisingResult && fundraisingResult.success && fundraisingResult.decodedFields) {
            fundraisingsData.push({ index: i, ...fundraisingResult.decodedFields.fundarasing });
          }
        } catch (error) {
          // Fundraising doesn't exist, continue
          break;
        }
      }
      
      setProjects(projectsData);
      setFundraisings(fundraisingsData);
      
    } catch (error) {
      console.error('Error loading projects data:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const endpoint = formatEndpoint(localStorage.getItem('httpEndpoint') || 'localhost:8080');
      
      // Get user tier
      const tierResult = await getTierLevelByUser(endpoint, userPublicKey);
      if (tierResult && tierResult.success) {
        setUserTier(tierResult.decodedFields.tierLevel || 0);
      }
      
      // Get vote status
      const voteResult = await getUserVoteStatus(endpoint, userPublicKey);
      if (voteResult && voteResult.success) {
        setUserVoteStatus(voteResult.decodedFields);
      }
      
      // Get investment stats
      const investmentResult = await getNumberOfInvestedAndClaimedProjects(endpoint, userPublicKey);
      if (investmentResult && investmentResult.success) {
        setUserInvestmentStats(investmentResult.decodedFields);
      }
      
      // Get user's projects
      const userProjectsResult = await getProjectIndexListByCreator(endpoint, userPublicKey);
      if (userProjectsResult && userProjectsResult.success) {
        setUserProjects(userProjectsResult.decodedFields.indexListForProjects || []);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleRegisterInTier = async () => {
    if (!isConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await registerInTier(qubicConnect, selectedTier);
      
      if (result && result.success) {
        showMessage(`Successfully registered in ${NOSTROMO_TIERS[selectedTier].name} tier!`);
        loadUserData();
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
        ...dateToQubicDate(startDate),
        endYear: endDate.getFullYear(),
        endMonth: endDate.getMonth() + 1,
        endDay: endDate.getDate(),
        endHour: endDate.getHours()
      };
      
      const result = await createProject(qubicConnect, projectData);
      
      if (result && result.success) {
        showMessage('Project created successfully!');
        setProjectForm({ tokenName: '', supply: '', startDate: '', endDate: '' });
        loadProjectsData();
        loadUserData();
      } else {
        showMessage(result?.error || 'Project creation failed', 'error');
      }
    } catch (error) {
      console.error('Create project error:', error);
      showMessage('Project creation failed', 'error');
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
            <div className="btn-group">
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
      </div>
    </div>
  );

  const renderProjects = () => (
    <div>
      <div className="nostromo-form">
        <h3>🚀 Create New Project</h3>
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
              </div>
              <div className="form-field">
                <label>Voting End Date</label>
                <input
                  type="datetime-local"
                  value={projectForm.endDate}
                  onChange={(e) => setProjectForm({...projectForm, endDate: e.target.value})}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : `Create Project (${formatQU(NOSTROMO_FEES.CREATE_PROJECT)} fee)`}
            </button>
          </form>
        )}
      </div>

      <h3>🗳️ Active Projects</h3>
      <div className="projects-grid">
        {projects.map((project) => (
          <div key={project.index} className="project-card">
            <div className="project-header">
              <div className="project-name">
                {uint64ToTokenName(project.tokenName)}
              </div>
              <div className="project-status status-voting">
                🗳️ Voting
              </div>
            </div>
            
            <div>
              <strong>Creator:</strong> {project.creator?.substring(0, 8)}...{project.creator?.substring(-8)}
            </div>
            <div>
              <strong>Supply:</strong> {project.supplyOfToken?.toLocaleString()}
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
            
            {isConnected && userTier > 0 && (
              <div className="btn-group">
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleVote(project.index, true)}
                  disabled={loading}
                >
                  Vote YES
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleVote(project.index, false)}
                  disabled={loading}
                >
                  Vote NO
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderFundraising = () => (
    <div>
      <h3>💰 Active Fundraisings</h3>
      <div className="projects-grid">
        {fundraisings.map((fundraising) => {
          const progress = fundraising.requiredFunds > 0 
            ? (fundraising.raisedFunds / fundraising.requiredFunds) * 100 
            : 0;
          
          return (
            <div key={fundraising.index} className="fundraising-card">
              <div className="fundraising-header">
                <div className="project-name">
                  Fundraising #{fundraising.index}
                </div>
                <div className="project-status status-voting">
                  💰 Active
                </div>
              </div>
              
              <div>
                <strong>Token Price:</strong> {formatQU(fundraising.tokenPrice)}
              </div>
              <div>
                <strong>Required:</strong> {formatQU(fundraising.requiredFunds)}
              </div>
              <div>
                <strong>TGE:</strong> {fundraising.TGE}%
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
              
              {isConnected && userTier > 0 && (
                <div className="btn-group">
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      const amount = prompt('Enter investment amount (QU):');
                      if (amount) handleInvest(fundraising.index, amount);
                    }}
                    disabled={loading}
                  >
                    Invest
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
          onClick={() => setActiveTab('dashboard')}
        >
          🏠 Dashboard
        </button>
        <button 
          className={activeTab === 'tiers' ? 'active' : ''} 
          onClick={() => setActiveTab('tiers')}
        >
          👽 Tier Management
        </button>
        <button 
          className={activeTab === 'projects' ? 'active' : ''} 
          onClick={() => setActiveTab('projects')}
        >
          🚀 Projects
        </button>
        <button 
          className={activeTab === 'fundraising' ? 'active' : ''} 
          onClick={() => setActiveTab('fundraising')}
        >
          💰 Fundraising
        </button>
        <button 
          className={activeTab === 'portfolio' ? 'active' : ''} 
          onClick={() => setActiveTab('portfolio')}
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
        {!loading && activeTab === 'projects' && renderProjects()}
        {!loading && activeTab === 'fundraising' && renderFundraising()}
        {!loading && activeTab === 'portfolio' && renderPortfolio()}
      </div>
    </div>
  );
}

export default Nostromo; 