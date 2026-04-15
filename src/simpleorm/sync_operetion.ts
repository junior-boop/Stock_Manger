import { ModelFactory, SimpleORM } from "./simpleorm-sync";

// Types pour le journal des mises à jour côté client
export interface ClientJournalEntry {
  id: string; // Identifiant de la modification côté client
  id_serveur: string | null; // Identifiant de la même modification côté serveur
  operation: "create" | "update" | "delete";
  id_element: string; // Identifiant de l'élément
  table_name: string; // Nom de la table concernée
  timestamp: Date; // Date de la modification
  synced: boolean; // Si la modification a été synchronisée
  retry_count: number; // Nombre de tentatives de synchronisation
}

// Types pour le journal côté serveur
export interface ServerJournalEntry {
  id: string; // Identifiant de la modification côté serveur
  operation: "create" | "update" | "delete";
  id_element: string; // Identifiant de l'élément
  table_name: string; // Nom de la table concernée
  timestamp: Date; // Date de la modification
}

// Configuration pour la synchronisation
export interface SyncConfig {
  serverUrl: string;
  apiKey?: string;
  clientId: string;
  syncInterval?: number; // Intervalle de synchronisation automatique (ms)
  maxRetries?: number; // Nombre maximum de tentatives
  enableSSE?: boolean; // Activer les Server-Sent Events
}

// Status de la synchronisation
export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  isSyncing: boolean;
  errors: string[];
}

const orm = new SimpleORM("./notes.sqlite");
const db = new ModelFactory(orm);

export class SynchronizationManager {
  private orm: SimpleORM;
  private config: SyncConfig;
  private status: SyncStatus;
  private eventSource: EventSource | null = null;
  private syncTimer: number | null = null;

  constructor(orm: SimpleORM, config: SyncConfig) {
    this.orm = orm;

    this.config = config;
    this.status = {
      isOnline: this.isInBrowser() ? navigator.onLine : true,
      lastSync: null,
      pendingOperations: 0,
      isSyncing: false,
      errors: [],
    };

    this.initializeJournalTable();
    this.setupEventListeners();

    if (config.enableSSE) {
      this.setupSSE();
    }

    if (config.syncInterval && config.syncInterval > 0) {
      this.startPeriodicSync();
    }
  }

  private isInBrowser(): boolean {
    return typeof window !== "undefined" && typeof navigator !== "undefined";
  }

  private sync_journal() {
    const _sync_journal = db.createModel<ClientJournalEntry>("_sync_journal", {
      id: "TEXT PRIMARY KEY",
      id_serveur: "TEXT NULL",
      operation:
        "TEXT NOT NULL  CHECK(operation IN ('create', 'update', 'delete'))",
      id_element: "TEXT NOT NULL",
      table_name: "TEXT NOT NULL",
      timestamp: "TEXT NOT NULL",
      synced: "INTEGER DEFAULT 0",
      retry_count: "INTEGER DEFAULT 0",
      created_at: "DATETIME DEFAULT CURRENT_TIMESTAMP",
    });
    return _sync_journal;
  }

  private sync_metadata() {
    const _sync_metadata = db.createModel<{
      key: string;
      value: string;
      updated_at: Date;
    }>("_sync_metadata", {
      key: "TEXT PRIMARY KEY",
      value: "TEXT NOT NULL",
      updated_at: "DATETIME DEFAULT CURRENT_TIMESTAMP",
    });
    return _sync_metadata;
  }

  // Initialiser la table du journal des mises à jour
  private async initializeJournalTable(): Promise<void> {
    try {
      // Créer la table du journal des mises à jour
      await this.sync_journal().createTable();

      // Index pour améliorer les performances
      await this.orm.exec(`
            CREATE INDEX IF NOT EXISTS idx_sync_journal_synced ON _sync_journal(synced);
            CREATE INDEX IF NOT EXISTS idx_sync_journal_timestamp ON _sync_journal(timestamp);
            CREATE INDEX IF NOT EXISTS idx_sync_journal_element ON _sync_journal(id_element, table_name);
        `);

      // Table pour stocker les métadonnées de synchronisation
      await this.sync_metadata().createTable();

      console.log("Journal de synchronisation initialisé avec succès");
    } catch (error) {
      console.error("Erreur lors de l'initialisation du journal:", error);
      throw error;
    }
  }

  // Enregistrer une modification dans le journal local
  public async logOperation(
    operation: "create" | "update" | "delete",
    tableName: string,
    elementId: string
  ): Promise<string> {
    const journalId = this.generateUniqueId();
    const timestamp = new Date().toISOString();

    const journalEntry: ClientJournalEntry = {
      id: journalId,
      id_serveur: null,
      operation,
      id_element: elementId,
      table_name: tableName,
      timestamp: new Date(timestamp),
      synced: false,
      retry_count: 0,
    };

    try {
      // Enregistrer dans la base de données

      await this.sync_journal().create(journalEntry);

      await this.updatePendingOperationsCount();

      console.log(
        `Opération ${operation} enregistrée dans le journal:`,
        journalId
      );
      return journalId;
    } catch (error) {
      console.error("Erreur lors de l'enregistrement dans le journal:", error);
      throw error;
    }
  }

  // Obtenir les opérations non synchronisées
  private async getPendingOperations(): Promise<ClientJournalEntry[]> {
    try {
      const results = await this.orm.query<any>(
        `
        SELECT * FROM _sync_journal 
        WHERE synced = 0 AND retry_count < ?
        ORDER BY timestamp ASC
      `,
        [this.config.maxRetries || 5]
      );

      return results.map((row) => ({
        id: row.id,
        id_serveur: row.id_serveur,
        operation: row.operation as "create" | "update" | "delete",
        id_element: row.id_element,
        table_name: row.table_name,
        data: row.data ? JSON.parse(row.data) : null,
        timestamp: new Date(row.timestamp),
        synced: row.synced === 1,
        retry_count: row.retry_count,
      }));
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des opérations en attente:",
        error
      );
      return [];
    }
  }

  // Synchroniser avec le serveur
  public async synchronize(): Promise<void> {
    if (!this.status.isOnline || this.status.isSyncing) {
      return;
    }

    this.status.isSyncing = true;
    this.status.errors = [];

    try {
      console.log("Début de la synchronisation...");

      // 1. Récupérer le journal du serveur
      const serverJournal = await this.fetchServerJournal();

      // 2. Comparer et appliquer les modifications du serveur
      await this.applyServerChanges(serverJournal);

      // 3. Envoyer les modifications locales au serveur
      await this.pushLocalChanges();

      this.status.lastSync = new Date();
      console.log("Synchronisation terminée avec succès");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this.status.errors.push(errorMessage);
      console.error("Erreur lors de la synchronisation:", error);
    } finally {
      this.status.isSyncing = false;
      this.updatePendingOperationsCount();
    }
  }

  // Récupérer le journal du serveur
  private async fetchServerJournal(): Promise<ServerJournalEntry[]> {
    const lastSync = await this.getLastSyncTimestamp();
    const url = `${this.config.serverUrl}/journal?since=${lastSync || ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
        }),
        "X-Client-ID": this.config.clientId,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Erreur HTTP: ${response.status} - ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.journal || [];
  }

  // Appliquer les modifications du serveur
  private async applyServerChanges(
    serverJournal: ServerJournalEntry[]
  ): Promise<void> {
    for (const serverEntry of serverJournal) {
      try {
        // Vérifier si nous avons une version locale plus récente
        const localEntry = await this.findLocalEntry(
          serverEntry.id_element,
          serverEntry.table_name
        );

        if (
          localEntry &&
          new Date(localEntry.timestamp) > new Date(serverEntry.timestamp)
        ) {
          console.log(
            `Version locale plus récente pour ${serverEntry.id_element}, ignoré`
          );
          continue;
        }

        // Appliquer la modification du serveur
        await this.applyServerChange(serverEntry);
      } catch (error) {
        console.error(
          `Erreur lors de l'application de la modification serveur ${serverEntry.id}:`,
          error
        );
      }
    }
  }

  // Appliquer une modification spécifique du serveur
  private async applyServerChange(
    serverEntry: ServerJournalEntry
  ): Promise<void> {
    const { operation, id_element, table_name } = serverEntry;

    switch (operation) {
      case "create":
      case "update":
        // Récupérer les données depuis le serveur
        const elementData = await this.fetchElementFromServer(
          table_name,
          id_element
        );
        if (elementData) {
          await this.orm.upsert(table_name, elementData);
        }
        break;

      case "delete":
        await this.orm.delete(table_name, id_element);
        break;
    }

    // Marquer comme traité dans notre journal local si nous avions une entrée
    await this.markServerEntryProcessed(serverEntry);
  }

  // Envoyer les modifications locales au serveur
  private async pushLocalChanges(): Promise<void> {
    const pendingOperations = await this.getPendingOperations();

    for (const operation of pendingOperations) {
      try {
        await this.pushSingleOperation(operation);
      } catch (error) {
        console.error(
          `Erreur lors de l'envoi de l'opération ${operation.id}:`,
          error
        );
        await this.incrementRetryCount(operation.id);
      }
    }
  }

  // Envoyer une seule opération au serveur
  private async pushSingleOperation(
    operation: ClientJournalEntry
  ): Promise<void> {
    const { operation: op, id_element, table_name, data } = operation;
    let url = `${this.config.serverUrl}/${table_name}`;
    let method = "POST";
    let body: any = null;

    switch (op) {
      case "create":
        method = "POST";
        body = data;
        break;

      case "update":
        method = "PUT";
        url += `/${id_element}`;
        body = data;
        break;

      case "delete":
        method = "DELETE";
        url += `/${id_element}`;
        break;
    }

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
        }),
        "X-Client-ID": this.config.clientId,
        "X-Journal-ID": operation.id,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw new Error(
        `Erreur HTTP: ${response.status} - ${response.statusText}`
      );
    }

    const result = await response.json();

    // Marquer comme synchronisé et enregistrer l'ID serveur
    await this.markOperationSynced(operation.id, result.journalId || null);
  }

  // Utilitaires pour la gestion du journal
  private async findLocalEntry(
    elementId: string,
    tableName: string
  ): Promise<ClientJournalEntry | null> {
    const result = await this.sync_journal().findAll({
      where: {
        id_element: elementId,
        table_name: tableName,
      },
      orderBy: {
        timestamp: "DESC",
      },
      limit: 1,
    });
    // const result = await this.orm.get<any>(
    //   `
    //   SELECT * FROM _sync_journal
    //   WHERE id_element = ? AND table_name = ?
    //   ORDER BY timestamp DESC LIMIT 1
    // `,
    //   [elementId, tableName]
    // );

    if (!result) return null;

    return {
      id: result.id,
      id_serveur: result.id_serveur,
      operation: result.operation,
      id_element: result.id_element,
      table_name: result.table_name,
      timestamp: new Date(result.timestamp),
      synced: result.synced === 1,
      retry_count: result.retry_count,
    };
  }

  private async markOperationSynced(
    journalId: string,
    serverId: string | null
  ): Promise<void> {
    await this.orm.run(
      `
      UPDATE _sync_journal 
      SET synced = 1, id_serveur = ?
      WHERE id = ?
    `,
      [serverId, journalId]
    );
  }

  private async markServerEntryProcessed(
    serverEntry: ServerJournalEntry
  ): Promise<void> {
    // Si nous avons une entrée locale correspondante, la marquer comme synchronisée
    await this.orm.run(
      `
      UPDATE _sync_journal 
      SET id_serveur = ?, synced = 1
      WHERE id_element = ? AND table_name = ? AND synced = 0
    `,
      [serverEntry.id, serverEntry.id_element, serverEntry.table_name]
    );
  }

  private async incrementRetryCount(journalId: string): Promise<void> {
    await this.orm.run(
      `
      UPDATE _sync_journal 
      SET retry_count = retry_count + 1
      WHERE id = ?
    `,
      [journalId]
    );
  }

  private async fetchElementFromServer(
    tableName: string,
    elementId: string
  ): Promise<any> {
    const response = await fetch(
      `${this.config.serverUrl}/api/sync/${tableName}/${elementId}`,
      {
        headers: {
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
          "X-Client-ID": this.config.clientId,
        },
      }
    );

    if (response.ok) {
      return response.json();
    }
    return null;
  }

  private async getLastSyncTimestamp(): Promise<string | null> {
    const result = await this.orm.get<{ value: string }>(`
      SELECT value FROM _sync_metadata WHERE key = 'last_sync_timestamp'
    `);
    return result?.value || null;
  }

  private async updateLastSyncTimestamp(): Promise<void> {
    const timestamp = new Date().toISOString();
    await this.orm.run(
      `
      INSERT OR REPLACE INTO _sync_metadata (key, value, updated_at) 
      VALUES ('last_sync_timestamp', ?, CURRENT_TIMESTAMP)
    `,
      [timestamp]
    );
  }

  private async updatePendingOperationsCount(): Promise<void> {
    const result = await this.orm.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM _sync_journal WHERE synced = 0
    `);
    this.status.pendingOperations = result?.count || 0;
  }

  // Configuration des Server-Sent Events
  private setupSSE(): void {
    if (!this.config.serverUrl || !this.isInBrowser()) return;

    const sseUrl = `${this.config.serverUrl}/api/sync/events`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = () => {
      console.log("Connexion SSE établie");
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSSEMessage(data);
      } catch (error) {
        console.error("Erreur lors du traitement du message SSE:", error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error("Erreur SSE:", error);
    };
  }

  private async handleSSEMessage(data: any): Promise<void> {
    if (data.clientId === this.config.clientId) return; // Ignorer nos propres événements

    if (data.type === "journal_update") {
      // Nouvelle entrée dans le journal du serveur
      await this.applyServerChange(data.entry);
    }
  }

  // Gestion des événements réseau
  private setupEventListeners(): void {
    if (!this.isInBrowser()) return;

    window.addEventListener("online", () => {
      this.status.isOnline = true;
      console.log("Connexion réseau restaurée, synchronisation...");
      this.synchronize();
    });

    window.addEventListener("offline", () => {
      this.status.isOnline = false;
      console.log("Connexion réseau perdue");
    });
  }

  // Synchronisation périodique
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.status.isOnline && !this.status.isSyncing) {
        this.synchronize();
      }
    }, this.config.syncInterval!);
  }

  // Méthodes publiques pour l'interface
  public getStatus(): SyncStatus {
    return { ...this.status };
  }

  public async forcSync(): Promise<void> {
    return this.synchronize();
  }

  public async clearJournal(): Promise<void> {
    await this.orm.run("DELETE FROM _sync_journal WHERE synced = 1");
    this.updatePendingOperationsCount();
  }

  public async getJournalEntries(
    limit: number = 100
  ): Promise<ClientJournalEntry[]> {
    const results = await this.orm.query<any>(
      `
      SELECT * FROM _sync_journal 
      ORDER BY timestamp DESC 
      LIMIT ?
    `,
      [limit]
    );

    return results.map((row) => ({
      id: row.id,
      id_serveur: row.id_serveur,
      operation: row.operation,
      id_element: row.id_element,
      table_name: row.table_name,
      data: row.data ? JSON.parse(row.data) : null,
      timestamp: new Date(row.timestamp),
      synced: row.synced === 1,
      retry_count: row.retry_count,
    }));
  }

  private generateUniqueId(): string {
    return `${this.config.clientId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Nettoyage
  public destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Wrapper pour intégrer la synchronisation avec SimpleORM
export class SyncEnabledORM extends SimpleORM {
  private syncManager: SynchronizationManager | null = null;

  enableSynchronization(config: SyncConfig): void {
    this.syncManager = new SynchronizationManager(this, config);
  }

  // Override des méthodes pour enregistrer dans le journal
  async create<T extends any>(tableName: string, data: Partial<T>): Promise<T> {
    const result = await super.create<T>(tableName, data);

    if (this.syncManager && result.id) {
      await this.syncManager.logOperation(
        "create",
        tableName,
        result.id.toString(),
        result
      );
    }

    return result;
  }

  async update<T extends any>(
    tableName: string,
    id: string | number,
    data: Partial<T>
  ): Promise<T | null> {
    const result = await super.update<T>(tableName, id, data);

    if (this.syncManager && result) {
      await this.syncManager.logOperation(
        "update",
        tableName,
        id.toString(),
        result
      );
    }

    return result;
  }

  async delete(tableName: string, id: string | number): Promise<boolean> {
    const result = await super.delete(tableName, id);

    if (this.syncManager && result) {
      await this.syncManager.logOperation("delete", tableName, id.toString());
    }

    return result;
  }

  getSyncManager(): SynchronizationManager | null {
    return this.syncManager;
  }
}
