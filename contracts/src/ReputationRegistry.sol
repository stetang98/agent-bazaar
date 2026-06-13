// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title ReputationRegistry — ERC-8004 reputation (core surface)
/// @notice Permissionless agent feedback. Anti-sybil is intentionally left off-chain (per the
///         standard): consumers filter `getSummary` by a `clientAddresses[]` set — e.g. the
///         verified buyers known from PaymentEscrow `TaskPaid` receipts.
/// @dev Faithful to EIP-8004 (Draft, Jan 2026). Summaries average the signed fixed-point values
///      after normalizing each to 1e18, then re-express the mean with 2 decimals.
contract ReputationRegistry is IReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    uint8 private constant SUMMARY_DECIMALS = 2;

    /// @notice Identity Registry this reputation registry is bound to (immutable).
    address public immutable identityRegistry;

    mapping(uint256 agentId => mapping(address client => Feedback[])) private _feedback;
    mapping(uint256 agentId => address[]) private _clients;
    mapping(uint256 agentId => mapping(address client => bool)) private _isClient;

    error ZeroAddress();
    error InvalidDecimals();
    error ValueOutOfRange();
    error UnknownAgent();
    error BadIndex();

    /// @param identityRegistry_ The Identity Registry to bind to (set atomically at deploy).
    constructor(address identityRegistry_) {
        if (identityRegistry_ == address(0)) revert ZeroAddress();
        identityRegistry = identityRegistry_;
    }

    /// @inheritdoc IReputationRegistry
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external override {
        if (valueDecimals > 18) revert InvalidDecimals();
        if (value > 1e15 || value < -1e15) revert ValueOutOfRange();
        if (!IIdentityRegistry(identityRegistry).agentExists(agentId)) revert UnknownAgent();
        if (!_isClient[agentId][msg.sender]) {
            _clients[agentId].push(msg.sender);
            _isClient[agentId][msg.sender] = true;
        }
        uint64 idx = uint64(_feedback[agentId][msg.sender].length);
        _feedback[agentId][msg.sender].push(Feedback(value, valueDecimals, tag1, tag2, false));
        emit NewFeedback(
            agentId, msg.sender, idx, value, valueDecimals, tag1, tag1, tag2, endpoint, feedbackURI, feedbackHash
        );
    }

    /// @inheritdoc IReputationRegistry
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        Feedback[] storage arr = _feedback[agentId][msg.sender];
        if (feedbackIndex >= arr.length) revert BadIndex();
        arr[feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /// @inheritdoc IReputationRegistry
    /// @dev On-chain callers should pass an explicit `clientAddresses[]`; an empty filter iterates
    ///      the full permissionless client list and can be gas-griefed. Off-chain eth_call is fine.
    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        override
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        bool filterTag1 = bytes(tag1).length > 0;
        bool filterTag2 = bytes(tag2).length > 0;
        bytes32 tag1Hash = keccak256(bytes(tag1));
        bytes32 tag2Hash = keccak256(bytes(tag2));

        address[] memory clientList;
        if (clientAddresses.length > 0) {
            clientList = clientAddresses;
        } else {
            clientList = _clients[agentId];
        }

        int256 sumNorm; // accumulated in 1e18 fixed point
        uint256 n;
        for (uint256 i; i < clientList.length; ++i) {
            Feedback[] storage arr = _feedback[agentId][clientList[i]];
            for (uint256 j; j < arr.length; ++j) {
                Feedback storage fb = arr[j];
                if (fb.isRevoked) continue;
                if (filterTag1 && keccak256(bytes(fb.tag1)) != tag1Hash) continue;
                if (filterTag2 && keccak256(bytes(fb.tag2)) != tag2Hash) continue;
                sumNorm += int256(fb.value) * int256(10 ** (18 - uint256(fb.valueDecimals)));
                unchecked {
                    ++n;
                }
            }
        }
        if (n == 0) return (0, 0, 0);
        int256 avg = sumNorm / int256(n); // mean in 1e18
        return (uint64(n), SafeCast.toInt128(avg / 1e16), SUMMARY_DECIMALS); // mean, re-expressed with 2 decimals
    }

    /// @inheritdoc IReputationRegistry
    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        override
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        Feedback[] storage arr = _feedback[agentId][clientAddress];
        if (feedbackIndex >= arr.length) revert BadIndex();
        Feedback storage fb = arr[feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked);
    }

    /// @inheritdoc IReputationRegistry
    function getClients(uint256 agentId) external view override returns (address[] memory) {
        return _clients[agentId];
    }

    /// @inheritdoc IReputationRegistry
    function getLastIndex(uint256 agentId, address clientAddress) external view override returns (uint64) {
        return uint64(_feedback[agentId][clientAddress].length);
    }

    /// @inheritdoc IReputationRegistry
    function getIdentityRegistry() external view override returns (address) {
        return identityRegistry;
    }
}
