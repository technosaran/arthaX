import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AccountServiceContainer } from "./container";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

const container = AccountServiceContainer.getInstance();

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "account-service", timestamp: new Date().toISOString() });
});

// Get Accounts via Service & Repository
app.get("/accounts", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const accounts = await container.accountService.getUserAccounts(userId);
  res.json({
    success: true,
    service: "account-service",
    userId,
    data: accounts,
    message: "Fetched accounts from Account Microservice"
  });
});

// Create Account via Service & Repository
app.post("/accounts", async (req: Request, res: Response) => {
  const userId = (req.headers["x-user-id"] as string) || "user_default";
  const newAcc = await container.accountService.createAccount(userId, req.body);
  res.status(201).json({
    success: true,
    service: "account-service",
    userId,
    data: newAcc,
    message: "Account created successfully"
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Account Microservice running on port ${PORT}`);
});
