import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AIServiceContainer } from "./container";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;

app.use(cors());
app.use(express.json());

const container = AIServiceContainer.getInstance();

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "ai-mcp-service", timestamp: new Date().toISOString() });
});

// AI Chat Endpoint
app.post("/chat", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const { prompt } = req.body;
  const reply = await container.aiService.generateChatResponse(userId, prompt);
  res.json({
    success: true,
    service: "ai-mcp-service",
    userId,
    reply,
  });
});

// MCP Protocol Endpoint
app.all("/mcp*", (req: Request, res: Response) => {
  const capabilities = container.aiService.getMCPCapabilities();
  res.json({
    success: true,
    service: "ai-mcp-service",
    data: capabilities,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI-MCP Microservice running on port ${PORT}`);
});
