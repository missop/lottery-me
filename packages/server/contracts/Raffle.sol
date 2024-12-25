// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// mock interface,目前的 subscribtionId 是 unit256，需要升级到最新
// import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";
// 真正的 VRF 服务
// import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

error Raffle__NotEnoughETHEntered(); // 自定义错误
error Raffle__TransferFailed(); // 打钱失败
error Raffle__NOTOpen(); // 活动未开启
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

contract Raffle is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    // Type Declations
    enum RaffleState {
        OPEN, // 0
        CALCULATING // 1
    }

    // State variables
    // 首先需要有入场费
    uint256 private immutable i_entranceFee;
    // 定义玩家数组
    address payable[] private s_players;
    // 调用请求随机数的方法
    VRFCoordinatorV2_5Mock private immutable i_vrfCoordinator;
    // 随机数请求的确认次数
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    // 随机数请求的 gas 限制
    uint32 private immutable i_callbackGasLimit;
    // 随机数请求的 gasLane，不超过某个上限值
    bytes32 private immutable i_gasLane;
    // 随机数请求的 订阅 id
    uint256 private immutable i_subscriptionId;
    uint16 private constant NUM_WORDS = 1;

    // lottery 变量
    address private s_recentWinner; // 当前获胜者
    RaffleState private s_raffleState; // 活动状态
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    // 事件，当有人加入活动的时候，会触发这个事件
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed player);

    // 定义一个变量，用来记录随机数

    // 入场费从构造函数里面传进来，就固定不变了所以用immutable
    constructor(
        address vrfCoordinatorV2_5, // 合约需要 mock
        uint256 entranceFee,
        bytes32 keyHash,
        uint256 subId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2Plus(vrfCoordinatorV2_5) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2_5Mock(vrfCoordinatorV2_5);
        i_gasLane = keyHash;
        i_subscriptionId = subId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval; // 间隔时间
    }

    function enterRaffle() public payable {
        // 不使用 require 比较花费燃气费
        // require(msg.value >= i_entranceFee, "Not enough ETH!");
        // 先要看一看入场费够不够
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        //  如果活动没开始也需要回退
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NOTOpen();
        }

        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
     * This is the function that the Chainlink Automation node
     * calls to check if the upkeep is needed.
     * The following should be true for this to return true:
     * 1. The time interval has passed between raffle runs
     * 2. The lottery should have at leat one player and have some TTH
     * 3. Our subscription is funded with LINK
     * 4. The lottery should be in an open state
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        bool isOpen = s_raffleState == RaffleState.OPEN;
        upkeepNeeded = (timePassed && hasPlayers && hasBalance && isOpen);
        return (upkeepNeeded, "0x0");
    }

    // 请求 Chainlink 获取随机数
    function performUpkeep(bytes calldata /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_gasLane,
                subId: i_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: i_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        emit RequestedRaffleWinner(requestId);
    }

    //填充随机数
    function fulfillRandomWords(
        uint256 /*_requestId*/,
        uint256[] calldata _randomWords
    ) internal override {
        uint256 indexOfWinner = _randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp; // reset  事件保证下一个玩家可以参赛
        // 比赛完成后清空玩家
        s_players = new address payable[](0);
        s_recentWinner = recentWinner;
        // 打钱给获胜者
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    // 由于是 private 方法，所以需要一个 get 函数
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint16) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
