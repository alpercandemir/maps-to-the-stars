import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://api.geoapify.com/v1/ipinfo?**", (route) =>
    route.abort(),
  );
});

async function openSearch(page: Page) {
  await page.goto("/");
  await page.locator(".place-control").click();
  const search = page.getByRole("textbox", { name: "Search places" });
  // The production bundle intentionally works without a provider key too.
  test.skip(
    (await search.getAttribute("placeholder")) === "Search saved cities…",
    "Worldwide search requires the optional build-time Geoapify key",
  );
  return search;
}
const tromso = {
  formatted: "Tromsø, Norway",
  country: "Norway",
  lat: 69.65,
  lon: 18.96,
  timezone: { name: "Europe/Oslo" },
};

test("GPS coordinates use the returned place time zone and never guess after lookup failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      configurable: true,
      value: (success: PositionCallback) =>
        success({
          coords: { latitude: 69.650123, longitude: 18.960123 },
        } as GeolocationPosition),
    });
  });
  await page.route("https://api.geoapify.com/v1/geocode/**", (route) =>
    route.fulfill({ json: { results: [tromso] } }),
  );
  await openSearch(page);
  await page
    .getByRole("button", { name: "Use my location asks permission" })
    .click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    "69.650123",
  );
  await expect(page.getByLabel("IANA time zone")).toHaveValue("Europe/Oslo");
  await expect(
    page.getByRole("button", { name: "Set location" }),
  ).toBeEnabled();
  await page.unroute("https://api.geoapify.com/v1/geocode/**");
  await page.route("https://api.geoapify.com/v1/geocode/**", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page
    .getByRole("button", { name: "Use my location asks permission" })
    .click();
  await expect(
    page.getByRole("button", { name: "Set location" }),
  ).toBeEnabled();
  await expect(page.getByLabel("IANA time zone")).toHaveValue("");
});

test("worldwide place selection applies coordinates and time zone and reuses cached results", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://api.geoapify.com/v1/geocode/**", async (route) => {
    calls++;
    await route.fulfill({ json: { results: [tromso] } });
  });
  const search = await openSearch(page);
  await search.fill("Tromso");
  await page.getByRole("button", { name: /Tromsø, Norway/ }).click();
  await expect(page).toHaveURL(/tz=Europe%2FOslo/);
  await expect(page).toHaveURL(/lat=69.65/);
  await expect(page.locator(".zone-note")).toContainText("Europe/Oslo");
  await page.locator(".place-control").click();
  await page.getByRole("textbox", { name: "Search places" }).fill("Tromso");
  await expect(
    page.getByRole("button", { name: /Tromsø, Norway/ }),
  ).toBeVisible();
  expect(calls).toBe(1);
});

test("search failure preserves bundled cities and missing time zones require manual entry", async ({
  page,
}) => {
  await page.route("https://api.geoapify.com/v1/geocode/**", (route) =>
    route.fulfill({ status: 429, json: {} }),
  );
  const search = await openSearch(page);
  await search.fill("Istanbul");
  await expect(page.getByRole("status")).toContainText(
    "Worldwide search is unavailable",
  );
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /^Istanbul Türkiye/ }),
  ).toBeVisible();
  await page.unroute("https://api.geoapify.com/v1/geocode/**");
  await page.route("https://api.geoapify.com/v1/geocode/**", (route) =>
    route.fulfill({ json: { results: [{ ...tromso, timezone: null }] } }),
  );
  await search.fill("Tromso");
  await page.getByRole("button", { name: /Tromsø, Norway/ }).click();
  await expect(page.getByLabel("IANA time zone")).toHaveValue("");
  await expect(page.getByRole("alert")).toContainText("no time zone");
  await page.getByLabel("IANA time zone").fill("Europe/Oslo");
  await page.getByRole("button", { name: "Set location" }).click();
  await expect(page).toHaveURL(/tz=Europe%2FOslo/);
});

test("superseded search responses cannot replace a newer query", async ({
  page,
}) => {
  await page.route("https://api.geoapify.com/v1/geocode/**", async (route) => {
    const old =
      new URL(route.request().url()).searchParams.get("text") === "Slow place";
    if (old) await new Promise((resolve) => setTimeout(resolve, 800));
    await route
      .fulfill({
        json: {
          results: old
            ? [{ ...tromso, formatted: "Old search result" }]
            : [tromso],
        },
      })
      .catch(() => {});
  });
  const search = await openSearch(page);
  await search.fill("Slow place");
  await page.waitForRequest((r) =>
    r.url().startsWith("https://api.geoapify.com/"),
  );
  await search.fill("New place");
  await expect(
    page.getByRole("button", { name: /Tromsø, Norway/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Old search result/ }),
  ).toHaveCount(0);
});

test("live guide keeps the historical map unchanged and works without sensors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/at=/);
  const original = page.url();
  await page.getByRole("button", { name: "Sky guide Live" }).click();
  await expect(page.getByRole("dialog", { name: "Sky guide" })).toBeVisible();
  await expect(page.getByText("Manual view", { exact: true })).toBeVisible();
  await page.getByLabel("Guide target").selectOption("polaris");
  await page.getByRole("button", { name: "Look toward Polaris" }).click();
  await expect(page.locator(".guide-aim")).toContainText("Polaris is in view");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(page.url()).toBe(original);
});

test("permission failures keep manual guide controls usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", {
      configurable: true,
      value: async () => "denied",
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sky guide Live" }).click();
  await page.getByRole("button", { name: "Follow phone", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Motion permission" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Camera permission" }),
  ).toBeVisible();
  await expect(page.getByLabel("Guide direction")).toBeVisible();
});

test("camera and compass start only on request and stop on close", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      cameraCalls: 0,
      motionCalls: 0,
      tracks: [] as MediaStreamTrack[],
    };
    Object.assign(window, { guideTest: state });
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", {
      configurable: true,
      value: async () => {
        state.motionCalls++;
        return "granted";
      },
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        if (constraints.audio !== false)
          throw new Error("No audio should be requested");
        state.cameraCalls++;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        canvas.getContext("2d")!.fillRect(0, 0, 320, 240);
        const stream = canvas.captureStream(1);
        state.tracks.push(...stream.getTracks());
        return stream;
      },
    });
  });
  const state = () =>
    page.evaluate(() => {
      const s = (
        window as Window & {
          guideTest?: {
            cameraCalls: number;
            motionCalls: number;
            tracks: MediaStreamTrack[];
          };
        }
      ).guideTest!;
      return {
        cameraCalls: s.cameraCalls,
        motionCalls: s.motionCalls,
        tracks: s.tracks.map((t) => t.readyState),
      };
    });
  await page.goto("/");
  await page.getByRole("button", { name: "Sky guide Live" }).click();
  expect(await state()).toEqual({ cameraCalls: 0, motionCalls: 0, tracks: [] });
  await page.getByRole("button", { name: "Follow phone", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceOrientationEvent("deviceorientationabsolute", {
        alpha: 0,
        beta: 135,
        gamma: 0,
        absolute: true,
      }),
    ),
  );
  await expect(
    page.getByText("Following phone", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByLabel("Live rear camera")).toBeVisible();
  expect(await state()).toEqual({
    cameraCalls: 1,
    motionCalls: 1,
    tracks: ["live"],
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Manual view", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Live rear camera")).toHaveCount(0);
  expect((await state()).tracks).toEqual(["ended"]);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByLabel("Live rear camera")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect((await state()).tracks).toEqual(["ended", "ended"]);
});
