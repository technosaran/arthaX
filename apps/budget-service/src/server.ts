import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { BudgetServiceContainer } from "./container";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

const container = BudgetServiceContainer.getInstance();

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "budget-service", timestamp: new Date().toISOString() });
});

// Budgets Endpoint
app.get("/budgets", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const budgets = await container.budgetService.getUserBudgets(userId);
  res.json({
    success: true,
    service: "budget-service",
    userId,
    data: budgets,
    message: "Fetched budgets from Budget Microservice"
  });
});

// Create Budget Endpoint
app.post("/budgets", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const newBudget = await container.budgetService.createBudget(userId, req.body);
  res.status(201).json({
    success: true,
    service: "budget-service",
    userId,
    data: newBudget,
    message: "Budget category created"
  });
});

app.listen(PORT, () => {
  console.log(`Budget Microservice running on port ${PORT}`);
});
