import { Temporal } from "@js-temporal/polyfill";

export function zoned(ms: number, zone: string) {
  return Temporal.Instant.fromEpochMilliseconds(
    Math.round(ms),
  ).toZonedDateTimeISO(zone);
}
export function inRange(ms: number, zone: string) {
  try {
    const year = zoned(ms, zone).year;
    return year >= 1900 && year <= 2100;
  } catch {
    return false;
  }
}
export function validZone(zone: string) {
  // Require a named zone (or UTC), not a fixed numeric offset.
  try {
    return !/^[+−-]/.test(zone) && Boolean(zoned(0, zone));
  } catch {
    return false;
  }
}
export type LocalResult =
  | { kind: "ok"; ms: number }
  | { kind: "ambiguous"; earlier: number; later: number }
  | { kind: "error"; message: string };
export function parseLocal(
  date: string,
  time: string,
  zone: string,
): LocalResult {
  try {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}(:\d{2})?$/.test(time)
    )
      throw Error();
    if (!validZone(zone))
      return {
        kind: "error",
        message: "Enter a valid IANA time zone, such as Europe/Istanbul.",
      };
    const plain = Temporal.PlainDateTime.from(`${date}T${time}`, {
      overflow: "reject",
    });
    if (plain.year < 1900 || plain.year > 2100)
      return { kind: "error", message: "Choose a date between 1900 and 2100." };
    const earlier = plain.toZonedDateTime(zone, { disambiguation: "earlier" });
    const later = plain.toZonedDateTime(zone, { disambiguation: "later" });
    if (
      !earlier.toPlainDateTime().equals(plain) ||
      !later.toPlainDateTime().equals(plain)
    )
      return {
        kind: "error",
        message:
          "This local time does not exist because the clocks move forward. Choose another time.",
      };
    if (earlier.epochMilliseconds !== later.epochMilliseconds)
      return {
        kind: "ambiguous",
        earlier: earlier.epochMilliseconds,
        later: later.epochMilliseconds,
      };
    return { kind: "ok", ms: earlier.epochMilliseconds };
  } catch {
    return { kind: "error", message: "Enter a valid date and local time." };
  }
}
export function inputs(ms: number, zone: string) {
  const z = zoned(ms, zone);
  return {
    date: z.toPlainDate().toString(),
    time: z.toPlainTime().toString({ smallestUnit: "minute" }),
  };
}
export function shiftCalendar(
  ms: number,
  zone: string,
  months = 0,
  days = 0,
): LocalResult {
  const plain = zoned(ms, zone).toPlainDateTime().add({ months, days });
  return parseLocal(
    plain.toPlainDate().toString(),
    plain.toPlainTime().toString({ smallestUnit: "second" }),
    zone,
  );
}
export function clock(ms: number, zone: string) {
  return inputs(ms, zone).time;
}
export function prettyDate(ms: number, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zone,
  }).format(ms);
}
