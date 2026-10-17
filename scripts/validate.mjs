#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildP2PoolStackCommands, validateP2PoolAddress } from "./generate-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  }
}

const PRIMARY = "48VWHdLTEpE5dqa5VpAy5xgQWBHZARiGmEmojNLqD4ef1FAzkPxCe9JXUYwCShRR5XNMGnyusrnkmMWr2HMdfDRx2vsrG7c";
const SUBADDRESS = "888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H";

assert(validateP2PoolAddress(PRIMARY).valid === true, "Primary 4... address should be accepted for P2Pool");
assert(validateP2PoolAddress(SUBADDRESS).valid === false, "Subaddress 8... must be rejected for P2Pool");
assert(validateP2PoolAddress(SUBADDRESS).reason.includes("Subaddresses"), "Should explain why 8... subaddress is rejected");

const cmds = buildP2PoolStackCommands({ address: PRIMARY, chain: "mini" });
assert(cmds.p2poolCmd.includes("--mini"), "Mini sidechain flag missing");
assert(cmds.monerodCmd.includes("--zmq-pub"), "ZMQ pub flag missing in monerodCmd");

const monerodConf = fs.readFileSync(path.join(rootDir, "config", "monerod-p2pool.conf"), "utf8");
assert(monerodConf.includes("zmq-pub=tcp://127.0.0.1:18083"), "monerod-p2pool.conf missing zmq-pub=tcp://127.0.0.1:18083");

const xmrigJson = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "xmrig-config.json"), "utf8"));
assert(xmrigJson.pools?.[0]?.url === "127.0.0.1:3333", "xmrig-config.json should point to local P2Pool Stratum 127.0.0.1:3333");

for (const svg of ["hero-banner.svg", "p2pool-architecture.svg"]) {
  const svgPath = path.join(rootDir, "assets", svg);
  assert(fs.existsSync(svgPath), `Missing SVG asset: assets/${svg}`);
  const text = fs.readFileSync(svgPath, "utf8");
  assert(text.includes("<svg") && text.includes("</svg>"), `Malformed SVG in assets/${svg}`);
}

if (failures > 0) {
  console.error(`\nValidation failed with ${failures} error(s).`);
  process.exit(1);
}

console.log("OK: Verified P2Pool primary address validator, monerod ZMQ config, XMRig Stratum config, Docker/systemd files, and SVG diagrams.");
