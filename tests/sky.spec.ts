import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const summerSky =
  "/?lat=41.0082&lon=28.9784&tz=Europe%2FIstanbul&place=Istanbul&at=1998-07-15T20%3A30%3A00.000Z";

test.beforeEach(async ({ page }) => {
  await page.route("https://api.geoapify.com/v1/ipinfo?**", (route) =>
    route.abort(),
  );
});

test.describe("local defaults", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("opens Istanbul at now in the browser's time zone, including the local date", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-02T01:30:00Z"));
    await page.goto("/");
    await expect(page.locator(".place-control strong")).toHaveText("Istanbul");
    await expect(page.getByLabel("Local date", { exact: true })).toHaveValue(
      "2026-11-01",
    );
    await expect(page.getByLabel("Local time", { exact: true })).toHaveValue(
      "17:30",
    );
    await expect(page.locator(".zone-note")).toContainText(
      "America/Los_Angeles",
    );
    await expect(page).toHaveURL(/at=2026-11-02T01%3A30%3A00.000Z/);

    await page.clock.setFixedTime(new Date("2026-11-03T18:45:00Z"));
    await page.goto("/");
    await expect(page.getByLabel("Local date", { exact: true })).toHaveValue(
      "2026-11-03",
    );
    await expect(page.getByLabel("Local time", { exact: true })).toHaveValue(
      "10:45",
    );
  });

  test("a shared sky retains its instant and time zone", async ({ page }) => {
    await page.goto(summerSky);
    await expect(page.getByLabel("Local date", { exact: true })).toHaveValue(
      "1998-07-15",
    );
    await expect(page.getByLabel("Local time", { exact: true })).toHaveValue(
      "23:30",
    );
    await expect(page.locator(".zone-note")).toContainText("Europe/Istanbul");
  });
});

test("date and time changes automatically update the sky and share URL", async ({
  page,
}) => {
  await page.goto(summerSky);
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
  await page.goto(summerSky);
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
  await page.goto(summerSky);
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
  await page.getByLabel("Card title").fill("Işığın yolculuğu · İzmir");
  // Export PNG first: an SVG download must not warm the font cache for this check.
  const pngEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const png = await readFile((await (await pngEvent).path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1600);
  expect(png.readUInt32BE(20)).toBe(2240);
  await expect(page.getByRole("status")).toContainText(
    "PNG sky card downloaded",
  );
  const titlePixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 1540, 1600, 180).data;
    let ink = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 100 && pixels[i + 1] > 100) ink++;
    return ink;
  }, png.toString("base64"));
  expect(
    titlePixels,
    "the first PNG must contain visible title glyphs",
  ).toBeGreaterThan(500);
  const svgEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG" }).click();
  const svg = await readFile((await (await svgEvent).path())!, "utf8");
  expect(svg).toContain("Işığın yolculuğu · İzmir");
  expect(svg.match(/@font-face/g)).toHaveLength(4);
  expect(svg.match(/unicode-range:U\+0100-02BA/g)).toHaveLength(2);
  expect(svg.match(/data:font\/woff2;base64,/g)).toHaveLength(4);
});
