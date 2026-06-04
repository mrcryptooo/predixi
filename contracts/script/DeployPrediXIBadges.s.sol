// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {PrediXIBadges}    from "../src/PrediXIBadges.sol";

/**
 * @title  DeployPrediXIBadges
 * @notice Deploys PrediXIBadges (soulbound ERC-1155 badge NFT) to Base Mainnet.
 *
 * ── Required environment variables ───────────────────────────────────────────
 *
 *   DEPLOYER_PRIVATE_KEY   — hex private key of the deployer wallet (0x-prefixed).
 *                            This wallet pays gas only. It does NOT become owner.
 *                            Fund with ~0.002 ETH on Base Mainnet before running.
 *                            NEVER commit this value.
 *                            NEVER write it to any file.
 *                            Set it in the shell session only, then clear it.
 *
 *   PREDIXI_BADGE_OWNER    — address that will own the deployed contract.
 *                            The owner can call setSigner() to rotate the
 *                            backend signing key.
 *                            Use a hardware wallet or multisig address.
 *                            MUST NOT be the deployer address.
 *
 *   PREDIXI_BADGE_SIGNER   — address of the backend wallet that signs
 *                            EIP-712 MintBadge authorisations.
 *                            This is the hot wallet whose private key the
 *                            backend API holds (BADGE_SIGNER_KEY in Phase 5).
 *
 * ── Optional environment variable ────────────────────────────────────────────
 *
 *   PREDIXI_BADGE_BASE_URI — ERC-1155 metadata URI template.
 *                            Defaults to the production metadata endpoint if
 *                            not set (see DEFAULT_BASE_URI below).
 *                            The string must contain the literal "{id}"
 *                            placeholder — off-chain clients substitute the
 *                            token ID in hex, zero-padded to 64 chars.
 *
 * ── Deploy (from the contracts/ directory) ───────────────────────────────────
 *
 *   ⚠  DO NOT RUN until Phase 2 is approved and you have funded the deployer.
 *
 *   Bash / Zsh:
 *     export DEPLOYER_PRIVATE_KEY="0x<deployer key>"
 *     export PREDIXI_BADGE_OWNER="0x<owner address>"
 *     export PREDIXI_BADGE_SIGNER="0x<signer address>"
 *     # Optional — omit to use the default URI:
 *     # export PREDIXI_BADGE_BASE_URI="https://..."
 *
 *     forge script script/DeployPrediXIBadges.s.sol:DeployPrediXIBadges \
 *       --rpc-url https://mainnet.base.org \
 *       --broadcast \
 *       --verify \
 *       --etherscan-api-key $BASESCAN_API_KEY
 *
 *   PowerShell:
 *     $env:DEPLOYER_PRIVATE_KEY = "0x<deployer key>"
 *     $env:PREDIXI_BADGE_OWNER  = "0x<owner address>"
 *     $env:PREDIXI_BADGE_SIGNER = "0x<signer address>"
 *
 *     forge script script/DeployPrediXIBadges.s.sol:DeployPrediXIBadges `
 *       --rpc-url https://mainnet.base.org `
 *       --broadcast `
 *       --verify `
 *       --etherscan-api-key $env:BASESCAN_API_KEY
 *
 * ── What this script does ────────────────────────────────────────────────────
 *
 *   1. Reads DEPLOYER_PRIVATE_KEY, PREDIXI_BADGE_OWNER, PREDIXI_BADGE_SIGNER
 *      from environment. Reverts immediately if any required var is missing
 *      or is address(0).
 *   2. Reads PREDIXI_BADGE_BASE_URI (optional — falls back to DEFAULT_BASE_URI).
 *   3. Starts a broadcast session (deploys a real transaction when --broadcast
 *      is passed; dry-runs silently without it).
 *   4. Deploys PrediXIBadges(initialOwner, initialSigner, baseURI).
 *   5. Stops broadcast.
 *   6. Logs the deployed contract address, owner, signer, baseURI, and the
 *      exact env var to set in Vercel.
 *
 *   IMPORTANT: the deployer private key is NEVER logged.
 *
 * ── After deploy ─────────────────────────────────────────────────────────────
 *
 *   1. Copy the logged contract address.
 *   2. Set in Vercel (and .env.local for local testing):
 *        NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT=<address>
 *        NEXT_PUBLIC_BASE_CHAIN_ID=8453
 *   3. Verify ownership on Basescan:
 *        cast call <address> "owner()(address)" \
 *          --rpc-url https://mainnet.base.org
 *        → expected: PREDIXI_BADGE_OWNER address
 *   4. Verify signer:
 *        cast call <address> "signer()(address)" \
 *          --rpc-url https://mainnet.base.org
 *        → expected: PREDIXI_BADGE_SIGNER address
 *   5. Confirm token range (should not revert for ID 1):
 *        cast call <address> "MIN_TOKEN_ID()(uint256)" \
 *          --rpc-url https://mainnet.base.org
 *        → expected: 1
 *   6. The broadcast artifacts will appear in contracts/broadcast/ —
 *      keep that directory untracked (it is already in .gitignore logic).
 */
contract DeployPrediXIBadges is Script {

    /// @dev Fallback metadata URI used when PREDIXI_BADGE_BASE_URI is not set.
    ///      Points to the Phase 4 backend metadata endpoint.
    ///      Must contain the literal "{id}" placeholder per ERC-1155 spec.
    string constant DEFAULT_BASE_URI =
        "https://predixi-base.vercel.app/api/badges/metadata/{id}";

    function run() external {
        // ── 1. Read required env vars ─────────────────────────────────────────
        //
        //    vm.envUint / vm.envAddress revert with a clear error if the
        //    variable is missing — fail fast before any broadcast.
        //
        //    The private key is read into a local uint256 and is NEVER logged.

        uint256 deployerKey  = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address initialOwner  = vm.envAddress("PREDIXI_BADGE_OWNER");
        address initialSigner = vm.envAddress("PREDIXI_BADGE_SIGNER");

        // ── 2. Validate addresses before broadcast ────────────────────────────
        //
        //    Reverting here (before vm.startBroadcast) means no gas is spent
        //    if the addresses are misconfigured.

        require(initialOwner  != address(0), "DeployPrediXIBadges: PREDIXI_BADGE_OWNER is zero address");
        require(initialSigner != address(0), "DeployPrediXIBadges: PREDIXI_BADGE_SIGNER is zero address");

        // Warn if owner == signer — not illegal, but unusual and worth flagging.
        // Use console2 (not require) so the deploy still proceeds; the operator
        // can decide whether this is intentional.
        if (initialOwner == initialSigner) {
            console2.log("WARNING: PREDIXI_BADGE_OWNER == PREDIXI_BADGE_SIGNER");
            console2.log("         Consider using separate wallets for security.");
        }

        // ── 3. Read optional base URI (falls back to default) ─────────────────

        string memory baseURI = vm.envOr(
            "PREDIXI_BADGE_BASE_URI",
            DEFAULT_BASE_URI
        );

        // ── 4. Log pre-deploy summary (no secrets) ────────────────────────────

        console2.log("=== PrediXIBadges Deploy ===");
        console2.log("Chain ID:       ", block.chainid);
        console2.log("Owner:          ", initialOwner);
        console2.log("Signer:         ", initialSigner);
        console2.log("Base URI:       ", baseURI);
        console2.log("---");

        // ── 5. Deploy ─────────────────────────────────────────────────────────
        //
        //    vm.startBroadcast(key): all contract deployments and calls between
        //    start/stop are signed with the deployer key and broadcast as real
        //    transactions when --broadcast is passed.
        //    Without --broadcast, forge runs a dry simulation (safe to test).

        vm.startBroadcast(deployerKey);

        PrediXIBadges badges = new PrediXIBadges(
            initialOwner,   // contract owner — can setSigner(), transferOwnership()
            initialSigner,  // backend EIP-712 signing wallet
            baseURI         // ERC-1155 metadata URI template
        );

        vm.stopBroadcast();

        // ── 6. Log deployed address and next steps ────────────────────────────

        console2.log("=== Deploy Complete ===");
        console2.log("PrediXIBadges deployed at:", address(badges));
        console2.log("---");
        console2.log("Set these env vars in Vercel and .env.local:");
        console2.log("  NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT =", address(badges));
        console2.log("  NEXT_PUBLIC_BASE_CHAIN_ID          = 8453");
        console2.log("---");
        console2.log("Verify on Basescan:");
        console2.log("  https://basescan.org/address/", address(badges));
        console2.log("---");
        console2.log("Verify ownership:");
        console2.log("  cast call", address(badges), "\"owner()(address)\"",
            "--rpc-url https://mainnet.base.org");
        console2.log("  expected:", initialOwner);
    }
}
