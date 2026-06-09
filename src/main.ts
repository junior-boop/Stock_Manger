import { app, BrowserWindow, Menu, ipcMain, shell, dialog } from 'electron';
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
} from './Databases';
import {
  isSetupDone,
  setupFirstAdmin,
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  hasPermission,
  createUser as authCreateUser,
  updateUserPassword as authUpdateUserPassword,
} from './Databases/auth';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize database
checkDatabase();
initializeTables().then(() => {
  console.log('Tables de base de données créées avec succès');
}).catch(err => {
  console.error('Erreur lors de l\'initialisation de la base de données:', err);
});

// ======================== IPC HANDLERS - AUTH ========================
ipcMain.handle('auth:isSetupDone', async () => isSetupDone());
ipcMain.handle('auth:setup', async (_event, data) => setupFirstAdmin(data));
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

// ======================== IPC HANDLER - IMAGES ========================
const imagesDir = path.join(app.getPath('pictures'), "..", 'images');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

ipcMain.handle('images:save', async (event, base64Data: string, filename: string) => {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    const filePath = path.join(imagesDir, filename);
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

ipcMain.handle('images:get', async (event, filename: string) => {
  try {
    const filePath = path.join(filename);
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
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
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
  renderPdfToFile(html, filename, devisPdfDir),
);

ipcMain.handle('pdf:generateFacture', async (_event, html: string, filename: string) =>
  renderPdfToFile(html, filename, facturesPdfDir),
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
type CustomField = {
  id: string;
  type: 'email' | 'tel' | 'url' | 'address' | 'text';
  label: string;
  value: string;
};

const DEFAULT_COMPANY: {
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
} = {
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
};

function readCompanyInfo(): typeof DEFAULT_COMPANY {
  try {
    if (!fs.existsSync(companyInfoPath)) return { ...DEFAULT_COMPANY };
    const raw = fs.readFileSync(companyInfoPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_COMPANY, ...parsed };
  } catch (e) {
    console.error('Erreur lecture entreprise.json:', e);
    return { ...DEFAULT_COMPANY };
  }
}

ipcMain.handle('company:get', async () => readCompanyInfo());
ipcMain.handle('company:set', async (_event, data: Partial<typeof DEFAULT_COMPANY>) => {
  const current = readCompanyInfo();
  const next = { ...current, ...data };
  fs.writeFileSync(companyInfoPath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
});

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
ipcMain.handle('shell:openExternal', async (_event, url: string) => shell.openExternal(url));
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

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1020,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: true, // Nécessaire pour WASM en développement
      devTools: true,
      experimentalFeatures: true,

      preload: path.join(__dirname, 'preload.js'),
    },
    show : false
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

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

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
