import { describe, expect, it } from "vitest";
import { renderSkyCard } from "./postcard";
import { DEFAULT_PLACE } from "./state";

const DEFAULT = {
  place: DEFAULT_PLACE,
  ms: Date.parse("1998-07-15T20:30:00Z"),
};

describe("standalone sky cards", () => {
  it("carries the exact instant, place, time zone and self-contained map styles", () => {
    const svg = renderSkyCard(DEFAULT, "A summer night", {
      labels: true,
      trails: true,
    });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(new Date(DEFAULT.ms).toISOString());
    expect(svg).toContain("Europe/Istanbul");
    expect(svg).toContain("Istanbul");
    expect(svg).toContain("previous two hours");
    expect(svg).toContain(".star-trails");
    expect(svg).toContain("<style>");
    expect(svg).not.toContain('tabindex="0"');
    expect(svg).not.toContain('role="button"');
    expect(svg).not.toMatch(/(?:href|src)="https?:/);
  });
  it("escapes user titles and place labels as text rather than SVG markup", () => {
    const svg = renderSkyCard(
      {
        ...DEFAULT,
        place: { ...DEFAULT.place, label: '<script>alert("x")</script>' },
      },
      '<image href="evil"/> & me',
      { labels: false, trails: false },
    );
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain('<image href="evil"');
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp; me");
    expect(svg).not.toContain('class="star-label');
  });
});
