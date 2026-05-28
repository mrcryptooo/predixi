# PrediXI — Base App Submission Checklist

Complete this checklist before submitting PrediXI for official Base App / Mini App review.

---

## 1. Required Assets

| Asset | Spec | Status |
|---|---|---|
| App icon (PNG) | 512×512 px, square, no alpha required | ⚠️ Existing logo at `/public/brand/predixi-logo.png` — verify 512px |
| App icon (PNG) | 192×192 px fallback | ⚠️ Resize from 512px source |
| Apple touch icon | 180×180 px PNG, `/public/apple-touch-icon.png` | ❌ Needs creating |
| Favicon | 32×32 ICO or PNG, `/public/favicon.ico` | ❌ Needs creating |
| OG / share image | 1200×630 px PNG, `/public/brand/og-image.png` | ❌ Needs creating |
| Screenshots (mobile) | Min 2, 390×844 px (iPhone 14 Pro), PNG | ❌ Needs capturing |
| Screenshots (optional desktop) | 1280×800 px | ❌ Optional |

### Screenshot content recommendations
1. Home page with active match cards
2. Prediction modal with wallet connect prompt
3. Profile page showing XP, streak, and activity feed
4. Leaderboard with podium and rankings
5. World Cup predictions page

---

## 2. App Description

### Short description (max 80 chars)
```
Predict football matches. Earn XP. Compete on-chain. Built for Base.
```

### Long description (max 4000 chars)
Use `BASE_LAUNCH_CONFIG.longDescription` from `src/config/base-launch.ts` as the base — expand with feature highlights before submission.

**Suggested additions:**
- Supported leagues (Premier League, La Liga, Champions League, World Cup 2026)
- How XP and the leaderboard work
- Wallet signature and commitment hash proof system
- Base Account / Coinbase Smart Wallet native support

---

## 3. Privacy Policy Requirements

- [ ] Privacy policy page must exist at a live URL before submission
- [ ] Must cover: data collected (wallet address, predictions), no PII beyond wallet, no data selling
- [ ] Placeholder URL: `https://predixi-base.vercel.app/privacy`
- [ ] Create `/app/privacy/page.tsx` with a real policy before submission
- [ ] Link must resolve — no redirect loops, no 404

---

## 4. Support URL Requirements

- [ ] Support URL must be live and reachable
- [ ] Placeholder: `https://predixi-base.vercel.app/support`
- [ ] Minimum acceptable: a support page with contact email
- [ ] Create `/app/support/page.tsx` before submission

---

## 5. Domain Requirements

- [ ] App must be served from a stable, owned domain (not a preview URL)
- [ ] `predixi-base.vercel.app` is acceptable for beta; custom domain recommended for full launch
- [ ] HTTPS required (Vercel provides this automatically)
- [ ] No mixed content warnings
- [ ] Domain must match the `start_url` in `site.webmanifest`

---

## 6. Wallet / Connect Requirements

- [ ] Coinbase Smart Wallet supported ✅ (ERC-6492 via wagmi + OnchainKit)
- [ ] Base Account supported ✅ (same path)
- [ ] Standard EOA wallets supported ✅ (MetaMask, Rainbow, etc.)
- [ ] Wallet connect prompt appears only when needed (not on page load) ✅
- [ ] No wallet required to browse matches ✅
- [ ] Wallet required only to submit predictions ✅
- [ ] Wallet signature flow tested end-to-end on Base mainnet ✅

---

## 7. Mobile QA Checklist

Test on physical device (or Base App in-app browser) before submission:

### Layout
- [ ] No horizontal overflow at 375px viewport width
- [ ] Bottom nav visible and not obscured by iOS home bar
- [ ] Safe area insets applied (`viewport-fit=cover` + `h-safe-bottom`) ✅
- [ ] Text readable at default system font size

### Interaction
- [ ] No 300ms tap delay on nav and buttons (`touch-action: manipulation`) ✅
- [ ] No tap highlight flash (`-webkit-tap-highlight-color: transparent`) ✅
- [ ] Prediction modal scrollable without body scroll leaking (`overscroll-contain`) ✅
- [ ] Modal close button tappable (44px hit area) ✅
- [ ] Long-press on nav items does not select text (`select-none`) ✅

### Wallet flow
- [ ] Wallet reconnects when returning to app from background ✅
- [ ] Wallet reconnects after visibility change in embedded webview ✅
- [ ] Signature prompt appears correctly in Base App / Coinbase Wallet UI
- [ ] Prediction submission succeeds end-to-end in Base App browser

### Performance
- [ ] First paint < 3 seconds on 4G
- [ ] No jank on match list scroll
- [ ] Prediction modal animation smooth (60fps) on mid-range device
- [ ] Reduced-motion respected (iOS Accessibility → Reduce Motion) ✅

### Accessibility
- [ ] All interactive elements have sufficient tap targets (≥44px)
- [ ] Sufficient color contrast on text (WCAG AA)
- [ ] Images have alt text or `aria-hidden="true"` for decorative images

---

## 8. Production Checklist (Pre-Submission)

- [ ] All env vars set in Vercel Production environment
- [ ] Cron job running (`/api/cron/sync-fixtures` every 3 hours)
- [ ] At least one fixture sync completed successfully
- [ ] `/api/admin/health` returns all systems green
- [ ] Prediction end-to-end flow tested with real wallet on mainnet
- [ ] Leaderboard shows real data
- [ ] No `console.error` spam in production logs
- [ ] No exposed API keys or secrets in client bundle
- [ ] `ADMIN_API_KEY` not referenced in any client component
- [ ] Privacy policy page live
- [ ] Support page live

---

## 9. Review Risks

| Risk | Mitigation |
|---|---|
| Classified as gambling app | Add clear "no real-money wagering, XP only" copy on landing page and in store description |
| Wallet requirement blocks reviewers | Ensure wallet-free browsing works; only lock predictions behind wallet |
| Performance issues on reviewer device | Profile on mid-range Android; optimise if needed |
| Missing privacy policy | Create before submission — hard block |
| Missing support URL | Create before submission — hard block |
| 404 on OG image | Create `/public/brand/og-image.png` before submission |
| Icon too small | Verify source PNG is ≥512×512 before submission |

---

## 10. Launch Recommendations

1. **Create missing assets first** — favicon, apple-touch-icon, OG image (these block submission)
2. **Create `/privacy` and `/support` pages** — hard requirements
3. **Test full wallet flow in Base App browser** on physical iOS device before submitting
4. **Write landing page copy** that clearly explains: no real money, XP only, sports predictions
5. **Register custom domain** (`predixi.app`) for professional appearance during review
6. **Soft-launch on Farcaster/Warpcast** before official Base App submission to gather feedback
7. **Submit to Base App developer preview first** (if available) before full store submission
