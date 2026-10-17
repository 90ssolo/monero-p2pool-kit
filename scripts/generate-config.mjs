#!/usr/bin/env node
/**
 * Validates a Monero primary address for P2Pool mining and generates ready-to-run
 * monerod, p2pool, and xmrig launch commands.
 *
 * P2Pool requires a 95-character Mainnet Primary Address starting with "4".
 * Subaddresses ("8...") and 106-character Integrated Addresses cannot be used by P2Pool.
 */

const BASE58_SET = new Set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".split(""));

export function validateP2PoolAddress(address) {
  const s = String(address || "").trim();
  if (!s) {
    return { valid: false, reason: "Address is empty." };
  }
  if (s.startsWith("8")) {
    return {
      valid: false,
      reason: "P2Pool does not support Subaddresses (starting with '8'). Use your Primary Monero address (starting with '4').",
    };
  }
  if (s.length === 106) {
    return {
      valid: false,
      reason: "P2Pool does not support 106-character Integrated Addresses. Use your 95-character Primary address (starting with '4').",
    };
  }
  if (!s.startsWith("4") || s.length !== 95) {
    return {
      valid: false,
      reason: "Expected a 95-character Mainnet Primary Monero address starting with '4'.",
    };
  }
  for (const ch of s) {
    if (!BASE58_SET.has(ch)) {
      return { valid: false, reason: `Invalid Base58 character '${ch}' in address.` };
    }
  }
  return { valid: true, reason: null };
}

export function buildP2PoolStackCommands({ address, chain = "mini", rpcHost = "127.0.0.1", worker = "rig1" }) {
  const check = validateP2PoolAddress(address);
  if (!check.valid) {
    throw new Error(check.reason);
  }
  const chainFlag = chain === "main" ? "" : chain === "nano" ? " --nano" : " --mini";
  const p2pPort = chain === "main" ? 37889 : chain === "nano" ? 37890 : 37888;

  return {
    chain,
    p2pPort,
    monerodCmd: `monerod --prune-blockchain --sync-pruned-blocks --zmq-pub tcp://${rpcHost}:18083 --enable-dns-blocklist --no-igd`,
    p2poolCmd: `p2pool --host ${rpcHost} --rpc-port 18081 --zmq-port 18083 --wallet ${address.trim()} --stratum 0.0.0.0:3333${chainFlag}`,
    xmrigCmd: `xmrig -o ${rpcHost}:3333 -u ${worker} -k --randomx-1gb-pages`,
    envFile: `MONERO_PRIMARY_ADDRESS=${address.trim()}\nP2POOL_CHAIN_FLAG=${chainFlag.trim()}\nSTRATUM_BIND_IP=127.0.0.1\n`,
  };
}

if (process.argv[1] && process.argv[1].endsWith("generate-config.mjs")) {
  const args = process.argv.slice(2);
  const getArg = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };

  const address = getArg(
    "--address",
    "48VWHdLTEpE5dqa5VpAy5xgQWBHZARiGmEmojNLqD4ef1FAzkPxCe9JXUYwCShRR5XNMGnyusrnkmMWr2HMdfDRx2vsrG7c"
  );
  const chain = getArg("--chain", "mini");
  const worker = getArg("--worker", "rig1");

  try {
    const out = buildP2PoolStackCommands({ address, chain, worker });
    console.log("=== 1. Start monerod with ZMQ enabled ===");
    console.log(out.monerodCmd);
    console.log(`\n=== 2. Start P2Pool (${out.chain} sidechain, P2P port ${out.p2pPort}) ===`);
    console.log(out.p2poolCmd);
    console.log("\n=== 3. Start XMRig against local P2Pool Stratum ===");
    console.log(out.xmrigCmd);
    console.log("\n=== 4. Docker Compose .env file ===");
    console.log(out.envFile);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
