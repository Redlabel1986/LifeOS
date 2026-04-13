const fs = require("fs");
const p = ".vercel/output/functions/__nitro.func/.vc-config.json";
if (!fs.existsSync(p)) {
  console.log("WARN: " + p + " not found, skipping maxDuration patch");
  process.exit(0);
}
const c = JSON.parse(fs.readFileSync(p));
c.maxDuration = 60;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log("patched maxDuration=60");
