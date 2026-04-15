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
    };
  }
}

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
