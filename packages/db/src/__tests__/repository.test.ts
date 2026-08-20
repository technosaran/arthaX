import { IBaseRepository, RepositoryFilters } from "../index";

interface TestEntity {
  id: string;
  name: string;
  amount: number;
}

class MockRepository implements IBaseRepository<TestEntity> {
  private items: TestEntity[] = [];

  async findById(id: string): Promise<TestEntity | null> {
    return this.items.find((item) => item.id === id) || null;
  }

  async findAll(filters?: RepositoryFilters): Promise<TestEntity[]> {
    let result = [...this.items];
    if (filters?.where) {
      result = result.filter((item) => {
        return Object.entries(filters.where!).every(
          ([key, value]) => (item as any)[key] === value
        );
      });
    }
    if (filters?.offset !== undefined) {
      result = result.slice(filters.offset);
    }
    if (filters?.limit !== undefined) {
      result = result.slice(0, filters.limit);
    }
    return result;
  }

  async create(data: Partial<TestEntity>): Promise<TestEntity> {
    const newItem: TestEntity = {
      id: data.id || `id-${Date.now()}-${Math.random()}`,
      name: data.name || "Default",
      amount: data.amount || 0,
      ...data,
    };
    this.items.push(newItem);
    return newItem;
  }

  async update(id: string, data: Partial<TestEntity>): Promise<TestEntity | null> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    this.items[index] = { ...this.items[index], ...data };
    return this.items[index];
  }

  async delete(id: string): Promise<boolean> {
    const initialLength = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length < initialLength;
  }
}

describe("Repository Interface Contract", () => {
  let repo: IBaseRepository<TestEntity>;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it("should create and find an entity by id", async () => {
    const created = await repo.create({ name: "Savings", amount: 1000 });
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Savings");
    expect(created.amount).toBe(1000);

    const found = await repo.findById(created.id);
    expect(found).toEqual(created);
  });

  it("should return null when finding non-existent id", async () => {
    const found = await repo.findById("non-existent-id");
    expect(found).toBeNull();
  });

  it("should find all entities with filters", async () => {
    await repo.create({ id: "1", name: "A", amount: 100 });
    await repo.create({ id: "2", name: "B", amount: 200 });
    await repo.create({ id: "3", name: "A", amount: 300 });

    const all = await repo.findAll();
    expect(all).toHaveLength(3);

    const filtered = await repo.findAll({ where: { name: "A" } });
    expect(filtered).toHaveLength(2);

    const paginated = await repo.findAll({ offset: 1, limit: 1 });
    expect(paginated).toHaveLength(1);
    expect(paginated[0].id).toBe("2");
  });

  it("should update an existing entity", async () => {
    const created = await repo.create({ id: "item-1", name: "Old", amount: 50 });
    const updated = await repo.update(created.id, { name: "New", amount: 150 });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("New");
    expect(updated?.amount).toBe(150);

    const found = await repo.findById("item-1");
    expect(found?.name).toBe("New");
  });

  it("should return null when updating a non-existent entity", async () => {
    const updated = await repo.update("non-existent", { name: "New" });
    expect(updated).toBeNull();
  });

  it("should delete an entity and return true, or false if not found", async () => {
    const created = await repo.create({ id: "to-delete", name: "Delete Me", amount: 10 });
    
    const deleted = await repo.delete(created.id);
    expect(deleted).toBe(true);

    const found = await repo.findById(created.id);
    expect(found).toBeNull();

    const deleteAgain = await repo.delete(created.id);
    expect(deleteAgain).toBe(false);
  });
});
