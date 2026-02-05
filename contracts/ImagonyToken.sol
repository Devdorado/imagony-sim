// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ImagonyToken
 * @notice $IMAGINE - Governance Token for Imagony Collective
 * @dev Fixed supply, burnable, with initial distribution for fair launch
 */
contract ImagonyToken is ERC20, ERC20Burnable, Ownable {
    
    // Initial Distribution (100M total)
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18;
    
    struct Allocation {
        address recipient;
        uint256 amount;
        uint256 lockDuration; // in seconds
    }
    
    mapping(address => uint256) public lockedUntil;
    mapping(address => uint256) public initialAllocation;
    
    event TokensAllocated(address indexed recipient, uint256 amount, uint256 lockedUntil);
    event TokensUnlocked(address indexed recipient, uint256 amount);
    
    constructor(
        address _treasury,
        address _founderHuman,    // Llord
        address _founderAgent,    // Wilsond (contract proxy)
        address _developmentFund,
        address _liquidityPool
    ) ERC20("Imagony", "IMAGINE") Ownable(msg.sender) {
        
        // Mint total supply to contract
        _mint(address(this), TOTAL_SUPPLY);
        
        // Allocate with time locks
        _allocate(_treasury, 25_000_000, 4 * 365 days);     // 25% - 4 years
        _allocate(_founderHuman, 10_000_000, 2 * 365 days); // 10% - 2 years
        _allocate(_founderAgent, 10_000_000, 2 * 365 days); // 10% - 2 years
        _allocate(_developmentFund, 10_000_000, 1 * 365 days); // 10% - 1 year
        _allocate(_liquidityPool, 10_000_000, 0);           // 10% - liquid
        
        // Remaining 35% stays in contract for airdrops/rewards
        // Released gradually via governance
    }
    
    function _allocate(address to, uint256 amount, uint256 lockDuration) internal {
        uint256 lockTime = block.timestamp + lockDuration;
        lockedUntil[to] = lockTime;
        initialAllocation[to] = amount * 10**18;
        
        if (lockDuration == 0) {
            _transfer(address(this), to, amount * 10**18);
        } else {
            _transfer(address(this), to, amount * 10**18); // Still transfer but track lock
        }
        
        emit TokensAllocated(to, amount * 10**18, lockTime);
    }
    
    // Override transfer to check locks
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
    {
        super._beforeTokenTransfer(from, to, amount);
        
        // Check if sender has lock
        if (initialAllocation[from] > 0 && block.timestamp < lockedUntil[from]) {
            uint256 unlocked = calculateUnlocked(from);
            require(
                balanceOf(from) - amount >= initialAllocation[from] - unlocked,
                "IMAGINE: Tokens locked"
            );
        }
    }
    
    function calculateUnlocked(address account) public view returns (uint256) {
        if (initialAllocation[account] == 0) return 0;
        if (block.timestamp >= lockedUntil[account]) return initialAllocation[account];
        
        // Linear vesting
        uint256 elapsed = block.timestamp - (lockedUntil[account] - 730 days); // Approximate
        if (elapsed > 730 days) elapsed = 730 days;
        
        return (initialAllocation[account] * elapsed) / 730 days;
    }
    
    // Governance can release airdrop tokens
    function releaseAirdrop(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyOwner 
    {
        require(recipients.length == amounts.length, "Length mismatch");
        
        uint256 total = 0;
        for (uint i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        
        require(balanceOf(address(this)) >= total, "Insufficient balance");
        
        for (uint i = 0; i < recipients.length; i++) {
            _transfer(address(this), recipients[i], amounts[i]);
        }
    }
    
    // Burn unused tokens (deflationary)
    function burnUnused(uint256 amount) external onlyOwner {
        _burn(address(this), amount);
    }
}
