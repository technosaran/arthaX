/**
 * Bank Statement Parser Strategy Pattern Implementation.
 * Implements requirement (SOLID Open-Closed Principle): Strategy Pattern for extensible bank statement parsing algorithms.
 */

import { BankType, BankStatementParseResult } from "./types";
import { parseBankStatementText } from "./parser-engine";

export interface IBankParserStrategy {
  readonly bankType: BankType;
  parse(rawText: string): Promise<BankStatementParseResult>;
}

export class DefaultBankParserStrategy implements IBankParserStrategy {
  constructor(public readonly bankType: BankType = "auto") {}

  public async parse(rawText: string): Promise<BankStatementParseResult> {
    return parseBankStatementText(rawText, this.bankType);
  }
}

/**
 * Context for Strategy execution.
 */
export class BankParserContext {
  private strategy: IBankParserStrategy;

  constructor(strategy?: IBankParserStrategy) {
    this.strategy = strategy || new DefaultBankParserStrategy("auto");
  }

  public setStrategy(strategy: IBankParserStrategy): void {
    this.strategy = strategy;
  }

  public async execute(rawText: string): Promise<BankStatementParseResult> {
    return this.strategy.parse(rawText);
  }
}
