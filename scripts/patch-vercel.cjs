const fs = require("fs");
const p = ".vercel/output/functions/__nitro.func/.vc-config.json";
const c = JSON.parse(fs.readFileSync(p));
c.maxDuration = 60;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log("patched maxDuration=60");
