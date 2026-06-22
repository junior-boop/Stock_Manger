# Refonte de la synchronisation Kataleya

Architecture cible : **A+B hybride**, serveur prioritaire, résolution de conflits par **LWW** (Last-Write-Wins sur `updatedAt`).

Cette refonte remplace le modèle journal-pull-then-fetch actuel par une table `sync_state` partagée serveur↔postes qui sert d'index de version par ligne métier.

---

## Phase 1 — Fondation serveur

> Objectif : créer la table `sync_state` et la peupler avec l'existant sans rien casser.

### 1.1 Créer la table `sync_state` côté D1

**Fichier** : schéma D1 serveur (migration auto au démarrage).

**Schéma** :
```sql
CREATE TABLE IF NOT EXISTS sync_state (
  table_name TEXT NOT NULL,
  element_id TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updatedAt  TEXT NOT NULL,
  updatedBy  TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (table_name, element_id)
);
CREATE INDEX IF NOT EXISTS idx_sync_state_version ON sync_state(version);
CREATE INDEX IF NOT EXISTS idx_sync_state_table ON sync_state(table_name);
```

**Procédé** :
1. Ajouter le `CREATE TABLE` dans le runner de migrations idempotentes du serveur (même endroit que les autres tables).
2. Vérifier que la migration tourne au cold-start du Worker.
3. Tester en local : relancer 2× → aucune erreur, table créée une seule fois.

### 1.2 Seed rétroactif des données existantes

**Procédé** :
1. Détecter si `sync_state` est vide : `SELECT COUNT(*) FROM sync_state`.
2. Si vide ET au moins une table métier non vide → lancer le seed.
3. Pour chaque table syncable (`articles, clients, collections, sous_collections, devis, factures, lignes_documents, administrateurs, techniciens, projets, taches_projet, boutiques, stocks_boutique, transferts_stock`) :
   ```sql
   INSERT INTO sync_state (table_name, element_id, version, updatedAt, updatedBy, deleted)
   SELECT '<table>', id, 1,
          COALESCE(updatedAt, createdAt, datetime('now')),
          'bootstrap', 0
   FROM <table>
   WHERE NOT EXISTS (
     SELECT 1 FROM sync_state s
     WHERE s.table_name = '<table>' AND s.element_id = <table>.id
   );
   ```
4. Logger le nombre de lignes seedées par table.

**Idempotence** : `WHERE NOT EXISTS` garantit qu'un re-run ne duplique rien.

### 1.3 Hook automatique sur les écritures existantes

**Fichier** : [.server-cache/src/routes/sync.ts](.server-cache/src/routes/sync.ts)

**Procédé** :
1. Dans `POST /:table` (ligne 108), après le `upsert`/`update` réussi :
   - `UPSERT sync_state(table, id) SET version = version + 1, updatedAt = body.updatedAt, updatedBy = clientId, deleted = 0`.
2. Dans `PUT /:table/:id` (ligne 137) : idem.
3. Dans `DELETE /:table/:id` (ligne 170) : `UPDATE sync_state SET version = version + 1, deleted = 1, updatedAt = now, updatedBy = clientId`.
4. Encapsuler dans une transaction si possible (sinon ordre strict : métier puis sync_state).

---

## Phase 2 — Endpoints serveur

> Objectif : exposer `sync_state` aux postes et préparer la résolution LWW.

### 2.1 `GET /sync-state?since=<version>`

**Fichier** : [.server-cache/src/routes/sync.ts](.server-cache/src/routes/sync.ts)

**Procédé** :
1. Route protégée par auth (Bearer token comme les autres).
2. Query : `since` (default 0), `limit` (default 1000, max 5000).
3. Requête :
   ```sql
   SELECT table_name, element_id, version, updatedAt, updatedBy, deleted
   FROM sync_state
   WHERE version > ?
   ORDER BY version ASC
   LIMIT ?
   ```
4. Réponse : `{ items: [...], maxVersion, hasMore, serverTime }`.
5. **Pas de filtre `client_id`** — chaque poste reçoit tout ce qui a bougé.

### 2.2 `GET /sync-state/full?table=<name>&since=<version>`

**Procédé** :
1. Pour le bootstrap initial : éviter N round-trips.
2. JOIN `sync_state` + table métier :
   ```sql
   SELECT s.version, s.deleted, t.*
   FROM sync_state s
   JOIN <table> t ON t.id = s.element_id
   WHERE s.table_name = ? AND s.version > ?
   ORDER BY s.version ASC
   LIMIT 500
   ```
3. Pagination par version (`hasMore` + `maxVersion` dans la réponse).
4. Le poste appelle 1× par table au lieu de N× par ligne.

### 2.3 LWW dans `POST/PUT /:table/:id`

**Procédé** :
1. Accepter `_version` et `_updatedAt` dans le body (champs préfixés pour éviter collision métier).
2. Lire la version actuelle dans `sync_state`.
3. Cas :
   - `currentVersion == _version` ou ligne inexistante → accepter, bumper.
   - `currentVersion > _version` ET `_updatedAt > server.updatedAt` → client gagne (LWW), écraser + bumper.
   - `currentVersion > _version` ET `_updatedAt <= server.updatedAt` → serveur gagne, **ne pas écrire**.
4. Réponse enrichie :
   ```json
   {
     "ok": true,
     "applied": "server" | "client",
     "currentVersion": 8,
     "data": { ...état canonique post-arbitrage }
   }
   ```
5. Le client utilise `data` pour réaligner sa copie locale si `applied === "server"`.

---

## Phase 3 — Schéma local (SQLite renderer)

> Objectif : miroir d'index côté poste pour tracker version connue + dirty bit.

### 3.1 Table `sync_state` locale

**Fichier** : [src/Databases/index.ts](src/Databases/index.ts)

**Schéma** :
```sql
CREATE TABLE IF NOT EXISTS sync_state (
  table_name    TEXT NOT NULL,
  element_id    TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 0,  -- version serveur connue
  localVersion  INTEGER NOT NULL DEFAULT 0,  -- bumpée à chaque mutation locale
  dirty         INTEGER NOT NULL DEFAULT 0,  -- 1 = à pusher
  deleted       INTEGER NOT NULL DEFAULT 0,
  lastPulledAt  TEXT,
  lastPushedAt  TEXT,
  PRIMARY KEY (table_name, element_id)
);
CREATE INDEX IF NOT EXISTS idx_local_sync_dirty ON sync_state(dirty) WHERE dirty = 1;
```

**Procédé** :
1. Ajouter dans la fonction de migration auto existante (pattern Kataleya).
2. Idempotent via `IF NOT EXISTS`.

### 3.2 Helpers ORM `syncState`

**Fichier** : [src/Databases/index.ts](src/Databases/index.ts)

**API** :
- `syncState.maxVersion()` → `number` (max colonne `version`).
- `syncState.getDirty()` → liste des lignes `WHERE dirty = 1` ordonnée par `lastPushedAt NULLS FIRST`.
- `syncState.markDirty(table, id)` → upsert : `localVersion++`, `dirty=1`.
- `syncState.markClean(table, id, version)` → `dirty=0`, `version=?`, `lastPushedAt=now`.
- `syncState.applyRemote(entry)` → upsert depuis pull : `version=?`, `deleted=?`, `lastPulledAt=now`. **Ne touche pas à `dirty`** (si dirty=1 et serveur plus récent → conflit géré au push suivant).
- `syncState.get(table, id)` → ligne ou `null`.

### 3.3 Hook sur les mutations locales

**Fichier** : [src/Databases/index.ts](src/Databases/index.ts) (wrappers articles, clients, devis…)

**Procédé** :
1. Dans chaque `create(data)` : après insert, appeler `syncState.markDirty(table, data.id)`.
2. Dans chaque `update(id, patch)` : après update, idem.
3. Dans chaque `delete(id)` : marker dirty + `deleted=1` dans sync_state.
4. **Critique** : exclure les écritures issues de la sync elle-même (sinon boucle infinie). Ajouter un flag `{ fromSync: true }` au contexte d'appel.

---

## Phase 4 — Refonte `SyncClient`

> Objectif : remplacer le flux journal par le flux sync_state.

**Fichier** : [src/context/sync_client.ts](src/context/sync_client.ts)

### 4.1 Nouveau `pullRemoteChanges()`

**Procédé** :
1. Lire `maxVersionLocal = await db.syncState.maxVersion()`.
2. `GET /sync-state?since=<maxVersionLocal>&limit=1000`.
3. Pour chaque entrée :
   - Lire `local = await db.syncState.get(table, id)`.
   - Si `entry.version > (local?.version ?? 0)` :
     - Si `entry.deleted === 1` → supprimer la ligne métier locale + `applyRemote(entry)`.
     - Sinon → `GET /api/sync/:table/:id` → upsert métier (avec `fromSync: true`) + `applyRemote(entry)`.
4. Si `hasMore` → boucler avec le nouveau `since`.
5. Log : `[sync] pull → N entrée(s) appliquées, M ignorées`.

### 4.2 Bootstrap initial

**Procédé** :
1. Au `start()`, vérifier si `sync_state` local est vide.
2. Si vide :
   - Pour chaque table syncable : `GET /sync-state/full?table=X&since=0`.
   - Boucler la pagination jusqu'à `hasMore=false`.
   - Upsert massif (transaction par batch de 100).
3. Remplace l'actuel `bootstrapIfEmpty(role)` — plus de restriction par rôle, le serveur arbitre.

### 4.3 Nouveau `pushNow()` / `pullThenPush()`

**Procédé** :
1. `pullRemoteChanges()` d'abord (pour réduire les conflits).
2. `dirty = await db.syncState.getDirty()`.
3. Pour chaque ligne dirty :
   - Lire la donnée métier complète localement.
   - `PUT /:table/:id` avec body = `{ ...data, _version: local.version, _updatedAt: data.updatedAt }`.
   - Selon `applied` dans la réponse :
     - `"client"` → `syncState.markClean(table, id, response.currentVersion)`.
     - `"server"` → upsert métier avec `response.data` (fromSync) + `markClean(table, id, response.currentVersion)` + toast `"Modification écrasée par le serveur"`.
4. Gérer les erreurs réseau : laisser `dirty=1`, retry au prochain tick.

### 4.4 SSE → trigger seulement

**Procédé** :
1. Conserver l'abonnement SSE actuel sur `/api/sync/events`.
2. À chaque event reçu : appeler `requestSync()` (déjà debouncé).
3. Supprimer toute logique d'application directe depuis SSE — `sync_state` reste la source.

---

## Phase 5 — Migration côté postes

> Objectif : que les postes déjà installés avec des données locales fusionnent proprement avec le serveur.

### 5.1 Seed local au premier lancement post-update

**Procédé** :
1. Détecter : `sync_state` local vide ET au moins une table métier non vide.
2. Pour chaque ligne métier locale existante :
   - `INSERT INTO sync_state (table_name, element_id, version, localVersion, dirty) VALUES (?, ?, 0, 1, 1)`.
3. Conséquence : au premier sync, le poste va `pull` (rattrape serveur) puis `push` ses modifs locales en LWW.
4. Les doublons éventuels sont arbitrés par le serveur.

### 5.2 Validation post-bootstrap

**Procédé** :
1. Après le premier sync complet, comparer `COUNT(*)` local vs `maxVersion` distincts serveur.
2. Logger `[sync] bootstrap done — local=X rows, server=Y versions`.
3. Si divergence > 10% → alerter dans la console (debug).

---

## Phase 6 — Nettoyage

> Objectif : retirer le code legacy une fois la nouvelle sync stable.

**Procédé** :
1. Supprimer le filtre `client_id != ?` dans `GET /journal` ([.server-cache/src/routes/sync.ts:76](.server-cache/src/routes/sync.ts#L76)).
2. Marquer `pullRemoteChanges` legacy (ou supprimer) dans [src/context/sync_client.ts](src/context/sync_client.ts).
3. Réduire `sync_journal` au rôle d'**audit log** (plus consulté pour le pull primaire).
4. Documenter le nouveau flux en commentaire d'en-tête dans [src/context/sync_client.ts](src/context/sync_client.ts) et [.server-cache/src/routes/sync.ts](.server-cache/src/routes/sync.ts).
5. Mettre à jour [PUBLIC_API.md](PUBLIC_API.md) avec les nouveaux endpoints.

---

## Ordre recommandé & jalons de validation

| Étape | Action | Test de validation |
|---|---|---|
| 1 | Phase 1.1 + 1.2 | `SELECT COUNT(*) FROM sync_state` > 0 sur serveur seedé |
| 2 | Phase 1.3 | Une écriture via `POST /:table` bumpe `sync_state.version` |
| 3 | Phase 2.1 + 2.2 | `curl /sync-state?since=0` renvoie l'inventaire complet |
| 4 | Phase 2.3 | Push avec `_version` obsolète → réponse `applied: "server"` |
| 5 | Phase 3 | DB locale a la table + helpers ; une mutation locale crée une ligne `dirty=1` |
| 6 | Phase 4.1 + 4.2 | Nouveau poste (DB vide) reçoit tout l'inventaire serveur |
| 7 | Phase 4.3 | Modif offline → reconnexion → push réussi, `dirty=0` |
| 8 | Phase 4.4 | SSE déclenche bien un `requestSync()`, plus d'application directe |
| 9 | Phase 5 | Poste existant avec données locales fusionne sans perte |
| 10 | Phase 6 | Code legacy supprimé, build vert, sync fonctionnelle 48h |

---

## Notes architecturales

- **Serveur = arbitre unique** : aucun poste ne décide d'un conflit, seul le serveur tranche via LWW.
- **`sync_state` ≠ `sync_journal`** : `sync_state` est l'**état actuel** par ligne (1 row par entité), `sync_journal` reste un historique append-only (audit).
- **Pas de dépendance au `client_id`** dans le flux pull → le bug `pull → 0 entrée(s)` actuel disparaît dès la Phase 2.
- **Idempotence partout** : migrations, seeds, pushs, pulls peuvent être rejoués sans corruption.
