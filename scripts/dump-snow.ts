// Local runner: hits the real official sites through the same adapters the
// serverless endpoint uses, and prints the SnowReport JSON for all 5 resorts.
// Usage: npx tsx scripts/dump-snow.ts
import { getSnowReport, RESORT_IDS } from "../api/snow-report";

const ids = RESORT_IDS;
for (const id of ids) {
  const t0 = Date.now();
  const report = await getSnowReport(id);
  const ms = Date.now() - t0;
  console.log(`\n=== ${id}  (${ms} ms) ===`);
  console.log(JSON.stringify(report, null, 2));
}
