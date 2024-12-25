const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const CONTRACTADDRESSES_FILE = path.resolve(__dirname, "../../web/src/constants/contractAddresses.json");
const ABI_FILE = path.resolve(__dirname, "../../web/src/constants/abi.json");

module.exports = async () => {
  if (process.env.UPDATE_FRONTEND) {
    updateContractAddresses();
    updateAbi();
  }
};

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle");
  const chainId = network.config.chainId.toString();
  const contractAddresses = JSON.parse(fs.readFileSync(CONTRACTADDRESSES_FILE, "utf-8"));
  if (chainId in contractAddresses) {
    if (!contractAddresses[chainId].includes(raffle.address)) {
      contractAddresses[chainId].push(raffle.address);
    }
  } else {
    contractAddresses[chainId] = [raffle.address];
  }
  fs.writeFileSync(CONTRACTADDRESSES_FILE, JSON.stringify(contractAddresses), "utf-8");
}

async function updateAbi() {
  const raffle = await ethers.getContract("Raffle");
  const abi = raffle.interface.format(ethers.utils.FormatTypes.json);
  fs.writeFileSync(ABI_FILE, JSON.stringify(abi), "utf-8");
}

module.exports.tags = ["all", "frontend"];
