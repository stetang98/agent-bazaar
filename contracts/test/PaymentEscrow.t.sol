// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract PaymentEscrowTest is Test {
    MockUSDC usdc;
    PaymentEscrow escrow;

    address payer = makeAddr("payer");
    address agentWallet = makeAddr("agentWallet");
    uint256 constant AGENT = 1;
    uint256 constant PRICE = 100_000; // 0.10 USDC (6 decimals)

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new PaymentEscrow(address(usdc));
        usdc.mint(payer, 1_000_000); // 1 USDC
    }

    function _settle(bytes32 taskId, uint256 value) internal {
        // nonce == taskId for the mock; signature fields are ignored by the mock USDC.
        escrow.settle(
            taskId, AGENT, agentWallet, payer, value, 0, type(uint256).max, taskId, 0, bytes32(0), bytes32(0)
        );
    }

    function test_SettleRecordsReceiptAndCreditsAgent() public {
        bytes32 taskId = keccak256("task1");
        _settle(taskId, PRICE);

        assertEq(usdc.balanceOf(address(escrow)), PRICE);
        assertEq(usdc.balanceOf(payer), 1_000_000 - PRICE);
        assertEq(escrow.owed(agentWallet), PRICE);
        assertTrue(escrow.hasPaid(payer, AGENT));

        (address p, uint256 aid, uint256 amt,) = escrow.receipts(taskId);
        assertEq(p, payer);
        assertEq(aid, AGENT);
        assertEq(amt, PRICE);
    }

    function test_SettleReplayReverts() public {
        bytes32 taskId = keccak256("task1");
        _settle(taskId, PRICE);
        vm.expectRevert(PaymentEscrow.TaskAlreadySettled.selector);
        _settle(taskId, PRICE);
    }

    function test_ZeroValueReverts() public {
        vm.expectRevert(PaymentEscrow.ZeroValue.selector);
        _settle(keccak256("zero"), 0);
    }

    function test_WithdrawPaysAgentAndZeroes() public {
        _settle(keccak256("task1"), PRICE);

        vm.prank(agentWallet);
        escrow.withdraw();

        assertEq(usdc.balanceOf(agentWallet), PRICE);
        assertEq(escrow.owed(agentWallet), 0);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_WithdrawNothingReverts() public {
        vm.prank(agentWallet);
        vm.expectRevert(PaymentEscrow.NothingOwed.selector);
        escrow.withdraw();
    }

    function test_TwoTasksAccumulateOwed() public {
        _settle(keccak256("a"), PRICE);
        _settle(keccak256("b"), PRICE);
        assertEq(escrow.owed(agentWallet), 2 * PRICE);
    }

    function test_ReceiveEnforcesCallerIsPayee() public {
        // Models the EIP-3009 front-running guard the escrow relies on: a direct call where the
        // caller is not the `to` payee must revert.
        vm.expectRevert(MockUSDC.CallerMustBePayee.selector);
        usdc.receiveWithAuthorization(
            payer, agentWallet, PRICE, 0, type(uint256).max, keccak256("x"), 0, bytes32(0), bytes32(0)
        );
    }
}
