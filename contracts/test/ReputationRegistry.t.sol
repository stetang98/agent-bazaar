// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry rep;

    uint256 constant AGENT = 1;
    address clientA = makeAddr("clientA");
    address clientB = makeAddr("clientB");
    address identity = makeAddr("identity");

    function setUp() public {
        rep = new ReputationRegistry();
        rep.initialize(identity);
    }

    function _give(address who, int128 value, uint8 dec, string memory tag1) internal {
        vm.prank(who);
        rep.giveFeedback(AGENT, value, dec, tag1, "", "https://agent/audit", "", bytes32(0));
    }

    function test_InitializeOnce() public {
        assertEq(rep.getIdentityRegistry(), identity);
        vm.expectRevert();
        rep.initialize(address(0xBEEF));
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
        assertEq(val, 450); // 4.50 averaged, expressed with 2 decimals
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

    function test_SummaryFilteredByTag() public {
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
        vm.expectRevert();
        rep.revokeFeedback(AGENT, 0);
    }

    function test_RejectsInvalidDecimals() public {
        vm.prank(clientA);
        vm.expectRevert();
        rep.giveFeedback(AGENT, 5, 19, "audit", "", "", "", bytes32(0));
    }
}
