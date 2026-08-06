import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllCities } from "../src/cities/index.js";
import { ensureProxyAware } from "./lib/net.mjs";

ensureProxyAware();

const CITIES = await loadAllCities();

// Every city's startups, tagged so the report says which map a pin is on.
const STARTUPS = CITIES.flatMap((city) => city.startups.map((s) => ({ ...s, city: city.name })));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "public");
const csvPath = path.join(outputDir, "company-addresses.csv");
const mdPath = path.join(outputDir, "company-addresses.md");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "nyc-ai-atlas-address-report/1.0 (local development)";

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatNominatimAddress(result) {
  const address = result?.address ?? {};
  const road = address.road ?? address.pedestrian ?? address.footway ?? address.cycleway;
  const line1 = [address.house_number, road].filter(Boolean).join(" ");
  const city = address.city ?? address.town ?? address.village ?? address.suburb ?? address.county;
  const line2 = [city, address.state, address.postcode].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(", ") || result?.display_name || "";
}

async function reverseGeocode(startup) {
  if (startup.address) {
    return {
      address: startup.address,
      addressSource: "User supplied; Census geocoded",
    };
  }

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", startup.lat);
  url.searchParams.set("lon", startup.lng);
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    return {
      address: "",
      addressSource: `Nominatim reverse geocode failed: ${response.status}`,
    };
  }

  const result = await response.json();
  return {
    address: formatNominatimAddress(result),
    addressSource: "OpenStreetMap/Nominatim reverse geocode from map pin",
  };
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const rows = [];
  for (const startup of STARTUPS) {
    const geocode = await reverseGeocode(startup);
    rows.push({
      name: startup.name,
      city: startup.city,
      address: geocode.address,
      addressSource: geocode.addressSource,
      lat: startup.lat,
      lng: startup.lng,
      area: startup.area,
      source: startup.source,
    });
    if (!startup.address) await delay(1100);
  }

  const csvHeader = ["Company", "City", "Address", "Address Source", "Latitude", "Longitude", "Area", "Startup Source"];
  const csv = [
    csvHeader.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.city,
        row.address,
        row.addressSource,
        row.lat,
        row.lng,
        row.area,
        row.source,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");

  const markdown = [
    "# AI Atlas Company Address Report",
    "",
    "Addresses are derived from the stored map-pin coordinates unless an explicit address is stored in the dataset. Coordinate-derived addresses verify the nearest mapped address for the pin, not the company's current lease or office occupancy.",
    "",
    "| Company | City | Address | Address source |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.name} | ${row.city} | ${row.address || "Not resolved"} | ${row.addressSource} |`),
    "",
  ].join("\n");

  await writeFile(csvPath, `${csv}\n`, "utf8");
  await writeFile(mdPath, markdown, "utf8");
  console.log(`Wrote ${rows.length} rows to ${path.relative(root, csvPath)} and ${path.relative(root, mdPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
