const { copyFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const dest = join(
  __dirname,
  "..",
  "node_modules",
  "expo-sqlite",
  "web",
  "wa-sqlite",
  "wa-sqlite.wasm",
);
const src = join(__dirname, "..", "vendor", "wa-sqlite.wasm");
if (existsSync(src) && !existsSync(dest)) {
  copyFileSync(src, dest);
}
