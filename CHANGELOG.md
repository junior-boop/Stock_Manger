# Changelog – Kataleya

## 1.1.9 (2026-06-30)

### Nouvelles fonctionnalités
- Bouton "Sync now" dans le panneau de synchronisation (titlebar) pour lancer manuellement une sync
- Build `.tar.gz` pour macOS via `scripts/package-targz.mjs`
- Barre de progression avec étapes (bootstrap → pull → push → images) sur la page de synchronisation
- Timeout de 60s avec bouton "Continuer quand même" sur la page de sync
- CHANGELOG.md pour le suivi des versions

### Corrections
- Texte illisible en dark mode : ajout de `data-theme="light"` sur `<html>`
- Crash SQLite sur macOS packagé : `"./notes.sqlite"` → `app.getPath('userData')`
- Application "endommagée" sur macOS : ajout de `osxSign` (signature ad‑hoc)
- Sync initiale incomplète : `bootstrapIfEmpty()` appelé avant `start()`
- Build Windows CI : ajout de `windows-2022` + `ilammy/msvc-dev-cmd@v1`
- Actions GitHub mises à jour : `checkout@v6`, `setup-node@v6`, `fail-fast: false`, Node 22
- Activation de `AutoUnpackNativesPlugin` pour les modules natifs
- tsconfig ajusté pour compatibilité TypeScript 4.5.4

## 1.1.5 (2026-06-25)

### Corrections
- Correctifs mineurs et optimisation des performances
