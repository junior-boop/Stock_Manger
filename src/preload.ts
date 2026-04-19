// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts


import { contextBridge, ipcRenderer } from 'electron';


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
};

// ======================== ARTICLES ========================
const articlesApi = {
  getById: (id: string) => ipcRenderer.invoke('articles:getById', id),
  getAll: () => ipcRenderer.invoke('articles:getAll'),
  create: (data: any) => ipcRenderer.invoke('articles:create', data),
  update: (id: string, data: any) => ipcRenderer.invoke('articles:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('articles:delete', id),
  generateReference: (collectionId: string) => ipcRenderer.invoke('articles:generateReference', collectionId),
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
});
