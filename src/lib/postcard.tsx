import { renderToStaticMarkup } from "react-dom/server";
import serifUrl from "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url";
import sansUrl from "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url";
import serifExtUrl from "@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-normal.woff2?url";
import sansExtUrl from "@fontsource-variable/dm-sans/files/dm-sans-latin-ext-wght-normal.woff2?url";
import type { Moment } from "./state";
import { clock, inputs, prettyDate, zoned } from "./time";
import { calculateSky } from "./sky";
import { solarContext } from "./daylight";
import { createStarTrailSampler } from "./trails";
import SkyMap from "../components/SkyMap";

export type CardView = { trails: boolean; labels: boolean };
// SVG carries its own styles and fonts; it does not depend on the live page.
const CARD_STYLES = `
text { font-family: 'Card Sans', Arial, sans-serif; }
.sky-map { width:640px; height:640px; overflow:visible; }
.horizon { stroke:#9caeb260; stroke-width:.8; }
.altitude-ring { stroke:#859db740; stroke-width:.7; stroke-dasharray:2 6; }
.axis { stroke:#849bb328; stroke-width:.6; stroke-dasharray:2 6; }
.map-tick { stroke:#99a9b365; stroke-width:.6; }
.directions { font-size:13px; fill:#a6b2c0; text-anchor:middle; }
.map-annotations { fill:#7a8b9d; font-size:7px; letter-spacing:.3px; }
.star-label { font-size:12px; fill:#b8c3cf; paint-order:stroke; stroke:#0d1621; stroke-width:4px; stroke-linejoin:round; }
.star-trails { fill:none; stroke-width:1.25; stroke-linecap:round; }
`;

function lines(text: string, width: number): string[] {
  const chars = Array.from(text);
  if (chars.length <= width) return [text];
  const head = chars.slice(0, width).join("");
  const space = head.lastIndexOf(" ");
  const cut = space > width / 2 ? space : width;
  const tail = chars.slice(cut).join("").trim();
  const tailChars = Array.from(tail);
  return [
    chars.slice(0, cut).join(""),
    tailChars.length > width
      ? tailChars.slice(0, width - 1).join("") + "…"
      : tail,
  ];
}

function fittedSize(textLines: string[], preferred: number) {
  // Conservative glyph widths also accommodate long, unbroken titles.
  const width = Math.max(
    ...textLines.map((line) =>
      Array.from(line).reduce(
        (sum, char) =>
          sum +
          (/\s/.test(char)
            ? 0.3
            : /[MW@]/.test(char)
              ? 1.1
              : /[A-Z]/.test(char)
                ? 0.8
                : char.codePointAt(0)! > 0x2e7f
                  ? 1.2
                  : 0.65),
        0,
      ),
    ),
  );
  return Math.min(preferred, 650 / Math.max(1, width));
}

export function renderSkyCard(
  moment: Moment,
  title: string,
  view: CardView,
  fontCSS = "",
) {
  const objects = calculateSky(moment.ms, moment.place);
  const solar = solarContext(moment.ms, moment.place);
  const trails = view.trails
    ? createStarTrailSampler(moment.place)(moment.ms, objects)
    : [];
  const titleLines = lines(
    title.trim().slice(0, 60) || "A sky to remember",
    32,
  );
  const placeLines = lines(moment.place.label, 40);
  const titleSize = fittedSize(titleLines, 38);
  const placeSize = fittedSize(placeLines, 17);
  const offset = zoned(moment.ms, moment.place.zone).offset;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    renderToStaticMarkup(
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="800"
        height="1120"
        viewBox="0 0 800 1120"
        role="img"
        aria-label={`${title}. ${moment.place.label}, ${prettyDate(moment.ms, moment.place.zone)}, ${clock(moment.ms, moment.place.zone)}.`}
      >
        <title>{title || "A sky to remember"}</title>
        <desc>{`Calculated astronomical sky. ${solar.label}. North up, east right. ${new Date(moment.ms).toISOString()}. ${view.trails ? "Star trails show the previous two hours." : ""}`}</desc>
        <style>{fontCSS + CARD_STYLES}</style>
        <rect width="800" height="1120" fill="#0c1119" />
        <text
          x="60"
          y="78"
          fill="#e2e4e4"
          style={{ fontFamily: "'Card Serif', Georgia, serif", fontSize: 32 }}
        >
          maps to the stars
        </text>
        <path d="M60 104H740 M60 1002H740" stroke="#ffffff25" strokeWidth="1" />
        <text x="740" y="75" textAnchor="end" fill="#9cabbc" fontSize="12">
          {solar.label}
        </text>
        <svg x="80" y="130" width="640" height="640" viewBox="0 0 640 640">
          <SkyMap
            objects={objects}
            selected={null}
            onSelect={() => {}}
            labels={view.labels}
            trails={trails}
            solar={solar}
            interactive={false}
          />
        </svg>
        {titleLines.map((line, i) => (
          <text
            key={i}
            x="400"
            y={810 + i * 43}
            textAnchor="middle"
            fill="#e7e2d6"
            style={{
              fontFamily: "'Card Serif', Georgia, serif",
              fontSize: titleSize,
            }}
          >
            {line}
          </text>
        ))}
        {placeLines.map((line, i) => (
          <text
            key={i}
            x="400"
            y={906 + i * 23}
            textAnchor="middle"
            fill="#bac6d4"
            fontSize={placeSize}
          >
            {line}
          </text>
        ))}
        <text x="400" y="965" textAnchor="middle" fill="#a2b2c5" fontSize="15">
          {prettyDate(moment.ms, moment.place.zone)} ·{" "}
          {clock(moment.ms, moment.place.zone)}
        </text>
        <text x="60" y="1033" fill="#8c9cad" fontSize="12">
          {moment.place.zone} · UTC{offset}
        </text>
        <text x="740" y="1033" textAnchor="end" fill="#8c9cad" fontSize="12">
          {Math.abs(moment.place.lat).toFixed(4)}°{" "}
          {moment.place.lat >= 0 ? "N" : "S"} ·{" "}
          {Math.abs(moment.place.lon).toFixed(4)}°{" "}
          {moment.place.lon >= 0 ? "E" : "W"}
        </text>
        <text x="60" y="1073" fill="#78889c" fontSize="11">
          Calculated positions, not a record of visibility. Eight stars and the
          Moon.
        </text>
        <text x="60" y="1093" fill="#78889c" fontSize="11">
          {view.trails ? "Trails: previous 2 hours. " : ""}Clouds, terrain and
          light pollution are not reconstructed.
        </text>
      </svg>,
    )
  );
}

let fonts: Promise<string> | undefined;
export function embeddedFonts() {
  // Match Fontsource's ranges so each subset contributes its own glyphs.
  const latin =
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  const extended =
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
  const faces = [
    { url: serifUrl, family: "Card Serif", weight: "400", range: latin },
    { url: serifExtUrl, family: "Card Serif", weight: "400", range: extended },
    { url: sansUrl, family: "Card Sans", weight: "100 1000", range: latin },
    {
      url: sansExtUrl,
      family: "Card Sans",
      weight: "100 1000",
      range: extended,
    },
  ];
  fonts ??= Promise.all(
    faces.map(async ({ url, family, weight, range }) => {
      const response = await fetch(url);
      if (!response.ok) throw Error("Font unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let data = "";
      for (const byte of bytes) data += String.fromCharCode(byte);
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};unicode-range:${range};src:url(data:font/woff2;base64,${btoa(data)}) format('woff2')}`;
    }),
  )
    .then((rules) => rules.join(""))
    .catch((error) => {
      fonts = undefined;
      throw error;
    });
  return fonts;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSkyCard(
  moment: Moment,
  title: string,
  view: CardView,
  format: "svg" | "png",
) {
  const svg = renderSkyCard(moment, title, view, await embeddedFonts());
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const name = `sky-${inputs(moment.ms, moment.place.zone).date}.${format}`;
  if (format === "svg") return download(blob, name);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 2240;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Image export unavailable");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(Error("Image export failed")),
        "image/png",
      ),
    );
    download(png, name);
  } finally {
    URL.revokeObjectURL(url);
  }
}
