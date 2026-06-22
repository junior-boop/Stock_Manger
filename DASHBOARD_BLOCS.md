# Dashboard — Page d'accueil

Plan des 4 blocs pour la page `/` (HomePage).

---

## Bloc 1 — KPIs du mois ✅ (implémenté)

Vue d'ensemble chiffrée de l'activité du mois en cours.

**Contenu :**
- En-tête : mois courant (FR) + salutation prénom utilisateur
- 4 cartes KPI principales :
  - **CA encaissé** — somme des paiements reçus ce mois (+ tendance vs mois précédent)
  - **CA facturé** — somme des factures émises ce mois (+ tendance)
  - **Reste à encaisser** — total `montantRestant` des factures actives + nombre de factures en attente
  - **Stock total** — somme `stockTotal` articles + nombre d'articles au catalogue
- 3 mini-stats : compteurs Clients / Devis / Factures

**Sources :** `useDatabase()` — pur calcul mémoire, exclusion `brouillon` et `annulée`.

**Fichier :** [src/pages/home.tsx](src/pages/home.tsx)

---

## Bloc 2 — To-Do listes

Listes actionnables pour ne rien oublier.

**Contenu :**
- **Factures en retard** — `dateEcheance < aujourd'hui` et `montantRestant > 0`, triées par ancienneté, clic → `/factures/:id`
- **Devis sans réponse** — statut `envoyé` depuis plus de N jours, clic → `/devis/:id`
- **Tâches projet `à_faire`** — tâches ouvertes sur projets actifs, clic → `/projets/:id`

**Layout :** 3 colonnes (responsive), chaque colonne = card avec titre + compteur + liste compacte (5 max + lien "voir tout").

**Sources :** `useDatabase()` (factures, devis, projets).

---

## Bloc 3 — Flux d'activité ✅ (implémenté)

Fil chronologique des 10 derniers événements pour avoir le pouls de l'activité.

**Contenu :**
Événements unifiés et datés :
- Facture émise / payée / annulée
- Devis créé / envoyé / converti
- Paiement enregistré (avec montant + qui a perçu)
- Article ajouté / stock modifié
- Client créé

Chaque ligne : icône typée + libellé court + acteur (admin) + temps relatif ("il y a 2 h").

**Layout :** card pleine largeur, liste verticale, lien sur l'entité concernée.

**Sources :** agrégation `createdAt`/`updatedAt` + `paiements[].date` côté front, tri desc, slice 10.

---

## Bloc 4 — Graphique CA mensuel ✅ (implémenté)

Courbe simple du chiffre d'affaires sur les 6 derniers mois.

**Contenu :**
- Axe X : 6 derniers mois (libellés courts FR : "janv.", "févr."…)
- Axe Y : montant en FCFA
- Deux séries possibles : CA encaissé (trait plein) + CA facturé (trait pointillé)
- Tooltip au survol avec montant exact

**Layout :** card pleine largeur, hauteur fixe (~240 px), SVG inline (pas de lib externe).

**Sources :** `factures` + `paiements[]`, agrégation par mois côté front.

---

## Ordre d'implémentation

1. ✅ Bloc 1 — KPIs
2. ⏳ Bloc 2 — To-Do listes
3. ⏳ Bloc 3 — Flux d'activité
4. ⏳ Bloc 4 — Graphique CA

## Conventions DA respectées

- Fond page : `bg-slate-50`
- Cards : `bg-white border border-slate-100 rounded-2xl`
- Icônes Fluent dans tuiles tintées (`bg-emerald-50`, `bg-sky-50`, `bg-amber-50`, `bg-slate-100`)
- Valeurs numériques en `tabular-nums`
- Format FCFA via `formatFCFA()` de [src/libs/format.ts](src/libs/format.ts)
- Format dates / nombres en locale `fr-FR`
- Loader : `SvgSpinners180RingWithBg`
