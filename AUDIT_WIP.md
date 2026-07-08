# Audit — Travail en cours (changements non commités)

**Date :** 2026-07-07
**Périmètre :** `git diff` non commité au moment de l'audit — `package.json`, `src/components/titlebar.tsx`, `src/context/databaseApi.ts`, `src/context/sync_client.ts`, `src/libs/devis_pdf.ts`, `src/main.ts`, `src/pages/facture_new.tsx`, `src/pages/settings.tsx`, `src/pages/sync_progress.tsx`, `src/preload.ts`, + fichiers non trackés `src/assets/Kataleya_titre.png`, `src/global.d.ts`.
**Méthode :** revue ligne à ligne du diff complet, vérification croisée des points d'entrée IPC (main ↔ preload ↔ renderer).
**Convention :** ce fichier est un complément à `AUDIT_RAPPORT.md` (audit serveur↔app du 2026-06-27, findings `C1`–`C21`). Les findings ci-dessous sont préfixés `W` (Work-in-progress) pour éviter toute collision d'ID. À cocher au fur et à mesure des corrections.

| Indicateur | Valeur |
|---|---|
| Findings critiques | 3 |
| Findings majeurs | 3 |
| Findings mineurs | 3 |

---

## 1. Findings critiques 🔴

### W1 — Le bootstrap de sync ne s'exécute plus après connexion
- [x] Corrigé
- **Fichiers :** `src/pages/settings.tsx:1413-1416`, `src/context/sync_client.ts:195-211`, `src/context/sync_client.ts:373-378`
- **Description :** `doLogin()` appelle désormais `syncClient.bootstrapIfEmpty(role).then(() => syncClient.start())` (ordre inversé par rapport à avant : `start().then(() => bootstrapIfEmpty(role))`). Or `bootstrapIfEmpty()` retourne immédiatement si `this.status.enabled` est `false` (`sync_client.ts:375-378`), et ce flag n'est mis à `true` que **dans** `start()` (`sync_client.ts:202`). Résultat : au premier login sur un appareil neuf, `bootstrapIfEmpty` sort en `console.warn` sans rien faire, et tout le nouveau mécanisme de pagination par curseur (`(version, table, id)`, vérification via `/admin/status`) ne se déclenche jamais.
- **Impact :** un nouvel appareil lié au sync ne reçoit jamais le snapshot initial des données serveur. Régression sur une fonctionnalité cœur (première synchronisation).
- **Recommandation :** remettre l'ordre `start()` puis `bootstrapIfEmpty(role)`, ou faire en sorte que `bootstrapIfEmpty` ne dépende pas de `status.enabled` (ex: vérifier directement `window.syncApi.getConfig()`).

### W2 — `entreprises:update` renvoie `true` au lieu de l'entreprise mise à jour
- [x] Corrigé
- **Fichiers :** `src/main.ts:672-682`, `src/pages/settings.tsx:699-704`
- **Description :** le handler IPC calcule `row` (l'entreprise à jour via `updateEntreprise(data)`) mais fait `return true` au lieu de `return row`. Côté renderer, `handleSave()` fait `const next = await window.db.entreprises.update(form); setDevisCompanyInfo(next); setFactureCompanyInfo(next)` — avec `next === true`, le spread `{...COMPANY, ...true}` est un no-op : l'état en mémoire utilisé pour générer les PDF (logo, nom, matricule, notes...) n'est plus rafraîchi après sauvegarde (il faut redémarrer l'app). De plus le `catch (e) { console.log(e) }` ne renvoie rien : en cas d'échec, l'appelant reçoit `undefined` silencieusement, sans moyen de détecter l'erreur.
- **Impact :** modifications des infos société (logo, coordonnées) invisibles sur les PDF générés dans la même session. Erreurs de sauvegarde invisibles pour l'utilisateur.
- **Recommandation :** `return row` (ou `{ ok: true, data: row }` si on veut un contrat homogène) ; propager l'erreur au lieu de l'avaler (`return { ok: false, error: String(e) }` + adapter le renderer). Le handler existant `company:set` (`main.ts:649-659`) fait déjà ça correctement — s'en inspirer plutôt que dupliquer un nouveau canal.
- **Suivi :** à la demande de l'utilisateur, `company:get`/`company:set` (et `window.companyApi`) ont été **retirés** — toutes les infos entreprise passent désormais uniquement par `entreprises:get`/`entreprises:update` (`window.db.entreprises`). Handler `entreprises:get` ajouté dans `main.ts` (reprend la logique de fallback/migration de l'ancien `company:get`). Tous les appels renderer (`app/index.tsx`, `titlebar.tsx`, `company_setup.tsx`, `settings.tsx` ×2 sections, `facture_new.tsx`, `devis_new.tsx`) migrés vers `window.db.entreprises.get()`/`.update()`. Types `CompanyApi`/`companyApi` retirés de `global.d.ts` et `databaseApi.ts`.

### W3 — Suppression du garde-fou anti-blocage sur l'écran de sync
- [x] Corrigé
- **Fichiers :** `src/pages/sync_progress.tsx`
- **Description :** le timeout de 60s (`timedOut`) et le bouton d'échappatoire « Continuer quand même » ont été retirés, en même temps que le bootstrap devient une boucle quasi illimitée côté `sync_client.ts` (jusqu'à 100 000 pages/table, contre `MAX_ITER=50` avant).
- **Impact :** si le serveur est lent, en erreur intermittente, ou le dataset volumineux, l'utilisateur reste bloqué sur l'écran de sync sans aucun moyen de continuer.
- **Recommandation :** réintroduire un timeout + échappatoire (ou au minimum un moyen d'annuler/continuer), adapté à la durée potentiellement plus longue du nouveau bootstrap paginé.
- **Suivi :** remplacé le timeout fixe (60s sur la durée totale) par un timeout d'**inactivité** (`INACTIVITY_TIMEOUT_MS = 20000`) — plus adapté au bootstrap paginé qui peut légitimement prendre longtemps tant qu'il progresse (jusqu'à 100 000 pages/table). `lastActivityRef` est mis à jour à chaque callback `syncClient.subscribe`, et un `setInterval` vérifie toutes les 2s si 20s se sont écoulées sans la moindre mise à jour de statut ; le cas échéant, le bouton « Continuer quand même » réapparaît. Les `console.log` de debug (`sync_state`, `sync_state done`) dans le même callback ont aussi été supprimés au passage (recoupe W7).

---

## 2. Findings majeurs 🟠

### W4 — Logo base64 (~958 Ko) codé en dur dans `devis_pdf.ts`
- [x] Corrigé
- **Fichiers :** `src/libs/devis_pdf.ts:25,32-33`, `src/assets/Kataleya_titre.png` (non tracké, non référencé)
- **Description :** `COMPANY.logoDataUrl` par défaut est une chaîne base64 d'environ 958 000 caractères embarquée directement dans le `.ts`, avec en plus `matricule: "CM-DLA-02-2025-B13-00975"` en dur (infos de la société Kataleya elle-même utilisées comme fallback). Le nouveau fichier `src/assets/Kataleya_titre.png` (718 Ko) a été ajouté mais n'est importé/utilisé nulle part dans le code.
- **Impact :** fichier source de ~950 Ko difficile à revoir/differ, gonflement du bundle. Le fichier asset ajouté est mort.
- **Recommandation :** remplacer par `import logoUrl from '../assets/Kataleya_titre.png'` (laisser le bundler gérer l'asset), ou charger dynamiquement le logo par défaut depuis un fichier statique plutôt qu'une constante inline.
- **Suivi :** en comparant avec `src/libs/facture_pdf.ts` (non touché par le diff), qui utilise déjà un `COMPANY` par défaut générique et inoffensif (`nom: 'Kataleya'`, `adresse: 'Douala, Cameroun'`, `logoDataUrl: ''`), il s'est avéré que le vrai problème n'était pas seulement la taille du fichier mais le **contenu** : `devis_pdf.ts` embarquait le vrai logo et le vrai matricule d'une entreprise cliente réelle comme valeur par défaut codée en dur, alors que ces informations doivent transiter exclusivement par `entreprises:get()` → `setDevisCompanyInfo()` (cf. consolidation W2). La ligne `default` de la table `entreprises` est seedée vide à l'installation (`Databases/index.ts:1622-1646`), donc ce fallback ne devait de toute façon jamais contenir de vraies données de production. Correction : suppression de la constante `logo` (base64) et alignement de `COMPANY` sur les mêmes valeurs génériques que `facture_pdf.ts` (`logoDataUrl: ''`, `matricule: ''`, nom/adresse/téléphone placeholders). Fichier `src/assets/Kataleya_titre.png` (mort, non référencé) supprimé.

### W5 — Duplication complète des types `Window` entre deux fichiers
- [x] Corrigé
- **Fichiers :** `src/context/databaseApi.ts:7-320`, `src/global.d.ts` (nouveau)
- **Description :** `databaseApi.ts` contient désormais ~300 lignes de types (`DbApi`, `AuthApi`, `SyncApi`, `declare global { interface Window {...} }`...) qui sont une copie quasi exacte du nouveau `src/global.d.ts` — y compris le commentaire « à placer à la racine du renderer (ex: src/types/global.d.ts) » resté dans le mauvais fichier. Les deux copies divergent déjà : le `CompanyInfo` exporté en bas de `databaseApi.ts` (ligne 337) a perdu le champ `matricule` présent dans la copie de `global.d.ts`.
- **Impact :** maintenance à double, risque de divergence silencieuse des types (déjà constaté), confusion pour la suite.
- **Recommandation :** supprimer le bloc de types dupliqué dans `databaseApi.ts` (garder uniquement `export const db = window.db` + les types exportés type `CompanyInfo`/`CustomField` réellement utilisés ailleurs), et ne garder qu'une seule source de vérité dans `src/global.d.ts`.
- **Suivi :** vérifié par grep qu'aucun fichier du projet n'importe quoi que ce soit depuis `databaseApi.ts` (`CompanyInfo`/`CustomField`/`SyncConfigShape` exportés n'étaient utilisés nulle part — chaque appelant a sa propre définition locale). Le fichier a donc été réduit à son seul usage réel : `export const db = window.db` (+ le commentaire d'utilisation), tout le bloc de types/interfaces dupliqué (`DbApi`, `AuthApi`, `SyncApi`, `declare global { interface Window {...} }`, `CompanyInfo`, etc.) a été supprimé. `src/global.d.ts` reste l'unique source de vérité pour le typage de `window.*`.

### W6 — Perte du scroll personnalisé sur `facture_new.tsx`
- [x] Corrigé
- **Fichiers :** `src/pages/facture_new.tsx:212`
- **Description :** l'attribut `data-os-scroll` a été retiré du conteneur principal scrollable. Il est utilisé dans 21 autres fichiers (`src/libs/scrollbars.ts` + toutes les pages/layouts) pour la scrollbar custom de l'app.
- **Impact :** régression visuelle probable, isolée à cette page (retour à la scrollbar native du navigateur, incohérente avec le reste de l'app).
- **Recommandation :** remettre `data-os-scroll` sauf si le retrait est volontaire (à confirmer).
- **Suivi :** retrait confirmé volontaire par l'utilisateur — `data-os-scroll` cassait React avec une erreur `insertBefore`/`removeChild` qui bloquait la lecture de l'app. Cause racine : l'ancien mécanisme (`src/libs/scrollbars.ts`, `MutationObserver` global appelant l'API impérative brute `OverlayScrollbars(el, options)`) restructure physiquement le DOM en déplaçant les enfants de l'élément cible dans des wrappers internes (`.os-viewport`/`.os-content`) — mais ces enfants sont aussi gérés/rendus par React, qui ignore ce déplacement et plante dès qu'il tente de les manipuler (ajout/suppression de lignes de liste, démontage, etc.). Un premier essai non branché (`src/components/scrollable.tsx`) avait le même défaut (juste un `destroy()` au démontage, ne résout pas le conflit pendant que le composant reste monté).
  Solution retenue : composant `src/components/scroll_area.tsx` (`ScrollArea`) basé sur `overlayscrollbars-react` (`OverlayScrollbarsComponent`, déjà en dépendance mais inutilisé), qui gère lui-même sa structure DOM interne via React — pas de déplacement de nœuds que React ne connaît pas. Remplacé tous les `<div data-os-scroll>`/`<aside data-os-scroll>` (36 occurrences, 20 fichiers) par `<ScrollArea>` (`as="aside"` pour le cas `<aside>`), réintroduit sur `facture_new.tsx`, supprimé `src/libs/scrollbars.ts` + son appel dans `src/app/index.tsx` + le composant mort `src/components/scrollable.tsx`. Vérifié : zéro `data-os-scroll` restant, comptage ouverture/fermeture `ScrollArea` cohérent par fichier, eslint sans nouvelle erreur.

---

## 3. Findings mineurs 🟡

### W7 — Logs de debug oubliés
- [ ] Corrigé
- **Fichiers et lignes :**
  - `src/components/titlebar.tsx:207` — `console.log('user', user)`
  - `src/main.ts:673,677,680` — `console.log(data)`, `console.log(row)`, `console.log(e)`
  - `src/pages/settings.tsx:693` — `console.log(String(reader.result))` (log le logo entier en base64 à chaque upload)
  - `src/pages/sync_progress.tsx:47,50` — `console.log("sync_state ", s)` à chaque tick de progression + `console.log("sync_state done")`
- **Recommandation :** nettoyer avant commit/release.

### W8 — `package.json` sans retour à la ligne final
- [ ] Corrigé
- **Fichiers :** `package.json`
- **Description :** diff montre `\ No newline at end of file`. Script `local:build` ajouté (`electron-forge make --platform=win32 --arch=x64`) — vérifier cohérence avec la CI existante si applicable.
- **Recommandation :** rétablir le retour à la ligne final (config editorconfig/prettier).

### W9 — Reformattage Prettier pur mélangé au diff fonctionnel
- [ ] Corrigé
- **Fichiers :** `src/components/titlebar.tsx` (réindentation ternaire `Phase`), `src/pages/sync_progress.tsx` (réindentation classes conditionnelles)
- **Description :** changements d'indentation sans effet fonctionnel qui gonflent le diff et compliquent la revue.
- **Recommandation :** si un formatter tourne automatiquement, faire un commit séparé « formatting only » pour garder les diffs fonctionnels lisibles.

---

## 4. Plan d'action priorisé

| # | Finding | Gravité | Effort | Risque régression |
|---|---------|---------|--------|-------------------|
| W1 | Bootstrap sync jamais déclenché (ordre inversé) | 🔴 Critique | 5 min | Très faible |
| W2 | `entreprises:update` renvoie `true` au lieu des données | 🔴 Critique | 15 min | Faible |
| W3 | Écran de sync sans échappatoire | 🔴 Critique | 30 min | Faible |
| W4 | Logo base64 en dur dans `devis_pdf.ts` | 🟠 Majeur | 20 min | Faible |
| W6 | `data-os-scroll` manquant sur facture_new | 🟠 Majeur | 2 min | Nul |
| W5 | Types `Window` dupliqués | 🟠 Majeur | 30 min | Faible |
| W7 | Logs de debug | 🟡 Mineur | 5 min | Nul |
| W8 | `package.json` newline finale | 🟡 Mineur | 1 min | Nul |
| W9 | Bruit de reformattage | 🟡 Mineur | — | Nul |

---

*Rapport à mettre à jour au fur et à mesure des corrections (cocher les cases ci-dessus).*
