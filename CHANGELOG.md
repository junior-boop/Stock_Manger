# Changelog – Kataleya

## [1.1.5] – 2026-06-30

### Ajouté
- Build `.tar.gz` pour macOS (via `scripts/package-targz.mjs`)
- Barre de progression détaillée avec étapes (bootstrap → pull → push → images) sur la page de synchronisation
- Timeout de sécurité (60s) avec bouton "Continuer quand même" sur la page de sync
- Fonction `getDbPath()` pour résolution portable du chemin de la base SQLite

### Corrigé
- **Build macOS** – Signature ad‑hoc (`osxSign`) pour éviter l'erreur "application endommagée"
- **Crash SQLite** – Chemin de base de données passant de `"./notes.sqlite"` (relatif, lecture seule) → `app.getPath('userData')` (writable)
- **Sync initiale** – Ordre inversé : `bootstrapIfEmpty()` maintenant appelé avant `start()` pour garantir la récupération complète des données
- **Build Windows CI** – Ajout de `windows-2022` + `ilammy/msvc-dev-cmd@v1` pour la compilation de `better-sqlite3`
- **Actions GitHub** – Mise à jour vers `checkout@v6` / `setup-node@v6` (Node 24), `fail-fast: false`, `node-version: 22`
- **Plugin auto‑unpack** – Activation de `AutoUnpackNativesPlugin` pour les modules natifs (`better-sqlite3`)
- **TypeScript** – tsconfig ajusté pour compatibilité avec TS 4.5.4 (suppression des options inconnues)
