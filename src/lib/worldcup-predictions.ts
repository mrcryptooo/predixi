// ─────────────────────────────────────────────────────────────────────────────
// World Cup Predictions — localStorage helpers + Supabase remote helpers
// localStorage is always written first (fast, offline-safe).
// Remote helpers are fire-and-forget; failures never block the UI.
// ─────────────────────────────────────────────────────────────────────────────

export type WCPrediction = {
  predictionId:     string;
  selection:        string[];   // one or two team/player names
  savedAt:          string;     // ISO timestamp
  commitmentHash?:  string | null;
  submittedOnchain?: boolean;
  txHash?:          string | null;
};

export type WCPredictionsStore = Record<string, WCPrediction>;

const STORE_KEY = "predixi-wc-predictions";

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers (synchronous, unchanged API)
// ─────────────────────────────────────────────────────────────────────────────

export function loadAllWCPredictions(): WCPredictionsStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as WCPredictionsStore) : {};
  } catch { return {}; }
}

export function saveWCPrediction(pred: WCPrediction): void {
  if (typeof window === "undefined") return;
  try {
    const store = loadAllWCPredictions();
    store[pred.predictionId] = pred;
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export function clearWCPrediction(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const store = loadAllWCPredictions();
    delete store[id];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export function clearAllWCPredictions(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(STORE_KEY); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Remote helpers (async, Supabase-backed via /api/wc-predictions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all WC predictions for a wallet from Supabase.
 * Returns a WCPredictionsStore so it can be merged with localStorage.
 * Returns {} on any error — caller falls back to localStorage.
 */
export async function fetchWCPredictions(walletAddress: string): Promise<WCPredictionsStore> {
  try {
    const res = await fetch(
      `/api/wc-predictions?wallet=${encodeURIComponent(walletAddress)}`,
    );
    if (!res.ok) return {};
    const data = await res.json() as {
      success:     boolean;
      predictions?: Array<{
        predictionKey:    string;
        selectedValue:    string[];
        commitmentHash?:  string | null;
        submittedOnchain?: boolean;
        txHash?:          string | null;
      }>;
    };
    if (!data.success || !data.predictions) return {};
    const store: WCPredictionsStore = {};
    for (const p of data.predictions) {
      store[p.predictionKey] = {
        predictionId:     p.predictionKey,
        selection:        p.selectedValue,
        savedAt:          new Date().toISOString(),
        commitmentHash:   p.commitmentHash   ?? null,
        submittedOnchain: p.submittedOnchain ?? false,
        txHash:           p.txHash           ?? null,
      };
    }
    return store;
  } catch {
    return {};
  }
}

/**
 * Persist a single WC prediction to Supabase.
 * Fire-and-forget — never throws.  localStorage is always saved first.
 *
 * walletMessage + walletSignature are required by the backend (Phase 2).
 * Pass the EIP-191 signed message and its hex signature from the wallet.
 */
export async function saveWCPredictionRemote(params: {
  walletAddress:   string;
  predictionKey:   string;
  predictionType:  string;
  selectedValue:   string[];
  xpReward:        number;
  deadline?:       string | null;
  walletMessage?:  string;
  walletSignature?: string;
}): Promise<void> {
  try {
    const { walletMessage, walletSignature, ...body } = params;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (walletMessage)   headers["x-wallet-message"]   = walletMessage;
    if (walletSignature) headers["x-wallet-signature"] = walletSignature;
    await fetch("/api/wc-predictions", {
      method:  "POST",
      headers,
      body:    JSON.stringify(body),
    });
  } catch (e) {
    console.warn("[WC] remote save failed:", e);
  }
}
