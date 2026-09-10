import { describe, it, expect } from "vitest";
import { SDK_VERSION, buildTag } from "../../src/buildinfo";

describe("buildinfo", () => {
  it("matches package.json version", async () => {
    const pkg = await import("../../package.json");
    expect(SDK_VERSION).toBe(pkg.default?.version ?? pkg.version ?? "0.3.0");
  });
  it("builds a tag", () => {
    expect(buildTag()).toContain(SDK_VERSION);
  });
});
