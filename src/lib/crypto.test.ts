import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("crypto", () => {
  it("round-trips and uses a fresh IV each time", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const a = encrypt("secret-token");
    const b = encrypt("secret-token");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("secret-token");
    expect(decrypt(b)).toBe("secret-token");
  });

  it("rejects tampered payloads", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const [iv, ct, tag] = encrypt("hello").split(".");
    expect(() => decrypt([iv, ct, tag.slice(0, -2) + "AA"].join("."))).toThrow();
  });
});
