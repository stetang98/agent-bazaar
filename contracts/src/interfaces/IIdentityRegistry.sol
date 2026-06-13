// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

/// @notice Key/value metadata entry for an agent (ERC-8004).
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}

/// @title IIdentityRegistry — ERC-8004 "Trustless Agents" Identity Registry
/// @notice Agents are ERC-721 tokens; `agentId == tokenId`. The token's `agentURI` (tokenURI)
///         points to the off-chain registration JSON. The reserved metadata key `agentWallet`
///         is set via an EIP-712 / ERC-1271 signature from the new wallet and is automatically
///         reset to address(0) on transfer.
/// @dev Interface mirrors EIP-8004 (Draft, Jan 2026 update) and the ChaosChain reference impl.
interface IIdentityRegistry is IERC721, IERC721Metadata {
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletSet(uint256 indexed agentId, address indexed newWallet, address indexed setBy);

    // --- Registration (three overloads) ---
    function register(string calldata agentURI, MetadataEntry[] calldata metadata)
        external
        returns (uint256 agentId);
    function register(string calldata agentURI) external returns (uint256 agentId);
    function register() external returns (uint256 agentId);

    // --- Metadata ---
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;
    function getMetadata(uint256 agentId, string calldata metadataKey)
        external
        view
        returns (bytes memory metadataValue);
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    // --- Reserved agentWallet (EIP-712 / ERC-1271 verified) ---
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
    function getAgentWallet(uint256 agentId) external view returns (address wallet);
    function unsetAgentWallet(uint256 agentId) external;

    // --- Views ---
    function totalAgents() external view returns (uint256 count);
    function agentExists(uint256 agentId) external view returns (bool exists);
}
