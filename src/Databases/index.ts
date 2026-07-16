import { ModelFactory, SimpleORM } from "../simpleorm/simpleorm-sync";

import type {
    Article,
    Client,
    Collection,
    Devis,
    Facture,
    SousCollection,
    Administrateur,
    LigneDocument,
    DimensionsArticle,
    Adresse,
    Technicien,
    Projet,
    TacheProjet,
    Boutique,
    StockBoutique,
    TransfertStock,
    SensTransfert,
    Inventaire,
    LigneInventaire,
    Entreprise,
    CustomField,
} from "./db"

import { app } from 'electron';
import path from 'node:path';
import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations";

const DB_FILENAME = 'notes.sqlite';
let _dbPath: string | null = null;
export function getDbPath(): string {
  if (!_dbPath) {
    _dbPath = path.join(app.getPath('userData'), DB_FILENAME);
  }
  return _dbPath;
}

export function checkDatabase() {
  const db = new Database(getDbPath());
  const stml = db.prepare("SELECT 1+1 AS result");
  const result = stml.run();
  return result;
}

export const orm = new SimpleORM(getDbPath());
const db = new ModelFactory(orm);


const Articles = db.createModel<Article>("articles", {
    id : "TEXT PRIMARY KEY NOT NULL", 
    collectionId : "TEXT NOT NULL", 
    images : "TEXT NOT NULL", 
    nom : "TEXT NOT NULL", 
    description : "TEXT", 
    reference : "TEXT NOT NULL",
    unite : "TEXT NOT NULL",
    prixHT : "INTEGER NOT NULL",
    tauxTVA : "INTEGER NOT NULL",
    prixTTC : "INTEGER NOT NULL",
    dimensions : "TEXT",
    stockTotal : "INTEGER NOT NULL",
    statut : "TEXT NOT NULL",
    createdAt : "DATETIME DEFAULT CURRENT_TIMESTAMP",
    updatedAt : "DATETIME DEFAULT CURRENT_TIMESTAMP",
    createdBy : "TEXT NOT NULL",
    sousCollectionId : "TEXT NULL"
})

const createArticlesTable = async () => {
  await Articles.createTable();
};

export function getArticleById(id: string) {
  try {
    const result = Articles.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllArticles() {
  const result = await Articles.orderBy("nom", "ASC").findAll();
  return result;
}

export function createArticles(data: Omit<Article, "id" | "createdAt" | "updatedAt | createdBy | prixTTC">, opts?: { fromSync?: boolean }) {
  try {
    const prixTTC = data.prixHT * (1 + data.tauxTVA / 100);
    const id = uuidv4();
    const result = Articles.create({
      id,
      nom: data.nom,
      images: data.images,
      description: data.description,
      reference: data.reference,
      unite: data.unite,
      prixHT: data.prixHT,
      tauxTVA: data.tauxTVA,
      prixTTC: prixTTC,
      dimensions: data.dimensions,
      stockTotal: data.stockTotal,
      statut: data.statut,
      collectionId: data.collectionId,
      sousCollectionId: data.sousCollectionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy
    });
    if (result && !opts?.fromSync) syncState.markDirty("articles", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateArticles(id: string, data: Partial<Omit<Article, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    
    if (data.prixHT !== undefined || data.tauxTVA !== undefined) {
      const article = Articles.findById(id);
      if (article) {
        const prixHT = data.prixHT ?? article.prixHT;
        const tauxTVA = data.tauxTVA ?? article.tauxTVA;
        updateData.prixTTC = prixHT * (1 + tauxTVA / 100);
      }
    }
    
    updateData.updatedAt = new Date().toISOString();
    const result = Articles.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("articles", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteArticles(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Articles.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("articles", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== CLIENTS ========================

const Clients = db.createModel<Client>("clients", {
  id: "TEXT PRIMARY KEY NOT NULL",
  type: "TEXT NOT NULL",
  nom: "TEXT NOT NULL",
  prenom: "TEXT",
  raisonSociale: "TEXT",
  email: "TEXT NOT NULL",
  telephone: "TEXT NOT NULL",
  telephone2: "TEXT",
  adresse: "TEXT NOT NULL",
  statut: "TEXT NOT NULL",
  notes: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  createdBy: "TEXT NOT NULL",
});

const createClientsTable = async () => {
  await Clients.createTable();
};

export function getClientById(id: string) {
  try {
    const result = Clients.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllClients() {
  try {
    const result = await Clients.orderBy("nom", "ASC").findAll();
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createClient(data: Omit<Client, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Clients.create({
      id,
      type: data.type,
      nom: data.nom,
      prenom: data.prenom,
      raisonSociale: data.raisonSociale,
      email: data.email,
      telephone: data.telephone,
      telephone2: data.telephone2,
      adresse: JSON.stringify(data.adresse),
      statut: data.statut,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy,
    });
    if (result && !opts?.fromSync) syncState.markDirty("clients", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateClient(id: string, data: Partial<Omit<Client, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    if (data.adresse) {
      updateData.adresse = JSON.stringify(data.adresse);
    }
    updateData.updatedAt = new Date().toISOString();
    const result = Clients.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("clients", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteClient(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Clients.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("clients", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== COLLECTIONS ========================

const Collections = db.createModel<Collection>("collections", {
  id: "TEXT PRIMARY KEY NOT NULL",
  nom: "TEXT NOT NULL",
  description: "TEXT",
  ordre: "INTEGER",
  statut: "TEXT NOT NULL",
  quantite : "INTEGER NULL DEFAULT 0",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

const createCollectionsTable = async () => {
  await Collections.createTable();
};

export function getCollectionById(id: string) {
  try {
    const result = Collections.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllCollections() {
  try {
    const result = await Collections.orderBy("ordre", "ASC").findAll();
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createCollection(data: Omit<Collection, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Collections.create({
      id,
      nom: data.nom,
      description: data.description,
      ordre: data.ordre,
      statut: data.statut || 'actif',
      quantite : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (result && !opts?.fromSync) syncState.markDirty("collections", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateCollection(id: string, data: Partial<Omit<Collection, "id" | "createdAt">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = Collections.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("collections", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteCollection(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Collections.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("collections", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== SOUS-COLLECTIONS ========================

const SousCollections = db.createModel<SousCollection>("sous_collections", {
  id: "TEXT PRIMARY KEY NOT NULL",
  collectionId: "TEXT NOT NULL",
  nom: "TEXT NOT NULL",
  description: "TEXT",
  image: "TEXT",
  ordre: "INTEGER",
  statut: "TEXT NOT NULL",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

const createSousCollectionsTable = async () => {
  await SousCollections.createTable();
};

export function getSousCollectionById(id: string) {
  try {
    const result = SousCollections.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllSousCollections() {
  try {
    const result = await SousCollections.orderBy("nom", "ASC").findAll();
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getSousCollectionsByCollectionId(collectionId: string) {
  try {
    const result = await SousCollections.where("collectionId", "=", collectionId).orderBy("ordre", "ASC").findAll();
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createSousCollection(data: Omit<SousCollection, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = SousCollections.create({
      id,
      collectionId: data.collectionId,
      nom: data.nom,
      description: data.description,
      image: data.image,
      ordre: data.ordre,
      statut: data.statut,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (result && !opts?.fromSync) syncState.markDirty("sous_collections", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateSousCollection(id: string, data: Partial<Omit<SousCollection, "id" | "createdAt">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = SousCollections.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("sous_collections", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteSousCollection(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = SousCollections.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("sous_collections", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== ADMINISTRATEURS ========================

const Administrateurs = db.createModel<Administrateur>("administrateurs", {
  id: "TEXT PRIMARY KEY NOT NULL",
  nom: "TEXT NOT NULL",
  prenom: "TEXT NOT NULL",
  email: "TEXT NOT NULL UNIQUE",
  telephone: "TEXT",
  role: "TEXT NOT NULL",
  motDePasseHash: "TEXT NOT NULL",
  avatar: "TEXT",
  statut: "TEXT NOT NULL",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  derniereConnexion: "DATETIME",
});

const createAdministrateursTable = async () => {
  await Administrateurs.createTable();
};

export function getAdministrateurById(id: string) {
  try {
    const result = Administrateurs.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllAdministrateurs() {
  try {
    const result = await Administrateurs.orderBy("nom", "ASC").findAll();
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function createAdministrateur(
  data: Omit<Administrateur, "id" | "createdAt" | "updatedAt">,
  opts?: { fromSync?: boolean; id?: string },
) {
  try {
    const id = opts?.id || uuidv4();
    const result = await Administrateurs.create({
      id,
      nom: data.nom,
      prenom: data.prenom,
      email: data.email,
      telephone: data.telephone,
      role: data.role,
      motDePasseHash: data.motDePasseHash,
      avatar: data.avatar,
      statut: data.statut,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      derniereConnexion: data.derniereConnexion,
    });
    if (result && !opts?.fromSync) syncState.markDirty("administrateurs", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateAdministrateur(id: string, data: Partial<Omit<Administrateur, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = Administrateurs.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("administrateurs", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteAdministrateur(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Administrateurs.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("administrateurs", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== DEVIS ========================

const Devis = db.createModel<Devis>("devis", {
  id: "TEXT PRIMARY KEY NOT NULL",
  numero: "TEXT NOT NULL UNIQUE",
  clientId: "TEXT NOT NULL",
  lignes: "TEXT NOT NULL",
  groupes: "TEXT",
  totalHT: "INTEGER NOT NULL",
  totalTVA: "INTEGER NOT NULL",
  totalTTC: "INTEGER NOT NULL",
  afficherTVA: "INTEGER NOT NULL DEFAULT 1",
  afficherTVALignes: "INTEGER NOT NULL DEFAULT 1",
  remiseGlobale: "INTEGER NOT NULL DEFAULT 0",
  totalApreRemise: "INTEGER NOT NULL",
  statut: "TEXT NOT NULL",
  dateEmission: "DATETIME NOT NULL",
  dateValidite: "DATETIME NOT NULL",
  dateAcceptation: "DATETIME",
  notes: "TEXT",
  conditionsPaiement: "TEXT",
  envois: "TEXT NOT NULL DEFAULT '[]'",
  factureId: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  createdBy: "TEXT NOT NULL",
});

const createDevisTable = async () => {
  await Devis.createTable();
};

function parseDevis(row: any): Devis | null {
  if (!row) return row;
  return {
    ...row,
    lignes: typeof row.lignes === "string" ? JSON.parse(row.lignes || "[]") : (row.lignes ?? []),
    groupes: typeof row.groupes === "string" ? JSON.parse(row.groupes || "[]") : (row.groupes ?? []),
    envois: typeof row.envois === "string" ? JSON.parse(row.envois || "[]") : (row.envois ?? []),
    afficherTVA: row.afficherTVA === undefined || row.afficherTVA === null ? true : row.afficherTVA !== 0,
    afficherTVALignes: row.afficherTVALignes === undefined || row.afficherTVALignes === null ? true : row.afficherTVALignes !== 0,
  };
}

export function getDevisById(id: string) {
  try {
    const result = Devis.findById(id);
    return parseDevis(result);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllDevis() {
  try {
    const result = await Devis.findAll({ orderBy : { column : "numero", order : "DESC"}});
    return Array.isArray(result) ? result.map(parseDevis) : result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getDevisByClientId(clientId: string) {
  try {
    const result = await Devis.findAll({ where : { clientId : clientId }, orderBy : { column : "numero", order : "DESC"}});
    return Array.isArray(result) ? result.map(parseDevis) : result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createDevis(data: Omit<Devis, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Devis.create({
      id,
      numero: data.numero,
      clientId: data.clientId,
      lignes: JSON.stringify(data.lignes),
      groupes: JSON.stringify(data.groupes ?? []),
      totalHT: data.totalHT,
      totalTVA: data.totalTVA,
      totalTTC: data.totalTTC,
      afficherTVA: (data.afficherTVA === false ? 0 : 1) as any,
      afficherTVALignes: (data.afficherTVALignes === false ? 0 : 1) as any,
      remiseGlobale: data.remiseGlobale || 0,
      totalApreRemise: data.totalApreRemise,
      statut: data.statut,
      dateEmission: data.dateEmission,
      dateValidite: data.dateValidite,
      dateAcceptation: data.dateAcceptation,
      notes: data.notes,
      conditionsPaiement: data.conditionsPaiement,
      envois: JSON.stringify(data.envois ?? []) as any,
      factureId: data.factureId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy,
    });
    if (result && !opts?.fromSync) syncState.markDirty("devis", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateDevis(id: string, data: Partial<Omit<Devis, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    if (data.lignes) {
      updateData.lignes = JSON.stringify(data.lignes);
    }
    if (data.groupes !== undefined) {
      updateData.groupes = JSON.stringify(data.groupes ?? []);
    }
    if (data.envois !== undefined) {
      updateData.envois = JSON.stringify(data.envois ?? []);
    }
    if (data.afficherTVA !== undefined) {
      updateData.afficherTVA = data.afficherTVA === false ? 0 : 1;
    }
    if (data.afficherTVALignes !== undefined) {
      updateData.afficherTVALignes = data.afficherTVALignes === false ? 0 : 1;
    }
    updateData.updatedAt = new Date().toISOString();
    const result = Devis.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("devis", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteDevis(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Devis.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("devis", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== FACTURES ========================

const Factures = db.createModel<Facture>("factures", {
  id: "TEXT PRIMARY KEY NOT NULL",
  numero: "TEXT NOT NULL UNIQUE",
  clientId: "TEXT NOT NULL",
  devisId: "TEXT",
  lignes: "TEXT NOT NULL",
  groupes: "TEXT NOT NULL DEFAULT '[]'",
  totalHT: "INTEGER NOT NULL",
  totalTVA: "INTEGER NOT NULL",
  totalTTC: "INTEGER NOT NULL",
  afficherTVA: "INTEGER NOT NULL DEFAULT 1",
  afficherTVALignes: "INTEGER NOT NULL DEFAULT 1",
  remiseGlobale: "INTEGER NOT NULL DEFAULT 0",
  totalApreRemise: "INTEGER NOT NULL",
  montantPayé: "INTEGER NOT NULL DEFAULT 0",
  montantRestant: "INTEGER NOT NULL",
  paiements: "TEXT NOT NULL DEFAULT '[]'",
  statut: "TEXT NOT NULL",
  dateEmission: "DATETIME NOT NULL",
  dateEcheance: "DATETIME NOT NULL",
  datePaiementComplet: "DATETIME",
  notes: "TEXT",
  conditionsPaiement: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  createdBy: "TEXT NOT NULL",
});

const createFacturesTable = async () => {
  await Factures.createTable();
};

function parseFacture(row: any): Facture | null {
  if (!row) return row;
  return {
    ...row,
    lignes: typeof row.lignes === "string" ? JSON.parse(row.lignes || "[]") : (row.lignes ?? []),
    groupes: typeof row.groupes === "string" ? JSON.parse(row.groupes || "[]") : (row.groupes ?? []),
    paiements: typeof row.paiements === "string" ? JSON.parse(row.paiements || "[]") : (row.paiements ?? []),
    afficherTVA: row.afficherTVA === undefined || row.afficherTVA === null ? true : row.afficherTVA !== 0,
    afficherTVALignes: row.afficherTVALignes === undefined || row.afficherTVALignes === null ? true : row.afficherTVALignes !== 0,
  };
}

export function getFactureById(id: string) {
  try {
    const result = Factures.findById(id);
    return parseFacture(result);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllFactures() {
  try {
    const result = await Factures.orderBy("numero", "DESC").findAll();
    return Array.isArray(result) ? result.map(parseFacture) : result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getFacturesByClientId(clientId: string) {
  try {
    const result = await Factures.findAll({
        where : { clientId : clientId }
    });
    return Array.isArray(result) ? result.map(parseFacture) : result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createFacture(data: Omit<Facture, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Factures.create({
      id,
      numero: data.numero,
      clientId: data.clientId,
      devisId: data.devisId,
      lignes: JSON.stringify(data.lignes),
      groupes: JSON.stringify(data.groupes ?? []),
      totalHT: data.totalHT,
      totalTVA: data.totalTVA,
      totalTTC: data.totalTTC,
      afficherTVA: (data.afficherTVA === false ? 0 : 1) as any,
      afficherTVALignes: (data.afficherTVALignes === false ? 0 : 1) as any,
      remiseGlobale: data.remiseGlobale || 0,
      totalApreRemise: data.totalApreRemise,
      montantPayé: data.montantPayé || 0,
      montantRestant: data.montantRestant,
      paiements: JSON.stringify(data.paiements || []),
      statut: data.statut,
      dateEmission: data.dateEmission,
      dateEcheance: data.dateEcheance,
      datePaiementComplet: data.datePaiementComplet,
      notes: data.notes,
      conditionsPaiement: data.conditionsPaiement,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy,
    });
    if (result && !opts?.fromSync) syncState.markDirty("factures", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateFacture(id: string, data: Partial<Omit<Facture, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    if (data.lignes) {
      updateData.lignes = JSON.stringify(data.lignes);
    }
    if (data.groupes !== undefined) {
      updateData.groupes = JSON.stringify(data.groupes ?? []);
    }
    if (data.paiements) {
      updateData.paiements = JSON.stringify(data.paiements);
    }
    if (data.afficherTVA !== undefined) {
      updateData.afficherTVA = data.afficherTVA === false ? 0 : 1;
    }
    if (data.afficherTVALignes !== undefined) {
      updateData.afficherTVALignes = data.afficherTVALignes === false ? 0 : 1;
    }
    updateData.updatedAt = new Date().toISOString();
    const result = Factures.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("factures", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteFacture(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Factures.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("factures", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== LIGNES DOCUMENTS ========================

const LignesDocuments = db.createModel<LigneDocument>("lignes_documents", {
  id: "TEXT PRIMARY KEY NOT NULL",
  articleId: "TEXT NOT NULL",
  varianteId: "TEXT",
  designation: "TEXT NOT NULL",
  reference: "TEXT NOT NULL",
  quantite: "INTEGER NOT NULL",
  unite: "TEXT NOT NULL",
  prixUnitaireHT: "INTEGER NOT NULL",
  tauxTVA: "INTEGER NOT NULL",
  prixUnitaireTTC: "INTEGER NOT NULL",
  montantTotalHT: "INTEGER NOT NULL",
  montantTotalTTC: "INTEGER NOT NULL",
  remise: "INTEGER NOT NULL DEFAULT 0",
  notes: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

const createLignesDocumentsTable = async () => {
  await LignesDocuments.createTable();
};

export function getLigneDocumentById(id: string) {
  try {
    const result = LignesDocuments.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllLignesDocuments() {
  try {
    const result = await LignesDocuments.orderBy("createdAt", "DESC").findAll();
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getLignesDocumentsByArticleId(articleId: string) {
  try {
    const result = await LignesDocuments.findAll({ where: { articleId : articleId}});
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createLigneDocument(data: Omit<LigneDocument, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = LignesDocuments.create({
      id,
      articleId: data.articleId,
      varianteId: data.varianteId,
      designation: data.designation,
      reference: data.reference,
      quantite: data.quantite,
      unite: data.unite,
      prixUnitaireHT: data.prixUnitaireHT,
      tauxTVA: data.tauxTVA,
      prixUnitaireTTC: data.prixUnitaireTTC,
      montantTotalHT: data.montantTotalHT,
      montantTotalTTC: data.montantTotalTTC,
      remise: data.remise || 0,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (result && !opts?.fromSync) syncState.markDirty("lignes_documents", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateLigneDocument(id: string, data: Partial<Omit<LigneDocument, "id" | "createdAt">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = LignesDocuments.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("lignes_documents", id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteLigneDocument(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = LignesDocuments.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("lignes_documents", id, { deleted: true });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ======================== TECHNICIENS ========================

const Techniciens = db.createModel<Technicien>("techniciens", {
  id: "TEXT PRIMARY KEY NOT NULL",
  nom: "TEXT NOT NULL",
  prenom: "TEXT NOT NULL",
  telephone: "TEXT NOT NULL",
  email: "TEXT",
  specialite: "TEXT",
  statut: "TEXT NOT NULL",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

const createTechniciensTable = async () => {
  await Techniciens.createTable();
};

export function getTechnicienById(id: string) {
  try { return Techniciens.findById(id); } catch (e) { console.error(e); return null; }
}

export async function getAllTechniciens() {
  try { return await Techniciens.orderBy("nom", "ASC").findAll(); } catch (e) { console.error(e); return null; }
}

export function createTechnicien(data: Omit<Technicien, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Techniciens.create({
      id,
      nom: data.nom,
      prenom: data.prenom,
      telephone: data.telephone,
      email: data.email,
      specialite: data.specialite,
      statut: data.statut || "actif",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (result && !opts?.fromSync) syncState.markDirty("techniciens", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function updateTechnicien(id: string, data: Partial<Omit<Technicien, "id" | "createdAt">>, opts?: { fromSync?: boolean }) {
  try {
    const result = Techniciens.update(id, { ...data, updatedAt: new Date().toISOString() });
    if (result && !opts?.fromSync) syncState.markDirty("techniciens", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function deleteTechnicien(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Techniciens.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("techniciens", id, { deleted: true });
    return result;
  } catch (e) { console.error(e); return null; }
}


// ======================== PROJETS ========================

const Projets = db.createModel<Projet>("projets", {
  id: "TEXT PRIMARY KEY NOT NULL",
  nom: "TEXT NOT NULL",
  description: "TEXT",
  clientId: "TEXT NOT NULL",
  adresse: "TEXT",
  statut: "TEXT NOT NULL",
  dateDebut: "DATETIME NOT NULL",
  dateFin: "DATETIME",
  dateFinReelle: "DATETIME",
  devisIds: "TEXT NOT NULL DEFAULT '[]'",
  technicienIds: "TEXT NOT NULL DEFAULT '[]'",
  notes: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  createdBy: "TEXT NOT NULL",
});

const createProjetsTable = async () => {
  await Projets.createTable();
};

function parseProjet(row: any): Projet | null {
  if (!row) return null;
  return {
    ...row,
    adresse: row.adresse ? (typeof row.adresse === "string" ? JSON.parse(row.adresse) : row.adresse) : undefined,
    devisIds: typeof row.devisIds === "string" ? JSON.parse(row.devisIds || "[]") : (row.devisIds ?? []),
    technicienIds: typeof row.technicienIds === "string" ? JSON.parse(row.technicienIds || "[]") : (row.technicienIds ?? []),
  };
}

export function getProjetById(id: string) {
  try { return parseProjet(Projets.findById(id)); } catch (e) { console.error(e); return null; }
}

export async function getAllProjets() {
  try {
    const result = await Projets.orderBy("createdAt", "DESC").findAll();
    return Array.isArray(result) ? result.map(parseProjet) : result;
  } catch (e) { console.error(e); return null; }
}

export async function getProjetsByClientId(clientId: string) {
  try {
    const result = await Projets.findAll({ where: { clientId } });
    return Array.isArray(result) ? result.map(parseProjet) : result;
  } catch (e) { console.error(e); return null; }
}

export function createProjet(data: Omit<Projet, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Projets.create({
      id,
      nom: data.nom,
      description: data.description,
      clientId: data.clientId,
      adresse: data.adresse ? JSON.stringify(data.adresse) : undefined,
      statut: data.statut || "planifié",
      dateDebut: data.dateDebut,
      dateFin: data.dateFin,
      dateFinReelle: data.dateFinReelle,
      devisIds: JSON.stringify(data.devisIds ?? []),
      technicienIds: JSON.stringify(data.technicienIds ?? []),
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy,
    });
    if (result && !opts?.fromSync) syncState.markDirty("projets", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function updateProjet(id: string, data: Partial<Omit<Projet, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    if (data.adresse !== undefined) updateData.adresse = data.adresse ? JSON.stringify(data.adresse) : null;
    if (data.devisIds !== undefined) updateData.devisIds = JSON.stringify(data.devisIds);
    if (data.technicienIds !== undefined) updateData.technicienIds = JSON.stringify(data.technicienIds);
    const result = Projets.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("projets", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function deleteProjet(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = Projets.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("projets", id, { deleted: true });
    return result;
  } catch (e) { console.error(e); return null; }
}


// ======================== TÂCHES PROJET ========================

const TachesProjet = db.createModel<TacheProjet>("taches_projet", {
  id: "TEXT PRIMARY KEY NOT NULL",
  projetId: "TEXT NOT NULL",
  titre: "TEXT NOT NULL",
  description: "TEXT",
  statut: "TEXT NOT NULL",
  priorite: "TEXT NOT NULL",
  technicienIds: "TEXT NOT NULL DEFAULT '[]'",
  dateDebut: "DATETIME",
  dateEcheance: "DATETIME",
  ordre: "INTEGER NOT NULL DEFAULT 0",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  createdBy: "TEXT NOT NULL",
});

const createTachesProjetTable = async () => {
  await TachesProjet.createTable();
};

function parseTache(row: any): TacheProjet | null {
  if (!row) return null;
  return {
    ...row,
    technicienIds: typeof row.technicienIds === "string" ? JSON.parse(row.technicienIds || "[]") : (row.technicienIds ?? []),
  };
}

export function getTacheProjetById(id: string) {
  try { return parseTache(TachesProjet.findById(id)); } catch (e) { console.error(e); return null; }
}

export async function getTachesProjetByProjetId(projetId: string) {
  try {
    const result = await TachesProjet.findAll({ where: { projetId }, orderBy: { column: "ordre", order: "ASC" } });
    return Array.isArray(result) ? result.map(parseTache) : result;
  } catch (e) { console.error(e); return null; }
}

export function createTacheProjet(data: Omit<TacheProjet, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = TachesProjet.create({
      id,
      projetId: data.projetId,
      titre: data.titre,
      description: data.description,
      statut: data.statut || "à_faire",
      priorite: data.priorite || "normale",
      technicienIds: JSON.stringify(data.technicienIds ?? []),
      dateDebut: data.dateDebut,
      dateEcheance: data.dateEcheance,
      ordre: data.ordre ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy,
    });
    if (result && !opts?.fromSync) syncState.markDirty("taches_projet", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function updateTacheProjet(id: string, data: Partial<Omit<TacheProjet, "id" | "createdAt" | "createdBy">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    if (data.technicienIds !== undefined) updateData.technicienIds = JSON.stringify(data.technicienIds);
    const result = TachesProjet.update(id, updateData);
    if (result && !opts?.fromSync) syncState.markDirty("taches_projet", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function deleteTacheProjet(id: string, opts?: { fromSync?: boolean }) {
  try {
    const result = TachesProjet.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("taches_projet", id, { deleted: true });
    return result;
  } catch (e) { console.error(e); return null; }
}


// ======================== BOUTIQUES ========================

const Boutiques = db.createModel<Boutique>("boutiques", {
  id: "TEXT PRIMARY KEY NOT NULL",
  nom: "TEXT NOT NULL",
  adresse: "TEXT",
  userId: "TEXT",
  isPrincipal: "INTEGER NOT NULL DEFAULT 0",
  statut: "TEXT NOT NULL DEFAULT 'actif'",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

function parseBoutique(row: any): Boutique | null {
  if (!row) return null;
  return { ...row, isPrincipal: row.isPrincipal === 1 || row.isPrincipal === true };
}

const createBoutiquesTable = async () => {
  await Boutiques.createTable();
};

export function getBoutiqueById(id: string) {
  try { return parseBoutique(Boutiques.findById(id)); } catch (e) { console.error(e); return null; }
}

export async function getAllBoutiques() {
  try {
    const result = await Boutiques.orderBy("nom", "ASC").findAll();
    return Array.isArray(result) ? result.map(parseBoutique) : result;
  } catch (e) { console.error(e); return null; }
}

export function getBoutiquePrincipale(): Boutique | null {
  try {
    const row = orm.get<any>("SELECT * FROM boutiques WHERE isPrincipal = 1 LIMIT 1");
    return parseBoutique(row);
  } catch (e) { console.error(e); return null; }
}

export function createBoutique(data: Omit<Boutique, "id" | "createdAt" | "updatedAt">, opts?: { fromSync?: boolean }) {
  try {
    const id = uuidv4();
    const result = Boutiques.create({
      id,
      nom: data.nom,
      adresse: data.adresse,
      userId: data.userId,
      isPrincipal: (data.isPrincipal ? 1 : 0) as any,
      statut: data.statut || "actif",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (result && !opts?.fromSync) syncState.markDirty("boutiques", id);
    return result;
  } catch (e) { console.error(e); return null; }
}

export function updateBoutique(id: string, data: Partial<Omit<Boutique, "id" | "createdAt" | "isPrincipal">>, opts?: { fromSync?: boolean }) {
  try {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    const result = Boutiques.update(id, updateData);
    if (result && !opts?.fromSync) {
      const b = getBoutiqueById(id);
      if (!b?.isPrincipal) syncState.markDirty("boutiques", id);
    }
    return result;
  } catch (e) { console.error(e); return null; }
}

export function deleteBoutique(id: string, opts?: { fromSync?: boolean }) {
  try {
    const b = getBoutiqueById(id);
    if (b?.isPrincipal) {
      console.error("Impossible de supprimer la boutique principale");
      return null;
    }
    const result = Boutiques.delete(id);
    if (result && !opts?.fromSync) syncState.markDirty("boutiques", id, { deleted: true });
    return result;
  } catch (e) { console.error(e); return null; }
}

// ======================== STOCKS BOUTIQUE ========================

const StocksBoutique = db.createModel<StockBoutique>("stocks_boutique", {
  id: "TEXT PRIMARY KEY NOT NULL",
  boutiqueId: "TEXT NOT NULL",
  articleId: "TEXT NOT NULL",
  varianteId: "TEXT",
  quantite: "INTEGER NOT NULL DEFAULT 0",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

const createStocksBoutiqueTable = async () => {
  await StocksBoutique.createTable();
  try {
    orm.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS ux_stocks_boutique_unique " +
      "ON stocks_boutique(boutiqueId, articleId, IFNULL(varianteId, ''))"
    );
  } catch (e) { console.error("Index stocks_boutique:", e); }
};

export function getStockBoutiqueById(id: string) {
  try { return StocksBoutique.findById(id); } catch (e) { console.error(e); return null; }
}

export async function getStocksByBoutique(boutiqueId: string) {
  try { return await StocksBoutique.findAll({ where: { boutiqueId } }); }
  catch (e) { console.error(e); return null; }
}

export async function getStocksByArticle(articleId: string) {
  try { return await StocksBoutique.findAll({ where: { articleId } }); }
  catch (e) { console.error(e); return null; }
}

export function getStockEntry(boutiqueId: string, articleId: string, varianteId?: string): StockBoutique | null {
  try {
    const row = varianteId
      ? orm.get<StockBoutique>(
          "SELECT * FROM stocks_boutique WHERE boutiqueId = ? AND articleId = ? AND varianteId = ? LIMIT 1",
          [boutiqueId, articleId, varianteId]
        )
      : orm.get<StockBoutique>(
          "SELECT * FROM stocks_boutique WHERE boutiqueId = ? AND articleId = ? AND varianteId IS NULL LIMIT 1",
          [boutiqueId, articleId]
        );
    return row ?? null;
  } catch (e) { console.error(e); return null; }
}

/**
 * Recalcule Article.stockTotal comme somme du stock à travers toutes les boutiques.
 */
export function recomputeArticleStockTotal(articleId: string) {
  try {
    const row = orm.get<{ total: number }>(
      "SELECT COALESCE(SUM(quantite), 0) AS total FROM stocks_boutique WHERE articleId = ?",
      [articleId]
    );
    const total = Number(row?.total ?? 0);
    Articles.update(articleId, { stockTotal: total, updatedAt: new Date().toISOString() } as any);
    syncState.markDirty("articles", articleId);
    return total;
  } catch (e) { console.error(e); return null; }
}

/**
 * Ajoute (delta > 0) ou retire (delta < 0) du stock pour un triplet
 * (boutique, article, variante?). Crée l'entrée si absente. Recalcule
 * Article.stockTotal. Retourne la nouvelle quantité ou null en cas d'erreur.
 */
export function adjustStock(
  boutiqueId: string,
  articleId: string,
  varianteId: string | undefined,
  delta: number,
): StockBoutique | null {
  try {
    const updatedAt = new Date().toISOString();
    const existing = getStockEntry(boutiqueId, articleId, varianteId);
    if (existing) {
      const next = Math.max(0, existing.quantite + delta);
      StocksBoutique.update(existing.id, { quantite: next, updatedAt } as any);
      syncState.markDirty("stocks_boutique", existing.id);
      recomputeArticleStockTotal(articleId);
      return { ...existing, quantite: next, updatedAt } as StockBoutique;
    }
    const next = Math.max(0, delta);
    const id = uuidv4();
    StocksBoutique.create({
      id,
      boutiqueId,
      articleId,
      varianteId,
      quantite: next,
      updatedAt,
    } as any);
    syncState.markDirty("stocks_boutique", id);
    recomputeArticleStockTotal(articleId);
    return {
      id,
      boutiqueId,
      articleId,
      varianteId,
      quantite: next,
      updatedAt,
    } as StockBoutique;
  } catch (e) { console.error(e); return null; }
}

// ======================== TRANSFERTS STOCK ========================

const TransfertsStock = db.createModel<TransfertStock>("transferts_stock", {
  id: "TEXT PRIMARY KEY NOT NULL",
  articleId: "TEXT NOT NULL",
  varianteId: "TEXT",
  boutiqueSourceId: "TEXT",
  boutiqueDestId: "TEXT",
  quantite: "INTEGER NOT NULL",
  sens: "TEXT NOT NULL",
  userId: "TEXT NOT NULL",
  note: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
});

const createTransfertsStockTable = async () => {
  await TransfertsStock.createTable();
};

export async function getAllTransfertsStock() {
  try { return await TransfertsStock.orderBy("createdAt", "DESC").findAll(); }
  catch (e) { console.error(e); return null; }
}

export async function getTransfertsByBoutique(boutiqueId: string) {
  try {
    return orm.query<TransfertStock>(
      "SELECT * FROM transferts_stock WHERE boutiqueSourceId = ? OR boutiqueDestId = ? ORDER BY createdAt DESC",
      [boutiqueId, boutiqueId]
    );
  } catch (e) { console.error(e); return null; }
}

/**
 * Exécute un transfert (ou ajout/retrait) et écrit son entrée d'historique.
 * - 'transfert' : décrémente source, incrémente dest.
 * - 'ajout'     : incrémente dest uniquement.
 * - 'retrait'   : décrémente source uniquement.
 */
export type ExecuteTransfertResult = {
  transfert: TransfertStock;
  stocks: StockBoutique[];
  articleId: string;
};

export function executeTransfert(
  data: Omit<TransfertStock, "id" | "createdAt">,
): ExecuteTransfertResult | null {
  try {
    if (data.quantite <= 0) {
      console.error("Quantité de transfert invalide");
      return null;
    }
    const sens: SensTransfert = data.sens;
    const changedStocks: StockBoutique[] = [];
    if (sens === "transfert" || sens === "retrait") {
      if (!data.boutiqueSourceId) { console.error("boutiqueSourceId requis"); return null; }
      const src = getStockEntry(data.boutiqueSourceId, data.articleId, data.varianteId);
      if (!src || src.quantite < data.quantite) {
        console.error("Stock source insuffisant");
        return null;
      }
      const srcRow = adjustStock(data.boutiqueSourceId, data.articleId, data.varianteId, -data.quantite);
      if (srcRow) changedStocks.push(srcRow);
    }
    if (sens === "transfert" || sens === "ajout") {
      if (!data.boutiqueDestId) { console.error("boutiqueDestId requis"); return null; }
      const dstRow = adjustStock(data.boutiqueDestId, data.articleId, data.varianteId, data.quantite);
      if (dstRow) changedStocks.push(dstRow);
    }
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    TransfertsStock.create({
      id,
      articleId: data.articleId,
      varianteId: data.varianteId,
      boutiqueSourceId: data.boutiqueSourceId,
      boutiqueDestId: data.boutiqueDestId,
      quantite: data.quantite,
      sens,
      userId: data.userId,
      note: data.note,
      createdAt,
    } as any);
    syncState.markDirty("transferts_stock", id);
    return {
      transfert: { ...data, id, createdAt },
      stocks: changedStocks,
      articleId: data.articleId,
    };
  } catch (e) { console.error(e); return null; }
}

// ======================== INVENTAIRES ========================
// Tableau LOCAL uniquement (non synchronisé). Chaque poste pilote son propre
// inventaire physique. La validation pousse le résultat dans stocks_boutique
// (qui est, lui, synchronisé).

const Inventaires = db.createModel<Inventaire>("inventaires", {
  id: "TEXT PRIMARY KEY NOT NULL",
  boutiqueId: "TEXT",
  status: "TEXT NOT NULL DEFAULT 'brouillon'",
  exportPath: "TEXT",
  lignes: "TEXT NOT NULL DEFAULT '[]'",
  startedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  validatedAt: "DATETIME",
  createdBy: "TEXT NOT NULL",
});

const createInventairesTable = async () => {
  await Inventaires.createTable();
};

function parseLignes(raw: any): LigneInventaire[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.length > 0) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function hydrateInventaire(row: any): Inventaire | null {
  if (!row) return null;
  return { ...row, lignes: parseLignes(row.lignes) } as Inventaire;
}

export function getBrouillonInventaire(): Inventaire | null {
  try {
    const row = orm.get<any>(
      "SELECT * FROM inventaires WHERE status = 'brouillon' ORDER BY startedAt DESC LIMIT 1",
    );
    return hydrateInventaire(row);
  } catch (e) { console.error(e); return null; }
}

export function getInventaireById(id: string): Inventaire | null {
  try { return hydrateInventaire(Inventaires.findById(id)); }
  catch (e) { console.error(e); return null; }
}

export async function getAllInventaires(): Promise<Inventaire[]> {
  try {
    const rows = await Inventaires.orderBy("startedAt", "DESC").findAll();
    return (rows ?? []).map((r) => hydrateInventaire(r)!).filter(Boolean);
  } catch (e) { console.error(e); return []; }
}

export function createInventaire(data: {
  boutiqueId?: string | null;
  exportPath?: string | null;
  createdBy: string;
}): Inventaire | null {
  try {
    const existing = getBrouillonInventaire();
    if (existing) {
      console.warn("[inventaire] un brouillon existe déjà — retour de l'existant");
      return existing;
    }
    const id = uuidv4();
    const startedAt = new Date().toISOString();
    Inventaires.create({
      id,
      boutiqueId: data.boutiqueId ?? null,
      status: "brouillon",
      exportPath: data.exportPath ?? null,
      lignes: "[]" as any,
      startedAt,
      validatedAt: null,
      createdBy: data.createdBy,
    } as any);
    return getInventaireById(id);
  } catch (e) { console.error(e); return null; }
}

export function updateInventaireLignes(id: string, lignes: LigneInventaire[]): boolean {
  try {
    Inventaires.update(id, { lignes: JSON.stringify(lignes) } as any);
    return true;
  } catch (e) { console.error(e); return false; }
}

export function cancelInventaire(id: string): boolean {
  try {
    Inventaires.update(id, { status: "annule", validatedAt: new Date().toISOString() } as any);
    return true;
  } catch (e) { console.error(e); return false; }
}

/**
 * Valide l'inventaire : pour chaque ligne avec quantiteCompte != null,
 * REMPLACE la quantité dans stocks_boutique. Les lignes sans quantité
 * comptée gardent leur valeur actuelle. Recalcule Article.stockTotal.
 */
export function validateInventaire(id: string): { ok: boolean; appliedCount: number } | null {
  try {
    const inv = getInventaireById(id);
    if (!inv) return null;
    const touchedArticles = new Set<string>();
    let applied = 0;
    const updatedAt = new Date().toISOString();
    for (const ligne of inv.lignes) {
      if (ligne.quantiteCompte == null) continue;
      const qte = Math.max(0, Math.floor(Number(ligne.quantiteCompte) || 0));
      const existing = getStockEntry(ligne.boutiqueId, ligne.articleId, ligne.varianteId ?? undefined);
      if (existing) {
        StocksBoutique.update(existing.id, { quantite: qte, updatedAt } as any);
        syncState.markDirty("stocks_boutique", existing.id);
      } else {
        const newId = uuidv4();
        StocksBoutique.create({
          id: newId,
          boutiqueId: ligne.boutiqueId,
          articleId: ligne.articleId,
          varianteId: ligne.varianteId ?? null,
          quantite: qte,
          updatedAt,
        } as any);
        syncState.markDirty("stocks_boutique", newId);
      }
      touchedArticles.add(ligne.articleId);
      applied++;
    }
    for (const aid of touchedArticles) recomputeArticleStockTotal(aid);
    Inventaires.update(id, { status: "valide", validatedAt: updatedAt } as any);
    return { ok: true, appliedCount: applied };
  } catch (e) { console.error(e); return null; }
}

// ======================== ENTREPRISE ========================

const Entreprises = db.createModel<Entreprise>("entreprises", {
  id: "TEXT PRIMARY KEY NOT NULL",
  matricule: "TEXT NOT NULL DEFAULT ''",
  nom: "TEXT NOT NULL DEFAULT ''",
  adresse: "TEXT NOT NULL DEFAULT ''",
  telephone: "TEXT NOT NULL DEFAULT ''",
  email: "TEXT NOT NULL DEFAULT ''",
  logoDataUrl: "TEXT NOT NULL DEFAULT ''",
  notesDevis: "TEXT NOT NULL DEFAULT ''",
  notesFacture: "TEXT NOT NULL DEFAULT ''",
  conditionsPaiement: "TEXT NOT NULL DEFAULT ''",
  setupDone: "INTEGER NOT NULL DEFAULT 0",
  customFields: "TEXT NOT NULL DEFAULT '[]'",
  devisPrefix: "TEXT NOT NULL DEFAULT 'DEV'",
  facturePrefix: "TEXT NOT NULL DEFAULT 'FAC'",
  numeroFormat: "TEXT NOT NULL DEFAULT 'PREFIX-YYYY-NNNN'",
  tvaDefault: "REAL NOT NULL DEFAULT 19.25",
  devise: "TEXT NOT NULL DEFAULT 'FCFA'",
  afficherTVA: "INTEGER NOT NULL DEFAULT 1",
});

const createEntrepriseTable = async () => {
  await Entreprises.createTable();
  const existing = Entreprises.findById('default');
  if (!existing) {
    Entreprises.create({
      id: 'default',
      matricule: '',
      nom: '',
      adresse: '',
      telephone: '',
      email: '',
      logoDataUrl: '',
      notesDevis: '',
      notesFacture: '',
      conditionsPaiement: '',
      setupDone: 0,
      customFields: '[]',
      devisPrefix: 'DEV',
      facturePrefix: 'FAC',
      numeroFormat: 'PREFIX-YYYY-NNNN',
      tvaDefault: 19.25,
      devise: 'FCFA',
      afficherTVA: 1,
    } as any);
  }
};

function parseEntreprise(row: any): Entreprise | null {
  if (!row) return null;
  const setupDone = row.setupDone === 1 || row.setupDone === true || !!String(row.nom ?? '').trim();
  return {
    ...row,
    setupDone,
    afficherTVA: row.afficherTVA === 1 || row.afficherTVA === true,
    customFields: typeof row.customFields === 'string'
      ? JSON.parse(row.customFields || '[]')
      : (row.customFields ?? []),
  };
}

export async function getEntreprise(): Promise<Entreprise | null> {
  try {
    const row = await Entreprises.findById('default');
    return parseEntreprise(row);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function updateEntreprise(data: Partial<Omit<Entreprise, 'id'>>): Promise<Entreprise | null> {
  try {
    const updateData: any = { ...data };
    if (data.customFields !== undefined) {
      updateData.customFields = JSON.stringify(data.customFields);
    }
    if (data.setupDone !== undefined) {
      updateData.setupDone = data.setupDone ? 1 : 0;
    }
    if (data.afficherTVA !== undefined) {
      updateData.afficherTVA = data.afficherTVA ? 1 : 0;
    }

    const checkData = await Entreprises.findById("default")

    if(checkData === null) {
      await Entreprises.create({
      id: 'default',
      devisPrefix: 'DEV',
      facturePrefix: 'FAC',
      numeroFormat: 'PREFIX-YYYY-NNNN',
      tvaDefault: 19.25,
      devise: 'FCFA',
      ...updateData
    } as any)

    return getEntreprise();
    }

    await Entreprises.update('default', updateData);
    syncState.markDirty('entreprises', 'default');
    return getEntreprise();
  } catch (e) {
    console.error(e);
    return null;
  }
}


// ======================== HISTORIQUE ARTICLE ========================

export type ArticleHistoryEvent =
  | {
      type: 'vente';
      date: string;
      factureId: string;
      factureNumero: string;
      statut: string;
      quantite: number;
      montantTTC: number;
      clientId: string | null;
      clientNom: string | null;
      vendeurId: string | null;
      vendeurNom: string | null;
    }
  | {
      type: 'transfert';
      date: string;
      sens: SensTransfert;
      quantite: number;
      sourceId: string | null;
      sourceNom: string | null;
      destId: string | null;
      destNom: string | null;
      userId: string | null;
      userNom: string | null;
      note: string | null;
    }
  | {
      type: 'inventaire';
      date: string;
      inventaireId: string;
      boutiqueId: string | null;
      boutiqueNom: string | null;
      quantiteCompte: number;
      userId: string | null;
      userNom: string | null;
    };

export function getArticleHistory(articleId: string): ArticleHistoryEvent[] {
  const events: ArticleHistoryEvent[] = [];
  const adminName = (id: string | null | undefined) => {
    if (!id) return null;
    const a: any = getAdministrateurById(id);
    if (!a) return null;
    return [a.prenom, a.nom].filter(Boolean).join(' ').trim() || a.email || null;
  };
  const clientName = (id: string | null | undefined) => {
    if (!id) return null;
    const c: any = getClientById(id);
    if (!c) return null;
    return c.nom || c.raisonSociale || c.email || null;
  };
  const boutiqueName = (id: string | null | undefined) => {
    if (!id) return null;
    const b: any = getBoutiqueById(id);
    return b?.nom ?? null;
  };

  try {
    const factureRows = orm.query<any>(
      "SELECT * FROM factures WHERE statut != 'brouillon' AND statut != 'annulée' ORDER BY dateEmission DESC",
    );
    for (const row of factureRows ?? []) {
      const lignes: any[] = typeof row.lignes === 'string' ? JSON.parse(row.lignes || '[]') : (row.lignes ?? []);
      for (const ligne of lignes) {
        if (ligne.articleId !== articleId) continue;
        events.push({
          type: 'vente',
          date: row.dateEmission || row.createdAt,
          factureId: row.id,
          factureNumero: row.numero,
          statut: row.statut,
          quantite: Number(ligne.quantite) || 0,
          montantTTC: Number(ligne.montantTotalTTC) || 0,
          clientId: row.clientId ?? null,
          clientNom: clientName(row.clientId),
          vendeurId: row.createdBy ?? null,
          vendeurNom: adminName(row.createdBy),
        });
      }
    }
  } catch (e) { console.error('[history] factures', e); }

  try {
    const transferts = orm.query<TransfertStock>(
      "SELECT * FROM transferts_stock WHERE articleId = ? ORDER BY createdAt DESC",
      [articleId],
    );
    for (const t of transferts ?? []) {
      events.push({
        type: 'transfert',
        date: t.createdAt,
        sens: t.sens,
        quantite: t.quantite,
        sourceId: t.boutiqueSourceId ?? null,
        sourceNom: boutiqueName(t.boutiqueSourceId),
        destId: t.boutiqueDestId ?? null,
        destNom: boutiqueName(t.boutiqueDestId),
        userId: t.userId ?? null,
        userNom: adminName(t.userId),
        note: t.note ?? null,
      });
    }
  } catch (e) { console.error('[history] transferts', e); }

  try {
    const invs = orm.query<any>(
      "SELECT * FROM inventaires WHERE status = 'valide' ORDER BY validatedAt DESC",
    );
    for (const row of invs ?? []) {
      const lignes: any[] = typeof row.lignes === 'string' ? JSON.parse(row.lignes || '[]') : (row.lignes ?? []);
      for (const ligne of lignes) {
        if (ligne.articleId !== articleId) continue;
        if (ligne.quantiteCompte === null || ligne.quantiteCompte === undefined) continue;
        events.push({
          type: 'inventaire',
          date: row.validatedAt || row.startedAt,
          inventaireId: row.id,
          boutiqueId: ligne.boutiqueId ?? null,
          boutiqueNom: boutiqueName(ligne.boutiqueId),
          quantiteCompte: Number(ligne.quantiteCompte) || 0,
          userId: row.createdBy ?? null,
          userNom: adminName(row.createdBy),
        });
      }
    }
  } catch (e) { console.error('[history] inventaires', e); }

  events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return events;
}

// ======================== SEED & MIGRATION STOCK ========================

/**
 * À la première init :
 *  - crée la boutique "Stock principal" si aucune boutique n'existe.
 *  - migre Article.stockTotal vers stocks_boutique (entrée par article, varianteId null)
 *    pour les articles non encore présents.
 */
function seedAndMigrateStockPrincipal() {
  try {
    let principale = getBoutiquePrincipale();
    if (!principale) {
      const row = orm.get<{ c: number }>("SELECT COUNT(*) AS c FROM boutiques");
      const c = row?.c;
      if (!c || Number(c) === 0) {
        const id = uuidv4();
        const now = new Date().toISOString();
        Boutiques.create({
          id,
          nom: "Stock principal",
          adresse: null as any,
          userId: null as any,
          isPrincipal: 1 as any,
          statut: "actif",
          createdAt: now,
          updatedAt: now,
        } as any);
        principale = getBoutiqueById(id);
      }
    }
    if (!principale) return;
    const articles = orm.query<{ id: string; stockTotal: number }>("SELECT id, stockTotal FROM articles");
    if (Array.isArray(articles)) {
      for (const a of articles) {
        const existing = getStockEntry(principale.id, a.id, undefined);
        if (!existing && (a.stockTotal ?? 0) > 0) {
          StocksBoutique.create({
            id: uuidv4(),
            boutiqueId: principale.id,
            articleId: a.id,
            varianteId: null as any,
            quantite: Number(a.stockTotal) || 0,
            updatedAt: new Date().toISOString(),
          } as any);
        }
      }
    }
  } catch (e) { console.error("seedAndMigrateStockPrincipal:", e); }
}

// ======================== SYNC_STATE (Phase 3.1 + 3.2) ========================
// Miroir local de la table sync_state du serveur. Sert à :
//   • mémoriser la dernière version serveur connue par row (champ `version`),
//   • tracker les mutations locales non encore pushées (champ `dirty`),
//   • marquer les suppressions locales (champ `deleted`),
//   • borner le `since` du prochain pull via `maxVersion()`.
// La table est créée idempotemment au démarrage (pattern Kataleya). Aucun
// helper ne touche aux tables métier — c'est purement un index de sync.

async function createSyncStateTable() {
  orm.exec(
    `CREATE TABLE IF NOT EXISTS sync_state (
       table_name    TEXT NOT NULL,
       element_id    TEXT NOT NULL,
       version       INTEGER NOT NULL DEFAULT 0,
       localVersion  INTEGER NOT NULL DEFAULT 0,
       dirty         INTEGER NOT NULL DEFAULT 0,
       deleted       INTEGER NOT NULL DEFAULT 0,
       lastPulledAt  TEXT,
       lastPushedAt  TEXT,
       PRIMARY KEY (table_name, element_id)
     )`,
  );
  orm.exec(
    `CREATE INDEX IF NOT EXISTS idx_local_sync_dirty
       ON sync_state(dirty) WHERE dirty = 1`,
  );
}

type SyncStateRow = {
  table_name: string;
  element_id: string;
  version: number;
  localVersion: number;
  dirty: number;
  deleted: number;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
};

export const syncState = {
  /** Max version serveur connue localement → `since` du prochain pull. */
  maxVersion(): number {
    const row = orm.get<{ v: number | null }>(
      "SELECT MAX(version) AS v FROM sync_state",
    );
    return Number(row?.v ?? 0);
  },

  /** Lignes à pusher, ordonnées par ancienneté de push (jamais pushé en tête). */
  getDirty(): SyncStateRow[] {
    return (
      orm.query<SyncStateRow>(
        `SELECT * FROM sync_state
         WHERE dirty = 1
         ORDER BY (lastPushedAt IS NULL) DESC, lastPushedAt ASC`,
      ) ?? []
    );
  },

  get(table: string, id: string): SyncStateRow | null {
    const rows = orm.query<SyncStateRow>(
      `SELECT * FROM sync_state WHERE table_name = ? AND element_id = ?`,
      [table, id],
    );
    return rows?.[0] ?? null;
  },

  /**
   * Une mutation locale (create/update/delete) vient d'être appliquée :
   *  • upsert la row sync_state,
   *  • bump `localVersion`,
   *  • passe `dirty=1` (sera consommé au prochain push).
   * Pour les deletes, passer `deleted=true` → l'entrée reste pour informer le
   * serveur (tombstone client).
   */
  markDirty(table: string, id: string, opts?: { deleted?: boolean }): void {
    const deleted = opts?.deleted ? 1 : 0;
    orm.run(
      `INSERT INTO sync_state (table_name, element_id, version, localVersion, dirty, deleted)
       VALUES (?, ?, 0, 1, 1, ?)
       ON CONFLICT(table_name, element_id) DO UPDATE SET
         localVersion = sync_state.localVersion + 1,
         dirty        = 1,
         deleted      = excluded.deleted`,
      [table, id, deleted],
    );
  },

  /**
   * Push réussi : on enregistre la version serveur retournée et on remet
   * `dirty=0`. `lastPushedAt` sert à round-robin équitablement les retries.
   */
  markClean(table: string, id: string, serverVersion: number): void {
    const now = new Date().toISOString();
    orm.run(
      `UPDATE sync_state
         SET version = ?, dirty = 0, lastPushedAt = ?
       WHERE table_name = ? AND element_id = ?`,
      [serverVersion, now, table, id],
    );
  },

  /**
   * Pull : on applique l'entrée serveur dans le miroir local. **Ne touche pas
   * `dirty`** : si la row est dirty et que le serveur est plus récent, le push
   * suivant déclenchera l'arbitrage LWW et résoudra le conflit.
   */
  applyRemote(entry: {
    table: string;
    id: string;
    version: number;
    deleted?: boolean;
  }): void {
    const now = new Date().toISOString();
    const deleted = entry.deleted ? 1 : 0;
    orm.run(
      `INSERT INTO sync_state (table_name, element_id, version, deleted, lastPulledAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(table_name, element_id) DO UPDATE SET
         version      = excluded.version,
         deleted      = excluded.deleted,
         lastPulledAt = excluded.lastPulledAt`,
      [entry.table, entry.id, entry.version, deleted, now],
    );
  },

  /** Pull batch : applique plusieurs entrées serveur dans une transaction. */
  batchApplyRemote(entries: Array<{
    table: string;
    id: string;
    version: number;
    deleted?: boolean;
  }>): void {
    const now = new Date().toISOString();
    orm.transaction(() => {
      for (const entry of entries) {
        const deleted = entry.deleted ? 1 : 0;
        orm.run(
          `INSERT INTO sync_state (table_name, element_id, version, deleted, lastPulledAt)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(table_name, element_id) DO UPDATE SET
             version      = excluded.version,
             deleted      = excluded.deleted,
             lastPulledAt = excluded.lastPulledAt`,
          [entry.table, entry.id, entry.version, deleted, now],
        );
      }
    });
  },

  /** Compte total — utile pour décider d'un bootstrap initial. */
  isEmpty(): boolean {
    const row = orm.get<{ n: number }>("SELECT COUNT(*) AS n FROM sync_state");
    return Number(row?.n ?? 0) === 0;
  },
};

// ======================== APPLY REMOTE (Phase 4) ========================
// Dispatcher pour les entrées venant du serveur (pull) : applique upsert/delete
// SANS passer par les wrappers métier (donc sans markDirty) puis enregistre la
// nouvelle version serveur dans `sync_state` via `applyRemote`.
//
// `data` est la ligne canonique renvoyée par le serveur (peut être null pour
// les tombstones). Les champs objet/tableau sont JSON.stringify-és avant
// l'upsert pour respecter le typage TEXT des colonnes (cf. wrappers).

const SYNC_MODEL_MAP = {
  articles: Articles,
  clients: Clients,
  collections: Collections,
  sous_collections: SousCollections,
  administrateurs: Administrateurs,
  devis: Devis,
  factures: Factures,
  lignes_documents: LignesDocuments,
  techniciens: Techniciens,
  projets: Projets,
  taches_projet: TachesProjet,
  boutiques: Boutiques,
  stocks_boutique: StocksBoutique,
  transferts_stock: TransfertsStock,
  entreprises: Entreprises,
} as const;

type SyncTableName = keyof typeof SYNC_MODEL_MAP;

function normalizeForSqlite(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = v;
  }
  return out;
}

export type RemoteSyncEntry = {
  table: string;
  id: string;
  version: number;
  deleted?: boolean;
  data?: Record<string, unknown> | null;
};

export type BatchResult = { ok: number; failed: number };

export function batchApplyRemoteEntries(entries: RemoteSyncEntry[]): BatchResult {
  const byTable = new Map<string, RemoteSyncEntry[]>();
  for (const e of entries) {
    const list = byTable.get(e.table) || [];
    list.push(e);
    byTable.set(e.table, list);
  }

  let ok = 0;
  let failed = 0;

  for (const [tableName, tableEntries] of byTable) {
    const model = (SYNC_MODEL_MAP as Record<string, any>)[tableName];
    if (!model) {
      console.warn(`[sync:batchApplyRemote] table inconnue: ${tableName}`);
      failed += tableEntries.length;
      continue;
    }

    try {
      // BUG-001 fix : ne PAS écraser les lignes dirty localement.
      // Si une ligne est dirty, on saute l'upsert/delete métier mais on
      // enregistre quand même la version serveur dans sync_state. Le push
      // enverra les données locales au prochain cycle, et l'arbitrage LWW
      // côté serveur tranchera le conflit.
      const isDirty = (id: string): boolean => {
        const state = syncState.get(tableName, id);
        return state ? state.dirty === 1 : false;
      };

      const deletes = tableEntries.filter((e) => e.deleted);
      const upserts = tableEntries.filter((e) => !e.deleted && e.data);

      for (const entry of deletes) {
        if (isDirty(entry.id)) continue;
        try { model.delete(entry.id); } catch { /* idempotent */ }
      }

      const safeUpserts = upserts.filter((e) => !isDirty(e.id));
      if (safeUpserts.length > 0) {
        const payloads = safeUpserts.map((e) =>
          normalizeForSqlite({ ...e.data!, id: e.id }),
        );
        model.batchUpsert(payloads);
      }

      syncState.batchApplyRemote(tableEntries);
      ok += tableEntries.length;
    } catch (e) {
      console.error(`[sync:batchApplyRemote] échec table ${tableName}`, e);
      failed += tableEntries.length;
    }
  }

  return { ok, failed };
}

export async function applyRemoteEntry(entry: RemoteSyncEntry): Promise<boolean> {
  const model = (SYNC_MODEL_MAP as Record<string, any>)[entry.table];
  if (!model) {
    console.warn(`[sync:applyRemote] table inconnue: ${entry.table}`);
    return false;
  }
  try {
    if (entry.deleted) {
      try { await model.delete(entry.id); } catch { /* idempotent */ }
    } else if (entry.data) {
      const payload = normalizeForSqlite({ ...entry.data, id: entry.id });
      await model.upsert(payload);
    }
    syncState.applyRemote({
      table: entry.table,
      id: entry.id,
      version: entry.version,
      deleted: !!entry.deleted,
    });
    return true;
  } catch (e) {
    console.error(`[sync:applyRemote] échec ${entry.table}/${entry.id}`, e);
    return false;
  }
}

// Liste des tables instrumentées côté serveur (= mêmes que SYNC_MODEL_MAP).
// Exposée pour que le client puisse itérer au bootstrap initial.
export const SYNCABLE_TABLES: SyncTableName[] = [
  "administrateurs",
  "clients",
  "collections",
  "sous_collections",
  "articles",
  "devis",
  "factures",
  "lignes_documents",
  "techniciens",
  "projets",
  "taches_projet",
  "boutiques",
  "stocks_boutique",
  "transferts_stock",
  "entreprises",
];

// ======================== PHASE 5.1 — Seed local sync_state ========================
// Lorsqu'un poste déjà installé reçoit la nouvelle version (avec sync_state) et
// que sa table `sync_state` est encore vide alors qu'il a déjà des données
// métier, on crée une row sync_state pour chaque ligne métier existante :
//   • version=0      → le serveur n'a rien d'autoritatif pour cette ligne,
//   • localVersion=1 → marqueur de mutation locale,
//   • dirty=1        → sera pushé au prochain sync (LWW côté serveur tranche).
//
// Idempotent : `WHERE NOT EXISTS (…)` garantit qu'un re-run ne duplique rien.
// Gating supplémentaire : on ne lance le seed que si `sync_state` est vide ET
// qu'au moins une table métier contient des lignes. Sinon (DB neuve), rien à
// faire — le bootstrap initial via `GET /sync-state/full` peuplera tout.
function seedLocalSyncStateIfNeeded() {
  if (!syncState.isEmpty()) return;

  let totalBusinessRows = 0;
  for (const table of SYNCABLE_TABLES) {
    const r = orm.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    totalBusinessRows += Number(r?.n ?? 0);
    if (totalBusinessRows > 0) break;
  }
  if (totalBusinessRows === 0) return;

  console.info("[sync:seed] sync_state vide + données métier existantes → seed local");
  const perTable: Record<string, number> = {};
  for (const table of SYNCABLE_TABLES) {
    const extraCondition = table === "boutiques" ? "AND isPrincipal != 1" : "";
    orm.run(
      `INSERT INTO sync_state (table_name, element_id, version, localVersion, dirty, deleted)
       SELECT ?, id, 0, 1, 1, 0 FROM ${table}
       WHERE NOT EXISTS (
         SELECT 1 FROM sync_state s
         WHERE s.table_name = ? AND s.element_id = ${table}.id
       ) ${extraCondition}`,
      [table, table],
    );
    const after = orm.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_state WHERE table_name = ?`,
      [table],
    );
    perTable[table] = Number(after?.n ?? 0);
  }
  console.info("[sync:seed] terminé", perTable);
}

export async function initializeTables() {
  try {
    await createSyncStateTable();
    await createArticlesTable();
    await createClientsTable();
    await createCollectionsTable();
    await createSousCollectionsTable();
    await createDevisTable();
    await createFacturesTable();
    await createLignesDocumentsTable();
    await createAdministrateursTable();
    await createTechniciensTable();
    await createProjetsTable();
    await createTachesProjetTable();
    await createBoutiquesTable();
    await createStocksBoutiqueTable();
    await createTransfertsStockTable();
    await createInventairesTable();
    await createEntrepriseTable();
    runMigrations(orm);
    seedAndMigrateStockPrincipal();
    seedLocalSyncStateIfNeeded();
    return true;
  } catch (e) {
    console.error("Erreur lors de l'initialisation des tables:", e);
    return false;
  }
}

export {
    createSousCollectionsTable,
    createArticlesTable,
    createCollectionsTable,
    createDevisTable,
    createFacturesTable,
    createLignesDocumentsTable,
    createAdministrateursTable,
    createBoutiquesTable,
    createStocksBoutiqueTable,
    createTransfertsStockTable,
    createInventairesTable,
    createEntrepriseTable,
}