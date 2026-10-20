import { createDb, type PortalDb } from "../src/db/index";
import { openDatabase } from "../src/db/local-d1";
import type { Viewer } from "../src/lib/types";

// Each pull request keeps its new tests in its own file so appending to
// tests/portal.test.ts does not make the open PRs conflict with each other.
process.env.SESSION_SECRET = "test-secret-please-change";
process.env.BOT_API_TOKEN = "test-bot-token-please-change";
process.env.ADMIN_EMAILS = "Kamron@mommamari.com";
process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);

export const mariclare: Viewer = {
  email: "mmaclamroc@gmail.com",
  role: "creator",
  creatorId: "mariclare",
  name: "MariClare",
};
export const abby: Viewer = {
  email: "theofficialtheriots@gmail.com",
  role: "creator",
  creatorId: "abby",
  name: "Abby Theriot",
};
export const admin: Viewer = {
  email: "kamron@mommamari.com",
  role: "admin",
  creatorId: null,
  name: "Kamron",
};

export function openTestDb(): PortalDb {
  return createDb(openDatabase(":memory:"));
}
