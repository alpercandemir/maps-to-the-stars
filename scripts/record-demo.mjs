// npm run build && npm run preview; then node scripts/record-demo.mjs
// Requires Playwright's Chromium and ffmpeg on PATH (or FFMPEG_PATH).
import { chromium } from "@playwright/test";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const base = process.env.DEMO_URL || "http://127.0.0.1:4173";
const output = resolve("docs/demo");
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME ? { channel: "chrome" } : {},
);
const context = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  recordVideo: {
    dir: resolve(".artifacts/demo"),
    size: { width: 1280, height: 960 },
  },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const pause = (ms) => page.waitForTimeout(ms);
await page.goto(
  `${base}/?lat=40.9909&lon=29.0297&tz=Europe%2FIstanbul&place=Kad%C4%B1k%C3%B6y%2C+Istanbul&at=2026-01-15T19%3A00%3A00.000Z`,
);
await page.evaluate(() => document.fonts.ready);
await page
  .getByRole("button", { name: /^Betelgeuse, altitude/ })
  .press("Enter");
await page.locator(".site-header").click({ position: { x: 600, y: 20 } });
await pause(3000);
await page.screenshot({ path: resolve("docs/screenshots/hero.png") });

await page.getByLabel("Local date", { exact: true }).fill("1998-07-15");
await pause(2500);
await page.getByLabel("Local time", { exact: true }).fill("23:30");
await pause(2000);
await page.getByRole("button", { name: "Objects", exact: true }).click();
await pause(1800);
await page
  .getByRole("dialog")
  .getByRole("button", { name: /^Sirius / })
  .click();
await pause(2000);
await page.getByRole("button", { name: /Jump to Sirius rise/ }).click();
await pause(2500);

await page
  .getByRole("button", { name: "Show star trails for the previous two hours" })
  .click();
await page.getByRole("button", { name: "Play time", exact: true }).click();
await pause(5000);
await page.getByRole("button", { name: "Pause time", exact: true }).click();
await page.getByLabel("Local time", { exact: true }).fill("23:30");
await pause(800);
await page.getByRole("button", { name: /^Vega, altitude/ }).press("Enter");
await pause(2500);
await page.getByRole("button", { name: "Explore 1973", exact: true }).click();
await pause(2500);

await page
  .getByRole("button", { name: "Explore Moments and starter skies" })
  .click();
await pause(1500);
await page.getByRole("button", { name: /^A southern sky/ }).click();
await pause(3000);
await page.screenshot({ path: resolve("docs/screenshots/trails.png") });
await page.getByRole("button", { name: "Share", exact: true }).click();
await page.getByLabel("Card title").fill("Işığın yolculuğu");
await pause(2500);
const svgDownload = page.waitForEvent("download");
await page.getByRole("button", { name: "Download SVG" }).click();
await (await svgDownload).saveAs(resolve(".artifacts/demo-card.svg"));
const pngDownload = page.waitForEvent("download");
await page.getByRole("button", { name: "Download PNG" }).click();
await (await pngDownload).saveAs(resolve("docs/screenshots/sky-card.png"));
await pause(2500);
await page.getByRole("button", { name: "Close dialog" }).click();
await pause(2000);

const video = page.video();
await context.close();
await browser.close();
if (errors.length) throw Error(errors.join("\n"));
const rawVideo = await video.path();
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
execFileSync(
  ffmpeg,
  [
    "-y",
    "-i",
    rawVideo,
    "-t",
    "59",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "25",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    resolve(output, "walkthrough.mp4"),
  ],
  { stdio: "inherit" },
);
await writeFile(
  resolve(output, "README.md"),
  "# Demo\n\nA real browser recording, under one minute. Regenerate with `node scripts/record-demo.mjs` while the production preview is running. Requires Chromium (`npx playwright install chromium`) and ffmpeg.\n",
);
await unlink(rawVideo);
console.log(`Saved ${output}/walkthrough.mp4`);
