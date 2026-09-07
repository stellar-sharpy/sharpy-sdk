import { defineConfig } from "tsup";

// v0.3.0 publish build: ESM + CJS + DTS verified green via `npm run build`.
export default defineConfig({
  entry: ["src/index.ts", "src/testing/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
});
