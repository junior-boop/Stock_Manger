// Types et interfaces de base
interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: SortOptions;
}

interface SortOptions<T = any> {
  field: keyof T;
  direction: "asc" | "desc";
}

interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StatsResult {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
}

type PredicateFunction<T> = (item: T) => boolean;
type UpdateData<T> = Partial<Omit<T, "id">>;

// Classe principale avec typage amélioré
export class QueryBuilder<T extends BaseEntity> {
  private dataMap: Map<string, T>;
  private lastQuery: T[] | null = null;

  constructor(array: T[]) {
    this.dataMap = new Map(array.map((item) => [item.id, item]));
  }

  // Méthodes de base avec typage
  findAll(): T[] {
    this.lastQuery = Array.from(this.dataMap.values());
    return this.lastQuery;
  }

  // Retourner le dernier résultat de requête
  getLastQuery(): T[] | null {
    return this.lastQuery;
  }

  // Amélioration: Trouver plusieurs éléments par IDs
  findByIds(ids: string[]): T[] {
    return ids
      .map((id) => this.dataMap.get(id))
      .filter((item): item is T => item !== undefined);
  }

  // Recherche avec typage amélioré
  search(property: keyof T, regex: RegExp): T[] {
    return this.where((item) => {
      const value = item[property];
      return typeof value === "string" && regex.test(value);
    });
  }

  // Grouper par propriété
  groupBy<K extends keyof T>(property: K): Map<T[K], T[]> {
    const groups = new Map<T[K], T[]>();
    this.findAll().forEach((item) => {
      const key = item[property];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    });
    return groups;
  }

  // Pagination avec interface de résultat
  paginate(page: number, itemsPerPage: number): PaginationResult<T> {
    const total = this.count();
    const totalPages = Math.ceil(total / itemsPerPage);
    const start = (page - 1) * itemsPerPage;
    const data = this.findAll().slice(start, start + itemsPerPage);

    return {
      data,
      total,
      page,
      limit: itemsPerPage,
      totalPages,
    };
  }

  // Agrégations avec typage strict
  sum(property: keyof T): number {
    return this.findAll().reduce((acc, item) => {
      const value = item[property];
      return acc + (typeof value === "number" ? value : 0);
    }, 0);
  }

  // Nouveau: Trouver les doublons
  findDuplicates(property: keyof T): T[] {
    const groups = this.groupBy(property);
    const duplicates: T[] = [];
    groups.forEach((group) => {
      if (group.length > 1) {
        duplicates.push(...group);
      }
    });
    return duplicates;
  }

  // Opérations de mise à jour avec typage strict
  updateMany(predicate: PredicateFunction<T>, data: UpdateData<T>): number {
    let count = 0;
    this.where(predicate).forEach((item) => {
      if (this.update(item.id, data)) {
        count++;
      }
    });
    return count;
  }

  // Nouveau: Supprimer plusieurs éléments
  deleteMany(predicate: PredicateFunction<T>): number {
    let count = 0;
    this.where(predicate).forEach((item) => {
      if (this.delete(item.id)) {
        count++;
      }
    });
    return count;
  }

  // Nouveau: Vérifier si tous les éléments respectent une condition
  every(predicate: PredicateFunction<T>): boolean {
    return this.findAll().every(predicate);
  }

  // Nouveau: Vérifier si au moins un élément respecte une condition
  some(predicate: PredicateFunction<T>): boolean {
    return this.findAll().some(predicate);
  }

  // Statistiques avec interface de résultat
  stats(property: keyof T): StatsResult {
    const numbers = this.findAll()
      .map((item) => item[property])
      .filter((value): value is number => typeof value === "number");

    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
      sum: numbers.reduce((a, b) => a + b, 0),
      count: numbers.length,
    };
  }

  // Convertir en Map
  toMap(): Map<string, T> {
    return new Map(this.dataMap);
  }

  // Fusionner avec une autre instance de QueryBuilder
  merge(other: QueryBuilder<T>): QueryBuilder<T> {
    const mergedArray = [...this.findAll(), ...other.findAll()];
    return new QueryBuilder(mergedArray);
  }

  // Vider la collection
  clear(): void {
    this.dataMap.clear();
    this.lastQuery = null;
  }

  // Trouver par ID
  findById(id: string): T | undefined {
    return this.dataMap.get(id);
  }

  // Filtrer avec un prédicat personnalisé
  where(predicate: PredicateFunction<T>): T[] {
    return this.findAll().filter(predicate);
  }

  // Rechercher par propriété
  findBy<K extends keyof T>(property: K, value: T[K]): T[] {
    return this.where((item) => item[property] === value);
  }

  // Trier par propriété
  orderBy<K extends keyof T>(
    property: K,
    direction: "asc" | "desc" = "asc"
  ): T[] {
    return this.findAll().sort((a, b) => {
      const modifier = direction === "asc" ? 1 : -1;
      return a[property] > b[property] ? modifier : -modifier;
    });
  }

  // Limiter le nombre de résultats
  limit(count: number): T[] {
    return this.findAll().slice(0, count);
  }

  // Ajouter un élément
  add(item: T): void {
    this.dataMap.set(item.id, item);
  }

  // Mettre à jour un élément
  update(id: string, data: UpdateData<T>): boolean {
    const item = this.dataMap.get(id);
    if (item) {
      this.dataMap.set(id, { ...item, ...data });
      return true;
    }
    return false;
  }

  // Supprimer un élément
  delete(id: string): boolean {
    return this.dataMap.delete(id);
  }

  // Obtenir la taille de la collection
  count(): number {
    return this.dataMap.size;
  }
}
