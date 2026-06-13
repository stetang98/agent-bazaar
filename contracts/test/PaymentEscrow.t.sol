// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract PaymentEscrowTest is Test {
    MockUSDC usdc;
    IdentityRegistry identity;
    PaymentEscrow escrow;

    address payer = makeAddr("payer");
    address agentWallet = makeAddr("agentWallet");
    address stranger = makeAddr("stranger");
    uint256 constant AGENT = 1;
    uint256 constant PRICE = 100_000; // 0.10 USDC (6 decimals)

    function setUp() public {
        usdc = new MockUSDC();
        identity = new IdentityRegistry();
        vm.prank(agentWallet);
        identity.register("ipfs://auditor"); // agentId 1 owned by agentWallet => getAgentWallet(1) == agentWallet
        escrow = new PaymentEscrow(address(usdc), address(identity));
        usdc.mint(payer, 1_000_000); // 1 USDC
    }

    function _settle(bytes32 taskId, uint256 value) internal {
        // agentWallet is derived on-chain from agentId; nonce == taskId for the mock; sig fields unused by mock.
        escrow.settle(taskId, AGENT, payer, value, 0, type(uint256).max, taskId, 0, bytes32(0), bytes32(0));
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

    function test_SettleUnknownAgentReverts() public {
        vm.expectRevert(PaymentEscrow.UnknownAgent.selector);
        escrow.settle(keccak256("u"), 999, payer, PRICE, 0, type(uint256).max, keccak256("u"), 0, bytes32(0), bytes32(0));
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
        vm.prank(stranger);
        vm.expectRevert(PaymentEscrow.NothingOwed.selector);
        escrow.withdraw();
    }

    function test_TwoTasksAccumulateOwed() public {
        _settle(keccak256("a"), PRICE);
        _settle(keccak256("b"), PRICE);
        assertEq(escrow.owed(agentWallet), 2 * PRICE);
    }

    function test_ReceiveEnforcesCallerIsPayee() public {
        // Models the EIP-3009 front-running guard the escrow relies on.
        vm.expectRevert(MockUSDC.CallerMustBePayee.selector);
        usdc.receiveWithAuthorization(
            payer, agentWallet, PRICE, 0, type(uint256).max, keccak256("x"), 0, bytes32(0), bytes32(0)
        );
    }
}
