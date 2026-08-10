import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ParserServiceContainer } from "./container";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4004;

app.use(cors());
app.use(express.json());

const container = ParserServiceContainer.getInstance();

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "parser-service", timestamp: new Date().toISOString() });
});

// Bank Statement Parser Endpoint
app.post("/parse-bank-statement", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const result = await container.parserService.parseBankStatement(userId, req.body.filename || "statement.pdf");
  res.json({
    success: true,
    service: "parser-service",
    data: result,
    message: "Processed bank statement via Document Parser Microservice"
  });
});

// CAS Statement Parser Endpoint
app.post("/parse-cas", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const result = await container.parserService.parseCASStatement(userId, req.body.filename || "cas.pdf");
  res.json({
    success: true,
    service: "parser-service",
    data: result,
    message: "Processed CSDL/NSDL CAS statement via Parser Microservice"
  });
});

app.listen(PORT, () => {
  console.log(`Document Parser Microservice running on port ${PORT}`);
});
