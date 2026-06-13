// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";

/// @notice Deploys the Agent Bazaar contracts to Arbitrum Sepolia and writes their addresses to
///         deployments/arbitrum-sepolia.json (consumed by the agent backend + frontend).
/// @dev Run: DEPLOYER_PK=0x... forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast
contract Deploy is Script {
    // Circle USDC on Arbitrum Sepolia (6 decimals, EIP-3009 capable).
    address constant DEFAULT_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        address usdc = vm.envOr("USDC", DEFAULT_USDC);
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");

        vm.startBroadcast(deployerPk);
        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry(address(identity));
        PaymentEscrow escrow = new PaymentEscrow(usdc, address(identity));
        vm.stopBroadcast();

        console2.log("IdentityRegistry  :", address(identity));
        console2.log("ReputationRegistry:", address(reputation));
        console2.log("PaymentEscrow     :", address(escrow));
        console2.log("USDC              :", usdc);

        string memory json = string.concat(
            "{\n",
            '  "chainId": 421614,\n',
            '  "USDC": "',
            vm.toString(usdc),
            '",\n',
            '  "IdentityRegistry": "',
            vm.toString(address(identity)),
            '",\n',
            '  "ReputationRegistry": "',
            vm.toString(address(reputation)),
            '",\n',
            '  "PaymentEscrow": "',
            vm.toString(address(escrow)),
            '"\n}\n'
        );
        vm.writeFile("deployments/arbitrum-sepolia.json", json);
        console2.log("Wrote deployments/arbitrum-sepolia.json");
    }
}
