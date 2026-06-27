// Génère latest.json pour le serveur de mise à jour après un `npm run make`.
// Copiez le dossier `out/make/` vers votre serveur web, puis configurez l'URL
// feed dans l'application (Paramètres → Mises à jour).
//
// latest.json doit être hébergé sur votre serveur à la racine du dossier
// de mise à jour, par exemple :
//   https://votreserveur.com/updates/latest.json
//   https://votreserveur.com/updates/kataleya-plateforme-1.2.0 Setup.exe

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "out", "make");

if (!fs.existsSync(outDir)) {
  console.log("[latest.json] Aucun dossier out/make/ — skipping");
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
const version = pkg.version;
const productName = pkg.productName || "Kataleya - Plateforme";

function walk(dir, base = ""): { file: string; size: number }[] {
  const results: { file: string; size: number }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      results.push(...walk(full, rel));
    } else if (
      e.isFile() &&
      (e.name.endsWith(".exe") || e.name.endsWith(".msi") || e.name.endsWith(".nupkg"))
    ) {
      const stat = fs.statSync(full);
      results.push({ file: rel, size: stat.size });
    }
  }
  return results;
}

const files = walk(outDir);

if (files.length === 0) {
  console.log("[latest.json] Aucun fichier d'installateur trouvé dans out/make/");
  process.exit(0);
}

// Choisir le plus gros .exe (le setup complet, pas le delta)
const setups = files.filter((f) => f.file.endsWith(".exe") && !f.file.includes("delta"));
const target = setups.sort((a, b) => b.size - a.size)[0] || files[0];

const installerPath = path.join(outDir, target.file);
const sha512 = createHash("sha512")
  .update(fs.readFileSync(installerPath))
  .digest("base64");

const latest = {
  version,
  url: target.file,
  sha512,
  size: target.size,
  releaseDate: new Date().toISOString(),
};

const dest = path.join(outDir, "latest.json");
fs.writeFileSync(dest, JSON.stringify(latest, null, 2));
console.log(`[latest.json] Généré : ${dest}`);
console.log(`  Version : ${version}`);
console.log(`  Fichier : ${target.file} (${(target.size / 1024 / 1024).toFixed(1)} Mo)`);
console.log(`  SHA512  : ${sha512.slice(0, 32)}...`);
