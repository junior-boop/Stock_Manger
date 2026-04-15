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
} from "./db"

import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";


export function checkDatabase() {
  const db = new Database("./notes.sqlite");
  const stml = db.prepare("SELECT 1+1 AS result");
  const result = stml.run();
  return result;
}

export const orm = new SimpleORM("./notes.sqlite");
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

export function createArticles(data: Omit<Article, "id" | "createdAt" | "updatedAt | createdBy | prixTTC">) {
  try {
    const prixTTC = data.prixHT * (1 + data.tauxTVA / 100);
    const result = Articles.create({
      id: uuidv4(),
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateArticles(id: string, data: Partial<Omit<Article, "id" | "createdAt" | "createdBy">>) {
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteArticles(id: string) {
  try {
    const result = Articles.delete(id);
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

export function createClient(data: Omit<Client, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = Clients.create({
      id: uuidv4(),
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateClient(id: string, data: Partial<Omit<Client, "id" | "createdAt" | "createdBy">>) {
  try {
    const updateData: any = { ...data };
    if (data.adresse) {
      updateData.adresse = JSON.stringify(data.adresse);
    }
    updateData.updatedAt = new Date().toISOString();
    const result = Clients.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteClient(id: string) {
  try {
    const result = Clients.delete(id);
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
  image: "TEXT",
  ordre: "INTEGER",
  statut: "TEXT NOT NULL",
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

export function createCollection(data: Omit<Collection, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = Collections.create({
      id: uuidv4(),
      nom: data.nom,
      description: data.description,
      image: data.image,
      ordre: data.ordre,
      statut: data.statut,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateCollection(id: string, data: Partial<Omit<Collection, "id" | "createdAt">>) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = Collections.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteCollection(id: string) {
  try {
    const result = Collections.delete(id);
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

export function createSousCollection(data: Omit<SousCollection, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = SousCollections.create({
      id: uuidv4(),
      collectionId: data.collectionId,
      nom: data.nom,
      description: data.description,
      image: data.image,
      ordre: data.ordre,
      statut: data.statut,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateSousCollection(id: string, data: Partial<Omit<SousCollection, "id" | "createdAt">>) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = SousCollections.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteSousCollection(id: string) {
  try {
    const result = SousCollections.delete(id);
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

export function createAdministrateur(data: Omit<Administrateur, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = Administrateurs.create({
      id: uuidv4(),
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateAdministrateur(id: string, data: Partial<Omit<Administrateur, "id" | "createdAt" | "createdBy">>) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = Administrateurs.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteAdministrateur(id: string) {
  try {
    const result = Administrateurs.delete(id);
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
  totalHT: "INTEGER NOT NULL",
  totalTVA: "INTEGER NOT NULL",
  totalTTC: "INTEGER NOT NULL",
  remiseGlobale: "INTEGER NOT NULL DEFAULT 0",
  totalApreRemise: "INTEGER NOT NULL",
  statut: "TEXT NOT NULL",
  dateEmission: "DATETIME NOT NULL",
  dateValidite: "DATETIME NOT NULL",
  dateAcceptation: "DATETIME",
  notes: "TEXT",
  conditionsPaiement: "TEXT",
  factureId: "TEXT",
  createdAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "DATETIME DEFAULT CURRENT_TIMESTAMP",
  createdBy: "TEXT NOT NULL",
});

const createDevisTable = async () => {
  await Devis.createTable();
};

export function getDevisById(id: string) {
  try {
    const result = Devis.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllDevis() {
  try {
    const result = await Devis.findAll({ orderBy : { column : "numero", order : "DESC"}});
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getDevisByClientId(clientId: string) {
  try {
    const result = await Devis.findAll({ where : { clientId : clientId }, orderBy : { column : "numero", order : "DESC"}});
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createDevis(data: Omit<Devis, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = Devis.create({
      id: uuidv4(),
      numero: data.numero,
      clientId: data.clientId,
      lignes: JSON.stringify(data.lignes),
      totalHT: data.totalHT,
      totalTVA: data.totalTVA,
      totalTTC: data.totalTTC,
      remiseGlobale: data.remiseGlobale || 0,
      totalApreRemise: data.totalApreRemise,
      statut: data.statut,
      dateEmission: data.dateEmission,
      dateValidite: data.dateValidite,
      dateAcceptation: data.dateAcceptation,
      notes: data.notes,
      conditionsPaiement: data.conditionsPaiement,
      factureId: data.factureId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy,
    });
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateDevis(id: string, data: Partial<Omit<Devis, "id" | "createdAt" | "createdBy">>) {
  try {
    const updateData: any = { ...data };
    if (data.lignes) {
      updateData.lignes = JSON.stringify(data.lignes);
    }
    updateData.updatedAt = new Date().toISOString();
    const result = Devis.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteDevis(id: string) {
  try {
    const result = Devis.delete(id);
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
  totalHT: "INTEGER NOT NULL",
  totalTVA: "INTEGER NOT NULL",
  totalTTC: "INTEGER NOT NULL",
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

export function getFactureById(id: string) {
  try {
    const result = Factures.findById(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getAllFactures() {
  try {
    const result = await Factures.orderBy("numero", "DESC").findAll();
    return result;
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function createFacture(data: Omit<Facture, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = Factures.create({
      id: uuidv4(),
      numero: data.numero,
      clientId: data.clientId,
      devisId: data.devisId,
      lignes: JSON.stringify(data.lignes),
      totalHT: data.totalHT,
      totalTVA: data.totalTVA,
      totalTTC: data.totalTTC,
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateFacture(id: string, data: Partial<Omit<Facture, "id" | "createdAt" | "createdBy">>) {
  try {
    const updateData: any = { ...data };
    if (data.lignes) {
      updateData.lignes = JSON.stringify(data.lignes);
    }
    if (data.paiements) {
      updateData.paiements = JSON.stringify(data.paiements);
    }
    updateData.updatedAt = new Date().toISOString();
    const result = Factures.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteFacture(id: string) {
  try {
    const result = Factures.delete(id);
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

export function createLigneDocument(data: Omit<LigneDocument, "id" | "createdAt" | "updatedAt">) {
  try {
    const result = LignesDocuments.create({
      id: uuidv4(),
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
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function updateLigneDocument(id: string, data: Partial<Omit<LigneDocument, "id" | "createdAt">>) {
  try {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const result = LignesDocuments.update(id, updateData);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function deleteLigneDocument(id: string) {
  try {
    const result = LignesDocuments.delete(id);
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function initializeTables() {
  try {
    await createArticlesTable();
    await createClientsTable();
    await createCollectionsTable();
    await createSousCollectionsTable();
    await createDevisTable();
    await createFacturesTable();
    await createLignesDocumentsTable();
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
    createAdministrateursTable
}