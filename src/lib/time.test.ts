import { describe, expect, it } from "vitest";
import { inputs, parseLocal, shiftCalendar, validZone, zoned } from "./time";

describe("historical wall time → UTC", () => {
  it.each([
    ["1998-07-15", "23:30", "Europe/Istanbul", "1998-07-15T20:30:00.000Z"],
    ["1998-01-15", "23:30", "Europe/Istanbul", "1998-01-15T21:30:00.000Z"],
    ["2015-11-01", "12:00", "Europe/Istanbul", "2015-11-01T09:00:00.000Z"],
    ["2015-11-15", "12:00", "Europe/Istanbul", "2015-11-15T10:00:00.000Z"],
    ["2026-01-15", "23:30", "Europe/Istanbul", "2026-01-15T20:30:00.000Z"],
    ["2026-01-15", "23:30", "Australia/Sydney", "2026-01-15T12:30:00.000Z"],
    ["2026-01-15", "23:30", "Asia/Kolkata", "2026-01-15T18:00:00.000Z"],
  ])("%s %s %s", (date, time, zone, expected) => {
    const result = parseLocal(date, time, zone);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(new Date(result.ms).toISOString()).toBe(expected);
      expect(inputs(result.ms, zone)).toEqual({ date, time });
    }
  });
  it("rejects nonexistent spring times", () => {
    expect(parseLocal("2026-03-08", "02:30", "America/New_York").kind).toBe(
      "error",
    );
  });
  it("exposes both fall-back instants and offsets", () => {
    const result = parseLocal("2026-11-01", "01:30", "America/New_York");
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.later - result.earlier).toBe(3600_000);
      expect(zoned(result.earlier, "America/New_York").offset).toBe("-04:00");
      expect(zoned(result.later, "America/New_York").offset).toBe("-05:00");
    }
  });
  it("handles Turkey’s historical spring gap and autumn overlap", () => {
    expect(parseLocal("2015-03-29", "03:30", "Europe/Istanbul").kind).toBe(
      "error",
    );
    expect(parseLocal("2015-11-08", "03:30", "Europe/Istanbul").kind).toBe(
      "ambiguous",
    );
  });
  it.each([
    ["1899-12-31", "12:00"],
    ["2101-01-01", "12:00"],
    ["2026-02-30", "12:00"],
    ["2026-01-01", "24:00"],
    ["2026-00-01", "12:00"],
  ])("rejects %s %s", (date, time) => {
    expect(parseLocal(date, time, "UTC").kind).toBe("error");
  });
  it("rejects invalid and numeric-offset zones", () => {
    expect(validZone("Europe/Neverland")).toBe(false);
    expect(validZone("+03:00")).toBe(false);
  });
  it("calendar day preserves wall time over DST (23 elapsed hours)", () => {
    const start = Date.parse("2026-03-07T17:00:00Z");
    const result = shiftCalendar(start, "America/New_York", 0, 1);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.ms - start).toBe(23 * 3600_000);
  });
  it("month jumps constrain to the last valid day", () => {
    const result = shiftCalendar(Date.parse("2026-01-31T12:00:00Z"), "UTC", 1);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok")
      expect(inputs(result.ms, "UTC").date).toBe("2026-02-28");
  });
});
