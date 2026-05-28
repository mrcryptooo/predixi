// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {PredixiCommitmentRegistry} from "../src/PredixiCommitmentRegistry.sol";

/**
 * @title  DeployScript
 * @notice Deploys PredixiCommitmentRegistry to Base Mainnet (chainId 8453).
 *
 * ── Required environment variable ────────────────────────────────────────────
 *
 *   DEPLOYER_PRIVATE_KEY   — hex private key of the deployer wallet (0x-prefixed)
 *                            Fund with ~0.002 ETH on Base Mainnet before running.
 *                            NEVER commit this value. NEVER write it to any file.
 *                            Set it in the shell session only.
 *
 * ── Optional environment variable ────────────────────────────────────────────
 *
 *   BASE_MAINNET_RPC_URL   — Base Mainnet JSON-RPC endpoint
 *                            Defaults to https://mainnet.base.org if not set.
 *                            Can also be supplied via --rpc-url flag.
 *
 * ── Deploy (from the contracts/ directory) ───────────────────────────────────
 *
 *   Bash / Zsh:
 *     export DEPLOYER_PRIVATE_KEY="0x<your key>"
 *     forge script script/Deploy.s.sol:DeployScript \
 *       --rpc-url https://mainnet.base.org \
 *       --broadcast
 *
 *   PowerShell:
 *     $env:DEPLOYER_PRIVATE_KEY = "0x<your key>"
 *     forge script script/Deploy.s.sol:DeployScript `
 *       --rpc-url https://mainnet.base.org `
 *       --broadcast
 *
 * ── What this script does ────────────────────────────────────────────────────
 *
 *   1. Reads DEPLOYER_PRIVATE_KEY from the environment.
 *   2. Starts a broadcast transaction session (signs and sends real txs).
 *   3. Deploys a new PredixiCommitmentRegistry contract.
 *   4. Stops broadcast.
 *   5. Logs the deployed contract address to the console.
 *
 *   The deployer wallet is NOT the contract owner — the contract has no owner.
 *   The deployer address is only relevant for gas payment.
 *
 * ── After deploy ─────────────────────────────────────────────────────────────
 *
 *   1. Copy the logged contract address.
 *   2. Set in Vercel and .env.local:
 *        NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT=<address>
 *        NEXT_PUBLIC_BASE_CHAIN_ID=8453
 *   3. Verify (read-only, no gas):
 *        cast call <address> "isSubmitted(bytes32)(bool)" \
 *          0x0000000000000000000000000000000000000000000000000000000000000000 \
 *          --rpc-url https://mainnet.base.org
 *        → expected: false
 *   4. See ONCHAIN_COMMITMENT_MVP.md §Deployment for the full checklist.
 */
contract DeployScript is Script {
    function run() external {
        // ── Read deployer key from environment — never hardcode ───────────────
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // ── Broadcast: all calls between start/stop are sent as real txs ─────
        vm.startBroadcast(deployerKey);

        PredixiCommitmentRegistry registry = new PredixiCommitmentRegistry();

        vm.stopBroadcast();

        // ── Log deployed address (shown in forge script output) ───────────────
        console2.log("PredixiCommitmentRegistry deployed at:", address(registry));
        console2.log("Chain ID:                              ", block.chainid);
        console2.log("Next step: set env var");
        console2.log("  NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT =", address(registry));
    }
}
