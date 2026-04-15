import { SyncOperation } from "./simpleorm-sync";

export class SyncQueue {
  private queue: SyncOperation[] = [];
  private processing: boolean = false;

  constructor() {}

  public async enqueue(operation: SyncOperation): Promise<void> {
    this.queue.push(operation);
    this.processQueue();
  }

  public async enqueueMany(operations: SyncOperation[]): Promise<void> {
    this.queue.push(...operations);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const operation = this.queue[0];
        await this.processOperation(operation);
        this.queue.shift(); // Retirer l'opération traitée de la queue
      }
    } catch (error) {
      console.error("Erreur lors du traitement de la queue:", error);
      // Si l'opération échoue, on la remet en queue avec un compteur de tentatives
      const failedOperation = this.queue[0];
      if (failedOperation) {
        failedOperation.retryCount = (failedOperation.retryCount || 0) + 1;
        if (failedOperation.retryCount < 3) {
          this.queue.push(failedOperation); // Remettre à la fin de la queue pour réessayer
        }
        this.queue.shift(); // Retirer l'opération de la tête de la queue
      }
    } finally {
      this.processing = false;
      // S'il reste des opérations, continuer le traitement
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    // Cette méthode sera implémentée par la classe SyncManager
    throw new Error("processOperation doit être implémenté par le SyncManager");
  }

  public clear(): void {
    this.queue = [];
    this.processing = false;
  }

  public size(): number {
    return this.queue.length;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public getQueue(): SyncOperation[] {
    return [...this.queue]; // Retourner une copie pour éviter les modifications externes
  }
}
