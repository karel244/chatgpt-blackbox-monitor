import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const npm = process.env.npm_execpath;
if (!npm)
  throw new Error("Run npm run verify so npm provides its portable CLI path");
const directory = `${process.env.BLACKBOX_RESULTS_DIR ?? "test-results/verification"}/${Date.now()}`;
await mkdir(directory, { recursive: true });
const rows = [];
for (const name of [
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "test:integration",
  "build",
  "build:synthetic",
]) {
  const start = performance.now();
  const actual = spawnSync(process.execPath, [npm, "run", name], {
    encoding: "utf8",
  });
  const row = {
    name,
    exit_code: actual.status,
    duration_ms: performance.now() - start,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
  await writeFile(
    `${directory}/${name.replaceAll(":", "-")}.log`,
    `${actual.stdout ?? ""}${actual.stderr ?? ""}`,
  );
  if (actual.status !== 0) break;
}
await writeFile(`${directory}/checks.json`, JSON.stringify(rows, null, 2));
process.exitCode =
  rows.length === 7 && rows.every((row) => row.exit_code === 0) ? 0 : 1;
