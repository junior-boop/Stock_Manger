// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts


import { contextBridge, ipcRenderer } from 'electron';
import { Entreprise } from './Databases/db';


// ======================== CLIENTS ========================
const clientsApi = {
  getById: (id: string) => ipcRenderer.invoke('clients:getById', id),
  getAll: () => ipcRenderer.invoke('clients:getAll'),
  create: (data: any) => ipcRenderer.invoke('clients:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('clients:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('clients:delete', id),
};

// ======================== COLLECTIONS ========================
const collectionsApi = {
  getById: (id: string) => ipcRenderer.invoke('collections:getById', id),
  getAll: () => ipcRenderer.invoke('collections:getAll'),
  create: (data: any) => ipcRenderer.invoke('collections:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('collections:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('collections:delete', id),
};

// ======================== SOUS-COLLECTIONS ========================
const sousCollectionsApi = {
  getById: (id: string) => ipcRenderer.invoke('sous-collections:getById', id),
  getAll: () => ipcRenderer.invoke('sous-collections:getAll'),
  getByCollectionId: (collectionId: string) => ipcRenderer.invoke('sous-collections:getByCollectionId', collectionId),
  create: (data: any) => ipcRenderer.invoke('sous-collections:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('sous-collections:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('sous-collections:delete', id),
};

// ======================== ADMINISTRATEURS ========================
const administrateursApi = {
  getById: (id: string) => ipcRenderer.invoke('administrateurs:getById', id),
  getAll: () => ipcRenderer.invoke('administrateurs:getAll'),
  create: (data: any) => ipcRenderer.invoke('administrateurs:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('administrateurs:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('administrateurs:delete', id),
};

// ======================== DEVIS ========================
const devisApi = {
  getById: (id: string) => ipcRenderer.invoke('devis:getById', id),
  getAll: () => ipcRenderer.invoke('devis:getAll'),
  getByClientId: (clientId: string) => ipcRenderer.invoke('devis:getByClientId', clientId),
  create: (data: any) => ipcRenderer.invoke('devis:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('devis:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('devis:delete', id),
};

// ======================== FACTURES ========================
const facturesApi = {
  getById: (id: string) => ipcRenderer.invoke('factures:getById', id),
  getAll: () => ipcRenderer.invoke('factures:getAll'),
  getByClientId: (clientId: string) => ipcRenderer.invoke('factures:getByClientId', clientId),
  create: (data: any) => ipcRenderer.invoke('factures:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('factures:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('factures:delete', id),
};

// ======================== LIGNES DOCUMENTS ========================
const lignesDocumentsApi = {
  getById: (id: string) => ipcRenderer.invoke('lignes-documents:getById', id),
  getAll: () => ipcRenderer.invoke('lignes-documents:getAll'),
  getByArticleId: (articleId: string) => ipcRenderer.invoke('lignes-documents:getByArticleId', articleId),
  create: (data: any) => ipcRenderer.invoke('lignes-documents:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('lignes-documents:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('lignes-documents:delete', id),
};

// ======================== IMAGES ========================
const imagesApi = {
  save: (base64Data: string, filename: string) => ipcRenderer.invoke('images:save', base64Data, filename),
  getPath: () => ipcRenderer.invoke('images:getPath'),
  get: (filename: string) => ipcRenderer.invoke('images:get', filename),
  list: () => ipcRenderer.invoke('images:list'),
  exists: (filename: string): Promise<boolean> => ipcRenderer.invoke('images:exists', filename),
  saveBinary: (bytes: Uint8Array, filename: string): Promise<string> =>
    ipcRenderer.invoke('images:saveBinary', bytes, filename),
  readBinary: (filename: string): Promise<Uint8Array | null> =>
    ipcRenderer.invoke('images:readBinary', filename),
};

// ======================== ARTICLES ========================
const articlesApi = {
  getById: (id: string) => ipcRenderer.invoke('articles:getById', id),
  getAll: () => ipcRenderer.invoke('articles:getAll'),
  create: (data: any) => ipcRenderer.invoke('articles:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('articles:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('articles:delete', id),
  generateReference: (collectionId: string) => ipcRenderer.invoke('articles:generateReference', collectionId),
  getHistory: (id: string) => ipcRenderer.invoke('articles:getHistory', id),
};

// ======================== AUTH ========================
const authApi = {
  isSetupDone: () => ipcRenderer.invoke('auth:isSetupDone'),
  setup: (data: {
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    motDePasse: string;
  }) => ipcRenderer.invoke('auth:setup', data),
  setupDemo: (data: {
    nom: string;
    prenom: string;
    motDePasse: string;
  }) => ipcRenderer.invoke('auth:setupDemo', data),
  login: (email: string, motDePasse: string) =>
    ipcRenderer.invoke('auth:login', email, motDePasse),
  logout: () => ipcRenderer.invoke('auth:logout'),
  me: () => ipcRenderer.invoke('auth:me'),
  hasPermission: (action: string) =>
    ipcRenderer.invoke('auth:hasPermission', action),
  createUser: (data: {
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    role: 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur' | 'demo';
    motDePasse: string;
    statut?: 'actif' | 'inactif' | 'archivé';
  }) => ipcRenderer.invoke('auth:createUser', data),
  updateUserPassword: (id: string, motDePasse: string) =>
    ipcRenderer.invoke('auth:updateUserPassword', id, motDePasse),
  setupOnline: (email: string, motDePasse: string) =>
    ipcRenderer.invoke('auth:setupOnline', email, motDePasse),
};

// ======================== TECHNICIENS ========================
const techniciensApi = {
  getById: (id: string) => ipcRenderer.invoke('techniciens:getById', id),
  getAll: () => ipcRenderer.invoke('techniciens:getAll'),
  create: (data: any) => ipcRenderer.invoke('techniciens:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('techniciens:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('techniciens:delete', id),
};

// ======================== PROJETS ========================
const projetsApi = {
  getById: (id: string) => ipcRenderer.invoke('projets:getById', id),
  getAll: () => ipcRenderer.invoke('projets:getAll'),
  getByClientId: (clientId: string) => ipcRenderer.invoke('projets:getByClientId', clientId),
  create: (data: any) => ipcRenderer.invoke('projets:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('projets:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('projets:delete', id),
};

// ======================== TÂCHES PROJET ========================
const tachesProjetApi = {
  getById: (id: string) => ipcRenderer.invoke('taches-projet:getById', id),
  getByProjetId: (projetId: string) => ipcRenderer.invoke('taches-projet:getByProjetId', projetId),
  create: (data: any) => ipcRenderer.invoke('taches-projet:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('taches-projet:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('taches-projet:delete', id),
};

// ======================== BOUTIQUES ========================
const boutiquesApi = {
  getById: (id: string) => ipcRenderer.invoke('boutiques:getById', id),
  getAll: () => ipcRenderer.invoke('boutiques:getAll'),
  getPrincipale: () => ipcRenderer.invoke('boutiques:getPrincipale'),
  create: (data: any) => ipcRenderer.invoke('boutiques:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('boutiques:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('boutiques:delete', id),
};

// ======================== STOCKS BOUTIQUE ========================
const stocksBoutiqueApi = {
  getEntry: (boutiqueId: string, articleId: string, varianteId?: string) =>
    ipcRenderer.invoke('stocks-boutique:getEntry', boutiqueId, articleId, varianteId),
  getByBoutique: (boutiqueId: string) => ipcRenderer.invoke('stocks-boutique:getByBoutique', boutiqueId),
  getByArticle: (articleId: string) => ipcRenderer.invoke('stocks-boutique:getByArticle', articleId),
  adjust: (boutiqueId: string, articleId: string, varianteId: string | undefined, delta: number) =>
    ipcRenderer.invoke('stocks-boutique:adjust', boutiqueId, articleId, varianteId, delta),
  recomputeArticleTotal: (articleId: string) =>
    ipcRenderer.invoke('stocks-boutique:recomputeArticleTotal', articleId),
};

// ======================== TRANSFERTS STOCK ========================
const transfertsStockApi = {
  execute: (data: any) => ipcRenderer.invoke('transferts-stock:execute', data),
  getAll: () => ipcRenderer.invoke('transferts-stock:getAll'),
  getByBoutique: (boutiqueId: string) => ipcRenderer.invoke('transferts-stock:getByBoutique', boutiqueId),
  adjustBatch: (entries: Array<{ boutiqueId: string; articleId: string; varianteId?: string; delta: number }>) =>
    ipcRenderer.invoke('stocks-boutique:adjustBatch', entries),
};

// ======================== INVENTAIRES ========================
const inventairesApi = {
  getBrouillon: () => ipcRenderer.invoke('inventaires:getBrouillon'),
  getById: (id: string) => ipcRenderer.invoke('inventaires:getById', id),
  getAll: () => ipcRenderer.invoke('inventaires:getAll'),
  create: (data: { boutiqueId?: string | null; exportPath?: string | null; createdBy: string }) =>
    ipcRenderer.invoke('inventaires:create', data),
  updateLignes: (id: string, lignes: Array<{ articleId: string; varianteId?: string | null; boutiqueId: string; quantiteCompte: number | null }>) =>
    ipcRenderer.invoke('inventaires:updateLignes', id, lignes),
  cancel: (id: string) => ipcRenderer.invoke('inventaires:cancel', id),
  validate: (id: string) => ipcRenderer.invoke('inventaires:validate', id),
  exportCurrentBackup: () => ipcRenderer.invoke('inventaires:exportCurrentBackup'),
};

// ======================== ENTREPRISES ========================
const entreprisesApi = {
  getById: () : Promise<Entreprise | null> => ipcRenderer.invoke('entreprises:getById'),
  getAll: () => ipcRenderer.invoke('entreprises:getAll'),
  get: (): Promise<CompanyInfo> => ipcRenderer.invoke('entreprises:get'),
  update: (data: Partial<CompanyInfo>): Promise<CompanyInfo> => ipcRenderer.invoke('entreprises:update', data),
};

// ======================== EXPOSE APIs VIA CONTEXT BRIDGE ========================
contextBridge.exposeInMainWorld('db', {
  articles: articlesApi,
  clients: clientsApi,
  collections: collectionsApi,
  sousCollections: sousCollectionsApi,
  administrateurs: administrateursApi,
  devis: devisApi,
  factures: facturesApi,
  lignesDocuments: lignesDocumentsApi,
  images: imagesApi,
  techniciens: techniciensApi,
  projets: projetsApi,
  tachesProjet: tachesProjetApi,
  boutiques: boutiquesApi,
  stocksBoutique: stocksBoutiqueApi,
  transfertsStock: transfertsStockApi,
  inventaires: inventairesApi,
  entreprises: entreprisesApi,
});

contextBridge.exposeInMainWorld('auth', authApi);

// ======================== PDF & SHELL ========================
const pdfApi = {
  generateDevis: (html: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('pdf:generateDevis', html, filename),
  generateFacture: (html: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('pdf:generateFacture', html, filename),
};
const shellApi = {
  openPath: (p: string): Promise<string> => ipcRenderer.invoke('shell:openPath', p),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (p: string): Promise<void> => ipcRenderer.invoke('shell:showItemInFolder', p),
};
contextBridge.exposeInMainWorld('pdf', pdfApi);
contextBridge.exposeInMainWorld('shell', shellApi);

// ======================== COMPANY INFO (types partagés par entreprisesApi) ========================
type CustomField = {
  id: string;
  type: 'email' | 'tel' | 'url' | 'address' | 'text';
  label: string;
  value: string;
};
type CompanyInfo = {
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
};

// ======================== SYNC ========================
type SyncConfig = {
  serverUrl: string;
  token: string;
  clientId: string;
  enabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
};
const syncApi = {
  getConfig: (): Promise<SyncConfig> => ipcRenderer.invoke('sync:getConfig'),
  setConfig: (data: Partial<SyncConfig>): Promise<SyncConfig> => ipcRenderer.invoke('sync:setConfig', data),
  login: (email: string, motDePasse: string): Promise<{ ok: boolean; user?: { id: string; email: string; nom: string; role: string }; error?: string }> =>
    ipcRenderer.invoke('sync:login', email, motDePasse),
  logout: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('sync:logout'),
  testConnection: (): Promise<{ ok: boolean; data?: { ok: boolean; time: number }; error?: string }> =>
    ipcRenderer.invoke('sync:testConnection'),
  initServer: (): Promise<{ ok: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('sync:initServer'),
  markLastSync: (): Promise<SyncConfig> => ipcRenderer.invoke('sync:markLastSync'),
  linkDevice: (serverUrl: string, email: string, motDePasse: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('sync:linkDevice', serverUrl, email, motDePasse),
  // Phase 4 — accès au miroir local sync_state + dispatcher pull-driven.
  applyRemote: (entry: {
    table: string;
    id: string;
    version: number;
    deleted?: boolean;
    data?: Record<string, unknown> | null;
  }): Promise<boolean> => ipcRenderer.invoke('sync:applyRemote', entry),
  applyRemoteBatch: (entries: Array<{
    table: string;
    id: string;
    version: number;
    deleted?: boolean;
    data?: Record<string, unknown> | null;
  }>): Promise<{ ok: number; failed: number }> =>
    ipcRenderer.invoke('sync:applyRemoteBatch', entries),
  syncState: {
    maxVersion: (): Promise<number> => ipcRenderer.invoke('sync:syncStateMaxVersion'),
    isEmpty: (): Promise<boolean> => ipcRenderer.invoke('sync:syncStateIsEmpty'),
    getDirty: (): Promise<Array<{
      table_name: string;
      element_id: string;
      version: number;
      localVersion: number;
      dirty: number;
      deleted: number;
      lastPulledAt: string | null;
      lastPushedAt: string | null;
    }>> => ipcRenderer.invoke('sync:syncStateGetDirty'),
    get: (table: string, id: string): Promise<any | null> =>
      ipcRenderer.invoke('sync:syncStateGet', table, id),
    markClean: (table: string, id: string, version: number): Promise<boolean> =>
      ipcRenderer.invoke('sync:syncStateMarkClean', table, id, version),
  },
  syncableTables: (): Promise<string[]> => ipcRenderer.invoke('sync:syncableTables'),
  // Broadcast émis par le main après chaque applyRemoteEntry réussi. Le
  // renderer s'y abonne via un provider React qui bumpe un revision counter
  // → les pages qui mettent cette valeur dans leurs deps re-fetchent.
  onRemoteChange: (
    cb: (payload: { table: string; id: string; deleted: boolean }) => void,
  ): (() => void) => {
    const listener = (
      _event: unknown,
      payload: { table: string; id: string; deleted: boolean },
    ) => cb(payload);
    ipcRenderer.on('sync:remote-change', listener);
    return () => ipcRenderer.removeListener('sync:remote-change', listener);
  },
};
contextBridge.exposeInMainWorld('syncApi', syncApi);

// ======================== EXPORT ========================
const exportApi = {
  articlesExcel: (): Promise<{ canceled: boolean; filePath?: string; count?: number }> =>
    ipcRenderer.invoke('export:articlesExcel'),
};
contextBridge.exposeInMainWorld('exportApi', exportApi);

// ======================== WINDOW CONTROLS ========================
const windowApi = {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (cb: (maximized: boolean) => void) => {
    const listener = (_event: unknown, value: boolean) => cb(value);
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
};

contextBridge.exposeInMainWorld('win', windowApi);

// ======================== AUTO-UPDATE ========================
const updateApi = {
  getStatus: (): Promise<{
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    version: string | null;
    currentVersion: string;
    error: string | null;
    progress: number;
  }> => ipcRenderer.invoke('update:getStatus'),
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  setFeedURL: (url: string) => ipcRenderer.invoke('update:setFeedURL', url),
  onStatus: (cb: (status: any) => void): (() => void) => {
    ipcRenderer.send('update:subscribe');
    const listener = (_event: unknown, status: any) => cb(status);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },
  onDownloaded: (cb: () => void): (() => void) => {
    const listener = () => cb();
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
};
contextBridge.exposeInMainWorld('updateApi', updateApi);
