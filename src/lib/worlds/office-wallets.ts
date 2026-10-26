import { containsPrivateOfficeDetail } from "./office-catalog";
import { worldsTextRejection } from "./safety";

/** Wallet kinds the vault knows. A label for the balance, not a linked account. */
export const WALLET_TYPES = ["cash", "bank", "gold", "other"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const WALLETS_PATH = "/api/worlds/wallets";

export type OfficeWallet = {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  currency: string;
  updatedAt: string;
};

export type WalletList = {
  wallets: OfficeWallet[];
  total: number;
  currency: "USD";
};

export type WalletWrite = {
  id: string | null;
  name: string;
  type: WalletType;
  balanceCents: number;
  currency: string;
};

type Parsed = { ok: true; value: WalletWrite } | { ok: false; status: number; error: string };

const ALLOWED_KEYS = new Set(["id", "name", "type", "balance", "currency"]);

function fail(status: number, error: string): Parsed {
  return { ok: false, status, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWalletType(value: string): value is WalletType {
  return (WALLET_TYPES as readonly string[]).includes(value);
}

/** USD balances add into the number on the vault door. Other currencies stay on their own row. */
export function walletTotal(wallets: Pick<OfficeWallet, "balance" | "currency">[]) {
  const cents = wallets.reduce((sum, wallet) => {
    if (wallet.currency.toUpperCase() !== "USD" || !Number.isFinite(wallet.balance)) return sum;
    return sum + Math.round(wallet.balance * 100);
  }, 0);
  return cents / 100;
}

export function formatWalletMoney(amount: number, currency = "USD") {
  const safe = Number.isFinite(amount) ? amount : 0;
  const whole = Math.abs(safe - Math.round(safe)) < 0.001;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(safe);
  } catch {
    return `${whole ? safe.toFixed(0) : safe.toFixed(2)} ${currency}`;
  }
}

function pileCount(amount: number) {
  if (amount <= 0) return 0;
  if (amount < 250) return 1;
  if (amount < 2500) return 2;
  if (amount < 25000) return 3;
  if (amount < 250000) return 4;
  return 5;
}

function pileHeight(amount: number) {
  if (amount <= 0) return 0;
  return Math.min(1.4, 0.18 + Math.log10(amount + 1) * 0.24);
}

/** Cash stacks and gold bars both grow as the USD total grows. Zero leaves the vault empty. */
export function vaultPilePlan(total: number) {
  const amount = Number.isFinite(total) ? Math.max(0, total) : 0;
  const height = pileHeight(amount);
  return {
    count: pileCount(amount),
    cashHeight: height,
    goldHeight: height,
  };
}

export function emptyWalletList(): WalletList {
  return { wallets: [], total: 0, currency: "USD" };
}

export function walletListFrom(wallets: OfficeWallet[]): WalletList {
  return { wallets, total: walletTotal(wallets), currency: "USD" };
}

/** One wallet per POST. The same name updates that balance. Extra fields are refused. */
export function parseWalletWrite(body: unknown): Parsed {
  if (!isRecord(body)) return fail(400, "Expected JSON.");
  const extra = Object.keys(body).find((key) => !ALLOWED_KEYS.has(key));
  if (extra) return fail(400, "Wallets store a name, type, balance, and currency. Nothing else.");
  const id = body.id === undefined || body.id === null ? null : body.id;
  if (id !== null && (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(id))) {
    return fail(400, "id is not a wallet id.");
  }
  if (typeof body.name !== "string" || !body.name.trim()) return fail(400, "name is required.");
  const name = body.name.trim().replace(/\s+/g, " ");
  if (name.length > 60) return fail(400, "name is too long.");
  if (containsPrivateOfficeDetail(name) || /\d{8,}/.test(name)) {
    return fail(400, "A wallet name is a label. Leave account and card numbers out.");
  }
  const blocked = worldsTextRejection(name);
  if (blocked) return fail(400, blocked);
  if (typeof body.type !== "string" || !isWalletType(body.type)) {
    return fail(400, "type must be cash, bank, gold, or other.");
  }
  if (typeof body.balance !== "number" || !Number.isFinite(body.balance)) return fail(400, "balance must be a number.");
  if (Math.abs(body.balance) > 1e12) return fail(400, "balance is out of range.");
  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "USD";
  if (!/^[A-Z]{3}$/.test(currency)) return fail(400, "currency is a 3-letter code.");
  return {
    ok: true,
    value: { id, name, type: body.type, balanceCents: Math.round(body.balance * 100), currency },
  };
}
