import { describe, expect, it } from "vitest";
import { DEFAULT_PLACE } from "./state";
import {
  MOMENTS_KEY,
  MOMENT_LIMIT,
  readSavedMoments,
  writeSavedMoments,
  type SavedMoment,
} from "./moments";

const moment: SavedMoment = {
  place: { ...DEFAULT_PLACE, lat: 41.00821234 },
  ms: Date.parse("1998-07-15T20:30:00Z") + 123,
  id: "test",
  title: "A night to remember",
  trails: true,
  labels: false,
};
function memoryStorage(raw: string | null = null) {
  const data = new Map<string, string>(
    raw === null ? [] : [[MOMENTS_KEY, raw]],
  );
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
describe("local Moments", () => {
  it("round-trips precise moments and view settings and persists removal", () => {
    const store = memoryStorage();
    writeSavedMoments([moment], store);
    expect(readSavedMoments(store)).toEqual({
      moments: [moment],
      warning: undefined,
    });
    writeSavedMoments([], store);
    expect(readSavedMoments(store).moments).toEqual([]);
  });
  it("retains valid skies while rejecting corrupt records and duplicate ids", () => {
    const invalid = [
      null,
      { ...moment, id: "bad-time", ms: NaN },
      { ...moment, id: "bad-place", place: { ...moment.place, lat: 91 } },
      {
        ...moment,
        id: "bad-zone",
        place: { ...moment.place, zone: "Invalid" },
      },
      { ...moment, id: "bad-title", title: "" },
      { ...moment, id: "bad-view", trails: "yes" },
    ];
    const store = memoryStorage(
      JSON.stringify({ version: 1, moments: [...invalid, moment, moment] }),
    );
    expect(readSavedMoments(store).moments).toEqual([moment]);
    expect(readSavedMoments(store).warning).toBeTruthy();
  });
  it.each([
    "not-json",
    '{"version":2,"moments":[]}',
    '{"version":1,"moments":null}',
  ])("handles unreadable storage without overwriting it: %s", (raw) => {
    const store = memoryStorage(raw);
    expect(readSavedMoments(store).warning).toBeTruthy();
    expect(store.getItem(MOMENTS_KEY)).toBe(raw);
  });
  it("reports denied storage and propagates write failures so the UI cannot claim a save", () => {
    const store = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("quota");
      },
    };
    expect(readSavedMoments(store)).toMatchObject({
      moments: [],
      warning: expect.any(String),
    });
    expect(() => writeSavedMoments([moment], store)).toThrow("quota");
  });
  it("enforces the shelf limit and rejects invalid saves", () => {
    const store = memoryStorage();
    const skies = Array.from({ length: MOMENT_LIMIT }, (_, i) => ({
      ...moment,
      id: String(i),
    }));
    writeSavedMoments(skies, store);
    expect(readSavedMoments(store).moments).toHaveLength(MOMENT_LIMIT);
    expect(() =>
      writeSavedMoments([...skies, { ...moment, id: "extra" }], store),
    ).toThrow();
    expect(() => writeSavedMoments([moment, moment], store)).toThrow();
    expect(() =>
      writeSavedMoments([{ ...moment, ms: Date.parse("2102-01-01") }], store),
    ).toThrow();
  });
});
