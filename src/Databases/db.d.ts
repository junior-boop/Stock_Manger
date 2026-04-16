// ============================================================
//  database.d.ts
//  Types de base de données — Boutique de Meubles
//  Genius of Digital
// ============================================================

// ─────────────────────────────────────────────
//  PRIMITIVES & UTILITAIRES
// ─────────────────────────────────────────────

/** Identifiant unique (UUID v4 ou clé métier) */
export type ID = string

/** Timestamp ISO 8601 : "2025-04-15T10:30:00.000Z" */
export type ISODateString = string

/** Montant monétaire en FCFA (nombre entier, pas de centimes) */
export type MontantFCFA = number

/** URL d'une image ou d'un fichier */
export type URLString = string

/** Statut générique activé / désactivé */
export type StatutActif = 'actif' | 'inactif' | 'archivé'


// ─────────────────────────────────────────────
//  ADRESSE
// ─────────────────────────────────────────────

export interface Adresse {
  rue        : string
  ville      : string
  quartier  ?: string
  pays       : string
  codePostal?: string
}


// ─────────────────────────────────────────────
//  ADMINISTRATEUR
// ─────────────────────────────────────────────

export type RoleAdmin = 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur'

export interface Administrateur {
  id          : ID
  nom         : string
  prenom      : string
  email       : string
  telephone  ?: string
  role        : RoleAdmin
  motDePasseHash: string        // Stocké hashé, jamais en clair
  avatar     ?: URLString
  statut      : StatutActif
  createdAt   : ISODateString
  updatedAt   : ISODateString
  derniereConnexion?: ISODateString
}


// ─────────────────────────────────────────────
//  CLIENT
// ─────────────────────────────────────────────

export type TypeClient = 'particulier' | 'entreprise'

export interface Client {
  id           : ID
  type         : TypeClient
  nom          : string
  prenom      ?: string            // Optionnel pour les entreprises
  raisonSociale?: string           // Uniquement pour les entreprises
  email        : string
  telephone    : string
  telephone2  ?: string
  adresse      : Adresse
  statut       : StatutActif
  notes       ?: string
  createdAt    : ISODateString
  updatedAt    : ISODateString
  createdBy    : ID                // Réf. Administrateur
}


// ─────────────────────────────────────────────
//  CATALOGUE : COLLECTION → SOUS-COLLECTION → ARTICLE
// ─────────────────────────────────────────────

/**
 * Collection principale (ex : "Salon", "Chambre", "Bureau")
 */
export interface Collection {
  id          : ID
  nom         : string
  description?: string
  ordre      ?: number             // Pour le tri dans l'UI
  statut      : StatutActif
  createdAt   : ISODateString
  updatedAt   : ISODateString
}

/**
 * Sous-collection appartenant à une Collection
 * (ex : Collection "Salon" → Sous-collection "Canapés", "Tables basses")
 */
export interface SousCollection {
  id           : ID
  collectionId : ID                // Réf. Collection parente
  nom          : string
  description ?: string
  image       ?: URLString
  ordre       ?: number
  statut       : StatutActif
  createdAt    : ISODateString
  updatedAt    : ISODateString
}

// ── Article ──────────────────────────────────

export type UniteArticle = 'unité' | 'lot' | 'm²' | 'm³' | 'ml'

export interface DimensionsArticle {
  longueur?: number               // en cm
  largeur ?: number               // en cm
  hauteur ?: number               // en cm
  poids   ?: number               // en kg
}

export interface VarianteArticle {
  id           : ID
  nom          : string           // ex : "Chêne naturel", "Wengé"
  couleur     ?: string
  matiere     ?: string
  prixSurcharge: MontantFCFA      // Supplément par rapport au prix de base (peut être 0)
  stock        : number
  reference   ?: string
}

export interface Article {
  id              : ID
  collectionId    : ID            // Réf. Collection
  sousCollectionId: ID            // Réf. SousCollection
  nom             : string
  description    ?: string
  reference       : string        // Code article unique (ex : "ART-0042")
  unite           : UniteArticle
  prixHT          : MontantFCFA
  tauxTVA         : number        // En pourcentage : 0, 10, 19.25...
  prixTTC         : MontantFCFA   // Calculé : prixHT * (1 + tauxTVA/100)
  dimensions     ?: DimensionsArticle
  images          : URLString[]
  stockTotal      : number        // Somme des stocks de toutes les variantes
  statut          : StatutActif
  createdAt       : ISODateString
  updatedAt       : ISODateString
  createdBy       : ID            // Réf. Administrateur
}


// ─────────────────────────────────────────────
//  LIGNE DE DOCUMENT (Devis / Facture)
// ─────────────────────────────────────────────

export interface LigneDocument {
  id           : ID
  articleId    : ID               // Réf. Article
  varianteId  ?: ID               // Réf. VarianteArticle (si applicable)
  designation  : string           // Copie du nom article au moment de la création
  reference    : string           // Copie de la référence article
  quantite     : number
  unite        : UniteArticle
  prixUnitaireHT : MontantFCFA
  tauxTVA      : number
  prixUnitaireTTC: MontantFCFA
  montantTotalHT : MontantFCFA    // quantite * prixUnitaireHT
  montantTotalTTC: MontantFCFA    // quantite * prixUnitaireTTC
  remise       : number           // En pourcentage (0 par défaut)
  notes       ?: string
}


// ─────────────────────────────────────────────
//  DEVIS
// ─────────────────────────────────────────────

export type StatutDevis =
  | 'brouillon'
  | 'envoyé'
  | 'accepté'
  | 'refusé'
  | 'expiré'
  | 'annulé'

export interface Devis {
  id              : ID
  numero          : string        // Numéro séquentiel (ex : "DEV-2025-0042")
  clientId        : ID            // Réf. Client
  lignes          : LigneDocument[]
  totalHT         : MontantFCFA   // Somme des montantTotalHT des lignes
  totalTVA        : MontantFCFA
  totalTTC        : MontantFCFA
  remiseGlobale   : number        // En pourcentage (0 par défaut)
  totalApreRemise : MontantFCFA   // totalTTC après remise globale
  statut          : StatutDevis
  dateEmission    : ISODateString
  dateValidite    : ISODateString  // Date d'expiration du devis
  dateAcceptation?: ISODateString
  notes          ?: string
  conditionsPaiement?: string
  factureId      ?: ID            // Réf. Facture générée (si accepté)
  createdAt       : ISODateString
  updatedAt       : ISODateString
  createdBy       : ID            // Réf. Administrateur
}


// ─────────────────────────────────────────────
//  FACTURE
// ─────────────────────────────────────────────

export type StatutFacture =
  | 'brouillon'
  | 'émise'
  | 'partiellement_payée'
  | 'payée'
  | 'en_retard'
  | 'annulée'
  | 'avoir'

export type ModePaiement =
  | 'espèces'
  | 'virement'
  | 'chèque'
  | 'mobile_money'
  | 'carte_bancaire'
  | 'autre'

export interface Paiement {
  id          : ID
  date        : ISODateString
  montant     : MontantFCFA
  mode        : ModePaiement
  reference  ?: string            // Numéro de transaction, chèque, etc.
  notes      ?: string
  enregistréPar: ID               // Réf. Administrateur
}

export interface Facture {
  id              : ID
  numero          : string        // Numéro séquentiel (ex : "FAC-2025-0042")
  clientId        : ID            // Réf. Client
  devisId        ?: ID            // Réf. Devis d'origine (si applicable)
  lignes          : LigneDocument[]
  totalHT         : MontantFCFA
  totalTVA        : MontantFCFA
  totalTTC        : MontantFCFA
  remiseGlobale   : number
  totalApreRemise : MontantFCFA
  montantPayé     : MontantFCFA   // Somme des paiements enregistrés
  montantRestant  : MontantFCFA   // totalApreRemise - montantPayé
  paiements       : Paiement[]
  statut          : StatutFacture
  dateEmission    : ISODateString
  dateEcheance    : ISODateString
  datePaiementComplet?: ISODateString
  notes          ?: string
  conditionsPaiement?: string
  createdAt       : ISODateString
  updatedAt       : ISODateString
  createdBy       : ID            // Réf. Administrateur
}


// ─────────────────────────────────────────────
//  RÉSUMÉ BASE DE DONNÉES (vue d'ensemble)
// ─────────────────────────────────────────────

/**
 * Représentation de la base de données complète.
 * Utile pour le typage des stores (Zustand, Redux, etc.)
 * ou d'un contexte de données local (SQLite, JSON, etc.)
 */
export interface Database {
  administrateurs  : Record<ID, Administrateur>
  clients          : Record<ID, Client>
  collections      : Record<ID, Collection>
  sousCollections  : Record<ID, SousCollection>
  articles         : Record<ID, Article>
  devis            : Record<ID, Devis>
  factures         : Record<ID, Facture>
}