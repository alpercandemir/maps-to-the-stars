import { test, expect } from "@playwright/test";

const endpoint = "https://api.geoapify.com/v1/ipinfo?**";
const tokyo = {
  city: { name: "Tokyo" },
  country: { name: "Japan" },
  location: { latitude: 35.69, longitude: 139.7 },
};
const isIPLookup = (request: { url(): string }) =>
  new URL(request.url()).pathname === "/v1/ipinfo";

test.use({ timezoneId: "America/Los_Angeles" });
test.beforeEach(async ({ page }) => {
  // Detect optional provider configuration without making a real IP request.
  await page.route(endpoint, (route) => route.abort());
  await page.addInitScript(() => {
    Object.assign(window, { gpsCalls: 0 });
    navigator.geolocation.getCurrentPosition = () => {
      const state = window as Window & { gpsCalls: number };
      state.gpsCalls++;
    };
  });
  await page.goto("/");
  await page.locator(".place-control").click();
  test.skip(
    (await page
      .getByRole("textbox", { name: "Search places" })
      .getAttribute("placeholder")) === "Search saved cities…",
    "Automatic city detection requires the optional build-time Geoapify key",
  );
});

test("uses an approximate city without requesting GPS and keeps the browser's clock", async ({
  page,
}) => {
  let calls = 0;
  await page.route(endpoint, async (route) => {
    calls++;
    await route.fulfill({ json: tokyo });
  });
  await page.clock.setFixedTime(new Date("2026-11-02T01:30:00Z"));
  await page.goto("/");
  await expect(page.locator(".place-control strong")).toHaveText("Tokyo");
  await expect(page.locator(".location-estimate")).toContainText(
    "Approximate location",
  );
  await expect(page.getByLabel("Local date", { exact: true })).toHaveValue(
    "2026-11-01",
  );
  await expect(page.getByLabel("Local time", { exact: true })).toHaveValue(
    "17:30",
  );
  await expect(page.locator(".zone-note")).toContainText("America/Los_Angeles");
  await expect(page).toHaveURL(/lat=35.69&lon=139.7/);
  await expect(page).toHaveURL(/at=2026-11-02T01%3A30%3A00.000Z/);
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      () => (window as Window & { gpsCalls: number }).gpsCalls,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const failure of ["unavailable", "incomplete"]) {
  test(`keeps Istanbul when the lookup is ${failure}`, async ({ page }) => {
    await page.route(endpoint, (route) =>
      route.fulfill(
        failure === "unavailable"
          ? { status: 503, json: {} }
          : { json: { ...tokyo, location: null } },
      ),
    );
    const response = page.waitForResponse((response) =>
      isIPLookup(response.request()),
    );
    await page.goto("/");
    await response;
    await expect(page).toHaveURL(/lat=41.0082&lon=28.9784/);
    await expect(page.locator(".place-control strong")).toHaveText("Istanbul");
    await expect(page.locator(".location-estimate")).toHaveCount(0);
  });
}

test("does not look up or overwrite a shared location", async ({ page }) => {
  let calls = 0;
  await page.route(endpoint, async (route) => {
    calls++;
    await route.fulfill({ json: tokyo });
  });
  await page.goto(
    "/?lat=51.5074&lon=-0.1278&tz=Europe%2FLondon&place=London&at=2026-01-15T19%3A00%3A00.000Z",
  );
  await expect(page.locator(".place-control strong")).toHaveText("London");
  await expect(page.getByLabel("Local time", { exact: true })).toHaveValue(
    "19:00",
  );
  await expect(page.locator(".zone-note")).toContainText("Europe/London");
  expect(calls).toBe(0);
});

for (const choice of ["city", "starter sky"]) {
  test(`cancels a delayed lookup when the user selects a ${choice}`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(endpoint, async (route) => {
      await gate;
      await route.fulfill({ json: tokyo }).catch(() => {});
    });
    const started = page.waitForRequest(isIPLookup);
    await page.goto("/");
    await started;
    const cancelled = page.waitForEvent("requestfailed", isIPLookup);
    try {
      if (choice === "city") {
        await page.locator(".place-control").click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "London United Kingdom", exact: true })
          .click();
      } else {
        await page.getByRole("button", { name: /^A southern sky/ }).click();
      }
      await cancelled;
    } finally {
      release();
    }
    await expect(page.locator(".place-control strong")).toHaveText(
      choice === "city" ? "London" : "Sydney",
    );
    await expect(page.locator(".zone-note")).toContainText(
      choice === "city" ? "Europe/London" : "Australia/Sydney",
    );
    await expect(page.locator(".location-estimate")).toHaveCount(0);
  });
}

test("abandons a slow lookup after three seconds", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    await gate;
    await route.fulfill({ json: tokyo }).catch(() => {});
  });
  await page.clock.install();
  const started = page.waitForRequest(isIPLookup);
  await page.goto("/");
  await started;
  const cancelled = page.waitForEvent("requestfailed", isIPLookup);
  try {
    await page.clock.fastForward(3100);
    await cancelled;
  } finally {
    release();
  }
  await expect(page.locator(".place-control strong")).toHaveText("Istanbul");
  await expect(page.locator(".location-estimate")).toHaveCount(0);
});
