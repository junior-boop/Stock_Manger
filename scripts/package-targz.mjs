import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "out", "make");

if (!fs.existsSync(outDir)) {
  console.log("[targz] Aucun dossier out/make/ — skipping");
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.log("[targz] Skip (non-macOS)");
  process.exit(0);
}

const entries = fs.readdirSync(outDir, { withFileTypes: true });
let appDir = null;
for (const e of entries) {
  if (e.isDirectory() && (e.name.endsWith(".app") || e.name.endsWith(".App"))) {
    appDir = path.join(outDir, e.name);
    break;
  }
  if (e.isDirectory()) {
    const sub = fs.readdirSync(path.join(outDir, e.name), { withFileTypes: true });
    for (const s of sub) {
      if (s.name.endsWith(".app") || s.name.endsWith(".App")) {
        appDir = path.join(outDir, e.name, s.name);
        break;
      }
    }
    if (appDir) break;
  }
}

if (!appDir) {
  console.log("[targz] Aucun .app trouvé dans out/make/");
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
const version = pkg.version;
const appName = pkg.productName || "Kataleya - Plateforme";
const safeName = appName.replace(/[^a-zA-Z0-9_-]/g, "_");
const tarName = `${safeName}-${version}-mac.tar.gz`;
const tarPath = path.join(outDir, tarName);

console.log(`[targz] Compression de ${appDir} → ${tarName}`);
execSync(`tar -czf "${tarPath}" -C "${path.dirname(appDir)}" "${path.basename(appDir)}"`, {
  stdio: "inherit",
  cwd: root,
});

const stat = fs.statSync(tarPath);
console.log(`[targz] Terminé : ${tarName} (${(stat.size / 1024 / 1024).toFixed(1)} Mo)`);
