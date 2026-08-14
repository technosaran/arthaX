import { createAppContainer } from "@/lib/container";

describe("Container (Dependency Injection)", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(),
    };
  });

  it("should initialize and resolve all registered repositories and services", () => {
    const container = createAppContainer(mockSupabase);

    expect(container.has("supabase")).toBe(true);
    expect(container.has("transactionRepo")).toBe(true);
    expect(container.has("accountRepo")).toBe(true);
    expect(container.has("budgetRepo")).toBe(true);
    expect(container.has("investmentRepo")).toBe(true);
    expect(container.has("profileRepo")).toBe(true);
    expect(container.has("transactionService")).toBe(true);
    expect(container.has("accountService")).toBe(true);
    expect(container.has("budgetService")).toBe(true);
    expect(container.has("investmentService")).toBe(true);
    expect(container.has("profileService")).toBe(true);
    expect(container.has("eventBus")).toBe(true);

    const investmentService = container.resolve("investmentService");
    expect(investmentService).toBeDefined();

    const profileService = container.resolve("profileService");
    expect(profileService).toBeDefined();
  });
});
