import { RecordInvestmentCommand } from "@/services/commands/financial-commands";
import { ValidationError } from "@/lib/errors";

describe("RecordInvestmentCommand (Command Pattern)", () => {
  let mockAccountRepo: any;
  let mockInvestmentRepo: any;
  let mockTransactionRepo: any;

  beforeEach(() => {
    mockAccountRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    mockInvestmentRepo = {
      create: jest.fn(),
    };
    mockTransactionRepo = {
      create: jest.fn(),
    };
  });

  it("should execute BUY investment command successfully and update account balance", async () => {
    mockAccountRepo.findById.mockResolvedValueOnce({ id: "acc_1", balance: 1000 });
    mockAccountRepo.update.mockResolvedValueOnce({ id: "acc_1", balance: 500 });
    mockInvestmentRepo.create.mockResolvedValueOnce({ id: "inv_123" });

    const command = new RecordInvestmentCommand(
      {
        userId: "user_1",
        accountId: "acc_1",
        symbol: "AAPL",
        quantity: 5,
        price: 100,
        type: "BUY",
      },
      mockAccountRepo,
      mockInvestmentRepo,
      mockTransactionRepo
    );

    const result = await command.execute();

    expect(result.investmentId).toBe("inv_123");
    expect(result.newBalance).toBe(500);
    expect(mockAccountRepo.update).toHaveBeenCalledWith("acc_1", { balance: 500 });
    expect(mockTransactionRepo.create).toHaveBeenCalled();
  });

  it("should throw ValidationError if account balance is insufficient for BUY", async () => {
    mockAccountRepo.findById.mockResolvedValueOnce({ id: "acc_1", balance: 100 });

    const command = new RecordInvestmentCommand(
      {
        userId: "user_1",
        accountId: "acc_1",
        symbol: "AAPL",
        quantity: 5,
        price: 100,
        type: "BUY",
      },
      mockAccountRepo,
      mockInvestmentRepo,
      mockTransactionRepo
    );

    await expect(command.execute()).rejects.toThrow(ValidationError);
  });
});
