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
  quantite    : number
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
//  BOUTIQUE / STOCK PAR BOUTIQUE / TRANSFERTS
// ─────────────────────────────────────────────

/**
 * Une boutique = un stock physique. La boutique "Stock principal" est
 * créée automatiquement à la première initialisation (isPrincipal = true)
 * et reçoit le stock existant des articles lors de la migration.
 */
export interface Boutique {
  id          : ID
  nom         : string
  adresse    ?: string            // Texte libre
  userId     ?: ID                // Responsable (Réf. Administrateur)
  isPrincipal : boolean           // true uniquement pour la boutique seed
  statut      : StatutActif
  createdAt   : ISODateString
  updatedAt   : ISODateString
}

/**
 * Quantité d'un (article, variante?) dans une boutique précise.
 * Unique sur (boutiqueId, articleId, varianteId).
 * Source de vérité du stock — Article.stockTotal en est dérivé.
 */
export interface StockBoutique {
  id          : ID
  boutiqueId  : ID
  articleId   : ID
  varianteId ?: ID
  quantite    : number
  updatedAt   : ISODateString
}

/** Sens d'un transfert. */
export type SensTransfert = 'transfert' | 'ajout' | 'retrait'

/**
 * Historique des mouvements de stock entre boutiques (ou ajout/retrait).
 * Pour un transfert simple : boutiqueSourceId + boutiqueDestId remplis.
 * Pour un ajout : boutiqueSourceId = null, boutiqueDestId = cible.
 * Pour un retrait : boutiqueSourceId = source, boutiqueDestId = null.
 */
export interface TransfertStock {
  id               : ID
  articleId        : ID
  varianteId      ?: ID
  boutiqueSourceId?: ID
  boutiqueDestId  ?: ID
  quantite         : number
  sens             : SensTransfert
  userId           : ID            // Réf. Administrateur
  note            ?: string
  createdAt        : ISODateString
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
  groupeId    ?: ID               // Réf. GroupeDevis (par-devis, optionnel)
  sousGroupeId?: ID               // Réf. SousGroupeDevis (par-devis, optionnel)
}


// ─────────────────────────────────────────────
//  GROUPES (par-devis : pièces de maison, catégories…)
// ─────────────────────────────────────────────

export interface SousGroupeDevis {
  id    : ID
  nom   : string
  ordre : number
}

export interface GroupeDevis {
  id          : ID
  nom         : string
  ordre       : number
  sousGroupes : SousGroupeDevis[]
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

export type CanalEnvoiDevis = 'pdf' | 'whatsapp' | 'manuel'

export interface DevisEnvoi {
  id    : ID
  date  : ISODateString
  canal : CanalEnvoiDevis
  par   : ID
  notes?: string
}

export interface Devis {
  id              : ID
  numero          : string        // Numéro séquentiel (ex : "DEV-2025-0042")
  clientId        : ID            // Réf. Client
  lignes          : LigneDocument[]
  groupes        ?: GroupeDevis[] // Regroupement libre des lignes (par-devis)
  totalHT         : MontantFCFA   // Somme des montantTotalHT des lignes
  totalTVA        : MontantFCFA
  totalTTC        : MontantFCFA
  afficherTVA    ?: boolean        // Affiche/masque la TVA sur le PDF et l'aperçu (défaut: true)
  afficherTVALignes?: boolean      // Affiche/masque la colonne TVA dans les lignes (défaut: true). Si false alors que afficherTVA=true → TVA visible uniquement dans les totaux
  remiseGlobale   : number        // En pourcentage (0 par défaut)
  totalApreRemise : MontantFCFA   // totalTTC après remise globale
  statut          : StatutDevis
  dateEmission    : ISODateString
  dateValidite    : ISODateString  // Date d'expiration du devis
  dateAcceptation?: ISODateString
  notes          ?: string
  conditionsPaiement?: string
  envois         ?: DevisEnvoi[]   // Historique des envois (PDF, WhatsApp, manuel)
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
  groupes        ?: GroupeDevis[] // Repris du devis lors de la conversion
  totalHT         : MontantFCFA
  totalTVA        : MontantFCFA
  totalTTC        : MontantFCFA
  afficherTVA    ?: boolean        // Affiche/masque la TVA sur le PDF et l'aperçu (défaut: true)
  afficherTVALignes?: boolean      // Affiche/masque la colonne TVA dans les lignes (défaut: true). Si false alors que afficherTVA=true → TVA visible uniquement dans les totaux
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
//  TECHNICIEN
// ─────────────────────────────────────────────

export interface Technicien {
  id          : ID
  nom         : string
  prenom      : string
  telephone   : string
  email      ?: string
  specialite ?: string
  statut      : StatutActif
  createdAt   : ISODateString
  updatedAt   : ISODateString
}


// ─────────────────────────────────────────────
//  PROJET
// ─────────────────────────────────────────────

export type StatutProjet = 'planifié' | 'en_cours' | 'en_pause' | 'terminé' | 'annulé'

export interface Projet {
  id              : ID
  nom             : string
  description    ?: string
  clientId        : ID
  adresse        ?: Adresse       // JSON en base
  statut          : StatutProjet
  dateDebut       : ISODateString
  dateFin        ?: ISODateString  // date fin prévue
  dateFinReelle  ?: ISODateString  // date fin réelle
  devisIds        : ID[]           // JSON en base
  technicienIds   : ID[]           // JSON en base
  notes          ?: string
  createdAt       : ISODateString
  updatedAt       : ISODateString
  createdBy       : ID
}


// ─────────────────────────────────────────────
//  TÂCHE PROJET (Kanban)
// ─────────────────────────────────────────────

export type StatutTache   = 'à_faire' | 'en_cours' | 'terminé' | 'bloqué'
export type PrioriteTache = 'basse' | 'normale' | 'haute' | 'urgente'

export interface TacheProjet {
  id            : ID
  projetId      : ID
  titre         : string
  description  ?: string
  statut        : StatutTache
  priorite      : PrioriteTache
  technicienIds : ID[]           // JSON en base
  dateDebut    ?: ISODateString
  dateEcheance ?: ISODateString
  ordre         : number
  createdAt     : ISODateString
  updatedAt     : ISODateString
  createdBy     : ID
}


// ─────────────────────────────────────────────
//  RÉSUMÉ BASE DE DONNÉES (vue d'ensemble)
// ─────────────────────────────────────────────

/**
 * Représentation de la base de données complète.
 * Utile pour le typage des stores (Zustand, Redux, etc.)
 * ou d'un contexte de données local (SQLite, JSON, etc.)
 */
// ─────────────────────────────────────────────
//  INVENTAIRE
// ─────────────────────────────────────────────

export type StatutInventaire = 'brouillon' | 'valide' | 'annule'

export interface LigneInventaire {
  articleId   : ID
  varianteId ?: ID | null
  boutiqueId  : ID
  /** quantité saisie par l'utilisateur, null = non comptée → on conserve la valeur actuelle */
  quantiteCompte: number | null
}

export interface Inventaire {
  id           : ID
  /** null = inventaire sur toutes les boutiques */
  boutiqueId  ?: ID | null
  status       : StatutInventaire
  /** chemin du fichier Excel d'export de l'état initial (backup) */
  exportPath  ?: string | null
  /** JSON.stringify(LigneInventaire[]) en DB */
  lignes       : LigneInventaire[]
  startedAt    : ISODateString
  validatedAt ?: ISODateString | null
  createdBy    : ID
}

export interface Database {
  administrateurs  : Record<ID, Administrateur>
  clients          : Record<ID, Client>
  collections      : Record<ID, Collection>
  sousCollections  : Record<ID, SousCollection>
  articles         : Record<ID, Article>
  devis            : Record<ID, Devis>
  factures         : Record<ID, Facture>
  boutiques        : Record<ID, Boutique>
  stocksBoutique   : Record<ID, StockBoutique>
  transfertsStock  : Record<ID, TransfertStock>
}