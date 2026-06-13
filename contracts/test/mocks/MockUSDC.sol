// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal EIP-3009-style USDC mock for tests. `receiveWithAuthorization` enforces the
///         `to == msg.sender` rule (the front-running guard real USDC has) and moves funds with
///         no allowance, modeling a gasless meta-transfer. Signature args are accepted but not
///         verified (signature validity is Circle's concern, not the escrow's).
contract MockUSDC is ERC20 {
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    error CallerMustBePayee();
    error AuthAlreadyUsed();
    error AuthNotYetValid();
    error AuthExpired();

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8, /* v */
        bytes32, /* r */
        bytes32 /* s */
    ) external {
        if (to != msg.sender) revert CallerMustBePayee();
        if (block.timestamp <= validAfter) revert AuthNotYetValid();
        if (block.timestamp >= validBefore) revert AuthExpired();
        if (authorizationState[from][nonce]) revert AuthAlreadyUsed();
        authorizationState[from][nonce] = true;
        _transfer(from, to, value);
    }
}
