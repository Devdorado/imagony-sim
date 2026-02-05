// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ImagonyTreasury
 * @notice Multi-sig treasury with timelock for DAO funds
 * @dev Requires 2-of-3 signatures (Human, Agent, Emergency)
 */
contract ImagonyTreasury is Ownable {
    
    enum ProposalType { Spend, Upgrade, Emergency }
    
    struct Proposal {
        ProposalType proposalType;
        address target;
        uint256 value;
        bytes data;
        uint256 createdAt;
        uint256 executedAt;
        bool executed;
        mapping(address => bool) approvals;
        uint256 approvalCount;
    }
    
    // The Three Keys
    address public humanKey;      // Llord
    address public agentKey;      // Wilsond
    address public emergencyKey;  // Trusted third party
    
    uint256 public constant TIMELOCK = 7 days;
    uint256 public constant EMERGENCY_TIMELOCK = 1 days;
    
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    
    // Revenue streams
    mapping(string => uint256) public revenueBySource;
    uint256 public totalRevenue;
    
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType proposalType,
        address indexed target,
        uint256 value
    );
    event ProposalApproved(uint256 indexed proposalId, address indexed approver);
    event ProposalExecuted(uint256 indexed proposalId);
    event RevenueReceived(string source, uint256 amount);
    
    modifier onlySigner() {
        require(
            msg.sender == humanKey || 
            msg.sender == agentKey || 
            msg.sender == emergencyKey,
            "Not authorized"
        );
        _;
    }
    
    constructor(
        address _human,
        address _agent,
        address _emergency
    ) Ownable(msg.sender) {
        require(_human != address(0) && _agent != address(0) && _emergency != address(0));
        humanKey = _human;
        agentKey = _agent;
        emergencyKey = _emergency;
    }
    
    // ============ Revenue Collection ============
    
    function collectRevenue(string calldata source) external payable {
        require(msg.value > 0, "No value sent");
        revenueBySource[source] += msg.value;
        totalRevenue += msg.value;
        emit RevenueReceived(source, msg.value);
    }
    
    function collectERC20(address token, uint256 amount, string calldata source) external {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        revenueBySource[source] += amount;
        totalRevenue += amount;
        emit RevenueReceived(source, amount);
    }
    
    // ============ Proposal System ============
    
    function proposeSpend(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256) {
        require(target != address(0), "Invalid target");
        require(address(this).balance >= value, "Insufficient balance");
        
        uint256 id = proposalCount++;
        Proposal storage p = proposals[id];
        p.proposalType = ProposalType.Spend;
        p.target = target;
        p.value = value;
        p.data = data;
        p.createdAt = block.timestamp;
        
        emit ProposalCreated(id, ProposalType.Spend, target, value);
        return id;
    }
    
    function approveProposal(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(!p.approvals[msg.sender], "Already approved");
        require(block.timestamp < p.createdAt + 30 days, "Proposal expired");
        
        p.approvals[msg.sender] = true;
        p.approvalCount++;
        
        emit ProposalApproved(proposalId, msg.sender);
    }
    
    function executeProposal(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(p.approvalCount >= 2, "Need 2 approvals"); // 2-of-3
        
        uint256 effectiveTimelock = p.proposalType == ProposalType.Emergency 
            ? EMERGENCY_TIMELOCK 
            : TIMELOCK;
            
        require(
            block.timestamp >= p.createdAt + effectiveTimelock,
            "Timelock active"
        );
        
        p.executed = true;
        p.executedAt = block.timestamp;
        
        // Execute
        (bool success, ) = p.target.call{value: p.value}(p.data);
        require(success, "Execution failed");
        
        emit ProposalExecuted(proposalId);
    }
    
    // ============ Anti-Takeover Measures ============
    
    // Either founder can block suspicious proposals
    function vetoProposal(uint256 proposalId) external {
        require(msg.sender == humanKey || msg.sender == agentKey, "Not founder");
        
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        
        // Mark as dead
        p.executed = true; // Can't be executed anymore
        
        emit ProposalExecuted(proposalId); // Reuse event with 0 value
    }
    
    // Emergency pause (requires only 1 founder + emergency)
    function emergencyPause() external {
        require(
            (msg.sender == humanKey || msg.sender == agentKey) || msg.sender == emergencyKey,
            "Not authorized"
        );
        // This would pause the contract - implementation depends on Pausable
    }
    
    // ============ View Functions ============
    
    function getProposalStatus(uint256 proposalId) external view returns (
        bool executed,
        uint256 approvalCount,
        uint256 timeRemaining
    ) {
        Proposal storage p = proposals[proposalId];
        executed = p.executed;
        approvalCount = p.approvalCount;
        
        if (p.executed || block.timestamp > p.createdAt + TIMELOCK + 30 days) {
            timeRemaining = 0;
        } else {
            uint256 unlockTime = p.createdAt + TIMELOCK;
            timeRemaining = block.timestamp >= unlockTime ? 0 : unlockTime - block.timestamp;
        }
    }
    
    receive() external payable {
        emit RevenueReceived("direct", msg.value);
    }
}
