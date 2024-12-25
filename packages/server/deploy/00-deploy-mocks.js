const { ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. It costs 0.25 LINK per request
const GAS_PRICE_LINK = 1e9; // 1000000000 // link per gas. calculated value based on the gas price of the chain.
const WEI_PERUNITLINK = 1e9;
/**
 * @param {import('hardhat/types').HardhatRuntimeEnvironment} params
 */
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // If we are on a local development network, we need to deploy mocks!
  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...");
    await Promise.all([
      await deploy("MockLinkToken", {
        from: deployer,
        log: true,
      }),
      await deploy("VRFCoordinatorV2_5Mock", {
        from: deployer,
        log: true,
        args: [BASE_FEE, GAS_PRICE_LINK, WEI_PERUNITLINK],
      }),
    ]);
    log("Mocks Deployed!");
    log("--------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
