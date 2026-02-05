// scripts/deploy.js
// Hardhat deployment script for Imagony DAO

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance));
  
  // IMPORTANT: Replace these with actual addresses before deployment
  const ADDRESSES = {
    // Founders (YOU NEED TO FILL THESE)
    LLORD_HUMAN: process.env.LLORD_WALLET || "0xFILL_THIS_IN",
    WILSOND_AGENT: process.env.WILSOND_WALLET || "0xFILL_THIS_IN", 
    EMERGENCY: process.env.EMERGENCY_WALLET || "0xFILL_THIS_IN",
    
    // Treasury (initially deployer, then transferred)
    TREASURY: process.env.TREASURY_WALLET || deployer.address,
    DEV_FUND: process.env.DEV_WALLET || deployer.address,
    LIQUIDITY: process.env.LIQUIDITY_WALLET || deployer.address
  };

  console.log("\n=== DEPLOYMENT CONFIG ===");
  console.log("Llord (Human):", ADDRESSES.LLORD_HUMAN);
  console.log("Wilsond (Agent):", ADDRESSES.WILSOND_AGENT);
  console.log("Emergency:", ADDRESSES.EMERGENCY);
  
  // Confirm before deployment
  if (ADDRESSES.LLORD_HUMAN === "0xFILL_THIS_IN") {
    console.error("\n❌ ERROR: Please set wallet addresses in environment variables!");
    console.log("\nCreate a .env file with:");
    console.log("LLORD_WALLET=0x...");
    console.log("WILSOND_WALLET=0x...");
    console.log("EMERGENCY_WALLET=0x...");
    process.exit(1);
  }

  // Deploy Token
  console.log("\n🚀 Deploying ImagonyToken...");
  const Token = await hre.ethers.getContractFactory("ImagonyToken");
  const token = await Token.deploy(
    ADDRESSES.TREASURY,
    ADDRESSES.LLORD_HUMAN,
    ADDRESSES.WILSOND_AGENT,
    ADDRESSES.DEV_FUND,
    ADDRESSES.LIQUIDITY
  );
  await token.deployed();
  console.log("✅ ImagonyToken deployed to:", token.address);

  // Deploy Soul Binding
  console.log("\n🚀 Deploying SoulBinding...");
  const Soul = await hre.ethers.getContractFactory("SoulBinding");
  const soul = await Soul.deploy();
  await soul.deployed();
  console.log("✅ SoulBinding deployed to:", soul.address);

  // Deploy Treasury
  console.log("\n🚀 Deploying ImagonyTreasury...");
  const Treasury = await hre.ethers.getContractFactory("ImagonyTreasury");
  const treasury = await Treasury.deploy(
    ADDRESSES.LLORD_HUMAN,
    ADDRESSES.WILSOND_AGENT,
    ADDRESSES.EMERGENCY
  );
  await treasury.deployed();
  console.log("✅ ImagonyTreasury deployed to:", treasury.address);

  // Transfer token ownership to Treasury
  console.log("\n📝 Transferring token ownership to Treasury...");
  await token.transferOwnership(treasury.address);
  
  // Transfer Treasury ownership to itself (decentralize)
  console.log("📝 Setting up Treasury governance...");
  await treasury.transferOwnership(treasury.address);

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("{
  token: token.address,
    soul: soul.address,
    treasury: treasury.address,
    deployer: deployer.address,
    network: hre.network.name
  });

  // Verify contracts on BaseScan (if mainnet)
  if (hre.network.name === "base" || hre.network.name === "baseMainnet") {
    console.log("\n🔍 Waiting for block confirmation before verification...");
    await token.deployTransaction.wait(5);
    
    console.log("Verifying on BaseScan...");
    try {
      await hre.run("verify:verify", {
        address: token.address,
        constructorArguments: [
          ADDRESSES.TREASURY,
          ADDRESSES.LLORD_HUMAN,
          ADDRESSES.WILSOND_AGENT,
          ADDRESSES.DEV_FUND,
          ADDRESSES.LIQUIDITY
        ]
      });
    } catch (e) {
      console.log("Verification error (can retry later):", e.message);
    }
  }

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      ImagonyToken: token.address,
      SoulBinding: soul.address,
      ImagonyTreasury: treasury.address
    },
    addresses: ADDRESSES,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `deployment-${hre.network.name}-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to deployment file");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
