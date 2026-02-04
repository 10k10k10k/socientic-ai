import hre from "hardhat";
import { formatEther } from "ethers";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("\n!!! INSUFFICIENT FUNDS !!!");
    console.error(`Please send Base Sepolia ETH to: ${deployer.address}`);
    console.error("You can get funds from https://faucet.quicknode.com/base/sepolia or https://sepolia.base.org");
    process.exit(1);
  }

  console.log("Deploying ClawPool...");
  
  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
  const ClawPool = await hre.ethers.getContractFactory("ClawPool");
  // Set agent to deployer initially
  const clawPool = await ClawPool.deploy(deployer.address, usdcAddress);

  await clawPool.waitForDeployment();

  console.log("ClawPool deployed to:", await clawPool.getAddress());
  console.log("Owner/Agent:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
