const https = require("https");
const fs = require("fs");
const out = process.argv[2];
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "node", Accept: "application/vnd.github+json" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(get(res.headers.location));
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode + " " + url));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}
(async () => {
  const rel = JSON.parse((await get("https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest")).toString());
  const asset = rel.assets.map((a) => a.name).filter((n) => /^cpython-3\.12\.\d+\+.*x86_64-pc-windows-msvc-install_only\.tar\.gz$/.test(n)).sort().pop();
  if (!asset) throw new Error("no matching asset in " + rel.tag_name);
  console.log("release " + rel.tag_name + " asset " + asset);
  const url = "https://github.com/astral-sh/python-build-standalone/releases/download/" + rel.tag_name + "/" + asset;
  fs.writeFileSync(out, await get(url));
  console.log("saved " + fs.statSync(out).size + " bytes");
})().catch((e) => { console.error("FAIL " + e.message); process.exit(1); });
