import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join("public", "images", "placeholders");

const PLACEHOLDERS = [
  { slug: "top-used", label: "BEST", icon: "♥", color: "#FFD2C2", accent: "#FF8A7A" },
  { slug: "sleep", label: "SLEEP", icon: "☾", color: "#BFDDF7", accent: "#6C8FD6" },
  { slug: "outing", label: "OUT", icon: "◠", color: "#BFEAD9", accent: "#4EAA83" },
  { slug: "sterilize", label: "CLEAN", icon: "✦", color: "#D9CDFB", accent: "#8A70D6" },
  { slug: "feeding", label: "MILK", icon: "◡", color: "#FFE8A8", accent: "#D89B2B" },
  { slug: "colic", label: "CARE", icon: "+", color: "#FFD7E5", accent: "#D56E9C" },
  { slug: "play", label: "PLAY", icon: "★", color: "#C8D3FF", accent: "#6E7CD5" },
  { slug: "diaper", label: "DAILY", icon: "□", color: "#D7EDB9", accent: "#74A944" },
  { slug: "mat", label: "MAT", icon: "▤", color: "#BFEAD9", accent: "#4EAA83" },
  { slug: "caregiver", label: "HELP", icon: "♡", color: "#FFD2C2", accent: "#FF8A7A" },
  { slug: "default", label: "ITEM", icon: "•", color: "#FFF0C6", accent: "#C98B28" },
];

function svg({ label, icon, color, accent }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720" role="img" aria-label="${label}">
  <rect width="960" height="720" fill="${color}"/>
  <path d="M96 548c78-92 167-117 267-75 83 35 151 25 205-30 63-65 162-63 296 6v271H96V548z" fill="#fff" opacity=".46"/>
  <circle cx="230" cy="160" r="88" fill="#fff" opacity=".55"/>
  <circle cx="742" cy="172" r="116" fill="#fff" opacity=".36"/>
  <circle cx="494" cy="338" r="178" fill="#fff" opacity=".58"/>
  <text x="480" y="347" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="132" font-weight="700" fill="${accent}">${icon}</text>
  <rect x="358" y="508" width="244" height="62" rx="31" fill="#fff" opacity=".78"/>
  <text x="480" y="543" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${accent}">${label}</text>
</svg>
`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const placeholder of PLACEHOLDERS) {
    await writeFile(path.join(OUTPUT_DIR, `${placeholder.slug}.svg`), svg(placeholder), "utf8");
  }

  console.log(`Wrote ${PLACEHOLDERS.length} placeholders to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
