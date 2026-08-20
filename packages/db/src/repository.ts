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


