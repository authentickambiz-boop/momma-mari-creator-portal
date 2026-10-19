import { readFileSync } from "node:fs";
import { createDb, resolveD1 } from "../src/db/index";
import { importAnalyticsSnapshots } from "../src/lib/analytics-snapshots";

async function main() {
  const file = process.argv[2] || "data/analytics-snapshots.json";
  const body = JSON.parse(readFileSync(file, "utf8"));
  const db = createDb(await resolveD1());
  const result = await importAnalyticsSnapshots(db, body);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(`Saved ${result.saved} snapshots from ${file}.`);
}

main();
