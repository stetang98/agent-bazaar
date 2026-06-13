// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {MetadataEntry} from "../src/interfaces/IIdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry reg;

    address owner = makeAddr("owner");
    address other = makeAddr("other");

    string constant URI = "https://agent.example/.well-known/agent-registration.json";
    bytes32 constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline,uint256 nonce)");

    function setUp() public {
        reg = new IdentityRegistry();
    }

    function test_RegisterStartsAtOne() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);
        assertEq(id, 1);
        assertEq(reg.ownerOf(1), owner);
        assertEq(reg.tokenURI(1), URI);
        assertEq(reg.totalAgents(), 1);
        assertTrue(reg.agentExists(1));
        assertFalse(reg.agentExists(2));
    }

    function test_RegisterNoArg() public {
        vm.prank(owner);
        uint256 id = reg.register();
        assertEq(id, 1);
        assertEq(reg.ownerOf(1), owner);
        assertEq(reg.getAgentWallet(1), owner);
    }

    function test_RegisterDefaultsAgentWalletToOwner() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);
        assertEq(reg.getAgentWallet(id), owner);
    }

    function test_SecondRegisterGetsIdTwo() public {
        vm.prank(owner);
        reg.register(URI);
        vm.prank(other);
        uint256 id2 = reg.register("ipfs://second");
        assertEq(id2, 2);
        assertEq(reg.totalAgents(), 2);
    }

    function test_RegisterWithMetadataArray() public {
        MetadataEntry[] memory md = new MetadataEntry[](1);
        md[0] = MetadataEntry("x402Support", abi.encodePacked(uint8(1)));
        vm.prank(owner);
        uint256 id = reg.register(URI, md);
        assertEq(reg.getMetadata(id, "x402Support"), abi.encodePacked(uint8(1)));
    }

    function test_RegisterWithReservedMetadataReverts() public {
        MetadataEntry[] memory md = new MetadataEntry[](1);
        md[0] = MetadataEntry("agentWallet", abi.encodePacked(other));
        vm.prank(owner);
        vm.expectRevert(IdentityRegistry.ReservedKey.selector);
        reg.register(URI, md);
    }

    function test_SetMetadataRejectsReservedKey() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);
        vm.prank(owner);
        vm.expectRevert(IdentityRegistry.ReservedKey.selector);
        reg.setMetadata(id, "agentWallet", abi.encodePacked(other));
    }

    function test_SetMetadataAndGet() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);
        vm.prank(owner);
        reg.setMetadata(id, "model", bytes("gpt-4o-mini"));
        assertEq(reg.getMetadata(id, "model"), bytes("gpt-4o-mini"));
    }

    function test_SetAgentURIOnlyOwner() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        vm.prank(other);
        vm.expectRevert(IdentityRegistry.NotAuthorized.selector);
        reg.setAgentURI(id, "ipfs://new");

        vm.prank(owner);
        reg.setAgentURI(id, "ipfs://new");
        assertEq(reg.tokenURI(id), "ipfs://new");
    }

    function test_SetAgentWalletWithValidSig() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        (address newWallet, uint256 pk) = makeAddrAndKey("newWallet");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(pk, id, newWallet, deadline);

        vm.prank(owner);
        reg.setAgentWallet(id, newWallet, deadline, sig);
        assertEq(reg.getAgentWallet(id), newWallet);
        assertEq(reg.walletNonce(id), 1);
    }

    function test_SetAgentWalletRejectsExpired() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        (address newWallet, uint256 pk) = makeAddrAndKey("newWallet");
        uint256 deadline = block.timestamp + 1;
        bytes memory sig = _sign(pk, id, newWallet, deadline);

        vm.warp(block.timestamp + 2);
        vm.prank(owner);
        vm.expectRevert(IdentityRegistry.SignatureExpired.selector);
        reg.setAgentWallet(id, newWallet, deadline, sig);
    }

    function test_SetAgentWalletRejectsBadSig() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        (address newWallet,) = makeAddrAndKey("newWallet");
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(attackerPk, id, newWallet, deadline);

        vm.prank(owner);
        vm.expectRevert(IdentityRegistry.InvalidSignature.selector);
        reg.setAgentWallet(id, newWallet, deadline, sig);
    }

    function test_SetAgentWalletSignatureNotReplayable() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        (address newWallet, uint256 pk) = makeAddrAndKey("newWallet");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(pk, id, newWallet, deadline); // nonce 0

        vm.prank(owner);
        reg.setAgentWallet(id, newWallet, deadline, sig);

        vm.prank(owner);
        reg.unsetAgentWallet(id);

        // Replaying the same signature must fail — the nonce has advanced to 1.
        vm.prank(owner);
        vm.expectRevert(IdentityRegistry.InvalidSignature.selector);
        reg.setAgentWallet(id, newWallet, deadline, sig);
    }

    function test_UnsetAgentWallet() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        (address newWallet, uint256 pk) = makeAddrAndKey("newWallet");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(pk, id, newWallet, deadline);
        vm.prank(owner);
        reg.setAgentWallet(id, newWallet, deadline, sig);
        assertEq(reg.getAgentWallet(id), newWallet);

        vm.prank(owner);
        reg.unsetAgentWallet(id);
        assertEq(reg.getAgentWallet(id), address(0));
    }

    function test_TransferResetsAgentWallet() public {
        vm.prank(owner);
        uint256 id = reg.register(URI);

        (address newWallet, uint256 pk) = makeAddrAndKey("newWallet");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(pk, id, newWallet, deadline);
        vm.prank(owner);
        reg.setAgentWallet(id, newWallet, deadline, sig);
        assertEq(reg.getAgentWallet(id), newWallet);

        vm.prank(owner);
        reg.transferFrom(owner, other, id);

        assertEq(reg.ownerOf(id), other);
        assertEq(reg.getAgentWallet(id), address(0));
    }

    function _sign(uint256 pk, uint256 agentId, address newWallet, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        uint256 nonce = reg.walletNonce(agentId);
        bytes32 structHash = keccak256(abi.encode(SET_WALLET_TYPEHASH, agentId, newWallet, deadline, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", reg.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
