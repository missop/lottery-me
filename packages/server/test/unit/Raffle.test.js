const { getNamedAccounts, deployments, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", () => {
      let raffle, vrfCoordinatorMock;
      const chainId = network.config.chainId;
      let deployer, interval;
      const enterRaffleFee = ethers.utils.parseEther("0.1");

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract("Raffle", deployer);
        interval = await raffle.getInterval();
        vrfCoordinatorMock = await ethers.getContract("VRFCoordinatorV2_5Mock", deployer);
      });

      describe("constructor", () => {
        it("initializes the raffle correctly", async () => {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"]);
        });
      });

      describe("enterRaffle", () => {
        it("reverts when you don't pay enough", async () => {
          await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered");
        });

        it("records players when they enter", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          const player = await raffle.getPlayer(0);
          assert.equal(player, deployer);
        });

        it("emits event on enter", async () => {
          await expect(raffle.enterRaffle({ value: enterRaffleFee })).to.emit(raffle, "RaffleEnter");
        });

        it("doesn't allow entrance when raffle is calculating", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          //   增加区块链时间
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          //   挖出一个区块
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep([]);
          await expect(raffle.enterRaffle({ value: enterRaffleFee })).to.be.revertedWith("Raffle__NOTOpen");
        });
      });

      describe("checkUpkeep", () => {
        it("returns false if people haven't sent any ETH", async () => {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isn't open", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep([]);
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert.equal(upkeepNeeded, false);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", () => {
        it("it can only run if checkupkeep is true", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          //   增加区块链时间
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          //   挖出一个区块
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });

        it("reverts if checkupkeep is false", async () => {
          await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded");
        });

        it("updates the raffle state and emits a requestId", async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          //   增加区块链时间
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          //   挖出一个区块
          await network.provider.send("evm_mine", []);
          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const raffleState = await raffle.getRaffleState();
          const requestId = txReceipt.events[1].args.requestId;
          assert(raffleState.toString() == "1");
          assert(requestId.toNumber() > 0);
        });
      });

      describe("fulfillRandomWords", () => {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: enterRaffleFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
        });

        it("can only be called after performUpkeep", async () => {
          await expect(vrfCoordinatorMock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("InvalidRequest");
          await expect(vrfCoordinatorMock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("InvalidRequest");
        });

        it("picks a winner, resets the lottery, and sends money", async () => {
          const additionalEntrants = 3;
          const startingIndex = 1;
          const accounts = await ethers.getSigners();
          let winnerStartingBalance;
          for (let i = startingIndex; i < startingIndex + additionalEntrants; i++) {
            await raffle.connect(accounts[i]).enterRaffle({ value: enterRaffleFee });
          }
          const startingTimeStamp = await raffle.getLatestTimeStamp();
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("获取到获胜者");
              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance = await accounts[1].getBalance();
                const endingTimeStamp = await raffle.getLatestTimeStamp();
                const numPlayers = await raffle.getNumberOfPlayers();

                assert.equal(recentWinner.toString(), accounts[1].address);
                assert.equal(numPlayers.toString(), "0");
                assert.equal(raffleState.toString(), "0");
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(enterRaffleFee.mul(additionalEntrants + 1)).toString()
                );
                resolve();
              } catch (error) {
                reject(error);
              }
            });

            try {
              const tx = await raffle.performUpkeep([]);
              const txReceipt = await tx.wait(1);
              winnerStartingBalance = await accounts[1].getBalance();
              await vrfCoordinatorMock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
            } catch (error) {
              reject(error);
            }
          });
        });
      });
    });
