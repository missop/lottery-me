const { ethers } = require("hardhat");
const { networkConfig, developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUNT = ethers.utils.parseEther("1");
/**
 * @param {import('hardhat/types').HardhatRuntimeEnvironment} params
 */
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address;
  let subscriptionId;
  let VRFCoordinatorV2_5Mock;

  if (developmentChains.includes(network.name)) {
    VRFCoordinatorV2_5Mock = await ethers.getContract("VRFCoordinatorV2_5Mock");
    vrfCoordinatorV2Address = VRFCoordinatorV2_5Mock.address;
    // 获取订阅 Id
    const transactionResponse = await VRFCoordinatorV2_5Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait();
    subscriptionId = transactionReceipt.events[0].args.subId;
    await VRFCoordinatorV2_5Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["keepersUpdateInterval"];
  const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying...");
    await verify(raffle.address, args);
  }
  log("------------------------------------------------------------");
  if (developmentChains.includes(network.name)) {
    await VRFCoordinatorV2_5Mock.addConsumer(subscriptionId, raffle.address);
  }
};

module.exports.tags = ["all", "raffle"];
