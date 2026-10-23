import { asc, desc, eq } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { officeWallets } from "@/db/schema";
import { nowIso } from "@/lib/format";
import {
  parseWalletWrite,
  walletListFrom,
  type OfficeWallet,
  type WalletList,
  type WalletType,
} from "./office-wallets";

function rowToWallet(row: typeof officeWallets.$inferSelect): OfficeWallet {
  return {
    id: row.id,
    name: row.name,
    type: row.type as WalletType,
    balance: row.balanceCents / 100,
    currency: row.currency,
    updatedAt: row.updatedAt,
  };
}

export async function listOfficeWallets(db: PortalDb): Promise<WalletList> {
  const rows = await db.select().from(officeWallets).orderBy(desc(officeWallets.updatedAt), asc(officeWallets.name));
  return walletListFrom(rows.map(rowToWallet));
}

/** Insert a balance, or update the row with this id or the same name. */
export async function saveOfficeWallet(db: PortalDb, body: unknown) {
  const parsed = parseWalletWrite(body);
  if (!parsed.ok) return parsed;
  const write = parsed.value;
  const rows = await db.select().from(officeWallets);
  const byId = write.id ? rows.find((row) => row.id === write.id) : undefined;
  if (write.id && !byId) return { ok: false as const, status: 404, error: "Wallet not found." };
  const byName = rows.find((row) => row.name.trim().toLowerCase() === write.name.toLowerCase());
  if (byId && byName && byName.id !== byId.id) {
    return { ok: false as const, status: 409, error: "A wallet with that name is already in the vault." };
  }
  const existing = byId ?? byName ?? null;
  const updatedAt = nowIso();
  const id = existing?.id ?? `wallet_${crypto.randomUUID()}`;
  if (existing) {
    await db.update(officeWallets).set({
      name: write.name,
      type: write.type,
      balanceCents: write.balanceCents,
      currency: write.currency,
      updatedAt,
    }).where(eq(officeWallets.id, id));
  } else {
    await db.insert(officeWallets).values({
      id,
      name: write.name,
      type: write.type,
      balanceCents: write.balanceCents,
      currency: write.currency,
      updatedAt,
    });
  }
  const list = await listOfficeWallets(db);
  const wallet = list.wallets.find((item) => item.id === id);
  if (!wallet) return { ok: false as const, status: 500, error: "The wallet did not save." };
  return { ok: true as const, status: existing ? 200 : 201, body: { wallet, ...list } };
}
