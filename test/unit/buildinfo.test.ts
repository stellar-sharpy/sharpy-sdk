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

import { SDK_NAME } from "../../src/buildinfo";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("buildinfo edges", () => {
  it2("exposes sdk name", () => {
    ex2(SDK_NAME).toBe("@stellar-sharpy/sdk");
  });
});
