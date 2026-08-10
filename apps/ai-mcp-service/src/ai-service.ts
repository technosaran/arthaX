import { createServiceLogger } from "@finance-os/logger";

const logger = createServiceLogger("AIService");

export class AIService {
  public async generateChatResponse(userId: string, prompt: string): Promise<string> {
    logger.info({ userId, prompt }, "Generating AI financial response");
    return `FinanceOS AI Assistant: Analyzed query "${prompt}". Portfolio status is healthy.`;
  }

  public getMCPCapabilities() {
    return {
      protocolVersion: "1.0.0",
      capabilities: {
        tools: {
          get_net_worth: "Calculates total net worth",
          list_accounts: "Lists registered cash & demat accounts",
          query_portfolio: "Queries active investment positions",
        },
      },
    };
  }
}
