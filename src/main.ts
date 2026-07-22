import { app, BrowserWindow, Menu, ipcMain, shell, dialog, session } from 'electron';
import { AutoUpdateService } from './auto-update';
import path from 'node:path';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import started from 'electron-squirrel-startup';
import {
  checkDatabase,
  initializeTables,
  orm,
  // Articles
  getArticleById,
  getAllArticles,
  createArticles,
  updateArticles,
  deleteArticles,
  getArticleHistory,
  // Clients
  getClientById,
  getAllClients,
  createClient,
  updateClient,
  deleteClient,
  // Collections
  getCollectionById,
  getAllCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  // SousCollections
  getSousCollectionById,
  getAllSousCollections,
  getSousCollectionsByCollectionId,
  createSousCollection,
  updateSousCollection,
  deleteSousCollection,
  // Administrateurs
  getAdministrateurById,
  getAllAdministrateurs,
  createAdministrateur,
  updateAdministrateur,
  deleteAdministrateur,
  // Devis
  getDevisById,
  getAllDevis,
  getDevisByClientId,
  createDevis,
  updateDevis,
  deleteDevis,
  // Factures
  getFactureById,
  getAllFactures,
  getFacturesByClientId,
  createFacture,
  updateFacture,
  deleteFacture,
  // LignesDocuments
  getLigneDocumentById,
  getAllLignesDocuments,
  getLignesDocumentsByArticleId,
  createLigneDocument,
  updateLigneDocument,
  deleteLigneDocument,
  // Techniciens
  getTechnicienById,
  getAllTechniciens,
  createTechnicien,
  updateTechnicien,
  deleteTechnicien,
  // Projets
  getProjetById,
  getAllProjets,
  getProjetsByClientId,
  createProjet,
  updateProjet,
  deleteProjet,
  // TachesProjet
  getTacheProjetById,
  getTachesProjetByProjetId,
  createTacheProjet,
  updateTacheProjet,
  deleteTacheProjet,
  // Boutiques
  getBoutiqueById,
  getAllBoutiques,
  getBoutiquePrincipale,
  createBoutique,
  updateBoutique,
  deleteBoutique,
  // StocksBoutique
  getStockEntry,
  getStocksByBoutique,
  getStocksByArticle,
  adjustStock,
  recomputeArticleStockTotal,
  // TransfertsStock
  executeTransfert,
  getAllTransfertsStock,
  getTransfertsByBoutique,
  // Inventaires
  getBrouillonInventaire,
  getInventaireById,
  getAllInventaires,
  createInventaire,
  updateInventaireLignes,
  cancelInventaire,
  validateInventaire,
  // Sync (Phase 4)
  syncState,
  applyRemoteEntry,
  batchApplyRemoteEntries,
  SYNCABLE_TABLES,
  type RemoteSyncEntry,
  type BatchResult,
  // Entreprise
  getEntreprise,
  updateEntreprise,
} from './Databases';
import {
  isSetupDone,
  setupFirstAdmin,
  setupDemoAccount,
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  hasPermission,
  createUser as authCreateUser,
  updateUserPassword as authUpdateUserPassword,
  ingestServerUser,
} from './Databases/auth';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// ======================== IPC HANDLERS - AUTH ========================
ipcMain.handle('auth:isSetupDone', async () => isSetupDone());
ipcMain.handle('auth:setup', async (_event, data) => setupFirstAdmin(data));
ipcMain.handle('auth:setupDemo', async (_event, data) => setupDemoAccount(data));
ipcMain.handle('auth:login', async (_event, email: string, motDePasse: string) => {
  const res = await authLogin(email, motDePasse);
  if (res?.ok) {
    // Connexion locale OK → on tente aussi le login serveur pour activer la sync.
    // Échec serveur (offline, URL non configurée, etc.) ne bloque PAS la session locale.
    try {
      const syncRes = await performSyncLogin(email, motDePasse);
      if (!syncRes.ok) console.warn('[auth:login] sync login skipped:', syncRes.error);
    } catch (e) {
      console.warn('[auth:login] sync login threw:', e);
    }
  }
  return res;
});
ipcMain.handle('auth:logout', async () => {
  authLogout();
  return { ok: true };
});
ipcMain.handle('auth:me', async () => getCurrentUser());
ipcMain.handle('auth:hasPermission', async (_event, action: string) =>
  hasPermission(action),
);
ipcMain.handle('auth:createUser', async (_event, data) => authCreateUser(data));
ipcMain.handle('auth:updateUserPassword', async (_event, id: string, motDePasse: string) =>
  authUpdateUserPassword(id, motDePasse),
);

// ======================== IPC HANDLERS - ARTICLES ========================
ipcMain.handle('articles:getById', async (event, id) => getArticleById(id));
ipcMain.handle('articles:getAll', async () => getAllArticles());
ipcMain.handle('articles:create', async (event, data) => createArticles(data));
ipcMain.handle('articles:update', async (event, id, data) => updateArticles(id, data));
ipcMain.handle('articles:delete', async (event, id) => deleteArticles(id));
ipcMain.handle('articles:getHistory', async (_event, id: string) => getArticleHistory(id));

// ======================== IPC HANDLERS - CLIENTS ========================
ipcMain.handle('clients:getById', async (event, id) => getClientById(id));
ipcMain.handle('clients:getAll', async () => getAllClients());
ipcMain.handle('clients:create', async (event, data) => createClient(data));
ipcMain.handle('clients:update', async (event, id, data) => updateClient(id, data));
ipcMain.handle('clients:delete', async (event, id) => deleteClient(id));

// ======================== IPC HANDLERS - COLLECTIONS ========================
ipcMain.handle('collections:getById', async (event, id) => getCollectionById(id));
ipcMain.handle('collections:getAll', async () => getAllCollections());
ipcMain.handle('collections:create', async (event, data) => createCollection(data));
ipcMain.handle('collections:update', async (event, id, data) => updateCollection(id, data));
ipcMain.handle('collections:delete', async (event, id) => deleteCollection(id));

// ======================== IPC HANDLERS - SOUS-COLLECTIONS ========================
ipcMain.handle('sous-collections:getById', async (event, id) => getSousCollectionById(id));
ipcMain.handle('sous-collections:getAll', async () => getAllSousCollections());
ipcMain.handle('sous-collections:getByCollectionId', async (event, collectionId) => getSousCollectionsByCollectionId(collectionId));
ipcMain.handle('sous-collections:create', async (event, data) => createSousCollection(data));
ipcMain.handle('sous-collections:update', async (event, id, data) => updateSousCollection(id, data));
ipcMain.handle('sous-collections:delete', async (event, id) => deleteSousCollection(id));

// ======================== IPC HANDLERS - ADMINISTRATEURS ========================
ipcMain.handle('administrateurs:getById', async (event, id) => getAdministrateurById(id));
ipcMain.handle('administrateurs:getAll', async () => getAllAdministrateurs());
ipcMain.handle('administrateurs:create', async (event, data) => createAdministrateur(data));
ipcMain.handle('administrateurs:update', async (event, id, data) => updateAdministrateur(id, data));
ipcMain.handle('administrateurs:delete', async (event, id) => deleteAdministrateur(id));

// ======================== IPC HANDLERS - DEVIS ========================
ipcMain.handle('devis:getById', async (event, id) => getDevisById(id));
ipcMain.handle('devis:getAll', async () => getAllDevis());
ipcMain.handle('devis:getByClientId', async (event, clientId) => getDevisByClientId(clientId));
ipcMain.handle('devis:create', async (event, data) => createDevis(data));
ipcMain.handle('devis:update', async (event, id, data) => updateDevis(id, data));
ipcMain.handle('devis:delete', async (event, id) => deleteDevis(id));

// ======================== IPC HANDLERS - FACTURES ========================
ipcMain.handle('factures:getById', async (event, id) => getFactureById(id));
ipcMain.handle('factures:getAll', async () => getAllFactures());
ipcMain.handle('factures:getByClientId', async (event, clientId) => getFacturesByClientId(clientId));
ipcMain.handle('factures:create', async (event, data) => createFacture(data));
ipcMain.handle('factures:update', async (event, id, data) => updateFacture(id, data));
ipcMain.handle('factures:delete', async (event, id) => deleteFacture(id));

// ======================== IPC HANDLERS - LIGNES DOCUMENTS ========================
ipcMain.handle('lignes-documents:getById', async (event, id) => getLigneDocumentById(id));
ipcMain.handle('lignes-documents:getAll', async () => getAllLignesDocuments());
ipcMain.handle('lignes-documents:getByArticleId', async (event, articleId) => getLignesDocumentsByArticleId(articleId));
ipcMain.handle('lignes-documents:create', async (event, data) => createLigneDocument(data));
ipcMain.handle('lignes-documents:update', async (event, id, data) => updateLigneDocument(id, data));
ipcMain.handle('lignes-documents:delete', async (event, id) => deleteLigneDocument(id));

// ======================== IPC HANDLERS - TECHNICIENS ========================
ipcMain.handle('techniciens:getById', async (event, id) => getTechnicienById(id));
ipcMain.handle('techniciens:getAll', async () => getAllTechniciens());
ipcMain.handle('techniciens:create', async (event, data) => createTechnicien(data));
ipcMain.handle('techniciens:update', async (event, id, data) => updateTechnicien(id, data));
ipcMain.handle('techniciens:delete', async (event, id) => deleteTechnicien(id));

// ======================== IPC HANDLERS - PROJETS ========================
ipcMain.handle('projets:getById', async (event, id) => getProjetById(id));
ipcMain.handle('projets:getAll', async () => getAllProjets());
ipcMain.handle('projets:getByClientId', async (event, clientId) => getProjetsByClientId(clientId));
ipcMain.handle('projets:create', async (event, data) => createProjet(data));
ipcMain.handle('projets:update', async (event, id, data) => updateProjet(id, data));
ipcMain.handle('projets:delete', async (event, id) => deleteProjet(id));

// ======================== IPC HANDLERS - TÂCHES PROJET ========================
ipcMain.handle('taches-projet:getById', async (event, id) => getTacheProjetById(id));
ipcMain.handle('taches-projet:getByProjetId', async (event, projetId) => getTachesProjetByProjetId(projetId));
ipcMain.handle('taches-projet:create', async (event, data) => createTacheProjet(data));
ipcMain.handle('taches-projet:update', async (event, id, data) => updateTacheProjet(id, data));
ipcMain.handle('taches-projet:delete', async (event, id) => deleteTacheProjet(id));

// ======================== IPC HANDLERS - BOUTIQUES ========================
ipcMain.handle('boutiques:getById', async (_event, id) => getBoutiqueById(id));
ipcMain.handle('boutiques:getAll', async () => getAllBoutiques());
ipcMain.handle('boutiques:getPrincipale', async () => getBoutiquePrincipale());
ipcMain.handle('boutiques:create', async (_event, data) => createBoutique(data));
ipcMain.handle('boutiques:update', async (_event, id, data) => updateBoutique(id, data));
ipcMain.handle('boutiques:delete', async (_event, id) => deleteBoutique(id));

// ======================== IPC HANDLERS - STOCKS BOUTIQUE ========================
ipcMain.handle('stocks-boutique:getEntry', async (_event, boutiqueId, articleId, varianteId) =>
  getStockEntry(boutiqueId, articleId, varianteId));
ipcMain.handle('stocks-boutique:getByBoutique', async (_event, boutiqueId) => getStocksByBoutique(boutiqueId));
ipcMain.handle('stocks-boutique:getByArticle', async (_event, articleId) => getStocksByArticle(articleId));
ipcMain.handle('stocks-boutique:adjust', async (_event, boutiqueId, articleId, varianteId, delta) =>
  adjustStock(boutiqueId, articleId, varianteId, delta));
ipcMain.handle('stocks-boutique:recomputeArticleTotal', async (_event, articleId) =>
  recomputeArticleStockTotal(articleId));

// ======================== IPC HANDLERS - TRANSFERTS STOCK ========================
ipcMain.handle('transferts-stock:execute', async (_event, data) => executeTransfert(data));
ipcMain.handle('transferts-stock:getAll', async () => getAllTransfertsStock());
ipcMain.handle('transferts-stock:getByBoutique', async (_event, boutiqueId) => getTransfertsByBoutique(boutiqueId));

// ======================== IPC HANDLERS - INVENTAIRES ========================
ipcMain.handle('inventaires:getBrouillon', async () => getBrouillonInventaire());
ipcMain.handle('inventaires:getById', async (_event, id) => getInventaireById(id));
ipcMain.handle('inventaires:getAll', async () => getAllInventaires());
ipcMain.handle('inventaires:create', async (_event, data) => createInventaire(data));
ipcMain.handle('inventaires:updateLignes', async (_event, id, lignes) => updateInventaireLignes(id, lignes));
ipcMain.handle('inventaires:cancel', async (_event, id) => cancelInventaire(id));
ipcMain.handle('inventaires:validate', async (_event, id) => validateInventaire(id));

/**
 * Sauvegarde automatique de l'état courant des articles en Excel dans
 * userData/inventaires-backup/. Renvoie le chemin écrit.
 */
ipcMain.handle('inventaires:exportCurrentBackup', async () => {
  try {
    const [articles, collections, sousCollections] = await Promise.all([
      getAllArticles(),
      getAllCollections(),
      getAllSousCollections(),
    ]);
    const collectionMap = new Map((collections ?? []).map((c: any) => [c.id, c.nom]));
    const sousCollectionMap = new Map((sousCollections ?? []).map((s: any) => [s.id, s.nom]));
    const rows = (articles ?? []).map((a: any) => ({
      Référence: a.reference,
      Nom: a.nom,
      Collection: collectionMap.get(a.collectionId) ?? '',
      'Sous-collection': a.sousCollectionId ? (sousCollectionMap.get(a.sousCollectionId) ?? '') : '',
      Unité: a.unite,
      'Prix HT': a.prixHT,
      'Prix TTC': a.prixTTC,
      Stock: a.stockTotal,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Articles');

    const backupDir = path.join(app.getPath('userData'), 'inventaires-backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    const filePath = path.join(backupDir, filename);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, buffer);
    return { ok: true, filePath, count: rows.length };
  } catch (error) {
    console.error('[inventaires:exportCurrentBackup]', error);
    return { ok: false, error: (error as Error).message };
  }
});

/**
 * Applique en lot des ajustements de stock (réapprovisionnement).
 * Chaque entrée ajoute `delta` à la quantité pour le triplet (boutique, article, variante).
 * Renvoie le nombre d'entrées appliquées.
 */
ipcMain.handle('stocks-boutique:adjustBatch', async (_event, entries: Array<{
  boutiqueId: string; articleId: string; varianteId?: string; delta: number;
}>) => {
  let applied = 0;
  for (const e of entries ?? []) {
    if (!e || !e.boutiqueId || !e.articleId || !Number.isFinite(e.delta) || e.delta === 0) continue;
    const r = adjustStock(e.boutiqueId, e.articleId, e.varianteId, e.delta);
    if (r) applied++;
  }
  return { ok: true, applied };
});

// ======================== IPC HANDLERS - SYNC STATE (Phase 4) ========================
// Expose le miroir local `sync_state` au renderer pour orchestrer le pull.
// Tous les writes pull-driven passent par `sync:applyRemote` qui n'appelle pas
// les wrappers métier (donc ne déclenche pas markDirty) — évite la boucle.
ipcMain.handle('sync:applyRemote', async (_event, entry: RemoteSyncEntry) => {
  const ok = await applyRemoteEntry(entry);
  if (ok) {
    const payload = { table: entry.table, id: entry.id, deleted: !!entry.deleted };
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('sync:remote-change', payload);
    }
  }
  return ok;
});
ipcMain.handle('sync:applyRemoteBatch', async (_event, entries: RemoteSyncEntry[]) => {
  const result = batchApplyRemoteEntries(entries);
  if (result.ok > 0) {
    const tables = new Set(entries.map((e) => e.table));
    for (const table of tables) {
      const payload = { table, id: '', deleted: false };
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('sync:remote-change', payload);
      }
    }
  }
  return result;
});
ipcMain.handle('sync:syncStateMaxVersion', async () => syncState.maxVersion());
ipcMain.handle('sync:syncStateIsEmpty', async () => syncState.isEmpty());
ipcMain.handle('sync:syncStateGetDirty', async () => syncState.getDirty());
ipcMain.handle('sync:syncStateGet', async (_event, table: string, id: string) =>
  syncState.get(table, id),
);
ipcMain.handle('sync:syncStateMarkClean', async (_event, table: string, id: string, version: number) => {
  syncState.markClean(table, id, version);
  return true;
});
ipcMain.handle('sync:syncableTables', async () => SYNCABLE_TABLES);

// ======================== IPC HANDLER - IMAGES ========================
const imagesDir = path.join(app.getPath('pictures'), "..", 'images');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

ipcMain.handle('images:save', async (event, base64Data: string, filename: string) => {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    const safeName = path.basename(filename);
    const filePath = path.join(imagesDir, safeName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'image:', error);
    throw error;
  }
});

ipcMain.handle('images:getPath', async () => {
  return imagesDir;
});

// Résolution : si `filename` est un chemin absolu (ancienne donnée) on l'utilise
// tel quel ; sinon on suppose un basename dans imagesDir. Permet aux articles
// synchronisés (qui stockent uniquement le basename) de fonctionner localement.
function resolveImagePath(filename: string): string {
  return path.isAbsolute(filename) ? filename : path.join(imagesDir, filename);
}

ipcMain.handle('images:get', async (event, filename: string) => {
  try {
    const filePath = resolveImagePath(filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filename).slice(1);
      const mimeType = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mimeType};base64,${data.toString('base64')}`;
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la lecture de l\'image:', error);
    throw error;
  }
});

ipcMain.handle('images:list', async () => {
  try {
    const files = fs.readdirSync(imagesDir);
    return files;
  } catch (error) {
    console.error('Erreur lors de la liste des images:', error);
    return [];
  }
});

// Existence par basename uniquement (utilisé par la sync pour décider si
// un download est nécessaire).
ipcMain.handle('images:exists', async (_event, filename: string) => {
  try {
    const basename = path.basename(filename);
    const filePath = path.join(imagesDir, basename);
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
});

// Écriture binaire — accepte un Uint8Array (sérialisé en bytes par
// contextBridge). Utilisé pour persister localement les images téléchargées
// depuis le serveur (R2).
ipcMain.handle('images:saveBinary', async (_event, bytes: Uint8Array, filename: string) => {
  try {
    const basename = path.basename(filename);
    const filePath = path.join(imagesDir, basename);
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error('Erreur lors de l\'écriture binaire de l\'image:', error);
    throw error;
  }
});

// Lecture binaire — renvoie un Uint8Array (utilisé par la sync pour uploader
// vers R2 sans repasser par base64).
ipcMain.handle('images:readBinary', async (_event, filename: string) => {
  try {
    const filePath = resolveImagePath(filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    const data = fs.readFileSync(filePath);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } catch (error) {
    console.error('Erreur lors de la lecture binaire de l\'image:', error);
    return null;
  }
});

// ======================== IPC HANDLERS - PDF & SHELL ========================
const devisPdfDir = path.join(app.getPath('userData'), 'devis');
if (!fs.existsSync(devisPdfDir)) {
  fs.mkdirSync(devisPdfDir, { recursive: true });
}
const facturesPdfDir = path.join(app.getPath('userData'), 'factures');
if (!fs.existsSync(facturesPdfDir)) {
  fs.mkdirSync(facturesPdfDir, { recursive: true });
}

async function renderPdfToFile(html: string, filename: string, dir: string): Promise<string> {
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, sandbox: true },
  });
  try {
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const buffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="
          width: 100%;
          text-align: center;
          font-size: 8pt;
          color: #94a3b8;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.7;
          padding: 0 15mm;
        ">
          <span class="title"></span><br>
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
      // margins: {
      //   marginType: 'custom',
      //   top: 0,
      //   bottom: 12,
      //   left: 0,
      //   right: 0,
      // },
    });
    const safeName = filename.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    const filePath = path.join(dir, `${safeName}.pdf`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } finally {
    pdfWin.destroy();
  }
}

ipcMain.handle('pdf:generateDevis', async (_event, html: string, filename: string) =>
  await renderPdfToFile(html, filename, devisPdfDir),
);

ipcMain.handle('pdf:generateFacture', async (_event, html: string, filename: string) =>
  await renderPdfToFile(html, filename, facturesPdfDir),
);

// ======================== IPC HANDLERS - EXPORT EXCEL ========================
ipcMain.handle('export:articlesExcel', async () => {
  try {
    const [articles, collections, sousCollections] = await Promise.all([
      getAllArticles(),
      getAllCollections(),
      getAllSousCollections(),
    ]);

    const collectionMap = new Map((collections ?? []).map((c: any) => [c.id, c.nom]));
    const sousCollectionMap = new Map((sousCollections ?? []).map((s: any) => [s.id, s.nom]));

    const formatDims = (d: any): string => {
      if (!d || typeof d !== 'object') return '';
      const L = Number(d.longueur) || 0;
      const l = Number(d.largeur) || 0;
      const h = Number(d.hauteur) || 0;
      if (!L && !l && !h) return '';
      const parts = [L, l, h].filter((n) => n > 0);
      return `${parts.join('x')}cm`;
    };

    const rows = (articles ?? []).map((a: any) => ({
      Référence: a.reference,
      Nom: a.nom,
      Description: a.description ?? '',
      Collection: collectionMap.get(a.collectionId) ?? '',
      'Sous-collection': a.sousCollectionId ? (sousCollectionMap.get(a.sousCollectionId) ?? '') : '',
      Unité: a.unite,
      'Prix HT': a.prixHT,
      'Taux TVA (%)': a.tauxTVA,
      'Prix TTC': a.prixTTC,
      Dimensions: formatDims(a.dimensions),
      Stock: a.stockTotal,
      Statut: a.statut,
      'Créé le': a.createdAt,
      'Modifié le': a.updatedAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Articles');

    const defaultName = `articles_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exporter les articles',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Fichier Excel', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) return { canceled: true };

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, buffer);
    return { canceled: false, filePath, count: rows.length };
  } catch (error) {
    console.error("Erreur lors de l'export Excel des articles:", error);
    throw error;
  }
});

// ======================== IPC HANDLERS - COMPANY INFO ========================
const companyInfoPath = path.join(app.getPath('userData'), 'entreprise.json');

function migrateCompanyJsonToDb() {
  try {
    if (!fs.existsSync(companyInfoPath)) return;
    const raw = fs.readFileSync(companyInfoPath, 'utf-8');
    const parsed = JSON.parse(raw);
    updateEntreprise(parsed);
    fs.unlinkSync(companyInfoPath);
    console.log('[company] Données migrées de entreprise.json vers la base SQLite');
  } catch (e) {
    console.error('[company] Erreur migration depuis entreprise.json:', e);
  }
}

ipcMain.handle('entreprises:get', async () => {
  const fromDb = await getEntreprise();
  if (fromDb) {
    const { id, ...data } = fromDb;
    return data;
  }
  // Aucune donnée en base → tenter la migration depuis le JSON
  migrateCompanyJsonToDb();
  const afterMigration = await getEntreprise();
  if (afterMigration) {
    const { id, ...data } = afterMigration;
    return data;
  }
  // Valeurs par défaut
  return {
    nom: 'Kataleya',
    adresse: 'Douala, Cameroun',
    telephone: '+237 6XX XX XX XX',
    email: 'contact@kataleya.com',
    logoDataUrl: '',
    notesDevis: '',
    notesFacture: '',
    conditionsPaiement: '',
    setupDone: false,
    customFields: [],
    devisPrefix: 'DEV',
    facturePrefix: 'FAC',
    numeroFormat: 'PREFIX-YYYY-NNNN',
    tvaDefault: 19.25,
    devise: 'FCFA',
    afficherTVA: true,
  };
});

// ======================== IPC HANDLERS - ENTREPRISES (SYNC) ========================
ipcMain.handle('entreprises:getById', async (_event) => {
  const row = await getEntreprise();
  if (row) return row;
  return null;
});


ipcMain.handle('entreprises:update', async (_event, data) => {
  try {
    const row = await updateEntreprise(data);
    console.log("[main.ts] - entreprises:update", data)
    if (fs.existsSync(companyInfoPath)) {
      console.log(companyInfoPath)
      fs.unlinkSync(companyInfoPath);
    }
    if (row) {
      const { id, ...rest } = row;
      return rest;
    }
    throw new Error('Échec de la mise à jour de l\'entreprise.');
  } catch (e) {
    console.error('[entreprises:update]', e);
    throw e;
  }
})

// ======================== IPC HANDLERS - SYNC CONFIG ========================
const syncConfigPath = path.join(app.getPath('userData'), 'sync.json');

type SyncConfigShape = {
  serverUrl: string;
  token: string;
  clientId: string;
  enabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
};

const DEFAULT_SYNC: SyncConfigShape = {
  serverUrl: '',
  token: '',
  clientId: '',
  enabled: false,
  syncInterval: 60000,
  lastSyncAt: null,
};

function readSyncConfig(): SyncConfigShape {
  try {
    if (!fs.existsSync(syncConfigPath)) return { ...DEFAULT_SYNC };
    const raw = fs.readFileSync(syncConfigPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_SYNC, ...parsed };
    if (!merged.clientId) {
      merged.clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      fs.writeFileSync(syncConfigPath, JSON.stringify(merged, null, 2), 'utf-8');
    }
    return merged;
  } catch (e) {
    console.error('Erreur lecture sync.json:', e);
    return { ...DEFAULT_SYNC };
  }
}

function writeSyncConfig(next: SyncConfigShape): SyncConfigShape {
  fs.writeFileSync(syncConfigPath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

ipcMain.handle('sync:getConfig', async () => readSyncConfig());

ipcMain.handle('sync:setConfig', async (_event, data: Partial<SyncConfigShape>) => {
  const current = readSyncConfig();
  return writeSyncConfig({ ...current, ...data });
});

async function attemptLogin(serverUrl: string, email: string, motDePasse: string) {
  return fetch(`${serverUrl.replace(/\/$/, '')}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse }),
  });
}

async function pushLocalAdminsToBootstrap(serverUrl: string): Promise<{ ok: boolean; error?: string; inserted?: number }> {
  try {
    const admins = await getAllAdministrateurs();
    if (!admins) return { ok: false, error: 'lecture admins locale échouée' };
    const eligible = admins.filter((a) => a.role === 'super_admin' || a.role === 'admin');
    if (eligible.length === 0) {
      return { ok: false, error: 'Aucun admin/super_admin local à pousser' };
    }
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/auth/bootstrap-admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admins: eligible }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: (err as any).error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { ok: boolean; inserted: string[] };
    return { ok: true, inserted: data.inserted?.length ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

async function performSyncLogin(email: string, motDePasse: string): Promise<{ ok: boolean; error?: string; user?: any }> {
  const cfg = readSyncConfig();
  if (!cfg.serverUrl) return { ok: false, error: 'URL serveur manquante' };
  try {
    let res = await attemptLogin(cfg.serverUrl, email, motDePasse);
    if (res.status === 401) {
      try {
        const probe = await fetch(`${cfg.serverUrl.replace(/\/$/, '')}/auth/needs-bootstrap`);
        if (probe.ok) {
          const { needsBootstrap } = (await probe.json()) as { needsBootstrap: boolean };
          if (needsBootstrap) {
            const boot = await pushLocalAdminsToBootstrap(cfg.serverUrl);
            if (!boot.ok) return { ok: false, error: `Pré-bootstrap échoué: ${boot.error}` };
            res = await attemptLogin(cfg.serverUrl, email, motDePasse);
          }
        }
      } catch (probeErr) {
        console.warn('[sync:login] needs-bootstrap probe failed', probeErr);
      }
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: (err as any).error || 'Échec de connexion' };
    }
    const data = (await res.json()) as { token: string; user: { id: string; email: string; nom: string; role: string } };
    writeSyncConfig({ ...cfg, token: data.token, enabled: true });
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

ipcMain.handle('sync:login', async (_event, email: string, motDePasse: string) => performSyncLogin(email, motDePasse));

// Liaison poste ↔ serveur : valide les credentials super_admin distants puis
// persiste l'URL serveur en local. Aucune session locale créée à ce stade.
ipcMain.handle('sync:linkDevice', async (_event, serverUrl: string, email: string, password: string) => {
  if (!serverUrl || !email || !password) {
    return { ok: false, error: 'URL, email et mot de passe requis' };
  }
  const url = serverUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${url}/public/link-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: (err as any).error || `HTTP ${res.status}` };
    }
    const cfg = readSyncConfig();
    writeSyncConfig({ ...cfg, serverUrl: url });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
});

// Setup en ligne : login user final via /public/login, récupère le hash via
// /public/sync-credentials, ingère le user en local et active la session.
// Prérequis : sync:linkDevice doit avoir été appelé (serverUrl persistant).
ipcMain.handle('auth:setupOnline', async (_event, email: string, password: string) => {
  const cfg = readSyncConfig();
  if (!cfg.serverUrl) return { ok: false, error: 'Serveur non lié' };
  const base = cfg.serverUrl.replace(/\/$/, '');
  try {
    const loginRes = await fetch(`${base}/public/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) {
      const err = await loginRes.json().catch(() => ({ error: `HTTP ${loginRes.status}` }));
      return { ok: false, error: (err as any).error || 'Identifiants invalides' };
    }
    const { token, user } = (await loginRes.json()) as {
      token: string;
      user: { id: string; email: string; nom: string; prenom: string; role: string };
    };
    const credRes = await fetch(`${base}/public/sync-credentials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!credRes.ok) {
      const err = await credRes.json().catch(() => ({ error: `HTTP ${credRes.status}` }));
      return { ok: false, error: (err as any).error || 'Échec récupération credentials' };
    }
    const { motDePasseHash } = (await credRes.json()) as { motDePasseHash: string };
    const ingest = await ingestServerUser({
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role as any,
      motDePasseHash,
    });
    if (!ingest.ok) return { ok: false, error: ingest.error };
    writeSyncConfig({ ...cfg, token, enabled: true });
    return { ok: true, user: ingest.user };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
});

ipcMain.handle('sync:logout', async () => {
  const cfg = readSyncConfig();
  writeSyncConfig({ ...cfg, token: '', enabled: false });
  return { ok: true };
});

ipcMain.handle('sync:testConnection', async () => {
  const cfg = readSyncConfig();
  if (!cfg.serverUrl) return { ok: false, error: 'URL serveur manquante' };
  try {
    const res = await fetch(`${cfg.serverUrl.replace(/\/$/, '')}/health`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
});

ipcMain.handle('sync:initServer', async () => {
  const cfg = readSyncConfig();
  if (!cfg.serverUrl || !cfg.token) return { ok: false, error: 'Non connecté' };
  try {
    const res = await fetch(`${cfg.serverUrl.replace(/\/$/, '')}/admin/init`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
});

ipcMain.handle('sync:markLastSync', async () => {
  const cfg = readSyncConfig();
  return writeSyncConfig({ ...cfg, lastSyncAt: new Date().toISOString() });
});

ipcMain.handle('shell:openPath', async (_event, p: string) => shell.openPath(p));
ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  } catch { return; }
  return shell.openExternal(url);
});
ipcMain.handle('shell:showItemInFolder', async (_event, p: string) => shell.showItemInFolder(p));

// ======================== IPC HANDLER - REFERENCE AUTOINCREMENT ========================
ipcMain.handle('articles:generateReference', async (event, collectionId: string) => {
  try {
    const collections = await getCollectionById(collectionId);
    if (!collections) return null;
    const prefix = collections.nom.substring(0, 3).toUpperCase();
    const articles = getAllArticles();
    const collectionArticles = (await articles).filter(a => a.collectionId === collectionId);
    const nextNumber = collectionArticles.length + 1;
    const reference = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    return reference;
  } catch (error) {
    console.error('Erreur lors de la génération de la référence:', error);
    throw error;
  }
});

app.whenReady().then(async () => {
  checkDatabase();
  await initializeTables().catch(err => {
    console.error('Erreur lors de l\'initialisation de la base de données:', err);
  });

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "connect-src 'self' https://*.workers.dev wss://*.workers.dev; " +
          "font-src 'self' data:"
        ],
      },
    });
  });

  createWindow();
});

// ======================== AUTO-UPDATE ========================
const autoUpdate = new AutoUpdateService(app.getPath('userData'));
const syncCfg = readSyncConfig();
const defaultFeedURL = syncCfg.serverUrl
    ? `${syncCfg.serverUrl.replace(/\/+$/, '')}/app/update`
    : undefined;
autoUpdate.init(defaultFeedURL);

// Vérification périodique des mises à jour (toutes les 6h en prod, désactivé en dev)
if (app.isPackaged) {
  autoUpdate.checkForUpdates();
  setInterval(() => autoUpdate.checkForUpdates(), 6 * 60 * 60 * 1000);
}

ipcMain.handle('update:getStatus', () => autoUpdate.getStatus());
ipcMain.handle('update:check', () => { autoUpdate.checkForUpdates(); });
ipcMain.handle('update:download', () => { autoUpdate.downloadUpdate(); });
ipcMain.handle('update:install', () => { autoUpdate.quitAndInstall(); });
ipcMain.handle('update:setFeedURL', (_e, url: string) => { autoUpdate.setFeedURL(url); });
ipcMain.on('update:subscribe', (event) => {
  const unsub = autoUpdate.subscribe((s) => {
    event.sender.send('update:status', s);
  });
  event.sender.on('destroyed', unsub);
});

const createWindow = () => {
  // Create the browser window.
  const isMac = process.platform === 'darwin';
  const mainWindow = new BrowserWindow({
    width: isMac ? 1680 : 1920,
    height: 1020,
    frame: isMac ? true : false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      devTools: !app.isPackaged,
      experimentalFeatures: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // ======================== IPC HANDLERS - WINDOW CONTROLS ========================
  ipcMain.handle('window:minimize', () => mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow.close());
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized());

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));

  Menu.setApplicationMenu(null);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  mainWindow.maximize();
  mainWindow.show()

  // Open the DevTools (dev only).
  if (!app.isPackaged) mainWindow.webContents.openDevTools();
};

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

/**
 * ======================== DOCUMENTATION IPC ========================
 * 
 * Comment utiliser les IPC handlers depuis le renderer (frontend):
 * 
 * Exemple avec des Articles:
 * 
 *   // Récupérer tous les articles
 *   const articles = await window.electron.ipcRenderer.invoke('articles:getAll');
 *   
 *   // Créer un article
 *   const newArticle = await window.electron.ipcRenderer.invoke('articles:create', {
 *     nom: "Chaise",
 *     reference: "ART-001",
 *     // ... autres données
 *   });
 *   
 *   // Mettre à jour
 *   await window.electron.ipcRenderer.invoke('articles:update', articleId, {
 *     nom: "Chaise modifiée"
 *   });
 *   
 *   // Supprimer
 *   await window.electron.ipcRenderer.invoke('articles:delete', articleId);
 * 
 * Les IPC handlers disponibles pour chaque entité:
 * - {entity}:getById, {entity}:getAll, {entity}:create, {entity}:update, {entity}:delete
 * 
 * Entités supportées:
 * - articles, clients, collections, sous-collections, administrateurs, devis, factures, lignes-documents
 */
