import { spawnSync } from "node:child_process";

// =================== Network plumbing shared by the data scripts ===================

// Node's fetch (undici) ignores HTTP_PROXY/HTTPS_PROXY unless it is told to read
// them, so on a proxied machine every request dies with UND_ERR_CONNECT_TIMEOUT
// while npm works fine. The durable fix is `NODE_OPTIONS=--use-env-proxy` in the
// environment; this is the fallback for machines that don't have it, so a fresh
// clone works without anyone having to know about the flag.
export function ensureProxyAware() {
  const proxied = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (!proxied) return;
  const alreadyOn =
    process.env.NODE_USE_ENV_PROXY ||
    (process.env.NODE_OPTIONS ?? "").includes("--use-env-proxy") ||
    process.execArgv.includes("--use-env-proxy");
  if (alreadyOn) return;

  const result = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
  });
  process.exit(result.status ?? 1);
}

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ------------------- Retry with backoff -------------------
// Overpass answers 429/504 under load far more often than it fails outright,
// so treat those as "wait and try again", not as errors.
export async function withRetry(label, attempt, { tries = 4, baseDelay = 4000 } = {}) {
  let lastError;
  for (let i = 0; i < tries; i += 1) {
    try {
      // The attempt index lets callers escalate: cheap and fast first, more
      // patient once it's clear the tile is genuinely heavy rather than unlucky.
      return await attempt(i);
    } catch (error) {
      lastError = error;
      const wait = baseDelay * 2 ** i;
      if (i < tries - 1) {
        console.warn(`  ${label}: ${error.message} — retrying in ${Math.round(wait / 1000)}s`);
        await delay(wait);
      }
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${lastError?.message}`);
}
