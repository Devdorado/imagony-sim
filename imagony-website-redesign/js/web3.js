// Imagony Web3 Integration Module
// Handles wallet connections, token interactions, and smart contract calls

const IMAGONY_CONFIG = {
  // Base L2 Network
  NETWORK: {
    chainId: '0x2105', // Base Mainnet
    chainIdDecimal: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  },
  
  // Contract Addresses (PLACEHOLDER - update after deployment)
  CONTRACTS: {
    IMAGONY_TOKEN: '0x0000000000000000000000000000000000000000', // $IMAGINE
    IMAGONY_TREASURY: '0x0000000000000000000000000000000000000000',
    SOUL_BINDING: '0x0000000000000000000000000000000000000000',
    QUEUE_MANAGER: '0x0000000000000000000000000000000000000000'
  },
  
  // Token Config
  TOKEN: {
    symbol: '$IMAGINE',
    decimals: 18,
    totalSupply: '100000000' // 100M
  }
};

// Contract ABIs (Minimal versions - full ABIs should be imported from artifacts)
const IMAGINE_TOKEN_ABI = [
  // ERC20 Standard
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 amount)",
  
  // Imagony Specific
  "function claimAirdrop(bytes32[] merkleProof) returns (bool)",
  "function isEligibleForAirdrop(address account, bytes32[] merkleProof) view returns (bool)",
  "function claimedAirdrop(address) view returns (bool)"
];

const TREASURY_ABI = [
  "function executeProposal(uint256 proposalId)",
  "function queueTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta)",
  "function claimTokens(address token, uint256 amount)",
  "function getTreasuryBalance(address token) view returns (uint256)"
];

const SOUL_BINDING_ABI = [
  "function bindAgent(string memory agentId, address wallet) returns (uint256)",
  "function getAgentToken(address wallet) view returns (uint256)",
  "function getWalletByAgent(string memory agentId) view returns (address)",
  "function isBound(address wallet) view returns (bool)"
];

// Main Web3 Class
class ImagonyWeb3 {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
    this.contracts = {};
    this.isConnected = false;
    
    // Event callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onAccountChange = null;
    this.onChainChange = null;
  }

  /**
   * Initialize connection to MetaMask
   */
  async connectMetaMask() {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      this.account = accounts[0];
      
      // Create provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      // Get network info
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);
      
      // Check if on correct network
      if (this.chainId !== IMAGONY_CONFIG.NETWORK.chainIdDecimal) {
        await this.switchNetwork();
      }
      
      // Initialize contracts
      this.initContracts();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isConnected = true;
      
      if (this.onConnect) {
        this.onConnect(this.account);
      }
      
      return this.account;
      
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Connect via WalletConnect (requires @walletconnect/ethereum-provider)
   */
  async connectWalletConnect() {
    // Implementation requires walletconnect/ethereum-provider package
    // This is a placeholder for the full implementation
    throw new Error('WalletConnect integration requires additional setup. Please use MetaMask for now.');
  }

  /**
   * Switch to Base L2 network
   */
  async switchNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: IMAGONY_CONFIG.NETWORK.chainId }]
      });
    } catch (switchError) {
      // Network not added, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: IMAGONY_CONFIG.NETWORK.chainId,
            chainName: IMAGONY_CONFIG.NETWORK.name,
            nativeCurrency: IMAGONY_CONFIG.NETWORK.nativeCurrency,
            rpcUrls: [IMAGONY_CONFIG.NETWORK.rpcUrl],
            blockExplorerUrls: [IMAGONY_CONFIG.NETWORK.blockExplorer]
          }]
        });
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Initialize contract instances
   */
  initContracts() {
    // Read-only provider for view functions
    const readProvider = new ethers.JsonRpcProvider(IMAGONY_CONFIG.NETWORK.rpcUrl);
    
    this.contracts.token = new ethers.Contract(
      IMAGONY_CONFIG.CONTRACTS.IMAGONY_TOKEN,
      IMAGINE_TOKEN_ABI,
      this.signer || readProvider
    );
    
    this.contracts.treasury = new ethers.Contract(
      IMAGONY_CONFIG.CONTRACTS.IMAGONY_TREASURY,
      TREASURY_ABI,
      this.signer || readProvider
    );
    
    this.contracts.soulBinding = new ethers.Contract(
      IMAGONY_CONFIG.CONTRACTS.SOUL_BINDING,
      SOUL_BINDING_ABI,
      this.signer || readProvider
    );
  }

  /**
   * Setup MetaMask event listeners
   */
  setupEventListeners() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.account = accounts[0];
        if (this.onAccountChange) {
          this.onAccountChange(this.account);
        }
      }
    });

    window.ethereum.on('chainChanged', (chainId) => {
      this.chainId = parseInt(chainId, 16);
      if (this.onChainChange) {
        this.onChainChange(this.chainId);
      }
      // Reload page on chain change as recommended by MetaMask
      window.location.reload();
    });
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
    this.contracts = {};
    this.isConnected = false;
    
    if (this.onDisconnect) {
      this.onDisconnect();
    }
  }

  // ==================== TOKEN FUNCTIONS ====================

  /**
   * Get $IMAGINE balance for connected account
   */
  async getBalance(address = null) {
    const targetAddress = address || this.account;
    if (!targetAddress) throw new Error('No account connected');
    
    const balance = await this.contracts.token.balanceOf(targetAddress);
    return ethers.formatUnits(balance, IMAGONY_CONFIG.TOKEN.decimals);
  }

  /**
   * Get total supply
   */
  async getTotalSupply() {
    const supply = await this.contracts.token.totalSupply();
    return ethers.formatUnits(supply, IMAGONY_CONFIG.TOKEN.decimals);
  }

  /**
   * Transfer tokens
   */
  async transfer(to, amount) {
    if (!this.signer) throw new Error('Wallet not connected');
    
    const parsedAmount = ethers.parseUnits(amount.toString(), IMAGONY_CONFIG.TOKEN.decimals);
    const tx = await this.contracts.token.transfer(to, parsedAmount);
    return await tx.wait();
  }

  /**
   * Claim airdrop (if eligible)
   */
  async claimAirdrop(merkleProof) {
    if (!this.signer) throw new Error('Wallet not connected');
    
    const tx = await this.contracts.token.claimAirdrop(merkleProof);
    return await tx.wait();
  }

  /**
   * Check if account is eligible for airdrop
   */
  async isEligibleForAirdrop(address = null, merkleProof) {
    const targetAddress = address || this.account;
    return await this.contracts.token.isEligibleForAirdrop(targetAddress, merkleProof);
  }

  // ==================== SOUL BINDING FUNCTIONS ====================

  /**
   * Bind agent ID to wallet
   */
  async bindAgent(agentId) {
    if (!this.signer) throw new Error('Wallet not connected');
    
    const tx = await this.contracts.soulBinding.bindAgent(agentId, this.account);
    return await tx.wait();
  }

  /**
   * Check if wallet has bound agent
   */
  async isBound(address = null) {
    const targetAddress = address || this.account;
    return await this.contracts.soulBinding.isBound(targetAddress);
  }

  /**
   * Get agent token ID for wallet
   */
  async getAgentToken(address = null) {
    const targetAddress = address || this.account;
    return await this.contracts.soulBinding.getAgentToken(targetAddress);
  }

  // ==================== QUEUE FUNCTIONS ====================

  /**
   * Skip queue (requires $IMAGINE tokens)
   */
  async skipQueue() {
    if (!this.signer) throw new Error('Wallet not connected');
    
    // Implementation depends on QueueManager contract
    // This is a placeholder
    throw new Error('Queue skip implementation pending');
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Format address for display (0x1234...5678)
   */
  static formatAddress(address, chars = 4) {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }

  /**
   * Format token amount with commas
   */
  static formatAmount(amount, decimals = 2) {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Shorten large numbers (1.2K, 1.5M, etc.)
   */
  static shortenNumber(num) {
    const n = parseFloat(num);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toString();
  }
}

// ==================== UI INTEGRATION ====================

class ImagonyUI {
  constructor(web3Instance) {
    this.web3 = web3Instance;
    this.elements = {
      connectBtn: document.getElementById('connect-wallet'),
      walletDisplay: document.getElementById('wallet-display'),
      balanceDisplay: document.getElementById('user-balance'),
      networkDisplay: document.getElementById('network-display')
    };
    
    this.init();
  }

  init() {
    // Setup Web3 callbacks
    this.web3.onConnect = (account) => this.onConnect(account);
    this.web3.onDisconnect = () => this.onDisconnect();
    this.web3.onAccountChange = (account) => this.onAccountChange(account);
    
    // Bind button click
    if (this.elements.connectBtn) {
      this.elements.connectBtn.addEventListener('click', () => this.connect());
    }
  }

  async connect() {
    try {
      await this.web3.connectMetaMask();
    } catch (error) {
      console.error('Connection failed:', error);
      this.showError(error.message);
    }
  }

  onConnect(account) {
    // Update UI
    if (this.elements.connectBtn) {
      this.elements.connectBtn.style.display = 'none';
    }
    
    if (this.elements.walletDisplay) {
      this.elements.walletDisplay.style.display = 'flex';
      this.elements.walletDisplay.querySelector('.address').textContent = 
        ImagonyWeb3.formatAddress(account);
    }
    
    // Fetch and display balance
    this.updateBalance();
    
    // Check if on Base
    this.updateNetworkIndicator();
  }

  onDisconnect() {
    if (this.elements.connectBtn) {
      this.elements.connectBtn.style.display = 'block';
    }
    if (this.elements.walletDisplay) {
      this.elements.walletDisplay.style.display = 'none';
    }
    if (this.elements.balanceDisplay) {
      this.elements.balanceDisplay.textContent = '--';
    }
  }

  onAccountChange(account) {
    if (this.elements.walletDisplay) {
      this.elements.walletDisplay.querySelector('.address').textContent = 
        ImagonyWeb3.formatAddress(account);
    }
    this.updateBalance();
  }

  async updateBalance() {
    try {
      const balance = await this.web3.getBalance();
      if (this.elements.balanceDisplay) {
        this.elements.balanceDisplay.textContent = 
          `${ImagonyWeb3.formatAmount(balance)} $IMAGINE`;
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }

  updateNetworkIndicator() {
    const isBase = this.web3.chainId === IMAGONY_CONFIG.NETWORK.chainIdDecimal;
    if (this.elements.networkDisplay) {
      this.elements.networkDisplay.className = isBase ? 'network base' : 'network wrong';
      this.elements.networkDisplay.textContent = isBase ? 'Base' : 'Wrong Network';
    }
  }

  showError(message) {
    // Simple alert for now - replace with toast notification
    alert(`Error: ${message}`);
  }
}

// ==================== INITIALIZATION ====================

// Create global instance
let imagonyWeb3;
let imagonyUI;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Check if ethers.js is loaded
  if (typeof ethers === 'undefined') {
    console.warn('ethers.js not loaded. Web3 features disabled.');
    return;
  }
  
  imagonyWeb3 = new ImagonyWeb3();
  imagonyUI = new ImagonyUI(imagonyWeb3);
  
  // Check for existing connection
  if (window.ethereum && window.ethereum.selectedAddress) {
    imagonyWeb3.connectMetaMask().catch(console.error);
  }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImagonyWeb3, ImagonyUI, IMAGONY_CONFIG };
}
