import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("date and time changes automatically update the sky and share URL", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Update sky" })).toHaveCount(0);
  await page.getByLabel("Local date", { exact: true }).fill("2026-01-15");
  await expect(page).toHaveURL(/at=2026-01-15T20%3A30/);
  await page.getByLabel("Local time", { exact: true }).fill("22:00");
  await expect(page).toHaveURL(/at=2026-01-15T19%3A00/);
  await expect(page.locator(".timeline-date")).toContainText("15 January 2026");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a rise jump makes a previously hidden Sirius visible", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Sirius / })
    .click();
  await expect(page.getByText("Below horizon", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Jump to Sirius rise/ }).click();
  await expect(page.getByText("Below horizon", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Sirius, altitude/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Jump to Sirius set/ }).click();
  await expect(page.getByText("Below horizon", { exact: true })).toBeVisible();
});

test("automatic edits preserve DST gap rejection and overlap choice", async ({
  page,
}) => {
  const query = "lat=40.7128&lon=-74.006&tz=America%2FNew_York&place=New+York";
  await page.goto(`/?${query}&at=2026-03-08T06%3A30%3A00.000Z`);
  await page.getByLabel("Local time", { exact: true }).fill("02:30");
  await expect(page.getByRole("alert")).toContainText("does not exist");
  await expect(page).toHaveURL(/at=2026-03-08T06%3A30/);
  await page.getByLabel("Local time", { exact: true }).fill("03:30");
  await expect(page).toHaveURL(/at=2026-03-08T07%3A30/);
  await page.goto(`/?${query}&at=2026-11-01T04%3A30%3A00.000Z`);
  await page.getByLabel("Local time", { exact: true }).fill("01:30");
  await page.getByRole("button", { name: /Second occurrence/ }).click();
  await expect(page).toHaveURL(/at=2026-11-01T06%3A30/);
});

test("nearby starlight uses the displayed year and preserves selection on exploration", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Vega, altitude/ }).click();
  await expect(page.locator(".light-travel")).toContainText("around 1973");
  await page.getByRole("button", { name: "Explore 1973", exact: true }).click();
  await expect(page.locator(".timeline-date")).toContainText("1973");
  await expect(
    page.getByRole("heading", { name: "Vega", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Local date", { exact: true }).fill("1900-07-15");
  await expect(page.locator(".timeline-date")).toContainText("1900");
  await expect(page.locator(".light-travel button")).toHaveCount(0);
});

test("downloaded cards carry both font subsets and render Turkish text to PNG", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByLabel("Card title").fill("İzmir ışığı · ğüşöç");
  const svgEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG" }).click();
  const svg = await readFile((await (await svgEvent).path())!, "utf8");
  expect(svg).toContain("İzmir ışığı · ğüşöç");
  expect(svg.match(/@font-face/g)).toHaveLength(4);
  expect(svg.match(/unicode-range:U\+0100-02BA/g)).toHaveLength(2);
  expect(svg.match(/data:font\/woff2;base64,/g)).toHaveLength(4);
  const pngEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const png = await readFile((await (await pngEvent).path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1600);
  expect(png.readUInt32BE(20)).toBe(2240);
  await expect(page.getByRole("status")).toContainText(
    "PNG sky card downloaded",
  );
});
