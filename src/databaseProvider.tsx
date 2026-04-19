import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
    useMemo
} from 'react';
import {
    Article,
    Client,
    Collection,
    SousCollection,
    Administrateur,
    Devis,
    Facture,
    LigneDocument
} from './Databases/db.d';

type DatabaseError = {
    message: string;
    code: string;
    details?: unknown;
};

interface DatabaseContextType {
    articles: Article[];
    clients: Client[];
    collections: Collection[];
    sousCollections: SousCollection[];
    administrateurs: Administrateur[];
    devis: Devis[];
    factures: Facture[];
    lignesDocuments: LigneDocument[];
    isLoading: boolean;
    error: DatabaseError | null;
    refreshAll: () => Promise<void>;
    refreshArticles: () => Promise<void>;
    refreshClients: () => Promise<void>;
    refreshCollections: () => Promise<void>;
    refreshSousCollections: () => Promise<void>;
    refreshSousCollectionsByCollection: (collectionId: string) => Promise<void>;
    refreshAdministrateurs: () => Promise<void>;
    refreshDevis: () => Promise<void>;
    refreshDevisByClient: (clientId: string) => Promise<void>;
    refreshFactures: () => Promise<void>;
    refreshFacturesByClient: (clientId: string) => Promise<void>;
    refreshLignesDocuments: () => Promise<void>;
    refreshLignesDocumentsByArticle: (articleId: string) => Promise<void>;
    createArticle: (data: Partial<Article>) => Promise<Article | undefined>;
    updateArticle: (id: string, data: Partial<Article>) => Promise<void>;
    deleteArticle: (id: string) => Promise<void>;
    createClient: (data: Partial<Client>) => Promise<Client | undefined>;
    updateClient: (id: string, data: Partial<Client>) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;
    createCollection: (data: Partial<Collection>) => Promise<Collection | undefined>;
    updateCollection: (id: string, data: Partial<Collection>) => Promise<void>;
    deleteCollection: (id: string) => Promise<void>;
    createSousCollection: (data: Partial<SousCollection>) => Promise<SousCollection | undefined>;
    updateSousCollection: (id: string, data: Partial<SousCollection>) => Promise<void>;
    deleteSousCollection: (id: string) => Promise<void>;
    createDevis: (data: Partial<Devis>) => Promise<Devis | undefined>;
    updateDevis: (id: string, data: Partial<Devis>) => Promise<void>;
    deleteDevis: (id: string) => Promise<void>;
    createFacture: (data: Partial<Facture>) => Promise<Facture | undefined>;
    updateFacture: (id: string, data: Partial<Facture>) => Promise<void>;
    deleteFacture: (id: string) => Promise<void>;
    createLigneDocument: (data: Partial<LigneDocument>) => Promise<LigneDocument | undefined>;
    updateLigneDocument: (id: string, data: Partial<LigneDocument>) => Promise<void>;
    deleteLigneDocument: (id: string) => Promise<void>;
    loadImage: (filename: string) => Promise<string | null>;
    loadImagesForArticle: (imagePaths: string[]) => Promise<string[]>;
    clearError: () => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [sousCollections, setSousCollections] = useState<SousCollection[]>([]);
    const [administrateurs, setAdministrateurs] = useState<Administrateur[]>([]);
    const [devis, setDevis] = useState<Devis[]>([]);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [lignesDocuments, setLignesDocuments] = useState<LigneDocument[]>([]);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<DatabaseError | null>(null);

    const handleError = useCallback((error: unknown, operation: string) => {
        const dbError: DatabaseError = {
            message: `Error during ${operation}`,
            code: 'DB_ERROR',
            details: error
        };
        setError(dbError);
        console.error(`Database error during ${operation}:`, error);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const refreshArticles = useCallback(async () => {
        try {
            const result = await window.db.articles.getAll();
            setArticles(result || []);
        } catch (error) {
            handleError(error, 'refreshing articles');
        }
    }, [handleError]);

    const refreshClients = useCallback(async () => {
        try {
            const result = await window.db.clients.getAll();
            setClients(result || []);
        } catch (error) {
            handleError(error, 'refreshing clients');
        }
    }, [handleError]);

    const refreshCollections = useCallback(async () => {
        try {
            const result = await window.db.collections.getAll();
            setCollections(result || []);
        } catch (error) {
            handleError(error, 'refreshing collections');
        }
    }, [handleError]);

    const refreshSousCollections = useCallback(async () => {
        try {
            const result = await window.db.sousCollections.getAll();
            setSousCollections(result || []);
        } catch (error) {
            handleError(error, 'refreshing sous-collections');
        }
    }, [handleError]);

    const refreshSousCollectionsByCollection = useCallback(async (collectionId: string) => {
        try {
            const result = await window.db.sousCollections.getByCollectionId(collectionId);
            setSousCollections(prev => {
                const filtered = prev.filter(s => s.collectionId !== collectionId);
                return [...filtered, ...(result || [])];
            });
        } catch (error) {
            handleError(error, 'refreshing sous-collections by collection');
        }
    }, [handleError]);

    const refreshAdministrateurs = useCallback(async () => {
        try {
            const result = await window.db.administrateurs.getAll();
            setAdministrateurs(result || []);
        } catch (error) {
            handleError(error, 'refreshing administrateurs');
        }
    }, [handleError]);

    const refreshDevis = useCallback(async () => {
        try {
            const result = await window.db.devis.getAll();
            setDevis(result || []);
        } catch (error) {
            handleError(error, 'refreshing devis');
        }
    }, [handleError]);

    const refreshDevisByClient = useCallback(async (clientId: string) => {
        try {
            const result = await window.db.devis.getByClientId(clientId);
            setDevis(prev => {
                const filtered = prev.filter(d => d.clientId !== clientId);
                return [...filtered, ...(result || [])];
            });
        } catch (error) {
            handleError(error, 'refreshing devis by client');
        }
    }, [handleError]);

    const refreshFactures = useCallback(async () => {
        try {
            const result = await window.db.factures.getAll();
            setFactures(result || []);
        } catch (error) {
            handleError(error, 'refreshing factures');
        }
    }, [handleError]);

    const refreshFacturesByClient = useCallback(async (clientId: string) => {
        try {
            const result = await window.db.factures.getByClientId(clientId);
            setFactures(prev => {
                const filtered = prev.filter(f => f.clientId !== clientId);
                return [...filtered, ...(result || [])];
            });
        } catch (error) {
            handleError(error, 'refreshing factures by client');
        }
    }, [handleError]);

    const refreshLignesDocuments = useCallback(async () => {
        try {
            const result = await window.db.lignesDocuments.getAll();
            setLignesDocuments(result || []);
        } catch (error) {
            handleError(error, 'refreshing lignes documents');
        }
    }, [handleError]);

    const refreshLignesDocumentsByArticle = useCallback(async (articleId: string) => {
        try {
            const result = await window.db.lignesDocuments.getByArticleId(articleId);
            setLignesDocuments(prev => {
                const filtered = prev.filter(l => l.articleId !== articleId);
                return [...filtered, ...(result || [])];
            });
        } catch (error) {
            handleError(error, 'refreshing lignes documents by article');
        }
    }, [handleError]);

    const refreshAll = useCallback(async () => {
        setIsLoading(true);
        clearError();
        try {
            await Promise.all([
                refreshArticles(),
                refreshClients(),
                refreshCollections(),
                refreshSousCollections(),
                refreshAdministrateurs(),
                refreshDevis(),
                refreshFactures(),
                refreshLignesDocuments()
            ]);
        } catch (error) {
            handleError(error, 'refreshing all data');
        } finally {
            setIsLoading(false);
        }
    }, [refreshArticles, refreshClients, refreshCollections, refreshSousCollections, refreshAdministrateurs, refreshDevis, refreshFactures, refreshLignesDocuments, handleError, clearError]);

    const createArticle = useCallback(async (data: Partial<Article>) => {
        clearError();
        try {
            const result = await window.db.articles.create(data);
            await refreshArticles();
            return result;
        } catch (error) {
            handleError(error, 'creating article');
        }
    }, [refreshArticles]);

    const updateArticle = useCallback(async (id: string, data: Partial<Article>) => {
        clearError();
        try {
            await window.db.articles.update(id, data);
            await refreshArticles();
        } catch (error) {
            handleError(error, 'updating article');
        }
    }, [refreshArticles]);

    const deleteArticle = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.articles.delete(id);
            await refreshArticles();
        } catch (error) {
            handleError(error, 'deleting article');
        }
    }, [refreshArticles]);

    const createClient = useCallback(async (data: Partial<Client>) => {
        clearError();
        try {
            const result = await window.db.clients.create(data);
            await refreshClients();
            return result;
        } catch (error) {
            handleError(error, 'creating client');
        }
    }, [refreshClients]);

    const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
        clearError();
        try {
            await window.db.clients.update(id, data);
            await refreshClients();
        } catch (error) {
            handleError(error, 'updating client');
        }
    }, [refreshClients]);

    const deleteClient = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.clients.delete(id);
            await refreshClients();
        } catch (error) {
            handleError(error, 'deleting client');
        }
    }, [refreshClients]);

    const createCollection = useCallback(async (data: Partial<Collection>) => {
        clearError();
        try {
            const result = await window.db.collections.create(data);
            await refreshCollections();
            return result;
        } catch (error) {
            handleError(error, 'creating collection');
        }
    }, [refreshCollections]);

    const updateCollection = useCallback(async (id: string, data: Partial<Collection>) => {
        clearError();
        try {
            await window.db.collections.update(id, data);
            await refreshCollections();
        } catch (error) {
            handleError(error, 'updating collection');
        }
    }, [refreshCollections]);

    const deleteCollection = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.collections.delete(id);
            await refreshCollections();
        } catch (error) {
            handleError(error, 'deleting collection');
        }
    }, [refreshCollections]);

    const createSousCollection = useCallback(async (data: Partial<SousCollection>) => {
        clearError();
        try {
            const result = await window.db.sousCollections.create(data);
            await refreshSousCollections();
            return result;
        } catch (error) {
            handleError(error, 'creating sous-collection');
        }
    }, [refreshSousCollections]);

    const updateSousCollection = useCallback(async (id: string, data: Partial<SousCollection>) => {
        clearError();
        try {
            await window.db.sousCollections.update(id, data);
            await refreshSousCollections();
        } catch (error) {
            handleError(error, 'updating sous-collection');
        }
    }, [refreshSousCollections]);

    const deleteSousCollection = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.sousCollections.delete(id);
            await refreshSousCollections();
        } catch (error) {
            handleError(error, 'deleting sous-collection');
        }
    }, [refreshSousCollections]);

    const createDevis = useCallback(async (data: Partial<Devis>) => {
        clearError();
        try {
            const result = await window.db.devis.create(data);
            await refreshDevis();
            return result;
        } catch (error) {
            handleError(error, 'creating devis');
        }
    }, [refreshDevis]);

    const updateDevis = useCallback(async (id: string, data: Partial<Devis>) => {
        clearError();
        try {
            await window.db.devis.update(id, data);
            await refreshDevis();
        } catch (error) {
            handleError(error, 'updating devis');
        }
    }, [refreshDevis]);

    const deleteDevis = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.devis.delete(id);
            await refreshDevis();
        } catch (error) {
            handleError(error, 'deleting devis');
        }
    }, [refreshDevis]);

    const createFacture = useCallback(async (data: Partial<Facture>) => {
        clearError();
        try {
            const result = await window.db.factures.create(data);
            await refreshFactures();
            return result;
        } catch (error) {
            handleError(error, 'creating facture');
        }
    }, [refreshFactures]);

    const updateFacture = useCallback(async (id: string, data: Partial<Facture>) => {
        clearError();
        try {
            await window.db.factures.update(id, data);
            await refreshFactures();
        } catch (error) {
            handleError(error, 'updating facture');
        }
    }, [refreshFactures]);

    const deleteFacture = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.factures.delete(id);
            await refreshFactures();
        } catch (error) {
            handleError(error, 'deleting facture');
        }
    }, [refreshFactures]);

    const createLigneDocument = useCallback(async (data: Partial<LigneDocument>) => {
        clearError();
        try {
            const result = await window.db.lignesDocuments.create(data);
            await refreshLignesDocuments();
            return result;
        } catch (error) {
            handleError(error, 'creating ligne document');
        }
    }, [refreshLignesDocuments]);

    const updateLigneDocument = useCallback(async (id: string, data: Partial<LigneDocument>) => {
        clearError();
        try {
            await window.db.lignesDocuments.update(id, data);
            await refreshLignesDocuments();
        } catch (error) {
            handleError(error, 'updating ligne document');
        }
    }, [refreshLignesDocuments]);

    const deleteLigneDocument = useCallback(async (id: string) => {
        clearError();
        try {
            await window.db.lignesDocuments.delete(id);
            await refreshLignesDocuments();
        } catch (error) {
            handleError(error, 'deleting ligne document');
        }
    }, [refreshLignesDocuments]);

    const loadImage = useCallback(async (filename: string): Promise<string | null> => {

        try {
            return await window.db.images.get(filename);
        } catch (error) {
            console.error('Erreur lors du chargement de l\'image:', error);
            return null;
        }
    }, []);

    const loadImagesForArticle = useCallback(async (imagePaths: string[]): Promise<string[]> => {
        const results: string[] = [];
        for (const path of imagePaths) {
            const filename = path.split(/[/\\]/).pop() || path;
            const imageData = await loadImage(filename);
            if (imageData) results.push(imageData);
        }
        return results;
    }, [loadImage]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    const contextValue = useMemo(() => ({
        articles,
        clients,
        collections,
        sousCollections,
        administrateurs,
        devis,
        factures,
        lignesDocuments,
        isLoading,
        error,
        refreshAll,
        refreshArticles,
        refreshClients,
        refreshCollections,
        refreshSousCollections,
        refreshSousCollectionsByCollection,
        refreshAdministrateurs,
        refreshDevis,
        refreshDevisByClient,
        refreshFactures,
        refreshFacturesByClient,
        refreshLignesDocuments,
        refreshLignesDocumentsByArticle,
        createArticle,
        updateArticle,
        deleteArticle,
        createClient,
        updateClient,
        deleteClient,
        createCollection,
        updateCollection,
        deleteCollection,
        createSousCollection,
        updateSousCollection,
        deleteSousCollection,
        createDevis,
        updateDevis,
        deleteDevis,
        createFacture,
        updateFacture,
        deleteFacture,
        createLigneDocument,
        updateLigneDocument,
        deleteLigneDocument,
        loadImage,
        loadImagesForArticle,
        clearError
    }), [
        articles,
        clients,
        collections,
        sousCollections,
        administrateurs,
        devis,
        factures,
        lignesDocuments,
        isLoading,
        error,
        refreshAll,
        refreshArticles,
        refreshClients,
        refreshCollections,
        refreshSousCollections,
        refreshSousCollectionsByCollection,
        refreshAdministrateurs,
        refreshDevis,
        refreshDevisByClient,
        refreshFactures,
        refreshFacturesByClient,
        refreshLignesDocuments,
        refreshLignesDocumentsByArticle,
        createArticle,
        updateArticle,
        deleteArticle,
        createClient,
        updateClient,
        deleteClient,
        createCollection,
        updateCollection,
        deleteCollection,
        createSousCollection,
        updateSousCollection,
        deleteSousCollection,
        createDevis,
        updateDevis,
        deleteDevis,
        createFacture,
        updateFacture,
        deleteFacture,
        createLigneDocument,
        updateLigneDocument,
        deleteLigneDocument,
        loadImage,
        loadImagesForArticle,
        clearError
    ]);

    return (
        <DatabaseContext.Provider value={contextValue}>
            {children}
        </DatabaseContext.Provider>
    );
};

export const useDatabase = () => {
    const context = useContext(DatabaseContext);
    if (context === undefined) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return context;
};