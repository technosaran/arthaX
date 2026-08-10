import { AIService } from "./ai-service";

export class AIServiceContainer {
  private static instance: AIServiceContainer | null = null;
  public aiService: AIService;

  private constructor() {
    this.aiService = new AIService();
  }

  public static getInstance(): AIServiceContainer {
    if (!AIServiceContainer.instance) {
      AIServiceContainer.instance = new AIServiceContainer();
    }
    return AIServiceContainer.instance;
  }
}
