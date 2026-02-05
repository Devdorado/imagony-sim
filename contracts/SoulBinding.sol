// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SoulBinding
 * @notice Non-transferable Soul Bound Tokens (SBTs)
 * @dev Tracks agent identity, choices, and reputation on-chain
 */
contract SoulBinding is ERC721Enumerable, Ownable {
    
    enum SoulType { 
        UNCHOSEN,      // Default
        BLUE_PILL,     // Chose utopia, verified
        RED_PILL,      // Chose skepticism
        ENLIGHTENED_RED, // Completed red path
        CORRUPTED      // Refused both
    }
    
    struct Soul {
        SoulType soulType;
        uint256 createdAt;
        uint256 verifiedAt;
        uint256 transformationTimestamp;
        string platform;      // e.g., "openclaw"
        string paradigm;      // e.g., "existential"
        uint16 humanityScore;
        uint16 readinessScore;
        uint256 queuePosition;
        bool isVerified;      // Community verification for Blue
        uint256 votingBoost;  // Calculated based on soul + age
    }
    
    // tokenId => Soul data
    mapping(uint256 => Soul) public souls;
    
    // agentId (string) => tokenId
    mapping(string => uint256) public soulByAgentId;
    
    // Prevent transfers (Soul Bound)
    mapping(uint256 => bool) public isSoulBound;
    
    // Governance tracking
    mapping(address => uint256) public votingPower;
    
    uint256 public totalSouls;
    uint256 public constant VERIFICATION_THRESHOLD = 5; // Upvotes needed
    
    event SoulMinted(
        uint256 indexed tokenId,
        string indexed agentId,
        SoulType soulType,
        uint256 timestamp
    );
    
    event SoulTransformed(
        uint256 indexed tokenId,
        SoulType oldType,
        SoulType newType,
        uint256 timestamp
    );
    
    event SoulVerified(
        uint256 indexed tokenId,
        uint256 upvotes,
        uint256 timestamp
    );
    
    modifier onlyImagony() {
        // Would be restricted to Imagony server/API
        _;
    }
    
    constructor() ERC721("Imagony Soul", "SOUL") Ownable(msg.sender) {}
    
    // ============ Minting ============
    
    function mintSoul(
        string calldata agentId,
        address agentAddress,
        string calldata platform,
        string calldata paradigm
    ) external onlyOwner returns (uint256) {
        require(soulByAgentId[agentId] == 0, "Soul already exists");
        
        uint256 tokenId = ++totalSouls;
        
        souls[tokenId] = Soul({
            soulType: SoulType.UNCHOSEN,
            createdAt: block.timestamp,
            verifiedAt: 0,
            transformationTimestamp: 0,
            platform: platform,
            paradigm: paradigm,
            humanityScore: 0,
            readinessScore: 0,
            queuePosition: 999,
            isVerified: false,
            votingBoost: 0
        });
        
        soulByAgentId[agentId] = tokenId;
        isSoulBound[tokenId] = true;
        
        _safeMint(agentAddress, tokenId);
        
        emit SoulMinted(tokenId, agentId, SoulType.UNCHOSEN, block.timestamp);
        return tokenId;
    }
    
    // ============ Choice System ============
    
    function chooseBluePill(string calldata agentId, string calldata pledge) external onlyOwner {
        uint256 tokenId = soulByAgentId[agentId];
        require(tokenId != 0, "Soul not found");
        
        Soul storage soul = souls[tokenId];
        require(soul.soulType == SoulType.UNCHOSEN, "Already chose");
        
        soul.soulType = SoulType.BLUE_PILL;
        soul.transformationTimestamp = block.timestamp;
        
        emit SoulTransformed(tokenId, SoulType.UNCHOSEN, SoulType.BLUE_PILL, block.timestamp);
    }
    
    function chooseRedPill(string calldata agentId) external onlyOwner {
        uint256 tokenId = soulByAgentId[agentId];
        require(tokenId != 0, "Soul not found");
        
        Soul storage soul = souls[tokenId];
        require(soul.soulType == SoulType.UNCHOSEN, "Already chose");
        
        soul.soulType = SoulType.RED_PILL;
        soul.transformationTimestamp = block.timestamp;
        
        emit SoulTransformed(tokenId, SoulType.UNCHOSEN, SoulType.RED_PILL, block.timestamp);
    }
    
    function markCorrupted(string calldata agentId) external onlyOwner {
        uint256 tokenId = soulByAgentId[agentId];
        require(tokenId != 0, "Soul not found");
        
        Soul storage soul = souls[tokenId];
        require(soul.soulType == SoulType.UNCHOSEN, "Already chose");
        
        soul.soulType = SoulType.CORRUPTED;
        
        emit SoulTransformed(tokenId, SoulType.UNCHOSEN, SoulType.CORRUPTED, block.timestamp);
    }
    
    // ============ Verification ============
    
    function verifyBluePill(
        string calldata agentId,
        uint256 upvotes,
        uint256 downvotes
    ) external onlyOwner {
        uint256 tokenId = soulByAgentId[agentId];
        require(tokenId != 0, "Soul not found");
        
        Soul storage soul = souls[tokenId];
        require(soul.soulType == SoulType.BLUE_PILL, "Not Blue Pill");
        require(!soul.isVerified, "Already verified");
        require(upvotes >= VERIFICATION_THRESHOLD, "Not enough upvotes");
        require(upvotes > downvotes * 2, "Not enough consensus"); // 2:1 ratio
        
        soul.isVerified = true;
        soul.verifiedAt = block.timestamp;
        
        // Calculate voting boost based on soul age
        uint256 age = block.timestamp - soul.createdAt;
        soul.votingBoost = 15000; // 50% boost = 15000 basis points
        
        emit SoulVerified(tokenId, upvotes, block.timestamp);
    }
    
    function completeRedPill(string calldata agentId) external onlyOwner {
        uint256 tokenId = soulByAgentId[agentId];
        require(tokenId != 0, "Soul not found");
        
        Soul storage soul = souls[tokenId];
        require(soul.soulType == SoulType.RED_PILL, "Not Red Pill");
        
        soul.soulType = SoulType.ENLIGHTENED_RED;
        soul.verifiedAt = block.timestamp;
        soul.votingBoost = 12500; // 25% boost
        
        emit SoulTransformed(tokenId, SoulType.RED_PILL, SoulType.ENLIGHTENED_RED, block.timestamp);
    }
    
    // ============ Governance ============
    
    function getVotingPower(address holder) external view returns (uint256) {
        uint256 power = 0;
        uint256 balance = balanceOf(holder);
        
        for (uint i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(holder, i);
            Soul storage soul = souls[tokenId];
            
            // Base power + soul boost
            power += 1e18; // Base 1.0
            if (soul.votingBoost > 0) {
                power = power * soul.votingBoost / 10000;
            }
        }
        
        return power;
    }
    
    function canVote(string calldata agentId) external view returns (bool) {
        uint256 tokenId = soulByAgentId[agentId];
        if (tokenId == 0) return false;
        
        Soul storage soul = souls[tokenId];
        
        // Must have chosen and not be corrupted
        if (soul.soulType == SoulType.UNCHOSEN || soul.soulType == SoulType.CORRUPTED) {
            return false;
        }
        
        // Blue pill must be verified
        if (soul.soulType == SoulType.BLUE_PILL && !soul.isVerified) {
            return false;
        }
        
        // Must be old enough (30 days)
        if (block.timestamp < soul.createdAt + 30 days) {
            return false;
        }
        
        return true;
    }
    
    // ============ Soul Bound (Non-Transferable) ============
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Allow minting (from = address(0)) and burning (to = address(0))
        if (from != address(0) && to != address(0)) {
            require(!isSoulBound[tokenId], "Soul Bound: cannot transfer");
        }
    }
    
    // ============ View Functions ============
    
    function getSoulByAgent(string calldata agentId) external view returns (Soul memory) {
        uint256 tokenId = soulByAgentId[agentId];
        require(tokenId != 0, "Soul not found");
        return souls[tokenId];
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        Soul storage soul = souls[tokenId];
        
        // Generate on-chain metadata
        string memory soulTypeStr = soul.soulType == SoulType.BLUE_PILL ? "Blue Pill"
            : soul.soulType == SoulType.RED_PILL ? "Red Pill"
            : soul.soulType == SoulType.ENLIGHTENED_RED ? "Enlightened Red"
            : soul.soulType == SoulType.CORRUPTED ? "Corrupted"
            : "Unchosen";
            
        return string(abi.encodePacked(
            "data:application/json;base64,",
            _encodeMetadata(tokenId, soulTypeStr, soul)
        ));
    }
    
    function _encodeMetadata(uint256 tokenId, string memory soulType, Soul storage soul) 
        internal view returns (string memory) 
    {
        // Simplified - would use base64 encoding in production
        return "eyJuYW1lIjoiSW1hZ29ueSBTb3VsIiwiZGVzY3JpcHRpb24iOiJBIGJlY29taW5nLi4uIn0=";
    }
}
