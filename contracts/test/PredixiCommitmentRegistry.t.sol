// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test}    from "forge-std/Test.sol";
import {PredixiCommitmentRegistry} from "../src/PredixiCommitmentRegistry.sol";

/**
 * @title  PredixiCommitmentRegistryTest
 * @notice Foundry test suite for PredixiCommitmentRegistry.
 *
 * Run from the contracts/ directory:
 *   forge test            — run all tests
 *   forge test -vvv       — verbose (shows logs + call traces on failure)
 *   forge test --gas-report — show gas usage per function
 *
 * Setup (one-time, from contracts/ directory):
 *   forge install foundry-rs/forge-std
 */
contract PredixiCommitmentRegistryTest is Test {

    PredixiCommitmentRegistry registry;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    bytes32 constant HASH_MATCH  = keccak256("match-prediction:wallet:abc:matchId:123:outcome:home");
    bytes32 constant HASH_XI     = keccak256("daily-xi:wallet:abc:2026-05-23:players:sorted");
    bytes32 constant HASH_WC     = keccak256("wc-prediction:wallet:abc:predKey:xyz:value:teamA");

    uint256 constant FIXED_TIME  = 1_716_000_000; // a fixed block.timestamp for determinism

    // ─────────────────────────────────────────────────────────────────────────
    // Setup
    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        registry = new PredixiCommitmentRegistry();
        vm.warp(FIXED_TIME);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Happy path — submit and read
    // ─────────────────────────────────────────────────────────────────────────

    function test_Submit_RecordsSubmitter() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        (address submitter,) = registry.getCommitmentRecord(HASH_MATCH);
        assertEq(submitter, alice, "submitter should be alice");
    }

    function test_Submit_RecordsTimestamp() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        uint256 ts = registry.getCommitmentTimestamp(HASH_MATCH);
        assertEq(ts, FIXED_TIME, "timestamp should equal block.timestamp");
    }

    function test_Submit_GetCommitmentRecord_ReturnsCorrectPair() public {
        vm.prank(bob);
        registry.submitCommitment(HASH_XI, "daily-xi");

        (address sub, uint256 ts) = registry.getCommitmentRecord(HASH_XI);
        assertEq(sub, bob,        "submitter mismatch");
        assertEq(ts,  FIXED_TIME, "timestamp mismatch");
    }

    function test_Submit_EmitsCommitmentSubmittedEvent() public {
        vm.prank(alice);

        // All 4 event fields must match (indexed1=true, indexed2=true, nonIndexed=true, topic0=true)
        vm.expectEmit(true, true, false, true);
        emit PredixiCommitmentRegistry.CommitmentSubmitted(
            alice,
            HASH_MATCH,
            "match-prediction",
            FIXED_TIME
        );
        registry.submitCommitment(HASH_MATCH, "match-prediction");
    }

    function test_Submit_EmitsEvent_WithDailyXIContext() public {
        vm.prank(bob);

        vm.expectEmit(true, true, false, true);
        emit PredixiCommitmentRegistry.CommitmentSubmitted(bob, HASH_XI, "daily-xi", FIXED_TIME);
        registry.submitCommitment(HASH_XI, "daily-xi");
    }

    function test_Submit_EmitsEvent_WithWCContext() public {
        vm.prank(alice);

        vm.expectEmit(true, true, false, true);
        emit PredixiCommitmentRegistry.CommitmentSubmitted(alice, HASH_WC, "wc-prediction", FIXED_TIME);
        registry.submitCommitment(HASH_WC, "wc-prediction");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // isSubmitted
    // ─────────────────────────────────────────────────────────────────────────

    function test_IsSubmitted_ReturnsFalseBeforeSubmit() public view {
        assertFalse(registry.isSubmitted(HASH_MATCH), "should not be submitted yet");
    }

    function test_IsSubmitted_ReturnsTrueAfterSubmit() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");
        assertTrue(registry.isSubmitted(HASH_MATCH), "should be submitted");
    }

    function test_IsSubmitted_OnlyTrueForSubmittedHash() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        assertTrue(registry.isSubmitted(HASH_MATCH),  "HASH_MATCH should be submitted");
        assertFalse(registry.isSubmitted(HASH_XI),    "HASH_XI should not be submitted");
        assertFalse(registry.isSubmitted(HASH_WC),    "HASH_WC should not be submitted");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Multiple wallets submitting different hashes
    // ─────────────────────────────────────────────────────────────────────────

    function test_MultipleWallets_CanSubmitDifferentHashes() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        vm.prank(bob);
        registry.submitCommitment(HASH_XI, "daily-xi");

        (address s1,) = registry.getCommitmentRecord(HASH_MATCH);
        (address s2,) = registry.getCommitmentRecord(HASH_XI);
        assertEq(s1, alice, "HASH_MATCH submitter should be alice");
        assertEq(s2, bob,   "HASH_XI submitter should be bob");
    }

    function test_SameWallet_CanSubmitMultipleDifferentHashes() public {
        vm.startPrank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");
        registry.submitCommitment(HASH_XI,    "daily-xi");
        registry.submitCommitment(HASH_WC,    "wc-prediction");
        vm.stopPrank();

        assertTrue(registry.isSubmitted(HASH_MATCH), "match hash submitted");
        assertTrue(registry.isSubmitted(HASH_XI),    "xi hash submitted");
        assertTrue(registry.isSubmitted(HASH_WC),    "wc hash submitted");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read before write — zero values
    // ─────────────────────────────────────────────────────────────────────────

    function test_GetCommitmentTimestamp_UnsubmittedHash_ReturnsZero() public view {
        uint256 ts = registry.getCommitmentTimestamp(HASH_MATCH);
        assertEq(ts, 0, "timestamp should be 0 for unsubmitted hash");
    }

    function test_GetCommitmentRecord_UnsubmittedHash_ReturnsZeroAddressAndZeroTimestamp()
        public view
    {
        (address sub, uint256 ts) = registry.getCommitmentRecord(HASH_MATCH);
        assertEq(sub, address(0), "submitter should be address(0)");
        assertEq(ts,  0,          "timestamp should be 0");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Error cases
    // ─────────────────────────────────────────────────────────────────────────

    function test_DuplicateHash_Reverts_WithAlreadySubmitted() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        vm.expectRevert(
            abi.encodeWithSelector(
                PredixiCommitmentRegistry.AlreadySubmitted.selector,
                HASH_MATCH
            )
        );
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");
    }

    function test_DuplicateHash_DifferentWallet_StillReverts() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        // Bob tries to anchor the same hash — the hash uniqueness is global
        vm.expectRevert(
            abi.encodeWithSelector(
                PredixiCommitmentRegistry.AlreadySubmitted.selector,
                HASH_MATCH
            )
        );
        vm.prank(bob);
        registry.submitCommitment(HASH_MATCH, "match-prediction");
    }

    function test_ZeroHash_Reverts_WithZeroHashNotAllowed() public {
        vm.expectRevert(PredixiCommitmentRegistry.ZeroHashNotAllowed.selector);
        vm.prank(alice);
        registry.submitCommitment(bytes32(0), "match-prediction");
    }

    function test_ZeroHash_Reverts_ForAnyWallet() public {
        vm.expectRevert(PredixiCommitmentRegistry.ZeroHashNotAllowed.selector);
        vm.prank(bob);
        registry.submitCommitment(bytes32(0), "daily-xi");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Timestamp accuracy
    // ─────────────────────────────────────────────────────────────────────────

    function test_Timestamp_MatchesBlockTimestamp_AtSubmitTime() public {
        // Advance to a different time than setUp
        uint256 laterTime = FIXED_TIME + 86_400; // +1 day
        vm.warp(laterTime);

        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        uint256 ts = registry.getCommitmentTimestamp(HASH_MATCH);
        assertEq(ts, laterTime, "timestamp should match block.timestamp at submit time");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Context does NOT affect deduplication (hash uniqueness, not context)
    // ─────────────────────────────────────────────────────────────────────────

    function test_SameHash_DifferentContext_StillReverts() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");

        // Same hash, different context string — should still revert
        vm.expectRevert(
            abi.encodeWithSelector(
                PredixiCommitmentRegistry.AlreadySubmitted.selector,
                HASH_MATCH
            )
        );
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "wc-prediction");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_Submit_AnyNonZeroHash_SucceedsFirstTime(
        bytes32 hash,
        address user,
        string  calldata context
    ) public {
        vm.assume(hash != bytes32(0));
        vm.assume(user != address(0));

        vm.prank(user);
        registry.submitCommitment(hash, context);

        (address sub, uint256 ts) = registry.getCommitmentRecord(hash);
        assertEq(sub, user,              "submitter should be user");
        assertEq(ts,  block.timestamp,   "timestamp should be block.timestamp");
        assertTrue(registry.isSubmitted(hash), "should be marked submitted");
    }

    function testFuzz_Submit_SameHashTwice_AlwaysReverts(
        bytes32 hash,
        address user1,
        address user2,
        string  calldata context
    ) public {
        vm.assume(hash  != bytes32(0));
        vm.assume(user1 != address(0));
        vm.assume(user2 != address(0));

        vm.prank(user1);
        registry.submitCommitment(hash, context);

        vm.expectRevert(
            abi.encodeWithSelector(
                PredixiCommitmentRegistry.AlreadySubmitted.selector,
                hash
            )
        );
        vm.prank(user2);
        registry.submitCommitment(hash, context);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gas snapshot helpers (visible with --gas-report)
    // ─────────────────────────────────────────────────────────────────────────

    function test_GasUsage_Submit() public {
        vm.prank(alice);
        registry.submitCommitment(HASH_MATCH, "match-prediction");
        // Run with: forge test --gas-report -m test_GasUsage_Submit
    }

    function test_GasUsage_Read() public view {
        registry.getCommitmentTimestamp(HASH_MATCH);
        registry.getCommitmentRecord(HASH_MATCH);
        registry.isSubmitted(HASH_MATCH);
    }
}
