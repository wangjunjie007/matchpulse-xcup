// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MatchPulsePaymaster {
    address public owner;
    mapping(address token => uint256 priceWeiPerToken) public gasTokenPrice;

    event GasTokenPriceSet(address indexed token, uint256 priceWeiPerToken);
    event GasSponsored(
        address indexed user,
        address indexed token,
        uint256 gasCostWei,
        uint256 tokenCharge,
        bytes32 indexed matchId
    );
    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed receiver, uint256 amount);

    error NotOwner();
    error UnsupportedGasToken();
    error InvalidPrice();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function setGasTokenPrice(address token, uint256 priceWeiPerToken) external onlyOwner {
        if (priceWeiPerToken == 0) revert InvalidPrice();
        gasTokenPrice[token] = priceWeiPerToken;
        emit GasTokenPriceSet(token, priceWeiPerToken);
    }

    function quoteTokenCharge(address token, uint256 gasCostWei) public view returns (uint256 tokenCharge) {
        uint256 price = gasTokenPrice[token];
        if (price == 0) revert UnsupportedGasToken();
        tokenCharge = (gasCostWei * 1e18 + price - 1) / price;
    }

    function recordSponsoredGas(address user, address token, uint256 gasCostWei, bytes32 matchId)
        external
        onlyOwner
        returns (uint256 tokenCharge)
    {
        tokenCharge = quoteTokenCharge(token, gasCostWei);
        emit GasSponsored(user, token, gasCostWei, tokenCharge, matchId);
    }

    function withdraw(address payable receiver, uint256 amount) external onlyOwner {
        (bool ok,) = receiver.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(receiver, amount);
    }
}
