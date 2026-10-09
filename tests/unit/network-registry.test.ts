import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { registeredLevel } from "../../src/history/safety.ts";
import { SAFE_HEADERS } from "../../src/core/network.ts";
test("NetworkMonitor literal emitter fields and safe header projections have explicit registry policy", async () => {
  const source = await readFile("src/adapters/network-monitor.ts", "utf8");
  const ast = ts.createSourceFile(
    "network-monitor.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const pairs = new Map<
    string,
    { namespace: string; field: string; policy: string }
  >();
  const add = (namespace: string, field: string) => {
    const registered = registeredLevel({
      field_namespace: namespace,
      field,
      source_path: "/network/fixture",
      direction: "inbound",
      transport: "fetch",
      endpoint_verified: true,
    });
    const intentionallyRedacted =
      (namespace === "network.headers" &&
        ["retry-after", "server-timing"].includes(field)) ||
      (namespace === "network.observer" && field === "body_limit") ||
      (namespace === "pow" && field === "requirements_endpoint") ||
      (namespace === "pow.observer" && field === "body_limit");
    assert.ok(registered || intentionallyRedacted, `${namespace}/${field}`);
    pairs.set(namespace + "/" + field, {
      namespace,
      field,
      policy: registered
        ? "registered"
        : "intentionally_redacted_with_partial_gap_control",
    });
  };
  const dynamic: string[] = [];
  function walk(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "append" &&
      node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      const ns = node.arguments[1],
        field = node.arguments[2];
      if (ns && field && ts.isStringLiteral(ns) && ts.isStringLiteral(field))
        add(ns.text, field.text);
      else
        dynamic.push(
          node.arguments
            .slice(1, 3)
            .map((a) => a.getText(ast))
            .join(" / "),
        );
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  for (const name of SAFE_HEADERS) add("network.headers", name);
  for (const field of ["metric_name", "dur"])
    add("network.server-timing.0", field);
  for (const field of [
    "raw_hex",
    "decimal",
    "source_path",
    "request_id",
    "association_status",
    "validity",
  ])
    add("pow", field);
  for (const field of [
    "segment_id",
    "event",
    "code",
    "wasClean",
    "reconnect",
    "association_status",
    "proof",
  ])
    add("network.websocket.segment-1", field);
  add("pow.association", "target.capture-1");
  assert.equal(
    pairs.get("network.headers/server-timing")!.policy,
    "intentionally_redacted_with_partial_gap_control",
  );
  assert.equal(
    pairs.get("network.headers/server-timing.availability")!.policy,
    "registered",
  );
  assert.equal(
    pairs.get("network.headers/retry-after.seconds")!.policy,
    "registered",
  );
  await mkdir("test-results/unit", { recursive: true });
  await writeFile(
    "test-results/unit/network-registry-matrix.json",
    JSON.stringify(
      {
        scope:
          "actual AST literal emitters plus expanded dynamic namespaces/header/PoW/WS policies; no raw values",
        fields: [...pairs.values()],
        dynamic_emitters: dynamic,
        raw_server_timing_desc: "never exported; not allowlisted",
      },
      null,
      2,
    ),
  );
});
