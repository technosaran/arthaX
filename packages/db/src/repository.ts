export interface RepositoryFilters {
  limit?: number;
  offset?: number;
  where?: Record<string, any>;
}

export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filters?: RepositoryFilters): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export abstract class InMemoryRepository<T extends { id: string }> implements IBaseRepository<T> {
  protected items = new Map<string, T>();

  public async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  public async findAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  public async create(data: Partial<T>): Promise<T> {
    const id = data.id || `id_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newItem = { ...data, id } as T;
    this.items.set(id, newItem);
    return newItem;
  }

  public async update(id: string, data: Partial<T>): Promise<T | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.items.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}
