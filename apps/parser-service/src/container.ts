import { ParserService } from "./parser-service";

export class ParserServiceContainer {
  private static instance: ParserServiceContainer | null = null;
  public parserService: ParserService;

  private constructor() {
    this.parserService = new ParserService();
  }

  public static getInstance(): ParserServiceContainer {
    if (!ParserServiceContainer.instance) {
      ParserServiceContainer.instance = new ParserServiceContainer();
    }
    return ParserServiceContainer.instance;
  }
}
