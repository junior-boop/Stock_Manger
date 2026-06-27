# Audit Kataleya — Serveur ↔ Application

**Date :** 2026-06-27
**Périmètre :** Comparatif entre le serveur (`.server-cache`, Cloudflare Worker) et l'application (Electron + React + SQLite local)
**Auditeur :** Revue de code statique (ZCode)

---

## 1. Synthèse exécutive

Kataleya est une application **offline-first** : un client lourd Electron (React + better-sqlite3) se synchronise avec un backend Cloudflare Worker (Hono + D1 + R2 + JWT) via un mécanisme de **réplication LWW (Last-Write-Wins) arbitré par le serveur**.

**Verdict global :** l'architecture de synchronisation est **solide et bien pensée** (miroir `sync_state` des deux côtés, pull-avant-push, SSE en simple trigger, idempotence des écritures, tombstones, authentification scrypt interopérable). En revanche, on relève **plusieurs failles de sécurité corrigibles** (endpoints d'admin/registre ouverts, absence de CSP) et **des divergences de contrat** entre les deux bases (types de montants, entreprise non synchronisée, lignes_documents) qui provoquent des pertes de données silencieuses.

| Indicateur | Valeur |
|---|---|
| Findings critiques | 5 |
| Findings importants | 8 |
| Findings mineurs / hygiène | 6 |
| Tables synchronisables | 15 (alignées des deux côtés ✅) |

---

## 2. Architecture constatée

### 2.1 Côté serveur (`.server-cache`)
- **Runtime :** Cloudflare Worker, Hono v4, `compatibility_flags: ["nodejs_compat"]`
- **Stockage :** D1 (SQLite, binding `DB`) + R2 (images, binding `IMAGES`)
- **Auth :** JWT HS256 (TTL 7 jours), hachage mot de passe scrypt (`lib/auth.ts`)
- **Routes :**
  - `POST /login`, `GET /me`, `POST /register`, `POST /auth/bootstrap-admins`, `GET /auth/needs-bootstrap`
  - `GET /sync-state`, `GET /sync-state/full`, `GET /api/sync/:table/:id`, `GET /journal`
  - `POST/PUT/DELETE /:table[/:id]` (CRUD sync générique)
  - `GET /api/sync/events` (SSE)
  - `GET/PUT/HEAD/DELETE /images/:name` (R2)
  - `/public/*` (site vitrine : collections, articles, login, sync-credentials, link-device)
  - `POST /admin/init`, `GET /admin/status`, `GET /admin/sync-state`

### 2.2 Côté application (`src/`)
- **Runtime :** Electron 41 + React 19 + Vite + better-sqlite3
- **Base locale :** `./notes.sqlite`, ORM maison `simpleorm-sync`
- **Pont IPC :** `preload.ts` via `contextBridge` (bonnes pratiques respectées : `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`)
- **Sync :** `SyncClient` (renderer) orchestre pull/push/SSE, persiste la queue dans `sync_state` local
- **Tables synchronisables (15) :** `administrateurs, clients, collections, sous_collections, articles, devis, factures, lignes_documents, techniciens, projets, taches_projet, boutiques, stocks_boutique, transferts_stock, entreprises`

### 2.3 Flux de synchronisation
```
Client (Electron + SQLite)
  │
  │  pull  GET /sync-state?since=<maxVersionLocal> → inventaire [{table,id,version,deleted}]
  │        GET /api/sync/:table/:id → row canonique (si non-delete)
  │  push  PUT /:table/:id  body={...row, _version, _updatedAt}
  │        → serveur arbitre (arbitrateLWW) → {applied:"client"|"server", currentVersion, data?}
  │  SSE   /api/sync/events → simple trigger debouncé
  ▼
Serveur (Worker + D1) — arbitre unique, sync_state est l'état autoritaire
```

---

## 3. Findings critiques 🔴

### C1 — `POST /register` et `POST /admin/init` exposés sans authentification
- **Fichiers :** `.server-cache/src/index.ts:48`, `.server-cache/src/routes/auth.ts:141`
- **Description :**
  - `POST /register` est **public**. Il crée un compte avec un **rôle `admin` par défaut** (`auth.ts:165`), sans token, sans vérification. N'importe qui peut donc créer un compte admin puis se logger → accès total au sync et aux données.
  - `POST /admin/init` n'apparaît pas dans la liste des routes protégées par `requireAuth` (`index.ts:81-88`). Il force `initDatabase()`. Le bootstrap initial est déjà couvert (et gated) par `/auth/bootstrap-admins`, donc `/admin/init` ne devrait jamais être public.
- **Impact :** création d'un compte administrateur arbitraire sur le serveur de production → compromission totale des données.
- **Recommandation :**
  - Supprimer `/register`, ou le protéger par `requireAuth` + `requireRole('super_admin')`.
  - Ajouter `app.use("/admin/init", requireAuth)` et limiter à `super_admin`.

### C2 — Aucune Content-Security-Policy (CSP) côté Electron
- **Fichiers :** `src/main.ts` (absence de `onHeadersReceived`), `index.html` (pas de meta CSP)
- **Description :** Le renderer charge du HTML arbitraire (rendu devis/factures, éditeur TipTap, génération PDF). Sans CSP, une injection XSS via une donnée métier (nom de client, note de devis, description) peut exécuter du JS et appeler librement `window.auth`, `window.db`, `window.shell` → exfiltration, altération de la base, exécution de commandes.
- **Recommandation :** définir une CSP stricte via `session.defaultSession.webRequest.onHeadersReceived` (voir §7.1). Tester le rendu PDF/TipTap qui peut nécessiter `'unsafe-inline'` pour les styles.

### C3 — `shell.openExternal` non validé (exécution arbitraire)
- **Fichier :** `src/main.ts:890`
- **Description :** `shell:openExternal` est exposé au renderer sans filtrage de protocole. Sur Windows, `shell.openExternal('file:///...')` ou un schéma type `smb:`, `ms-msdt:` peut lancer des exécutables. Combiné à l'absence de CSP (C2), c'est une chaîne d'exploitation crédible.
- **Recommandation :** n'autoriser que `http:`/`https:` (validation par `new URL()`).

### C4 — `openDevTools()` appelé en production
- **Fichier :** `src/main.ts:957`
- **Description :** `mainWindow.webContents.openDevTools()` est exécuté **inconditionnellement**, contredisant `devTools: !app.isPackaged` (l.923). Facilite le reverse-engineering de l'app packagée.
- **Recommandation :** `if (!app.isPackaged) mainWindow.webContents.openDevTools();`

### C5 — JWT_SECRET potentiellement déployé en production
- **Fichier :** `.server-cache/.dev.vars` → `JWT_SECRET=dev-secret-change-me-in-prod-kataleya-local`
- **Description :** Le fichier `.dev.vars` est bien gitignoré, mais le nom "dev-secret" et sa lisibilité laissent craindre un déploiement via `wrangler secret put` avec cette même valeur. Si c'est le cas, **tous les JWT sont forgeables** par quiconque connaît ce secret.
- **Recommandation :**
  1. Vérifier `wrangler secret list` côté prod.
  2. Faire une **rotation** avec une valeur aléatoire de 32+ octets (`openssl rand -hex 32`).
  3. Envisager un TTL JWT plus court (24 h) avec refresh token plutôt que 7 jours.

---

## 4. Findings importants — Alignement contrat sync 🟠

### C6 — Types de montants divergents : INTEGER (client) vs REAL (serveur)
- **Fichiers :** `src/Databases/index.ts` vs `.server-cache/src/models.ts`
- **Description :** Toutes les colonnes monétaires sont `INTEGER` côté client et `REAL` côté serveur :

| Champ | Client | Serveur |
|---|---|---|
| `articles.prixHT / tauxTVA / prixTTC` | `INTEGER` (l.51-53) | `REAL` (l.374-376) |
| `devis.totalHT / totalTVA / totalTTC / remiseGlobale / totalApreRemise` | `INTEGER` (l.518-524) | `REAL` (l.391-397) |
| `factures.*` (+ `montantPayé`, `montantRestant`) | `INTEGER` (l.668-676) | `REAL` (l.417-425) |
| `lignes_documents.*` (prix, montants, remise) | `INTEGER` (l.824-829) | `REAL` (l.447-452) |

- **Impact :** L'affinité `INTEGER` de SQLite **tronque silencieusement** les décimales. Un devis `12345.67` poussé par un poste sera stocké `12345` côté client après pull, puis repoussé tel quel → **dérive financière**. Noter que `db.d.ts:18` documente "FCFA (entier, pas de centimes)" mais le serveur a clairement été conçu pour des décimales (`REAL`).
- **Recommandation :** uniformiser en `REAL` des deux côtés. Les montants monétaires ne doivent jamais être `INTEGER`.

### C7 — `prixTTC` calculé côté client, jamais côté serveur
- **Fichiers :** `src/Databases/index.ts:84,122` (recalculation `prixTTC`) ; serveur `sync.ts` (aucune recalculation)
- **Impact :** Un `PUT` partiel envoyant seulement `prixHT` laisse `prixTTC` obsolète côté serveur, qui sera resynchronisé tel quel aux autres postes. Incohérence entre `prixHT`, `tauxTVA` et `prixTTC`.
- **Recommandation :** recalculer `prixTTC` côté serveur à l'écriture, ou exiger la cohérence triple à l'écriture.

### C8 — `entreprises` jamais synchronisée
- **Fichiers :** `src/context/db_sync.ts:14-29`, `src/preload.ts:204-207`, `src/Databases/index.ts:1655` (`updateEntreprise`)
- **Description :** Triple problème :
  1. `CAMEL_TO_SNAKE` (db_sync.ts) **omet `entreprises`** → `triggerSync()` ne se déclenche pas.
  2. `window.db.entreprises` n'expose que `getById`/`getAll` (pas de create/update/delete).
  3. L'édition passe par `window.companyApi.set` → `updateEntreprise()` qui **n'appelle jamais** `syncState.markDirty("entreprises", "default")`.
- **Impact :** toute modification des paramètres société (logo, TVA par défaut, prefixes, infos) **n'est jamais poussée**. Chaque poste garde une config divergente.
- **Recommandation :** ajouter `markDirty("entreprises", "default")` dans `updateEntreprise()` et `entreprises: 'entreprises'` dans `CAMEL_TO_SNAKE`.

### C9 — `entreprises` est un singleton `id='default'`, fragile au LWW
- **Fichier :** `src/Databases/index.ts:1608`
- **Description :** L'entreprise a toujours `id='default'`. Le `PUT /:table/:id` générique écrase l'unique ligne à chaque écriture (dernier gagne, pas de merge champ-par-champ). Deux postes éditant en parallèle → perte totale des modifs du premier.
- **Recommandation :** soit synchroniser vraiment (avec merge), soit **retirer** `entreprises` de `SYNCABLE_TABLES` pour éviter une fausse impression de sync.

### C10 — `lignes_documents` perd ses timestamps à la sync
- **Fichiers :** `.server-cache/src/models.ts:163-182`, `src/Databases/index.ts:816-833`
- **Description :** Le type serveur `LigneDocument` **n'a pas** `createdAt`/`updatedAt` (contrairement au client qui les déclare `NOT NULL`). Au pull, l'upsert client reçoit une row sans ces colonnes → `INSERT OR REPLACE` tente d'écrire `NULL` dans une colonne `NOT NULL` → échec ou incohérence.
- **Recommandation :** ajouter `createdAt`/`updatedAt` au schéma serveur, ou retirer ces colonnes côté client.

### C11 — Code mort trompeur : `utils/tables.ts`
- **Fichier :** `.server-cache/utils/tables.ts` (≈ 480 lignes)
- **Description :** Définit des types et un `initDatabase` pour `magazines, ebooks, audios, videos, albums, payments, big_hero_slides, payment_methods (PayPal/Monetbil)`. **Rien n'est utilisé** par le serveur réel (qui importe `src/models.ts`). C'est du boilerplate copié d'un autre projet Cloudflare.
- **Risque :** confusion, et import accidentel possible.
- **Recommandation :** supprimer le fichier.

### C12 — `bootstrapIfEmpty` vide la base locale AVANT le pull
- **Fichier :** `src/context/sync_client.ts:398-409`
- **Description :** Au bootstrap, pour chaque table, le client supprime toutes ses lignes locales **puis** tire l'état serveur. Si le pull échoue en cours (réseau coupé, `MAX_ITER=50`), le client se retrouve avec une **base partiellement vidée**. La boutique "Stock principal" seedée localement disparaît si le serveur n'en a pas.
- **Recommandation :** puller d'abord dans une transaction/table tampon, et ne nettoyer qu'après confirmation d'un pull complet.

### C13 — LWW : `_updatedAt` purement informatif
- **Fichier :** `.server-cache/src/routes/sync.ts:113-119`
- **Description :** Quand deux postes modifient la même ligne, le serveur arbitre uniquement sur `_version` ; `_updatedAt` est "tracé dans logs" mais **jamais décisif**. Or la version locale est souvent 0/égale entre postes → la règle se réduit à "dernier qui pousse gagne", sans comparaison temporelle.
- **Recommandation :** activer l'arbitrage sur `_updatedAt` à version égale, ou documenter explicitement le comportement.

---

## 5. Findings importants — Sécurité & robustesse 🟠

### C14 — `auth:login` déclenche un login serveur en fire-and-forget
- **Fichier :** `src/main.ts:149-154`
- **Description :** Après un login **local** réussi, `performSyncLogin` est appelé en "best effort". Si le mot de passe serveur a divergé (admin changé côté serveur, hash local ancien), le login serveur échoue silencieusement (`console.warn`) et **la sync ne démarre pas**. L'utilisateur croit être connecté mais reste offline, sans feedback UI.
- **Recommandation :** remonter l'échec à l'UI (bannière "Sync désactivée — identifiants serveur différents").

### C15 — CORS serveur en `origin: "*"`
- **Fichier :** `.server-cache/src/index.ts:34`
- **Description :** Acceptable pour un client Electron/EventSource, mais les routes `/public/*` deviennent alors **consommables depuis n'importe quel site web**.
- **Recommandation :** restreindre aux domaines du site vitrine prévu.

### C16 — `images:save` non protégé contre le path traversal
- **Fichier :** `src/main.ts:380`
- **Description :** `path.join(imagesDir, filename)` avec `filename` venant du renderer. Les autres handlers (`images:saveBinary`, `images:exists`) appliquent bien `path.basename()`, **mais pas `images:save`**. En l'absence de CSP (C2), un XSS pourrait écrire hors du dossier images via `../../...`.
- **Recommandation :** appliquer `path.basename(filename)` dans `images:save`.

---

## 6. Findings mineurs / hygiène 🟡

### C17 — Fichier `nul` orphelin à la racine
- **Fichier :** `nul` (193 octets), tracké par git (`?? nul`)
- **Description :** Résultat d'une commande `dir /s /b *.ts` Windows redirigée vers `nul` qui a créé un fichier au lieu du device null.
- **Recommandation :** supprimer et ajouter `nul` au `.gitignore`.

### C18 — `ROLE_MATRIX` dupliquée
- **Fichiers :** `src/Databases/auth.ts:119-147` (`PERMISSIONS`) et `src/auth/authProvider.tsx:161-182` (`ROLE_MATRIX`)
- **Description :** Deux copies quasi identiques mais déjà divergentes (`authProvider` ajoute `boutiques:write/delete`, absent de `auth.ts`). Risque de dérive.
- **Recommandation :** source unique (idéalement côté main, exposée via `auth:hasPermission` qui existe déjà).

### C19 — `seedAndMigrateStockPrincipal` crée N boutiques principales
- **Fichier :** `src/Databases/index.ts:1818-1858`
- **Description :** Chaque poste, à son premier lancement, crée sa **propre** boutique "Stock principal" avec un UUID différent. Après sync, vous vous retrouvez avec **autant de boutiques "Stock principal" que de postes**.
- **Recommandation :** centraliser la notion de "boutique principale" côté serveur (un seul `isPrincipal=1`), le client la reçoit au bootstrap.

### C20 — `experimentalFeatures: true` activé
- **Fichier :** `src/main.ts:923`
- **Description :** Active des fonctionnalités Chromium expérimentales. Inutile en production et augmente la surface d'attaque.
- **Recommandation :** retirer sauf justification explicite.

### C21 — Images stockées en Data URL dans `entreprises` (logo)
- **Fichiers :** `entreprises.logoDataUrl` (`db.d.ts:471`)
- **Description :** Le logo d'entreprise est stocké en base64 dans D1/SQLite, donc synchronisé comme une grosse string dans `sync_state`. Pour des logos volumineux, cela alourdit chaque push/pull et occupe D1 (qui a des quotas de ligne). Les images d'articles, elles, passent correctement par R2.
- **Recommandation :** migrer le logo vers R2 (comme les images d'articles) et ne stocker que le basename.

---

## 7. Recommandations détaillées

### 7.1 Correctifs prioritaires (bloquants)

**C1 — Protéger les endpoints d'admin** (`.server-cache/src/index.ts`)
```ts
app.use("/admin/init", requireAuth);        // + check role super_admin dans le handler
app.use("/register", requireAuth);          // ou supprimer la route /register
```
Dans le handler `/admin/init`, vérifier `c.get("userRole") === "super_admin"`.

**C2 — CSP** (`src/main.ts`, avant `createWindow`)
```ts
import { session } from 'electron';
session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
  cb({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " +
        "connect-src 'self' https://*.workers.dev; " +
        "font-src 'self' data:"
      ],
    },
  });
});
```

**C3 — Filtrer `openExternal`** (`src/main.ts:890`)
```ts
ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  } catch { return; }
  return shell.openExternal(url);
});
```

**C4 — DevTools conditionnel** (`src/main.ts:957`)
```ts
if (!app.isPackaged) mainWindow.webContents.openDevTools();
```

**C16 — `images:save` basename** (`src/main.ts:380`)
```ts
const safeName = path.basename(filename);
const filePath = path.join(imagesDir, safeName);
```

### 7.2 Correctifs contrat sync (important)

- **C6 :** passer toutes les colonnes monétaires en `REAL` côté client (migration DDL via `migrations.ts` : SQLite permet l'ajout de colonne REAL + recopie, ou `ALTER TABLE ... RENAME` + recréation).
- **C8 :** ajouter `markDirty("entreprises", "default")` dans `updateEntreprise()` ; ajouter `entreprises: 'entreprises'` à `CAMEL_TO_SNAKE`.
- **C10 :** aligner `lignes_documents` (ajouter `createdAt/updatedAt` serveur ou retirer côté client).
- **C12 :** sécuriser le bootstrap (transaction / nettoyage post-pull).
- **C7, C9, C13 :** décider et documenter la politique LWW + recalcul `prixTTC`.

### 7.3 Hygiène

- **C11 :** supprimer `.server-cache/utils/tables.ts`.
- **C17 :** `git rm --cached nul` + `.gitignore`.
- **C18 :** factoriser `ROLE_MATRIX`.
- **C19 :** centraliser la boutique principale serveur.
- **C20 :** retirer `experimentalFeatures`.
- **C21 :** migrer le logo vers R2.

---

## 8. Plan d'action priorisé

| # | Finding | Gravité | Effort | Risque régression |
|---|---------|---------|--------|-------------------|
| C1 | `/register` + `/admin/init` ouverts | 🔴 Critique | 30 min | Très faible |
| C3 | `shell.openExternal` non filtré | 🔴 Critique | 15 min | Très faible |
| C4 | `openDevTools()` en prod | 🔴 Critique | 1 min | Nul |
| C16 | `images:save` path traversal | 🔴 Critique | 5 min | Très faible |
| C2 | Pas de CSP Electron | 🔴 Critique | 1 h + tests | Moyen (PDF/TipTap) |
| C5 | Rotation JWT_SECRET prod | 🔴 Critique | vérif + rotation | Faible (logout users) |
| C6 | Montants INTEGER vs REAL | 🟠 Important | 1 h + migration | Moyen (migration DB) |
| C8 | `entreprises` non sync | 🟠 Important | 30 min | Faible |
| C10 | `lignes_documents` timestamps | 🟠 Important | 30 min | Faible |
| C11 | `utils/tables.ts` mort | 🟠 Important | 5 min | Nul |
| C12 | Bootstrap destructif | 🟠 Important | 1 h | Moyen |
| C14, C15 | Feedback sync + CORS | 🟠 Important | 1 h | Faible |
| C7, C9, C13 | Cohérence LWW | 🟡 Mineur | — | — |
| C17–C21 | Hygiène | 🟡 Mineur | 1 h total | Nul |

---

## 9. Points forts à conserver ✅

- **Contrat de sync robuste :** miroir `sync_state` des deux côtés, LWW serveur-arbitre, pull-avant-push debouncé, écritures idempotentes, tombstones de suppression.
- **Séparation sync data (D1) vs images (R2)** avec queue dédiée et retry (5 essais).
- **Auth scrypt interopérable** client/serveur (format `scrypt$N$salt$hash` identique, paramètres alignés documentés `lib/auth.ts:6-7`).
- **Electron fuses** correctement configurés (`forge.config.ts:59-67`) : `RunAsNode: false`, `EnableNodeOptionsEnvironmentVariable: false`, asar integrity, `OnlyLoadAppFromAsar`.
- **Bonnes pratiques de base Electron :** `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`.
- **Migrations versionnées** côté client (`migrations.ts`) avec table `_db_schema_version` et transactions.
- **Seed rétroactif** de `sync_state` pour les postes existants (`index.ts:2099`), idempotent.
- **Pagination** sur le pull (`limit` + `hasMore`), garde-fou `MAX_ITER=50` contre les boucles infinies.

---

*Fin du rapport. Pour exécuter les correctifs prioritaires (C1, C3, C4, C16) — qui sont rapides et à faible risque — je peux les appliquer immédiatement sur validation.*
