// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentityRegistry, MetadataEntry} from "./interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry — ERC-8004 "Trustless Agents" Identity Registry
/// @notice Each agent is an ERC-721 token (`agentId == tokenId`, starting at 1). The token's
///         `agentURI` (tokenURI) points to the off-chain registration JSON. The reserved
///         metadata key `agentWallet` is set via an EIP-712 / ERC-1271 signature from the new
///         wallet and is automatically reset to address(0) whenever the agent is transferred.
/// @dev Faithful to EIP-8004 (Draft, Jan 2026 update). Built on OpenZeppelin v5.
contract IdentityRegistry is IIdentityRegistry, ERC721URIStorage, EIP712, ReentrancyGuard {
    bytes32 private constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline,uint256 nonce)");
    bytes32 private constant RESERVED_WALLET_KEY = keccak256(bytes("agentWallet"));

    uint256 private _nextId = 1; // agentId starts at 1 (0 == non-existent)

    mapping(uint256 agentId => mapping(string key => bytes value)) private _metadata;
    mapping(uint256 agentId => address wallet) private _agentWallet;
    mapping(uint256 agentId => uint256 nonce) private _walletNonce; // EIP-712 single-use replay guard

    error ReservedKey();
    error NotAuthorized();
    error SignatureExpired();
    error InvalidSignature();

    constructor()
        ERC721("ERC-8004 Trustless Agent", "AGENT")
        EIP712("ERC-8004 IdentityRegistry", "1")
    {}

    // --- Registration ---

    /// @inheritdoc IIdentityRegistry
    function register(string calldata agentURI, MetadataEntry[] calldata metadata)
        external
        override
        nonReentrant
        returns (uint256 agentId)
    {
        agentId = _registerTo(msg.sender, agentURI);
        for (uint256 i; i < metadata.length; ++i) {
            if (_isReserved(metadata[i].metadataKey)) revert ReservedKey();
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }
    }

    /// @inheritdoc IIdentityRegistry
    function register(string calldata agentURI) external override nonReentrant returns (uint256 agentId) {
        agentId = _registerTo(msg.sender, agentURI);
    }

    /// @inheritdoc IIdentityRegistry
    function register() external override nonReentrant returns (uint256 agentId) {
        agentId = _registerTo(msg.sender, "");
    }

    function _registerTo(address to, string memory agentURI) private returns (uint256 agentId) {
        agentId = _nextId++;
        _safeMint(to, agentId);
        if (bytes(agentURI).length > 0) _setTokenURI(agentId, agentURI);
        _agentWallet[agentId] = to; // wallet defaults to the owner
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encodePacked(to));
        emit AgentWalletSet(agentId, to, to); // consistent event stream for off-chain indexers
        emit Registered(agentId, agentURI, to);
    }

    // --- Metadata ---

    /// @inheritdoc IIdentityRegistry
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue)
        external
        override
    {
        _requireOwnerOrApproved(agentId);
        if (_isReserved(metadataKey)) revert ReservedKey();
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    /// @inheritdoc IIdentityRegistry
    function getMetadata(uint256 agentId, string calldata metadataKey)
        external
        view
        override
        returns (bytes memory metadataValue)
    {
        if (_isReserved(metadataKey)) return abi.encodePacked(_agentWallet[agentId]);
        return _metadata[agentId][metadataKey];
    }

    /// @inheritdoc IIdentityRegistry
    function setAgentURI(uint256 agentId, string calldata newURI) external override {
        _requireOwnerOrApproved(agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // --- Reserved agentWallet (EIP-712 / ERC-1271 verified) ---

    /// @inheritdoc IIdentityRegistry
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature)
        external
        override
    {
        _requireOwnerOrApproved(agentId);
        if (block.timestamp > deadline) revert SignatureExpired();
        uint256 nonce = _walletNonce[agentId];
        bytes32 digest =
            _hashTypedDataV4(keccak256(abi.encode(SET_WALLET_TYPEHASH, agentId, newWallet, deadline, nonce)));
        if (!SignatureChecker.isValidSignatureNow(newWallet, digest, signature)) revert InvalidSignature();
        unchecked {
            _walletNonce[agentId] = nonce + 1; // consume the signature (single-use)
        }
        _agentWallet[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet, msg.sender);
    }

    /// @inheritdoc IIdentityRegistry
    function getAgentWallet(uint256 agentId) external view override returns (address wallet) {
        return _agentWallet[agentId];
    }

    /// @notice Current EIP-712 nonce for an agent's setAgentWallet signature (replay protection).
    function walletNonce(uint256 agentId) external view returns (uint256) {
        return _walletNonce[agentId];
    }

    /// @inheritdoc IIdentityRegistry
    function unsetAgentWallet(uint256 agentId) external override {
        _requireOwnerOrApproved(agentId);
        _agentWallet[agentId] = address(0);
        emit AgentWalletSet(agentId, address(0), msg.sender);
    }

    // --- Views ---

    /// @inheritdoc IIdentityRegistry
    function totalAgents() external view override returns (uint256 count) {
        return _nextId - 1;
    }

    /// @inheritdoc IIdentityRegistry
    function agentExists(uint256 agentId) external view override returns (bool exists) {
        return _ownerOf(agentId) != address(0);
    }

    /// @notice EIP-712 domain separator (exposed for off-chain signature construction).
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // --- Internal ---

    /// @dev Clears `agentWallet` on transfer (not on mint/burn) so the new owner must re-verify.
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address from) {
        from = super._update(to, tokenId, auth);
        // Clear the verified wallet on transfer AND burn (skip mint, where from == 0).
        if (from != address(0)) {
            _agentWallet[tokenId] = address(0);
            emit AgentWalletSet(tokenId, address(0), from);
        }
    }

    function _isReserved(string memory key) private pure returns (bool) {
        return keccak256(bytes(key)) == RESERVED_WALLET_KEY;
    }

    function _requireOwnerOrApproved(uint256 agentId) private view {
        address agentOwner = _requireOwned(agentId);
        if (!_isAuthorized(agentOwner, msg.sender, agentId)) revert NotAuthorized();
    }
}
