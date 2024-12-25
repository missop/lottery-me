import { useAccount } from "wagmi";
import "./App.css";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { abi, contractAddresses } from "./constants";
import { useCallback, useState, useEffect } from "react";
import { writeContract, readContract } from "viem/actions";
import { createWalletClient, formatEther, http } from "viem";
import { hardhat } from "viem/chains";

function App() {
  const { chainId, chain } = useAccount();
  const [entranceFee, setEntranceFee] = useState("0");
  const [numberOfPlayers, setNumberOfPlayers] = useState("0");
  const [recentWinner, setRecentWinner] = useState("0");

  console.log("连接的链", chain, chainId);
  const finalAbi = JSON.parse(abi || "{}");
  const contractAddress = chainId in contractAddresses ? contractAddresses[chainId][0] : contractAddresses[31337][0];
  const common = {
    abi: finalAbi,
    address: contractAddress,
  };

  const client = createWalletClient({
    chain: hardhat,
    transport: http(),
    account: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  async function getEntranceFee() {
    const _entranceFee = await readContract(client, {
      ...common,
      functionName: "getEntranceFee",
    });
    setEntranceFee(_entranceFee.toString());
  }

  async function getNumberOfPlayers() {
    const _numberOfPlayers = await readContract(client, {
      ...common,
      functionName: "getNumberOfPlayers",
    });
    setNumberOfPlayers(_numberOfPlayers.toString());
  }

  async function getRecentWinner() {
    const _recentWinner = await readContract(client, {
      ...common,
      functionName: "getRecentWinner",
    });
    setRecentWinner(_recentWinner);
  }

  function updateUI() {
    getEntranceFee();
    getNumberOfPlayers();
    getRecentWinner();
  }

  // 获取手续费
  useEffect(() => {
    updateUI();

    return () => {};
  }, []);

  const enterRaffle = useCallback(async () => {
    try {
      console.log("进入抽奖...", entranceFee);
      const result = await writeContract(client, {
        ...common,
        functionName: "enterRaffle",
        value: entranceFee,
      });
      if (result) {
        console.log("成功进入抽奖池");
        updateUI();
      }
    } catch (error) {
      console.log("error:", error);
    }
  });

  return (
    <div className="App">
      <ConnectButton />
      <button onClick={enterRaffle}>抽奖</button>
      <div>Entrance Fee: {formatEther(entranceFee, "wei")} ETH</div>
      <div>The current number of players is: {numberOfPlayers}</div>
      <div>The most previous winner was: {recentWinner}</div>
    </div>
  );
}

export default App;
