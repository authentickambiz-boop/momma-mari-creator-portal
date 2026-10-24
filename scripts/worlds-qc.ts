/**
 * Print the Worlds City task QC table and refresh the per-building reports.
 * Does not post, send mail, or turn live flags on.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  QC_MARKER_END,
  QC_MARKER_START,
  formatQcTable,
  renderBuildingJson,
  renderBuildingMarkdown,
  renderQcSummary,
  runWorldsQc,
  spliceQcSummary,
} from "../src/lib/worlds/city/qc";

const report = runWorldsQc();
const dir = join("src", "lib", "worlds", "city", "qc-reports");
mkdirSync(dir, { recursive: true });
for (const building of report.buildings) {
  writeFileSync(join(dir, `${building.locationId}.json`), renderBuildingJson(building));
  writeFileSync(join(dir, `${building.locationId}.md`), renderBuildingMarkdown(building));
}
writeFileSync(join(dir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);

const summary = renderQcSummary(report);
for (const path of ["README.md", "src/lib/worlds/city/README.md"]) {
  const current = readFileSync(path, "utf8");
  if (!current.includes(QC_MARKER_START) || !current.includes(QC_MARKER_END)) {
    console.error(`No worlds-qc markers in ${path}`);
    process.exit(1);
  }
  const next = spliceQcSummary(current, summary);
  if (next !== current) writeFileSync(path, next);
}

console.log(formatQcTable(report));
process.exit(report.pass ? 0 : 1);
