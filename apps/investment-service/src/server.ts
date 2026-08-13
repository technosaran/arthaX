import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { InvestmentServiceContainer } from "./container";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

const container = InvestmentServiceContainer.getInstance();

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "investment-service", timestamp: new Date().toISOString() });
});

// Investments Endpoint
app.get("/investments", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const investments = await container.investmentService.getUserInvestments(userId);
  res.json({
    success: true,
    service: "investment-service",
    userId,
    data: investments,
    message: "Fetched investments portfolio from Investment Microservice"
  });
});

// Add Investment Endpoint
app.post("/investments", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const newAsset = await container.investmentService.addInvestment(userId, req.body);
  res.status(201).json({
    success: true,
    service: "investment-service",
    userId,
    data: newAsset,
    message: "Investment asset created"
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Investment Microservice running on port ${PORT}`);
});
