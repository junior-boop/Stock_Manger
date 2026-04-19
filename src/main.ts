import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
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
} from './Databases';

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
    console.log('filePath:', imagesDir)
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
