// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title  PredixiCommitmentRegistry
 * @notice Append-only, on-chain registry for PrediXI prediction commitment hashes.
 *
 * @dev    Purpose
 *         -------
 *         When a user submits a prediction in the PrediXI app, the backend generates
 *         a keccak256 commitment hash of the prediction payload and stores it in
 *         Supabase. This contract lets the user anchor that same hash on Base, creating
 *         a tamper-evident, chain-verifiable receipt that was recorded *before* any
 *         match result is known.
 *
 *         Only the opaque bytes32 hash is stored on-chain. The raw prediction data
 *         (wallet address, match ID, outcome choice, timestamp) never touches the
 *         contract — keeping costs minimal and user data off-chain.
 *
 *         What this contract DOES:
 *           - Accepts a bytes32 commitment hash + a short context label from a wallet.
 *           - Records the submitter address and block timestamp for each hash.
 *           - Emits a CommitmentSubmitted event for off-chain indexing.
 *           - Prevents duplicate submissions (same hash = revert).
 *           - Exposes read functions so anyone can verify when a hash was anchored.
 *
 *         What this contract does NOT do:
 *           - Does NOT custody any funds or tokens.
 *           - Does NOT pay rewards of any kind.
 *           - Does NOT resolve predictions or evaluate outcomes.
 *           - Does NOT implement any betting, wagering, or gambling logic.
 *           - Does NOT have an owner, admin, or upgrade mechanism.
 *           - Does NOT store raw prediction data.
 *
 *         Gas profile (Base mainnet):
 *           submitCommitment: ~45,000–55,000 gas (~$0.001–0.003 at normal Base fees).
 *           Read calls (getCommitmentTimestamp, getCommitmentRecord): free.
 *
 *         Storage layout:
 *           Each CommitmentRecord (address + uint64) is packed into a single 32-byte
 *           storage slot, minimising storage cost per submission.
 */
contract PredixiCommitmentRegistry {

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Packed into a single 32-byte storage slot:
     *        address (20 bytes) + uint64 (8 bytes) + 4 bytes padding = 32 bytes.
     *      timestamp == 0 means the hash has never been submitted.
     *      uint64 timestamps are safe until the year 2554.
     */
    struct CommitmentRecord {
        address submitter;
        uint64  timestamp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Maps each commitment hash to its on-chain record.
    mapping(bytes32 => CommitmentRecord) private _commitments;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new commitment hash is anchored on Base.
     *
     * @param user            The wallet address that called submitCommitment.
     * @param commitmentHash  The opaque bytes32 hash. Reveals nothing about
     *                        the prediction content — it is a keccak256 of
     *                        the encrypted prediction payload.
     * @param context         A short human-readable label identifying the
     *                        prediction type. Stored in the event log only —
     *                        not in contract storage (saves gas).
     *                        Suggested values: "match-prediction", "daily-xi",
     *                        "wc-prediction".
     * @param timestamp       Block timestamp (seconds since Unix epoch) when
     *                        the commitment was anchored.
     */
    event CommitmentSubmitted(
        address indexed user,
        bytes32 indexed commitmentHash,
        string          context,
        uint256         timestamp
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Errors  (custom errors — cheaper than require strings)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Reverts when attempting to submit a hash that has already been anchored.
    error AlreadySubmitted(bytes32 commitmentHash);

    /// @notice Reverts when the zero hash (bytes32(0)) is submitted.
    error ZeroHashNotAllowed();

    // ─────────────────────────────────────────────────────────────────────────
    // Write functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Anchors a prediction commitment hash on Base.
     *
     * @dev    Validates the hash is non-zero and has not been previously submitted,
     *         then writes a single storage slot (submitter + timestamp) and emits
     *         CommitmentSubmitted.
     *
     *         The `context` string is passed as calldata and logged in the event
     *         only — it is NOT written to contract storage. This keeps gas costs
     *         low while still providing a human-readable label for off-chain
     *         indexers and BaseScan.
     *
     * @param commitmentHash  The bytes32 keccak256 hash of the prediction payload.
     *                        Must be unique across all submissions.
     *                        Must not be bytes32(0).
     * @param context         A short label for the prediction type. Purely
     *                        informational — not validated or stored on-chain.
     *                        Max recommended length: 32 characters.
     *
     * Emits {CommitmentSubmitted}.
     * Reverts with {ZeroHashNotAllowed}  if commitmentHash == bytes32(0).
     * Reverts with {AlreadySubmitted}    if commitmentHash was previously anchored.
     */
    function submitCommitment(
        bytes32         commitmentHash,
        string calldata context
    ) external {
        if (commitmentHash == bytes32(0)) {
            revert ZeroHashNotAllowed();
        }
        if (_commitments[commitmentHash].timestamp != 0) {
            revert AlreadySubmitted(commitmentHash);
        }

        uint64 ts = uint64(block.timestamp);

        _commitments[commitmentHash] = CommitmentRecord({
            submitter: msg.sender,
            timestamp: ts
        });

        emit CommitmentSubmitted(msg.sender, commitmentHash, context, ts);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the block timestamp when a commitment hash was anchored.
     *
     * @param commitmentHash  The bytes32 hash to query.
     * @return                Seconds since Unix epoch, or 0 if the hash has never
     *                        been submitted.
     *
     * @dev    Returns uint256 (not uint64) so callers do not need to cast.
     *         The value stored internally is uint64 but is safe to read as uint256.
     */
    function getCommitmentTimestamp(bytes32 commitmentHash)
        external
        view
        returns (uint256)
    {
        return _commitments[commitmentHash].timestamp;
    }

    /**
     * @notice Returns the full on-chain record for a commitment hash.
     *
     * @param commitmentHash  The bytes32 hash to query.
     * @return submitter      The wallet that submitted the commitment,
     *                        or address(0) if the hash has never been submitted.
     * @return timestamp      Seconds since Unix epoch, or 0 if not found.
     */
    function getCommitmentRecord(bytes32 commitmentHash)
        external
        view
        returns (address submitter, uint256 timestamp)
    {
        CommitmentRecord storage r = _commitments[commitmentHash];
        return (r.submitter, r.timestamp);
    }

    /**
     * @notice Returns true if the given hash has been submitted.
     *
     * @dev    Cheaper to call than getCommitmentTimestamp when the caller only
     *         needs a boolean check (e.g., duplicate-detection pre-flight).
     *
     * @param commitmentHash  The bytes32 hash to check.
     * @return                True if the hash was previously anchored.
     */
    function isSubmitted(bytes32 commitmentHash)
        external
        view
        returns (bool)
    {
        return _commitments[commitmentHash].timestamp != 0;
    }
}
