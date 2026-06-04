// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC1155}  from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {EIP712}   from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}    from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable}  from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  PrediXIBadges
 * @notice Soulbound ERC-1155 achievement badges for PrediXI on Base.
 *
 * @dev    Architecture
 *         ─────────────
 *         Badges are NOT freely mintable. The backend must sign an EIP-712
 *         MintBadge struct authorising exactly one wallet to mint one badge.
 *         The signature binds to msg.sender, so it cannot be replayed by a
 *         different wallet.
 *
 *         Soulbound enforcement
 *         ─────────────────────
 *         safeTransferFrom, safeBatchTransferFrom, and setApprovalForAll all
 *         unconditionally revert.  Tokens can only move into a wallet via
 *         mintBadge — they can never move out.
 *
 *         Token IDs
 *         ─────────
 *         1 – 19  current badges (see src/data/badges.ts for ID mapping)
 *         20 – 25 reserved for future badges
 *         0 and 26+ are invalid and will revert on mintBadge.
 *
 *         XP note
 *         ────────
 *         This contract has no awareness of XP.  XP is awarded offchain when
 *         a badge is earned (user_badges row inserted), NOT when an NFT is
 *         minted here.  Minting this NFT grants no additional XP.
 *
 *         Signer rotation
 *         ───────────────
 *         The `signer` address is the backend wallet that authorises mints.
 *         The owner can rotate it via setSigner() — e.g. after a key rotation.
 *         Old signatures become invalid immediately on rotation.
 */
contract PrediXIBadges is ERC1155, EIP712, Ownable {

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev EIP-712 type hash for the MintBadge authorisation struct.
    bytes32 public constant MINT_BADGE_TYPEHASH =
        keccak256("MintBadge(address wallet,uint256 tokenId,bytes32 nonce)");

    /// @dev Inclusive lower bound for valid token IDs.
    uint256 public constant MIN_TOKEN_ID = 1;

    /// @dev Inclusive upper bound for valid token IDs (IDs 20–25 are reserved).
    uint256 public constant MAX_TOKEN_ID = 25;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Address whose EIP-712 signature authorises a mint.  Rotatable
    ///         by the owner via setSigner().
    address public signer;

    /// @notice Nonce → consumed flag.  Prevents signature replay across mints.
    mapping(bytes32 => bool) public usedNonces;

    /// @notice wallet → tokenId → minted flag.  Enforces one-mint-per-badge
    ///         per wallet.
    mapping(address => mapping(uint256 => bool)) public hasMinted;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted after a badge is successfully minted.
    event BadgeMinted(
        address indexed wallet,
        uint256 indexed tokenId,
        bytes32         nonce
    );

    /// @notice Emitted when the owner rotates the authorised signer.
    event SignerUpdated(
        address indexed previousSigner,
        address indexed newSigner
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice tokenId is outside the valid range [MIN_TOKEN_ID, MAX_TOKEN_ID].
    error InvalidTokenId(uint256 tokenId);

    /// @notice This nonce has already been consumed by a previous mint.
    error NonceAlreadyUsed(bytes32 nonce);

    /// @notice The caller already owns this badge.
    error AlreadyMinted(address wallet, uint256 tokenId);

    /// @notice The recovered signer does not match the authorised signer.
    error InvalidSignature();

    /// @notice Soulbound: all token transfers are permanently disabled.
    error TransferNotAllowed();

    /// @notice address(0) is not a valid signer.
    error ZeroAddress();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param initialOwner   Address that will own the contract (can setSigner,
     *                       transferOwnership).  Must not be address(0).
     * @param initialSigner  Backend wallet whose signatures authorise mints.
     *                       Must not be address(0).
     * @param baseURI        Metadata URI template.  Use
     *                       "https://predixi-base.vercel.app/api/badges/metadata/{id}"
     *                       or an IPFS gateway once metadata is finalised.
     */
    constructor(
        address       initialOwner,
        address       initialSigner,
        string memory baseURI
    )
        ERC1155(baseURI)
        EIP712("PrediXIBadges", "1")
        Ownable(initialOwner)
    {
        if (initialSigner == address(0)) revert ZeroAddress();
        signer = initialSigner;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mint
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint one PrediXI badge NFT.
     *
     * @dev    The caller (msg.sender) receives the badge.  The backend must
     *         sign the EIP-712 struct:
     *
     *           MintBadge(address wallet, uint256 tokenId, bytes32 nonce)
     *
     *         where `wallet` == msg.sender.  Signatures generated for another
     *         wallet are rejected even if the signature itself is valid.
     *
     *         Checks (in order):
     *           1. tokenId in [1, 25]
     *           2. nonce not yet consumed
     *           3. wallet has not already minted this tokenId
     *           4. recovered signer == authorised signer
     *
     * @param tokenId    Badge token ID (1–25).
     * @param nonce      Unique bytes32 value generated by the backend per
     *                   authorisation.  Stored permanently after use.
     * @param signature  65-byte ECDSA signature over the EIP-712 digest.
     *
     * Emits {BadgeMinted}.
     */
    function mintBadge(
        uint256       tokenId,
        bytes32       nonce,
        bytes calldata signature
    ) external {
        // ── 1. Token ID bounds check ──────────────────────────────────────────
        if (tokenId < MIN_TOKEN_ID || tokenId > MAX_TOKEN_ID) {
            revert InvalidTokenId(tokenId);
        }

        // ── 2. Nonce replay protection ────────────────────────────────────────
        if (usedNonces[nonce]) revert NonceAlreadyUsed(nonce);

        // ── 3. One-mint-per-badge-per-wallet ──────────────────────────────────
        if (hasMinted[msg.sender][tokenId]) revert AlreadyMinted(msg.sender, tokenId);

        // ── 4. EIP-712 signature verification ────────────────────────────────
        //
        //    The struct hash encodes msg.sender as `wallet`, binding the
        //    signature to the calling wallet.  A signature issued to alice
        //    cannot be used by bob because the recovered address will not
        //    match `signer` when bob calls with a signature where wallet=alice.
        bytes32 structHash = keccak256(
            abi.encode(MINT_BADGE_TYPEHASH, msg.sender, tokenId, nonce)
        );
        bytes32 digest    = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        // ── 5. State mutations (checks-effects-interactions) ──────────────────
        usedNonces[nonce]              = true;
        hasMinted[msg.sender][tokenId] = true;

        // ── 6. Mint ───────────────────────────────────────────────────────────
        _mint(msg.sender, tokenId, 1, "");

        emit BadgeMinted(msg.sender, tokenId, nonce);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Replace the authorised backend signer.
     *
     * @dev    Rotate when the backend signing key is compromised or cycled.
     *         All outstanding signatures signed by the old key become invalid
     *         immediately — users mid-flow must re-request a signature.
     *
     * @param newSigner  New backend signer address.  Must not be address(0).
     *
     * Emits {SignerUpdated}.
     */
    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, newSigner);
        signer = newSigner;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Soulbound overrides — all transfers permanently disabled
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Soulbound: always reverts.
     */
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert TransferNotAllowed();
    }

    /**
     * @dev Soulbound: always reverts.
     */
    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert TransferNotAllowed();
    }

    /**
     * @dev Soulbound: approvals are meaningless when transfers are impossible.
     *      Always reverts to prevent misleading on-chain state.
     */
    function setApprovalForAll(address, bool) public pure override {
        revert TransferNotAllowed();
    }
}
