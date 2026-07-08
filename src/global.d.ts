// global.d.ts
// Typage global de l'API exposée par le preload via contextBridge.
// À placer à la racine du renderer (ex: src/types/global.d.ts) et inclure
// dans tsconfig.json ("include": ["src/**/*.d.ts", ...]).
//
// NB: les types `any` correspondent aux entités dont le shape exact vit côté
// main (Databases/*). Remplace-les progressivement par tes vrais types
// (Client, Article, Devis, Facture, etc.) importés depuis un fichier partagé
// entre main et renderer si tu veux du typage bout-en-bout.

import { Entreprise } from "./Databases/db";

export {}; // force ce fichier à être un module, requis pour `declare global`

// ======================== TYPES PARTAGÉS ========================

interface CrudApi<T = any, CreateData = any, UpdateData = any> {
  getById: (id: string) => Promise<T | null>;
  getAll: () => Promise<T[]>;
  create: (data: CreateData) => Promise<T>;
  update: (id: string, data: UpdateData) => Promise<T>;
  delete: (id: string) => Promise<boolean>;
}

type CustomFieldType = 'email' | 'tel' | 'url' | 'address' | 'text';

interface CustomField {
  id: string;
  type: CustomFieldType;
  label: string;
  value: string;
}

interface CompanyInfo {
  matricule: string;
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
}

interface SyncConfig {
  serverUrl: string;
  token: string;
  clientId: string;
  enabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
}

interface SyncUser {
  id: string;
  email: string;
  nom: string;
  role: string;
}

interface SyncLoginResult {
  ok: boolean;
  user?: SyncUser;
  error?: string;
}

interface SyncStateEntry {
  table_name: string;
  element_id: string;
  version: number;
  localVersion: number;
  dirty: number;
  deleted: number;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}

interface RemoteSyncEntry {
  table: string;
  id: string;
  version: number;
  deleted?: boolean;
  data?: Record<string, unknown> | null;
}

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  version: string | null;
  currentVersion: string;
  error: string | null;
  progress: number;
}

type AdminRole = 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur';
type AdminStatut = 'actif' | 'inactif' | 'archivé';

interface SetupData {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  motDePasse: string;
}

interface CreateUserData {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: AdminRole;
  motDePasse: string;
  statut?: AdminStatut;
}

interface AuthResult {
  ok: boolean;
  user?: any;
  error?: string;
}

// ======================== db.* ========================

interface DbApi {
  articles: CrudApi & {
    generateReference: (collectionId: string) => Promise<string>;
    getHistory: (id: string) => Promise<any[]>;
  };
  clients: CrudApi;
  collections: CrudApi;
  sousCollections: CrudApi & {
    getByCollectionId: (collectionId: string) => Promise<any[]>;
  };
  administrateurs: CrudApi;
  devis: CrudApi & {
    getByClientId: (clientId: string) => Promise<any[]>;
  };
  factures: CrudApi & {
    getByClientId: (clientId: string) => Promise<any[]>;
  };
  lignesDocuments: CrudApi & {
    getByArticleId: (articleId: string) => Promise<any[]>;
  };
  images: {
    save: (base64Data: string, filename: string) => Promise<string>;
    getPath: () => Promise<string>;
    get: (filename: string) => Promise<string | null>;
    list: () => Promise<string[]>;
    exists: (filename: string) => Promise<boolean>;
    saveBinary: (bytes: Uint8Array, filename: string) => Promise<string>;
    readBinary: (filename: string) => Promise<Uint8Array | null>;
  };
  techniciens: CrudApi;
  projets: CrudApi & {
    getByClientId: (clientId: string) => Promise<any[]>;
  };
  tachesProjet: {
    getById: (id: string) => Promise<any | null>;
    getByProjetId: (projetId: string) => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    delete: (id: string) => Promise<boolean>;
  };
  boutiques: CrudApi & {
    getPrincipale: () => Promise<any | null>;
  };
  stocksBoutique: {
    getEntry: (boutiqueId: string, articleId: string, varianteId?: string) => Promise<any | null>;
    getByBoutique: (boutiqueId: string) => Promise<any[]>;
    getByArticle: (articleId: string) => Promise<any[]>;
    adjust: (boutiqueId: string, articleId: string, varianteId: string | undefined, delta: number) => Promise<any>;
    recomputeArticleTotal: (articleId: string) => Promise<any>;
  };
  transfertsStock: {
    execute: (data: any) => Promise<any>;
    getAll: () => Promise<any[]>;
    getByBoutique: (boutiqueId: string) => Promise<any[]>;
    adjustBatch: (
      entries: Array<{ boutiqueId: string; articleId: string; varianteId?: string; delta: number }>
    ) => Promise<any>;
  };
  inventaires: {
    getBrouillon: () => Promise<any | null>;
    getById: (id: string) => Promise<any | null>;
    getAll: () => Promise<any[]>;
    create: (data: { boutiqueId?: string | null; exportPath?: string | null; createdBy: string }) => Promise<any>;
    updateLignes: (
      id: string,
      lignes: Array<{ articleId: string; varianteId?: string | null; boutiqueId: string; quantiteCompte: number | null }>
    ) => Promise<any>;
    cancel: (id: string) => Promise<any>;
    validate: (id: string) => Promise<any>;
    exportCurrentBackup: () => Promise<string | null>;
  };
  entreprises: {
    getById: () => Promise<Entreprise | null>;
    get: () => Promise<CompanyInfo>;
    update: (data: Partial<CompanyInfo>) => Promise<CompanyInfo>;
  };
}

// ======================== auth.* ========================

interface AuthApi {
  isSetupDone: () => Promise<boolean>;
  setup: (data: SetupData) => Promise<AuthResult>;
  login: (email: string, motDePasse: string) => Promise<AuthResult>;
  logout: () => Promise<boolean>;
  me: () => Promise<any | null>;
  hasPermission: (action: string) => Promise<boolean>;
  createUser: (data: CreateUserData) => Promise<any>;
  updateUserPassword: (id: string, motDePasse: string) => Promise<boolean>;
  setupOnline: (email: string, motDePasse: string) => Promise<AuthResult>;
}

// ======================== pdf.* / shell.* ========================

interface PdfApi {
  generateDevis: (html: string, filename: string) => Promise<string>;
  generateFacture: (html: string, filename: string) => Promise<string>;
}

interface ShellApi {
  openPath: (p: string) => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (p: string) => Promise<void>;
}

// ======================== syncApi.* ========================

interface SyncApi {
  getConfig: () => Promise<SyncConfig>;
  setConfig: (data: Partial<SyncConfig>) => Promise<SyncConfig>;
  login: (email: string, motDePasse: string) => Promise<SyncLoginResult>;
  logout: () => Promise<{ ok: boolean }>;
  testConnection: () => Promise<{ ok: boolean; data?: { ok: boolean; time: number }; error?: string }>;
  initServer: () => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  markLastSync: () => Promise<SyncConfig>;
  linkDevice: (serverUrl: string, email: string, motDePasse: string) => Promise<{ ok: boolean; error?: string }>;
  applyRemote: (entry: RemoteSyncEntry) => Promise<boolean>;
  applyRemoteBatch: (entries: RemoteSyncEntry[]) => Promise<{ ok: number; failed: number }>;
  syncState: {
    maxVersion: () => Promise<number>;
    isEmpty: () => Promise<boolean>;
    getDirty: () => Promise<SyncStateEntry[]>;
    get: (table: string, id: string) => Promise<any | null>;
    markClean: (table: string, id: string, version: number) => Promise<boolean>;
  };
  syncableTables: () => Promise<string[]>;
  onRemoteChange: (
    cb: (payload: { table: string; id: string; deleted: boolean }) => void
  ) => () => void;
}

// ======================== exportApi.* ========================

interface ExportApi {
  articlesExcel: () => Promise<{ canceled: boolean; filePath?: string; count?: number }>;
}

// ======================== win.* ========================

interface WindowApi {
  platform: NodeJS.Platform;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
}

// ======================== updateApi.* ========================

interface UpdateApi {
  getStatus: () => Promise<UpdateStatus>;
  check: () => Promise<any>;
  download: () => Promise<any>;
  install: () => Promise<any>;
  setFeedURL: (url: string) => Promise<any>;
  onStatus: (cb: (status: UpdateStatus) => void) => () => void;
  onDownloaded: (cb: () => void) => () => void;
}

// ======================== DÉCLARATION GLOBALE ========================

declare global {
  interface Window {
    db: DbApi;
    auth: AuthApi;
    pdf: PdfApi;
    shell: ShellApi;
    syncApi: SyncApi;
    exportApi: ExportApi;
    win: WindowApi;
    updateApi: UpdateApi;
  }
}