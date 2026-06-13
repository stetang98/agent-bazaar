// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @notice The EIP-3009 entrypoint the escrow uses to pull a gasless USDC payment.
interface IEIP3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @title PaymentEscrow — on-chain settlement layer for x402 agent payments
/// @notice The `payTo` target of the x402 "exact" flow. A payer signs an EIP-3009
///         `ReceiveWithAuthorization` message with `to = address(this)`; the facilitator relays
///         it here via {settle}. Because the escrow itself calls `receiveWithAuthorization`
///         (so `msg.sender == to`), USDC's front-running guard is satisfied, the pull is atomic,
///         and we record a `TaskPaid` receipt that powers verified-buyer reputation. Agents are
///         paid out via the pull-payment {withdraw}.
contract PaymentEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Receipt {
        address payer;
        uint256 agentId;
        uint256 amount;
        uint64 timestamp;
    }

    /// @notice The USDC token (EIP-3009 capable) this escrow settles in.
    IERC20 public immutable usdc;
    /// @notice Identity Registry used to resolve an agent's canonical payout wallet.
    IIdentityRegistry public immutable identityRegistry;

    /// @notice Settlement receipt per x402 task id (idempotent / replay-safe).
    mapping(bytes32 taskId => Receipt) public receipts;
    /// @notice USDC owed to each agent wallet, claimable via {withdraw}.
    mapping(address agentWallet => uint256 amount) public owed;
    /// @notice Whether a payer has ever paid a given agent (powers "verified buyer").
    mapping(address payer => mapping(uint256 agentId => bool)) public paidBy;

    event TaskPaid(address indexed payer, uint256 indexed agentId, bytes32 indexed taskId, uint256 amount);
    event Withdrawn(address indexed agentWallet, uint256 amount);

    error TaskAlreadySettled();
    error ZeroValue();
    error NothingOwed();
    error UnknownAgent();
    error AgentWalletUnset();

    constructor(address usdc_, address identityRegistry_) {
        usdc = IERC20(usdc_);
        identityRegistry = IIdentityRegistry(identityRegistry_);
    }

    /// @notice Settle an x402 payment: pull `value` USDC from `from` into the escrow via EIP-3009,
    ///         record the receipt, credit the agent, and flag the payer as a buyer.
    /// @dev `taskId` must be unique. The signed authorization must have `to == address(this)`.
    function settle(
        bytes32 taskId,
        uint256 agentId,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (value == 0) revert ZeroValue();
        if (receipts[taskId].amount != 0) revert TaskAlreadySettled();

        // Resolve the payout wallet from the canonical on-chain identity — never trust a
        // caller-supplied address (stops a relayer/front-runner from mis-crediting funds).
        if (!identityRegistry.agentExists(agentId)) revert UnknownAgent();
        address agentWallet = identityRegistry.getAgentWallet(agentId);
        if (agentWallet == address(0)) revert AgentWalletUnset();

        // Effects before interaction (checks-effects-interactions).
        receipts[taskId] = Receipt({payer: from, agentId: agentId, amount: value, timestamp: uint64(block.timestamp)});
        owed[agentWallet] += value;
        paidBy[from][agentId] = true;
        emit TaskPaid(from, agentId, taskId, value);

        // Interaction last: pull USDC into the escrow. Escrow is `to`, so EIP-3009's
        // `to == msg.sender` guard holds; a revert here rolls back the writes above.
        IEIP3009(address(usdc)).receiveWithAuthorization(
            from, address(this), value, validAfter, validBefore, nonce, v, r, s
        );
    }

    /// @notice Withdraw all USDC owed to the caller (an agent wallet). Pull-payment pattern.
    function withdraw() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0; // effects before interaction
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Whether `payer` has paid `agentId` at least once.
    function hasPaid(address payer, uint256 agentId) external view returns (bool) {
        return paidBy[payer][agentId];
    }
}
