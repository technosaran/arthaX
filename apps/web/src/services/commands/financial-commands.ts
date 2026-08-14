/**
 * Financial Transaction Command Pattern Implementation.
 * Implements the Command Design Pattern for financial balance updates and double-entry ledger transactions.
 */

import { AccountRepository } from "@/repositories/account-repository";
import { InvestmentRepository } from "@/repositories/investment-repository";
import { TransactionRepository } from "@/repositories/transaction-repository";
import { ValidationError, DatabaseError } from "@/lib/errors";

export interface Command<T = any> {
  execute(): Promise<T>;
}

export interface RecordInvestmentCommandInput {
  userId: string;
  accountId: string;
  symbol: string;
  quantity: number;
  price: number;
  charges?: number;
  type: "BUY" | "SELL";
}

/**
 * Command for recording an investment purchase/sale and adjusting bank account balance with audit safety.
 */
export class RecordInvestmentCommand implements Command<{ investmentId: string; newBalance: number }> {
  constructor(
    private readonly input: RecordInvestmentCommandInput,
    private readonly accountRepo: AccountRepository,
    private readonly investmentRepo: InvestmentRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  public async execute(): Promise<{ investmentId: string; newBalance: number }> {
    const { userId, accountId, symbol, quantity, price, charges = 0, type } = this.input;

    if (quantity <= 0) {
      throw new ValidationError("Quantity must be greater than zero");
    }
    if (price <= 0) {
      throw new ValidationError("Price must be greater than zero");
    }

    const account = await this.accountRepo.findById(accountId);
    if (!account) {
      throw new ValidationError("Selected bank account does not exist");
    }

    const totalCost = quantity * price + charges;
    const currentBalance = parseFloat(String(account.balance || "0"));

    let newBalance = currentBalance;
    if (type === "BUY") {
      if (currentBalance < totalCost) {
        throw new ValidationError("Insufficient account balance for investment purchase");
      }
      newBalance = currentBalance - totalCost;
    } else {
      newBalance = currentBalance + totalCost;
    }

    // 1. Update bank account balance
    const updatedAccount = await this.accountRepo.update(accountId, { balance: newBalance });
    if (!updatedAccount) {
      throw new DatabaseError("Failed to update account balance");
    }

    // 2. Create investment holding record
    const investment = await this.investmentRepo.create({
      user_id: userId,
      symbol,
      quantity,
      buy_price: price,
      current_price: price,
    });

    // 3. Create transaction audit log
    await this.transactionRepo.create({
      user_id: userId,
      account_id: accountId,
      type: type === "BUY" ? "expense" : "income",
      amount: totalCost,
      description: `${type} ${quantity} units of ${symbol} @ ${price}`,
      category: "Investment",
    });

    return {
      investmentId: investment.id,
      newBalance,
    };
  }
}
