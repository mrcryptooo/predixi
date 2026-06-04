// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {PrediXIBadges} from "../src/PrediXIBadges.sol";

/**
 * @title  PrediXIBadgesTest
 * @notice Foundry test suite for PrediXIBadges.
 *
 * Run from the contracts/ directory:
 *   forge test -vvv                   — run all tests with traces
 *   forge test --gas-report           — gas usage per function
 *   forge test --match-test testFuzz  — fuzz tests only
 */
contract PrediXIBadgesTest is Test {

    // ─────────────────────────────────────────────────────────────────────────
    // Test fixtures
    // ─────────────────────────────────────────────────────────────────────────

    PrediXIBadges badges;

    /// @dev Known private key → deterministic signer address for all EIP-712 helpers.
    uint256 constant SIGNER_PK  = 0xA11CE_BEEF_DEAD_C0DE;
    uint256 constant OTHER_PK   = 0xB0B_CAFE_1234_5678;

    address signer;    // vm.addr(SIGNER_PK)
    address otherKey;  // vm.addr(OTHER_PK) — not the authorised signer
    address owner;
    address alice;
    address bob;

    string  constant BASE_URI   = "https://predixi-base.vercel.app/api/badges/metadata/{id}";
    uint256 constant TOKEN_1    = 1;
    uint256 constant TOKEN_19   = 19;
    uint256 constant TOKEN_25   = 25;  // last reserved

    bytes32 constant NONCE_A    = keccak256("nonce-a");
    bytes32 constant NONCE_B    = keccak256("nonce-b");

    // Must match PrediXIBadges.MINT_BADGE_TYPEHASH exactly.
    bytes32 constant MINT_BADGE_TYPEHASH =
        keccak256("MintBadge(address wallet,uint256 tokenId,bytes32 nonce)");

    // ─────────────────────────────────────────────────────────────────────────
    // Setup
    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        signer   = vm.addr(SIGNER_PK);
        otherKey = vm.addr(OTHER_PK);
        owner    = makeAddr("owner");
        alice    = makeAddr("alice");
        bob      = makeAddr("bob");

        vm.prank(owner);
        badges = new PrediXIBadges(owner, signer, BASE_URI);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EIP-712 signing helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Compute the EIP-712 domain separator for the deployed contract.
     *      Must match the values passed to the PrediXIBadges constructor:
     *        name    = "PrediXIBadges"
     *        version = "1"
     */
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("PrediXIBadges"),
            keccak256("1"),
            block.chainid,
            address(badges)
        ));
    }

    /**
     * @dev Build and sign a MintBadge EIP-712 digest.
     *
     * @param pk       Signer's private key.
     * @param wallet   The `wallet` field in the struct (= intended msg.sender).
     * @param tokenId  Badge token ID.
     * @param nonce    Unique nonce for this authorisation.
     * @return 65-byte ECDSA signature (r ++ s ++ v).
     */
    function _sign(
        uint256 pk,
        address wallet,
        uint256 tokenId,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(MINT_BADGE_TYPEHASH, wallet, tokenId, nonce)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Deployment checks
    // ─────────────────────────────────────────────────────────────────────────

    function test_Deploy_OwnerIsSet() public view {
        assertEq(badges.owner(), owner, "owner should be set at deploy");
    }

    function test_Deploy_SignerIsSet() public view {
        assertEq(badges.signer(), signer, "signer should be set at deploy");
    }

    function test_Deploy_TypeHashMatchesSpec() public view {
        assertEq(
            badges.MINT_BADGE_TYPEHASH(),
            keccak256("MintBadge(address wallet,uint256 tokenId,bytes32 nonce)"),
            "typehash must match spec"
        );
    }

    function test_Deploy_MinMaxTokenIds() public view {
        assertEq(badges.MIN_TOKEN_ID(), 1,  "MIN_TOKEN_ID should be 1");
        assertEq(badges.MAX_TOKEN_ID(), 25, "MAX_TOKEN_ID should be 25");
    }

    function test_Deploy_RevertsIfSignerZero() public {
        vm.expectRevert(PrediXIBadges.ZeroAddress.selector);
        new PrediXIBadges(owner, address(0), BASE_URI);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // URI
    // ─────────────────────────────────────────────────────────────────────────

    function test_URI_ReturnsBaseURI() public view {
        // ERC1155 uri() returns the template string; token 1 should return BASE_URI
        // (ERC1155 default: uri(id) returns the stored string unchanged unless
        // overridden with {id} substitution at the application level).
        string memory returned = badges.uri(TOKEN_1);
        assertEq(returned, BASE_URI, "uri should return BASE_URI template");
    }

    function test_URI_SameForAllTokenIds() public view {
        // The base ERC1155 implementation returns the same template for all IDs.
        assertEq(badges.uri(TOKEN_1),  badges.uri(TOKEN_19), "uri should be consistent");
        assertEq(badges.uri(TOKEN_19), badges.uri(TOKEN_25), "uri should be consistent");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Happy-path mint
    // ─────────────────────────────────────────────────────────────────────────

    function test_Mint_ValidSignature_MintsToken() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);

        assertEq(badges.balanceOf(alice, TOKEN_1), 1, "balanceOf should be 1 after mint");
    }

    function test_Mint_SetsHasMinted() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);

        assertTrue(badges.hasMinted(alice, TOKEN_1), "hasMinted should be true after mint");
    }

    function test_Mint_MarksNonceUsed() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);

        assertTrue(badges.usedNonces(NONCE_A), "nonce should be marked used");
    }

    function test_Mint_EmitsBadgeMinted() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.expectEmit(true, true, false, true);
        emit PrediXIBadges.BadgeMinted(alice, TOKEN_1, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);
    }

    function test_Mint_TokenId19_Works() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_19, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_19, NONCE_A, sig);

        assertEq(badges.balanceOf(alice, TOKEN_19), 1, "token 19 should mint");
    }

    function test_Mint_TokenId25_Reserved_Works() public {
        // ID 25 is reserved but still valid — the contract does not restrict reserved IDs.
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_25, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_25, NONCE_A, sig);

        assertEq(badges.balanceOf(alice, TOKEN_25), 1, "token 25 should mint");
    }

    function test_Mint_TwoDifferentBadges_SameWallet() public {
        bytes memory sigA = _sign(SIGNER_PK, alice, TOKEN_1,  NONCE_A);
        bytes memory sigB = _sign(SIGNER_PK, alice, TOKEN_19, NONCE_B);

        vm.startPrank(alice);
        badges.mintBadge(TOKEN_1,  NONCE_A, sigA);
        badges.mintBadge(TOKEN_19, NONCE_B, sigB);
        vm.stopPrank();

        assertEq(badges.balanceOf(alice, TOKEN_1),  1, "token 1 balance");
        assertEq(badges.balanceOf(alice, TOKEN_19), 1, "token 19 balance");
    }

    function test_Mint_TwoDifferentWallets_SameBadge() public {
        bytes memory sigA = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);
        bytes memory sigB = _sign(SIGNER_PK, bob,   TOKEN_1, NONCE_B);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sigA);

        vm.prank(bob);
        badges.mintBadge(TOKEN_1, NONCE_B, sigB);

        assertEq(badges.balanceOf(alice, TOKEN_1), 1, "alice balance");
        assertEq(badges.balanceOf(bob,   TOKEN_1), 1, "bob balance");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revert: duplicate mint
    // ─────────────────────────────────────────────────────────────────────────

    function test_Revert_DuplicateMint_SameNonce() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);

        // Second attempt with same nonce reverts NonceAlreadyUsed before AlreadyMinted
        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.NonceAlreadyUsed.selector, NONCE_A)
        );
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);
    }

    function test_Revert_DuplicateMint_FreshNonce_AlreadyMinted() public {
        bytes memory sig1 = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);
        bytes memory sig2 = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_B);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig1);

        // Fresh nonce but hasMinted check fires
        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.AlreadyMinted.selector, alice, TOKEN_1)
        );
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_B, sig2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revert: nonce replay
    // ─────────────────────────────────────────────────────────────────────────

    function test_Revert_NonceReplay_DifferentBadge() public {
        // Mint badge 1 consuming NONCE_A, then try to use NONCE_A again for badge 2.
        bytes memory sig1 = _sign(SIGNER_PK, alice, TOKEN_1,  NONCE_A);
        bytes memory sig2 = _sign(SIGNER_PK, alice, TOKEN_19, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig1);

        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.NonceAlreadyUsed.selector, NONCE_A)
        );
        vm.prank(alice);
        badges.mintBadge(TOKEN_19, NONCE_A, sig2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revert: invalid token IDs
    // ─────────────────────────────────────────────────────────────────────────

    function test_Revert_TokenId0() public {
        bytes memory sig = _sign(SIGNER_PK, alice, 0, NONCE_A);

        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.InvalidTokenId.selector, 0)
        );
        vm.prank(alice);
        badges.mintBadge(0, NONCE_A, sig);
    }

    function test_Revert_TokenId26() public {
        bytes memory sig = _sign(SIGNER_PK, alice, 26, NONCE_A);

        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.InvalidTokenId.selector, 26)
        );
        vm.prank(alice);
        badges.mintBadge(26, NONCE_A, sig);
    }

    function test_Revert_TokenIdMaxUint() public {
        uint256 huge = type(uint256).max;
        bytes memory sig = _sign(SIGNER_PK, alice, huge, NONCE_A);

        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.InvalidTokenId.selector, huge)
        );
        vm.prank(alice);
        badges.mintBadge(huge, NONCE_A, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revert: invalid signatures
    // ─────────────────────────────────────────────────────────────────────────

    function test_Revert_WrongSigner() public {
        // Signed by otherKey, not the authorised signer
        bytes memory sig = _sign(OTHER_PK, alice, TOKEN_1, NONCE_A);

        vm.expectRevert(PrediXIBadges.InvalidSignature.selector);
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);
    }

    function test_Revert_SignatureForDifferentWallet() public {
        // Signature authorises alice, but bob tries to use it
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.expectRevert(PrediXIBadges.InvalidSignature.selector);
        vm.prank(bob);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);
    }

    function test_Revert_SignatureForDifferentTokenId() public {
        // Signature authorises token 1, but caller submits token 2
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.expectRevert(PrediXIBadges.InvalidSignature.selector);
        vm.prank(alice);
        badges.mintBadge(2, NONCE_A, sig);
    }

    function test_Revert_TamperedSignature() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        // Flip one byte
        sig[0] = sig[0] ^ 0xFF;

        // May revert with InvalidSignature or ECDSA error depending on bytes
        vm.prank(alice);
        (bool success,) = address(badges).call(
            abi.encodeWithSelector(
                badges.mintBadge.selector,
                TOKEN_1, NONCE_A, sig
            )
        );
        assertFalse(success, "tampered signature must revert");
    }

    function test_Revert_EmptySignature() public {
        vm.expectRevert();
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Soulbound — transfer attempts
    // ─────────────────────────────────────────────────────────────────────────

    function _mintForAlice() internal {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);
    }

    function test_Revert_SafeTransferFrom() public {
        _mintForAlice();

        vm.expectRevert(PrediXIBadges.TransferNotAllowed.selector);
        vm.prank(alice);
        badges.safeTransferFrom(alice, bob, TOKEN_1, 1, "");
    }

    function test_Revert_SafeBatchTransferFrom() public {
        _mintForAlice();

        uint256[] memory ids    = new uint256[](1);
        uint256[] memory values = new uint256[](1);
        ids[0]    = TOKEN_1;
        values[0] = 1;

        vm.expectRevert(PrediXIBadges.TransferNotAllowed.selector);
        vm.prank(alice);
        badges.safeBatchTransferFrom(alice, bob, ids, values, "");
    }

    function test_Revert_SetApprovalForAll() public {
        vm.expectRevert(PrediXIBadges.TransferNotAllowed.selector);
        vm.prank(alice);
        badges.setApprovalForAll(bob, true);
    }

    function test_Revert_SetApprovalForAll_EvenBeforeMint() public {
        // Approval revert is unconditional — no mint needed first
        vm.expectRevert(PrediXIBadges.TransferNotAllowed.selector);
        vm.prank(alice);
        badges.setApprovalForAll(bob, false);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Signer rotation
    // ─────────────────────────────────────────────────────────────────────────

    function test_SetSigner_OwnerCanRotate() public {
        address newSigner = makeAddr("newSigner");

        vm.prank(owner);
        badges.setSigner(newSigner);

        assertEq(badges.signer(), newSigner, "signer should be updated");
    }

    function test_SetSigner_EmitsSignerUpdated() public {
        address newSigner = makeAddr("newSigner");

        vm.expectEmit(true, true, false, false);
        emit PrediXIBadges.SignerUpdated(signer, newSigner);

        vm.prank(owner);
        badges.setSigner(newSigner);
    }

    function test_SetSigner_NonOwnerReverts() public {
        address newSigner = makeAddr("newSigner");

        vm.expectRevert();   // OwnableUnauthorizedAccount
        vm.prank(alice);
        badges.setSigner(newSigner);
    }

    function test_SetSigner_ZeroAddressReverts() public {
        vm.expectRevert(PrediXIBadges.ZeroAddress.selector);
        vm.prank(owner);
        badges.setSigner(address(0));
    }

    function test_SetSigner_OldKeyRejectedAfterRotation() public {
        address newSignerAddr = makeAddr("newSignerAddr");
        uint256 newSignerPk   = 0xDEAD_BEEF_CAFE_1337;
        newSignerAddr = vm.addr(newSignerPk);

        // Rotate to new key
        vm.prank(owner);
        badges.setSigner(newSignerAddr);

        // Old signer key can no longer authorise mints
        bytes memory oldSig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);

        vm.expectRevert(PrediXIBadges.InvalidSignature.selector);
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, oldSig);
    }

    function test_SetSigner_NewKeyWorks() public {
        uint256 newSignerPk  = 0xDEAD_BEEF_CAFE_1337;
        address newSignerAddr = vm.addr(newSignerPk);

        vm.prank(owner);
        badges.setSigner(newSignerAddr);

        // New signer key produces valid mints
        bytes memory newSig = _buildSign(newSignerPk, alice, TOKEN_1, NONCE_A);

        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, newSig);

        assertEq(badges.balanceOf(alice, TOKEN_1), 1, "new signer mint should succeed");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Balances / state invariants
    // ─────────────────────────────────────────────────────────────────────────

    function test_BalanceOf_ZeroBeforeMint() public view {
        assertEq(badges.balanceOf(alice, TOKEN_1), 0, "balance should be 0 before mint");
    }

    function test_BalanceOf_OneAfterMint() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);

        assertEq(badges.balanceOf(alice, TOKEN_1), 1, "balance should be 1 after mint");
    }

    function test_BalanceOf_NotCrossContaminated() public {
        bytes memory sig = _sign(SIGNER_PK, alice, TOKEN_1, NONCE_A);
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);

        assertEq(badges.balanceOf(bob,   TOKEN_1), 0, "bob balance should remain 0");
        assertEq(badges.balanceOf(alice, TOKEN_19), 0, "alice token 19 balance should be 0");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Fuzz: any valid (wallet, tokenId 1–25, nonce) should mint successfully
     *      and record expected state changes.
     */
    function testFuzz_Mint_ValidParams(
        address wallet,
        uint256 tokenId,
        bytes32 nonce
    ) public {
        vm.assume(wallet  != address(0));
        vm.assume(tokenId >= 1 && tokenId <= 25);
        // Avoid pre-used nonces (none used in this test, but be explicit)

        bytes memory sig = _buildSign(SIGNER_PK, wallet, tokenId, nonce);

        vm.prank(wallet);
        badges.mintBadge(tokenId, nonce, sig);

        assertEq(badges.balanceOf(wallet, tokenId), 1,    "balance should be 1");
        assertTrue(badges.hasMinted(wallet, tokenId),     "hasMinted should be true");
        assertTrue(badges.usedNonces(nonce),              "nonce should be used");
    }

    /**
     * @dev Fuzz: any tokenId < 1 or > 25 always reverts with InvalidTokenId.
     */
    function testFuzz_Revert_InvalidTokenId(uint256 tokenId) public {
        vm.assume(tokenId == 0 || tokenId > 25);

        bytes memory sig = _buildSign(SIGNER_PK, alice, tokenId, NONCE_A);

        vm.expectRevert(
            abi.encodeWithSelector(PrediXIBadges.InvalidTokenId.selector, tokenId)
        );
        vm.prank(alice);
        badges.mintBadge(tokenId, NONCE_A, sig);
    }

    /**
     * @dev Fuzz: any signature not from the authorised signer always reverts.
     */
    function testFuzz_Revert_WrongSigner(uint256 wrongPk) public {
        // Avoid accidentally hitting the correct signer key
        vm.assume(wrongPk != 0);
        vm.assume(wrongPk != SIGNER_PK);
        // secp256k1 order — vm.sign panics on out-of-range keys
        vm.assume(wrongPk < 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141);

        bytes memory sig = _buildSign(wrongPk, alice, TOKEN_1, NONCE_A);

        vm.expectRevert(PrediXIBadges.InvalidSignature.selector);
        vm.prank(alice);
        badges.mintBadge(TOKEN_1, NONCE_A, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Same as _sign() but takes a runtime-variable PK (needed by fuzz
     *      tests where SIGNER_PK may not be usable as a compile-time constant
     *      in the helper).
     */
    function _buildSign(
        uint256 pk,
        address wallet,
        uint256 tokenId,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(MINT_BADGE_TYPEHASH, wallet, tokenId, nonce)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
