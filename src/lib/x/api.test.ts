import { describe, expect, it } from "vitest";
import { composePostText } from "./api";

describe("composePostText", () => {
  it("appends hashtags and link", () => {
    const out = composePostText("Hello world", ["ai", "#dev"], "https://example.com/a");
    expect(out).toBe("Hello world\n#ai #dev\nhttps://example.com/a");
  });

  it("truncates long bodies so the whole post fits in 280 counting URLs as 23", () => {
    const body = "x".repeat(400);
    const out = composePostText(body, ["tag"], "https://example.com/very/long/url/that/x/shortens");
    const [text, tags, url] = out.split("\n");
    expect(tags).toBe("#tag");
    expect(url).toContain("https://");
    expect(text.length + 1 + tags.length + 1 + 23).toBeLessThanOrEqual(280);
    expect(text.endsWith("…")).toBe(true);
  });

  it("works with no hashtags and no url", () => {
    expect(composePostText("  plain  ", [], null)).toBe("plain");
  });
});
