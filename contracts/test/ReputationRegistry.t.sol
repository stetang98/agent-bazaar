// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract ReputationRegistryTest is Test {
    IdentityRegistry identity;
    ReputationRegistry rep;

    uint256 constant AGENT = 1;
    address agentOwner = makeAddr("agentOwner");
    address clientA = makeAddr("clientA");
    address clientB = makeAddr("clientB");

    function setUp() public {
        identity = new IdentityRegistry();
        vm.prank(agentOwner);
        identity.register("ipfs://agent"); // agentId 1 now exists
        rep = new ReputationRegistry(address(identity));
    }

    function _give(address who, int128 value, uint8 dec, string memory tag1) internal {
        vm.prank(who);
        rep.giveFeedback(AGENT, value, dec, tag1, "", "https://agent/audit", "", bytes32(0));
    }

    function _give2(address who, int128 value, uint8 dec, string memory tag1, string memory tag2) internal {
        vm.prank(who);
        rep.giveFeedback(AGENT, value, dec, tag1, tag2, "https://agent/audit", "", bytes32(0));
    }

    function test_IdentitySetAndConstructorRejectsZero() public {
        assertEq(rep.getIdentityRegistry(), address(identity));
        vm.expectRevert(ReputationRegistry.ZeroAddress.selector);
        new ReputationRegistry(address(0));
    }

    function test_GiveFeedbackRecords() public {
        _give(clientA, 5, 0, "audit");
        assertEq(rep.getLastIndex(AGENT, clientA), 1);
        address[] memory clients = rep.getClients(AGENT);
        assertEq(clients.length, 1);
        assertEq(clients[0], clientA);
        (int128 value, uint8 dec, string memory t1,, bool revoked) = rep.readFeedback(AGENT, clientA, 0);
        assertEq(value, 5);
        assertEq(dec, 0);
        assertEq(t1, "audit");
        assertFalse(revoked);
    }

    function test_SummaryAveragesAcrossClients() public {
        _give(clientA, 4, 0, "");
        _give(clientB, 5, 0, "");
        address[] memory none = new address[](0);
        (uint64 count, int128 val, uint8 dec) = rep.getSummary(AGENT, none, "", "");
        assertEq(count, 2);
        assertEq(dec, 2);
        assertEq(val, 450); // 4.50
    }

    function test_NegativeValueAveraging() public {
        _give(clientA, 4, 0, "");
        _give(clientB, -2, 0, "");
        address[] memory none = new address[](0);
        (uint64 count, int128 val,) = rep.getSummary(AGENT, none, "", "");
        assertEq(count, 2);
        assertEq(val, 100); // (4 + -2) / 2 = 1.00
    }

    function test_SummaryFilteredByClient() public {
        _give(clientA, 4, 0, "");
        _give(clientB, 5, 0, "");
        address[] memory only = new address[](1);
        only[0] = clientA;
        (uint64 count, int128 val,) = rep.getSummary(AGENT, only, "", "");
        assertEq(count, 1);
        assertEq(val, 400);
    }

    function test_SummaryFilteredByTag1() public {
        _give(clientA, 5, 0, "audit");
        _give(clientA, 1, 0, "spam");
        address[] memory none = new address[](0);
        (uint64 c1, int128 v1,) = rep.getSummary(AGENT, none, "audit", "");
        assertEq(c1, 1);
        assertEq(v1, 500);
        (uint64 c2, int128 v2,) = rep.getSummary(AGENT, none, "", "");
        assertEq(c2, 2);
        assertEq(v2, 300);
    }

    function test_SummaryFilteredByTag2() public {
        _give2(clientA, 5, 0, "audit", "v1");
        _give2(clientA, 1, 0, "audit", "v2");
        address[] memory none = new address[](0);
        (uint64 c, int128 v,) = rep.getSummary(AGENT, none, "", "v1");
        assertEq(c, 1);
        assertEq(v, 500);
    }

    function test_ValueDecimals18Allowed() public {
        _give(clientA, 1, 18, "audit"); // boundary of the <= 18 guard
        assertEq(rep.getLastIndex(AGENT, clientA), 1);
    }

    function test_RevokeExcludesFromSummary() public {
        _give(clientA, 5, 0, "audit");
        vm.prank(clientA);
        rep.revokeFeedback(AGENT, 0);
        (,,,, bool revoked) = rep.readFeedback(AGENT, clientA, 0);
        assertTrue(revoked);
        address[] memory none = new address[](0);
        (uint64 count,,) = rep.getSummary(AGENT, none, "", "");
        assertEq(count, 0);
    }

    function test_RevokeBadIndexReverts() public {
        vm.prank(clientB);
        vm.expectRevert(ReputationRegistry.BadIndex.selector);
        rep.revokeFeedback(AGENT, 0);
    }

    function test_RejectsInvalidDecimals() public {
        vm.prank(clientA);
        vm.expectRevert(ReputationRegistry.InvalidDecimals.selector);
        rep.giveFeedback(AGENT, 5, 19, "audit", "", "", "", bytes32(0));
    }

    function test_RejectsValueOutOfRange() public {
        vm.prank(clientA);
        vm.expectRevert(ReputationRegistry.ValueOutOfRange.selector);
        rep.giveFeedback(AGENT, int128(2e15), 0, "audit", "", "", "", bytes32(0));
    }

    function test_RejectsFeedbackForUnknownAgent() public {
        vm.prank(clientA);
        vm.expectRevert(ReputationRegistry.UnknownAgent.selector);
        rep.giveFeedback(999, 5, 0, "audit", "", "", "", bytes32(0));
    }

    function testFuzz_GiveFeedbackValueBound(int128 value) public {
        vm.prank(clientA);
        if (value > 1e15 || value < -1e15) {
            vm.expectRevert(ReputationRegistry.ValueOutOfRange.selector);
            rep.giveFeedback(AGENT, value, 0, "f", "", "", "", bytes32(0));
        } else {
            rep.giveFeedback(AGENT, value, 0, "f", "", "", "", bytes32(0));
            assertEq(rep.getLastIndex(AGENT, clientA), 1);
            // In-range values must never overflow the int128 summary.
            address[] memory none = new address[](0);
            rep.getSummary(AGENT, none, "", "");
        }
    }
}
