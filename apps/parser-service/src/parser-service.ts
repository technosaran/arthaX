import { createServiceLogger } from "@finance-os/logger";

const logger = createServiceLogger("ParserService");

export interface ParseResult {
  userId: string;
  documentType: "BANK_STATEMENT" | "CAS_MUTUAL_FUNDS";
  status: "SUCCESS" | "FAILED";
  extractedCount: number;
}

export class ParserService {
  public async parseBankStatement(userId: string, filename: string): Promise<ParseResult> {
    logger.info({ userId, filename }, "Parsing bank statement document");
    return {
      userId,
      documentType: "BANK_STATEMENT",
      status: "SUCCESS",
      extractedCount: 12,
    };
  }

  public async parseCASStatement(userId: string, filename: string): Promise<ParseResult> {
    logger.info({ userId, filename }, "Parsing CAS CSDL/NSDL statement");
    return {
      userId,
      documentType: "CAS_MUTUAL_FUNDS",
      status: "SUCCESS",
      extractedCount: 5,
    };
  }
}
