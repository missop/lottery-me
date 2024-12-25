const networkConfig = {
  default: {
    name: "hardhat",
    keepersUpdateInterval: "30",
  },
  31337: {
    name: "localhost",
    entranceFee: ethers.utils.parseEther("0.01"), // 0.01 ETH
    callbackGasLimit: "50000000", // 500,000 gas
    gasLane: "0x3f631d5ec60a0ce16203bcd6aff7ffbc423e22e452786288e172d467354304c8",
    keepersUpdateInterval: 30,
  },
  // Price Feed Address, values can be obtained at https://docs.chain.link/data-feeds/price-feeds/addresses
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    entranceFee: ethers.utils.parseEther("0.01"), // 0.01 ETH
    gasLane: "0x3f631d5ec60a0ce16203bcd6aff7ffbc423e22e452786288e172d467354304c8",
    callbackGasLimit: "50000000", // 500,000 gas
    keepersUpdateInterval: 30,
    subscriptionId: "65305614577246668352952137890111379788235824197216043909227165316560021621132",
  },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  developmentChains,
};
