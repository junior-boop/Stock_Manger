/**
 * Database API Helper
 * Utilise les APIs exposées via preload.ts (contextBridge)
 * Accès sécurisé à la base de données depuis le renderer
 */

declare global {
  interface Window {
    db: {
      articles: any;
      clients: any;
      collections: any;
      sousCollections: any;
      administrateurs: any;
      devis: any;
      factures: any;
      lignesDocuments: any;
      images: any;
      techniciens: any;
      projets: any;
      tachesProjet: any;
      boutiques: any;
      stocksBoutique: any;
      transfertsStock: any;
      inventaires: any;
    };
    win: {
      minimize: () => Promise<void>;
      maximize: () => Promise<boolean>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
    };
    auth: {
      isSetupDone: () => Promise<boolean>;
      setup: (data: {
        nom: string;
        prenom: string;
        email: string;
        telephone?: string;
        motDePasse: string;
      }) => Promise<{ ok: boolean; error?: string; user?: any }>;
      login: (email: string, motDePasse: string) => Promise<{ ok: boolean; error?: string; user?: any }>;
      logout: () => Promise<{ ok: boolean }>;
      me: () => Promise<any | null>;
      hasPermission: (action: string) => Promise<boolean>;
      createUser: (data: {
        nom: string;
        prenom: string;
        email: string;
        telephone?: string;
        role: 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur';
        motDePasse: string;
        statut?: 'actif' | 'inactif' | 'archivé';
      }) => Promise<{ ok: boolean; error?: string; user?: any }>;
      updateUserPassword: (id: string, motDePasse: string) => Promise<{ ok: boolean; error?: string }>;
      setupOnline: (email: string, motDePasse: string) => Promise<{ ok: boolean; error?: string; user?: any }>;
    };
    exportApi: {
      articlesExcel: () => Promise<{ canceled: boolean; filePath?: string; count?: number }>;
    };
    companyApi: {
      get: () => Promise<CompanyInfo>;
      set: (data: Partial<CompanyInfo>) => Promise<CompanyInfo>;
    };
    syncApi: {
      getConfig: () => Promise<SyncConfigShape>;
      setConfig: (data: Partial<SyncConfigShape>) => Promise<SyncConfigShape>;
      login: (email: string, motDePasse: string) => Promise<{ ok: boolean; user?: { id: string; email: string; nom: string; role: string }; error?: string }>;
      logout: () => Promise<{ ok: boolean }>;
      testConnection: () => Promise<{ ok: boolean; data?: { ok: boolean; time: number }; error?: string }>;
      initServer: () => Promise<{ ok: boolean; data?: unknown; error?: string }>;
      markLastSync: () => Promise<SyncConfigShape>;
      linkDevice: (serverUrl: string, email: string, motDePasse: string) => Promise<{ ok: boolean; error?: string }>;
      applyRemote: (entry: {
        table: string;
        id: string;
        version: number;
        deleted?: boolean;
        data?: Record<string, unknown> | null;
      }) => Promise<boolean>;
      syncState: {
        maxVersion: () => Promise<number>;
        isEmpty: () => Promise<boolean>;
        getDirty: () => Promise<Array<{
          table_name: string;
          element_id: string;
          version: number;
          localVersion: number;
          dirty: number;
          deleted: number;
          lastPulledAt: string | null;
          lastPushedAt: string | null;
        }>>;
        get: (table: string, id: string) => Promise<any | null>;
        markClean: (table: string, id: string, version: number) => Promise<boolean>;
      };
      syncableTables: () => Promise<string[]>;
      onRemoteChange: (
        cb: (payload: { table: string; id: string; deleted: boolean }) => void,
      ) => () => void;
    };
  }
}

export type SyncConfigShape = {
  serverUrl: string;
  token: string;
  clientId: string;
  enabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
};

export type CustomField = {
  id: string;
  type: 'email' | 'tel' | 'url' | 'address' | 'text';
  label: string;
  value: string;
};
export type CompanyInfo = {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  logoDataUrl: string;
  notesDevis: string;
  notesFacture: string;
  conditionsPaiement: string;
  setupDone: boolean;
  customFields: CustomField[];
  devisPrefix: string;
  facturePrefix: string;
  numeroFormat: string;
  tvaDefault: number;
  devise: string;
  afficherTVA: boolean;
};

// Réexport les APIs pour plus de commodité
export const db = window.db;

/**
 * UTILISATION:
 * 
 * import { db } from '@/context/databaseApi';
 * 
 * // Récupérer tous les clients
 * const clients = await db.clients.getAll();
 * 
 * // Créer un nouvel article
 * await db.articles.create({
 *   nom: 'Chaise',
 *   reference: 'ART-001',
 *   prixHT: 50000,
 *   tauxTVA: 19.25,
 *   unite: 'unité',
 *   stockTotal: 10,
 *   statut: 'actif',
 *   collectionId: 'collection-id',
 *   createdBy: 'admin-id'
 * });
 * 
 * // Récupérer les devis d'un client
 * const devis = await db.devis.getByClientId(clientId);
 * 
 * // Mettre à jour
 * await db.clients.update(clientId, { nom: 'Nouveau nom' });
 * 
 * // Supprimer
 * await db.articles.delete(articleId);
 * 
 * // Récupérer sous-collections d'une collection
 * const subCollections = await db.sousCollections.getByCollectionId(collectionId);
 * 
 * // Récupérer lignes d'un article
 * const lignes = await db.lignesDocuments.getByArticleId(articleId);
 */

// APIs disponibles par entité:
// - articles: { getById, getAll, create, update, delete }
// - clients: { getById, getAll, create, update, delete }
// - collections: { getById, getAll, create, update, delete }
// - sousCollections: { getById, getAll, getByCollectionId, create, update, delete }
// - administrateurs: { getById, getAll, create, update, delete }
// - devis: { getById, getAll, getByClientId, create, update, delete }
// - factures: { getById, getAll, getByClientId, create, update, delete }
// - lignesDocuments: { getById, getAll, getByArticleId, create, update, delete }
