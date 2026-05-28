// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {MatchOracleMock} from "./MatchOracleMock.sol";
import {PredictionToken} from "./PredictionToken.sol";

contract WorldCupMarketFactory {
    enum Outcome {
        Home,
        Draw,
        Away
    }

    struct Market {
        bytes32 matchId;
        address homeToken;
        address drawToken;
        address awayToken;
        uint256 totalCollateral;
        uint256 winningSupplyAtSettlement;
        Outcome winner;
        bool exists;
        bool settled;
    }

    address public owner;
    MatchOracleMock public immutable oracle;
    mapping(bytes32 matchId => Market market) public markets;

    event MarketCreated(
        bytes32 indexed matchId,
        address homeToken,
        address drawToken,
        address awayToken,
        string homeTeam,
        string awayTeam
    );
    event BundleMinted(bytes32 indexed matchId, address indexed buyer, uint256 amount);
    event MarketSettled(bytes32 indexed matchId, Outcome winner, uint256 winningSupplyAtSettlement);
    event Redeemed(bytes32 indexed matchId, address indexed user, Outcome winner, uint256 burnedAmount, uint256 payout);

    error NotOwner();
    error UnknownMarket();
    error MarketExists();
    error AlreadySettled();
    error NotFinalized();
    error ZeroPayment();
    error NoWinningSupply();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(MatchOracleMock matchOracle, address initialOwner) {
        oracle = matchOracle;
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
    }

    function createMarket(bytes32 matchId, string calldata homeTeam, string calldata awayTeam)
        external
        onlyOwner
        returns (Market memory market)
    {
        if (markets[matchId].exists) revert MarketExists();

        PredictionToken homeToken = new PredictionToken(
            string.concat(homeTeam, " wins"), string.concat(_shortCode(homeTeam), "W"), address(this)
        );
        PredictionToken drawToken = new PredictionToken(
            string.concat(homeTeam, " draw ", awayTeam), "DRAW", address(this)
        );
        PredictionToken awayToken = new PredictionToken(
            string.concat(awayTeam, " wins"), string.concat(_shortCode(awayTeam), "W"), address(this)
        );

        market = Market({
            matchId: matchId,
            homeToken: address(homeToken),
            drawToken: address(drawToken),
            awayToken: address(awayToken),
            totalCollateral: 0,
            winningSupplyAtSettlement: 0,
            winner: Outcome.Home,
            exists: true,
            settled: false
        });
        markets[matchId] = market;

        emit MarketCreated(matchId, market.homeToken, market.drawToken, market.awayToken, homeTeam, awayTeam);
    }

    function mintCompleteSet(bytes32 matchId) external payable {
        Market storage market = _requireMarket(matchId);
        if (market.settled) revert AlreadySettled();
        if (msg.value == 0) revert ZeroPayment();

        market.totalCollateral += msg.value;
        PredictionToken(market.homeToken).mint(msg.sender, msg.value);
        PredictionToken(market.drawToken).mint(msg.sender, msg.value);
        PredictionToken(market.awayToken).mint(msg.sender, msg.value);

        emit BundleMinted(matchId, msg.sender, msg.value);
    }

    function settle(bytes32 matchId) external {
        Market storage market = _requireMarket(matchId);
        if (market.settled) revert AlreadySettled();

        MatchOracleMock.MatchState memory state = oracle.getMatch(matchId);
        if (state.phase != MatchOracleMock.Phase.Finalized) revert NotFinalized();

        Outcome winner;
        if (state.homeScore > state.awayScore) {
            winner = Outcome.Home;
            market.winningSupplyAtSettlement = PredictionToken(market.homeToken).totalSupply();
        } else if (state.awayScore > state.homeScore) {
            winner = Outcome.Away;
            market.winningSupplyAtSettlement = PredictionToken(market.awayToken).totalSupply();
        } else {
            winner = Outcome.Draw;
            market.winningSupplyAtSettlement = PredictionToken(market.drawToken).totalSupply();
        }

        if (market.winningSupplyAtSettlement == 0) revert NoWinningSupply();
        market.winner = winner;
        market.settled = true;

        emit MarketSettled(matchId, winner, market.winningSupplyAtSettlement);
    }

    function redeem(bytes32 matchId, uint256 amount) external {
        Market storage market = _requireMarket(matchId);
        if (!market.settled) revert NotFinalized();

        address token = outcomeToken(matchId, market.winner);
        uint256 payout = amount * market.totalCollateral / market.winningSupplyAtSettlement;
        market.totalCollateral -= payout;
        PredictionToken(token).burn(msg.sender, amount);

        (bool ok,) = payable(msg.sender).call{value: payout}("");
        if (!ok) revert TransferFailed();

        emit Redeemed(matchId, msg.sender, market.winner, amount, payout);
    }

    function outcomeToken(bytes32 matchId, Outcome outcome) public view returns (address token) {
        Market storage market = _requireMarket(matchId);
        if (outcome == Outcome.Home) return market.homeToken;
        if (outcome == Outcome.Draw) return market.drawToken;
        return market.awayToken;
    }

    function _requireMarket(bytes32 matchId) private view returns (Market storage market) {
        market = markets[matchId];
        if (!market.exists) revert UnknownMarket();
    }

    function _shortCode(string calldata team) private pure returns (string memory code) {
        bytes calldata raw = bytes(team);
        bytes memory out = new bytes(raw.length < 3 ? raw.length : 3);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = raw[i];
        }
        code = string(out);
    }
}
