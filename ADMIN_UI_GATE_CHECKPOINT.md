# Admin Settlement UI Gate — Checkpoint

## Status
Admin Settlement UI gate added. Settlement tool is hidden until the admin key is verified.

## What Changed

### Updated Page
- Updated: `src/app/admin/settlement/page.tsx`
- No backend changes

### Gate Behaviour
- On page load: only title, warning banner, and key input are visible
- Settlement form, outcome picker, and safety notes are hidden behind gate
- Gate renders `KeyGate` component; form renders `SettlementForm` component
- Controlled by `verifiedKey` state (`null` = locked, string = unlocked)

### Key Verification
- Verification POSTs to `/api/admin/settle-match` with intentionally empty body `{}`
- Route evaluates auth header before body validation
- `401` response → key rejected → inline error shown ("Invalid admin key.")
- `400` response (validation error) → key accepted by auth → tool unlocked
- No match is settled during verification
- No secret is compared client-side
- Network error → shown as inline error message

### After Unlock
- Green "Admin tool unlocked" status bar shown
- Settlement form, outcome picker, Settle button all visible
- Verified key passed as prop to `SettlementForm` — not re-entered
- "Lock / clear key" button returns to gated state and wipes key from state

### Security
- Admin key stored only in `useState<string | null>`
- Cleared on lock click or page reload
- No `localStorage`, `sessionStorage`, URL params, or `console.log`
- Key not hardcoded anywhere
- Key input uses `type="password"` and `autoComplete="off"`

## Build
- ✅ Passed — 0 errors · 23 routes
- `/admin/settlement` registered as static route
