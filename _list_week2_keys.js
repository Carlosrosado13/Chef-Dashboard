const fs = require("fs");

const src = fs.readFileSync("recipes.js", "utf8");

// Find Week 2 block: 2: { ... } or "2": { ... } or '2': { ... }
const m = src.match(/(?:^|\W)(?:'2'|"2"|2)\s*:\s*\{([\s\S]*?)\n\s*\}\s*,/m);

if (!m) {
  console.log("No simple week 2 block match. We'll fallback to a broader search.");
  // fallback: list all keys (first 150) to confirm parsing
  const all = [...src.matchAll(/['"]([^'"]+)['"]\s*:\s*`/g)].map(x => x[1]);
  console.log("All recipe keys found:", all.length);
  console.log(all.slice(0,150).join("\n"));
  process.exit(0);
}

const block = m[1];
const keys = [...block.matchAll(/['"]([^'"]+)['"]\s*:\s*`/g)].map(x => x[1]);
console.log("Week 2 recipe keys found:", keys.length);
console.log(keys.slice(0,120).join("\n"));
