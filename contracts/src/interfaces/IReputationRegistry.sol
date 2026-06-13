// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IReputationRegistry — ERC-8004 reputation (core surface)
/// @notice Permissionless feedback for agents — the Jan 2026 ERC-8004 update removed
///         pre-authorization (`feedbackAuth`), so any client may submit feedback. Values are
///         signed fixed-point (`int128 value` + `uint8 valueDecimals`). `getSummary` accepts a
///         `clientAddresses[]` filter — the standard's hook for reviewer-filtering, which we use
///         to surface verified-buyer-only reputation (backed by on-chain PaymentEscrow receipts).
/// @dev Implements the core feedback/summary surface of EIP-8004 (Draft, Jan 2026). The optional
///      response and bulk-read extensions are out of scope for this build.
interface IReputationRegistry {
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked);

    function getClients(uint256 agentId) external view returns (address[] memory clientList);

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64 lastIndex);

    function getIdentityRegistry() external view returns (address registry);
}
