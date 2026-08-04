import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STARTUPS } from "../src/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "public", "logos");

const SIMPLE_ICON_CANDIDATES = new Map([
  ["Character.ai", ["characterai"]],
  ["Cohere", ["cohere"]],
  ["Datadog", ["datadog"]],
  ["Eleven Labs", ["elevenlabs"]],
  ["Etsy", ["etsy"]],
  ["Hugging Face", ["huggingface"]],
  ["Modal", ["modal"]],
  ["Pinecone", ["pinecone"]],
  ["Replit", ["replit"]],
  ["Robinhood", ["robinhood"]],
  ["Runway", ["runway"]],
  ["Snowflake", ["snowflake"]],
  ["Spotify", ["spotify"]],
  ["Together AI", ["together"]],
  ["Wiz", ["wiz"]],
]);

const WEBSITE_OVERRIDES = new Map([
  ["Abnormal Security", "https://abnormalsecurity.com/"],
  ["Adonis", "https://www.adonis.io/"],
  ["Arena AI", "https://arena-ai.com/"],
  ["Nomic", "https://www.nomic.ai/"],
  ["Stainless API", "https://www.stainless.com/"],
]);

const DIRECT_LOGO_ASSETS = new Map([
  ["Diplo AI", "https://www.google.com/s2/favicons?domain=diplo.ai&sz=128"],
  ["Fractal Tech", "https://github.com/fractal-tech.png?size=128"],
  ["Princeton", "https://www.google.com/s2/favicons?domain=princeton.edu&sz=128"],
  ["Ramp", "https://ramp.com/favicon.ico"],
  ["Runhouse", "https://github.com/run-house.png?size=128"],
  ["Seek AI", "https://www.google.com/s2/favicons?domain=seek.ai&sz=128"],
  ["VAST Data", "https://www.vastdata.com/favicon.svg"],
]);

const palette = [
  ["#0b1024", "#2e6cff"],
  ["#10251e", "#32bd7b"],
  ["#241026", "#c06cff"],
  ["#271714", "#ff8a4c"],
  ["#10242a", "#33d6c7"],
  ["#281c08", "#ffcc4d"],
  ["#241415", "#e54c42"],
];

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function initials(name) {
  const cleaned = name
    .replace(/\.ai$/i, " AI")
    .replace(/\.app$/i, "")
    .replace(/ api$/i, "")
    .replace(/[^a-z0-9 ]+/gi, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function fallbackLogo(startup) {
  const [bg, accent] = palette[hash(startup.name) % palette.length];
  const letters = escapeXml(initials(startup.name));
  const name = escapeXml(startup.name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" role="img" aria-label="${name}">
  <rect width="72" height="72" rx="16" fill="${bg}"/>
  <path d="M18 54h36" stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity=".92"/>
  <circle cx="53" cy="19" r="6" fill="${accent}" opacity=".9"/>
  <text x="36" y="42" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="800" fill="#fff" letter-spacing="-1">${letters}</text>
</svg>
`;
}

function isSvgDocument(text) {
  return /^(?:\s*<\?xml[^>]*>\s*)?(?:\s*<!--[\s\S]*?-->\s*)*<svg\b/i.test(text);
}

async function fetchSimpleIcon(slug) {
  const response = await fetch(`https://cdn.simpleicons.org/${slug}`, {
    headers: {
      "user-agent": "nyc-ai-atlas-logo-fetch/1.0",
    },
  });
  if (!response.ok) return null;
  const svg = await response.text();
  if (!isSvgDocument(svg)) return null;
  return svg;
}

function websiteFor(startup) {
  return WEBSITE_OVERRIDES.get(startup.name) || startup.website || null;
}

function websiteOrigin(website) {
  if (!website) return null;
  try {
    return new URL(website).origin;
  } catch {
    return null;
  }
}

function websiteHostname(website) {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function absolutizeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function isGenericPlatformIcon(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "github.com" && /fluidicon/i.test(parsed.pathname)) ||
      parsed.hostname.endsWith("githubassets.com") ||
      /octocat|fluidicon|github-mark|apple-touch-icon/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function mimeFromUrl(url) {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function realImageSvg(startup, bytes, mimeType) {
  const name = escapeXml(startup.name);
  const base64 = Buffer.from(bytes).toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" role="img" aria-label="${name}">
  <rect width="72" height="72" rx="16" fill="#fff"/>
  <image href="data:${mimeType};base64,${base64}" x="8" y="8" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
}

async function fetchLogoAsset(url, startup) {
  if (isGenericPlatformIcon(url)) return null;
  const response = await fetch(url, {
    headers: {
      "user-agent": "nyc-ai-atlas-logo-fetch/1.0",
      accept: "image/svg+xml,image/png,image/webp,image/jpeg,image/x-icon,text/html;q=0.5,*/*;q=0.4",
    },
    redirect: "follow",
  });
  if (!response.ok) return null;
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 500_000) return null;
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || mimeFromUrl(response.url || url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const textHead = bytes.subarray(0, 160).toString("utf8");
  if (contentType.includes("svg") || isSvgDocument(textHead)) {
    const svg = bytes.toString("utf8");
    if (!isSvgDocument(svg)) return null;
    return { svg, source: response.url || url, kind: "svg" };
  }
  if (contentType.startsWith("image/")) {
    return {
      svg: realImageSvg(startup, bytes, contentType),
      source: response.url || url,
      kind: contentType,
    };
  }
  return null;
}

async function fetchSvgUrl(url) {
  const asset = await fetchLogoAsset(url, { name: "Logo" });
  return asset?.kind === "svg" ? asset.svg : null;
}

async function discoverSiteLogo(startup) {
  const website = websiteFor(startup);
  const origin = websiteOrigin(website);
  if (!origin) return null;

  const candidates = [
    `${origin}/favicon.svg`,
    `${origin}/icon.svg`,
    `${origin}/logo.svg`,
    `${origin}/favicon-32x32.png`,
    `${origin}/favicon-96x96.png`,
    `${origin}/apple-touch-icon.png`,
    `${origin}/favicon.ico`,
    `${origin}/assets/logo.svg`,
    `${origin}/images/logo.svg`,
    `${origin}/static/logo.svg`,
  ];

  for (const url of candidates) {
    try {
      const asset = await fetchLogoAsset(url, startup);
      if (asset) return asset;
    } catch {
      // Continue trying discoverable logo URLs.
    }
  }

  try {
    const homeResponse = await fetch(website, {
      headers: {
        "user-agent": "nyc-ai-atlas-logo-fetch/1.0",
        accept: "text/html,*/*;q=0.5",
      },
      redirect: "follow",
    });
    if (!homeResponse.ok) return null;
    const html = await homeResponse.text();
    const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
    const iconMatches = linkTags
      .filter((tag) => /\brel=["'][^"']*(?:icon|apple-touch-icon|mask-icon)[^"']*["']/i.test(tag))
      .map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
      .filter(Boolean)
      .map((href) => absolutizeUrl(href, homeResponse.url))
      .filter(Boolean)
      .sort((a, b) => Number(b.includes(".svg")) - Number(a.includes(".svg")))
      .slice(0, 8);

    const manifestHref = linkTags
      .find((tag) => /\brel=["'][^"']*manifest[^"']*["']/i.test(tag))
      ?.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const manifestUrl = manifestHref ? absolutizeUrl(manifestHref, homeResponse.url) : null;
    const manifestMatches = [];
    if (manifestUrl) {
      try {
        const manifestResponse = await fetch(manifestUrl, {
          headers: {
            "user-agent": "nyc-ai-atlas-logo-fetch/1.0",
            accept: "application/json,*/*;q=0.5",
          },
        });
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
          manifestMatches.push(
            ...icons
              .map((icon) => icon?.src)
              .filter(Boolean)
              .map((src) => absolutizeUrl(src, manifestResponse.url || manifestUrl))
              .filter(Boolean),
          );
        }
      } catch {
        // Manifests are optional; keep going with link icons.
      }
    }

    for (const url of [...iconMatches, ...manifestMatches]) {
      try {
        const asset = await fetchLogoAsset(url, startup);
        if (asset) return asset;
      } catch {
        // Keep the fallback if this individual reference fails.
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function discoverLogoService(startup) {
  const hostname = websiteHostname(websiteFor(startup));
  if (!hostname) return null;
  const url = `https://logo.clearbit.com/${hostname}?size=128`;
  try {
    return await fetchLogoAsset(url, startup);
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  for (const startup of STARTUPS) {
    await writeFile(path.join(outputDir, `${startup.id}.svg`), fallbackLogo(startup), "utf8");
  }

  const fetched = [];
  const discovered = [];
  const missed = [];
  for (const startup of STARTUPS) {
    const candidates = SIMPLE_ICON_CANDIDATES.get(startup.name);
    let svg = null;
    let matchedSlug = null;

    if (candidates) {
      for (const slug of candidates) {
        try {
          svg = await fetchSimpleIcon(slug);
        } catch {
          svg = null;
        }
        if (svg) {
          matchedSlug = slug;
          break;
        }
      }
    }

    if (svg) {
      await writeFile(path.join(outputDir, `${startup.id}.svg`), svg, "utf8");
      fetched.push(`${startup.name}:${matchedSlug}`);
      continue;
    }

    const directLogoUrl = DIRECT_LOGO_ASSETS.get(startup.name);
    const directLogo = directLogoUrl ? await fetchLogoAsset(directLogoUrl, startup) : null;
    if (directLogo) {
      await writeFile(path.join(outputDir, `${startup.id}.svg`), directLogo.svg, "utf8");
      discovered.push(`${startup.name}:${directLogo.source}`);
      continue;
    }

    const siteLogo = (await discoverSiteLogo(startup)) || (await discoverLogoService(startup));
    if (siteLogo) {
      await writeFile(path.join(outputDir, `${startup.id}.svg`), siteLogo.svg, "utf8");
      discovered.push(`${startup.name}:${siteLogo.source}`);
    } else if (candidates) {
      missed.push(startup.name);
    }
  }

  console.log(`Wrote ${STARTUPS.length} SVG logo files to ${path.relative(root, outputDir)}`);
  console.log(`Fetched public SVGs: ${fetched.length ? fetched.join(", ") : "none"}`);
  console.log(`Discovered site SVGs: ${discovered.length ? discovered.join(", ") : "none"}`);
  if (missed.length) console.log(`Kept generated fallbacks: ${missed.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
