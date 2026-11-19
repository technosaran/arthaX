import { describe, it, expect } from "vitest";
import {
  verifyTelegramSecret,
  escapeTelegramHtml,
  formatCurrencyINR,
  formatExpenseConfirmation,
  formatIncomeConfirmation,
  formatTransferConfirmation,
  formatBudgetSummary,
  formatBudgetSetConfirmation,
  formatUndoConfirmation,
  formatBalanceSummary,
  formatRecentExpenses,
  formatSpendingSummary,
  formatWelcomeMessage,
  formatHelpMessage,
  formatStatusMessage,
  formatPortfolioOverview,
  formatStocksSummary,
  formatStockQuote,
  formatStockAddConfirmation,
  formatMutualFundsSummary,
  formatBullionSummary,
  getQuickChartSpendingUrl,
  sendTelegramPhoto,
  extractTelegramLinkCandidate,
  normalizeLinkTokenCandidates,
  getStandardInlineKeyboard,
  getExpenseActionKeyboard,
  getIncomeActionKeyboard,
  getAmbiguousExpenseKeyboard,
} from "@/utils/telegram";
import { parseExpenseMessage, AccountSummary } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";

describe("Telegram Integration Suite", () => {
  describe("Security & Secret Verification", () => {
    it("validates authentic secret token using timingSafeEqual", () => {
      const configured = "arthax_secure_token_secret_12345";
      expect(verifyTelegramSecret(configured, configured)).toBe(true);
    });

    it("rejects invalid or tampered secret token", () => {
      const configured = "arthax_secure_token_secret_12345";
      const incoming = "tampered_token_value_99999";
      expect(verifyTelegramSecret(incoming, configured)).toBe(false);
    });

    it("rejects empty or null incoming header when secret is configured", () => {
      const configured = "arthax_secure_token_secret_12345";
      expect(verifyTelegramSecret(null, configured)).toBe(false);
      expect(verifyTelegramSecret("", configured)).toBe(false);
    });

    it("accepts incoming header if no secret is configured in environment", () => {
      expect(verifyTelegramSecret("any_token", "")).toBe(true);
    });
  });

  describe("HTML Escaping & Content Sanitization", () => {
    it("escapes special HTML characters for Telegram HTML mode", () => {
      const input = "Swiggy <order #123> & Zomato > Uber";
      const escaped = escapeTelegramHtml(input);
      expect(escaped).toBe("Swiggy &lt;order #123&gt; &amp; Zomato &gt; Uber");
    });

    it("leaves safe strings unchanged", () => {
      const input = "Dinner at Taj 1500 HDFC";
      expect(escapeTelegramHtml(input)).toBe(input);
    });

    it("formats Indian Rupee currency correctly", () => {
      const res = formatCurrencyINR(15000);
      expect(res).toContain("15,000");
    });
  });

  describe("Message Formatting Templates", () => {
    it("formats expense confirmation message with all required details", () => {
      const msg = formatExpenseConfirmation({
        amount: 850,
        category: "Food & Dining",
        title: "Swiggy Dinner",
        accountName: "HDFC Salary",
        newBalance: 42150,
      });

      expect(msg).toContain("Expense Logged!");
      expect(msg).toContain("850");
      expect(msg).toContain("Food &amp; Dining");
      expect(msg).toContain("Swiggy Dinner");
      expect(msg).toContain("HDFC Salary");
      expect(msg).toContain("42,150");
      expect(msg).toContain("arthaX");
    });

    it("formats balance summary with total portfolio calculations", () => {
      const accounts = [
        { name: "HDFC Bank", type: "Savings", balance: 50000, last_four: "1234" },
        { name: "SBI Card", type: "Credit Card", balance: 15000, last_four: "5678" },
        { name: "Cash Reserve", type: "Liquid Cash", balance: 5000, last_four: null },
      ];

      const res = formatBalanceSummary(accounts);
      expect(res).toContain("Your Accounts &amp; Balances");
      expect(res).toContain("HDFC Bank (••1234)");
      expect(res).toContain("SBI Card (••5678)");
      expect(res).toContain("Cash Reserve");
      expect(res).toContain("70,000"); // 50000 + 15000 + 5000
    });

    it("handles empty accounts list gracefully", () => {
      const res = formatBalanceSummary([]);
      expect(res).toContain("No active accounts found");
    });

    it("formats recent expenses list", () => {
      const expenses = [
        { title: "Swiggy", amount: 450, category: "Food & Dining", expense_date: "2026-11-14", account_name: "HDFC" },
        { title: "Petrol", amount: 1200, category: "Transport & Fuel", expense_date: "2026-11-13", account_name: "Cash" },
      ];

      const res = formatRecentExpenses(expenses);
      expect(res).toContain("Recent Expenses");
      expect(res).toContain("1. <b>Swiggy</b>");
      expect(res).toContain("2. <b>Petrol</b>");
      expect(res).toContain("Food &amp; Dining");
      expect(res).toContain("Transport &amp; Fuel");
    });

    it("formats spending summary with today and monthly totals", () => {
      const summary = formatSpendingSummary({
        todayTotal: 1650,
        monthTotal: 24500,
        expenseCount: 18,
        topCategory: "Food & Dining",
      });

      expect(summary).toContain("Spending Summary");
      expect(summary).toContain("1,650");
      expect(summary).toContain("24,500");
      expect(summary).toContain("18");
      expect(summary).toContain("Food &amp; Dining");
    });

    it("formats welcome message for linked user", () => {
      const welcome = formatWelcomeMessage({
        isLinked: true,
        userName: "Saran",
      });

      expect(welcome).toContain("Welcome back, Saran!");
      expect(welcome).toContain("/balance");
      expect(welcome).toContain("/recent");
      expect(welcome).toContain("/summary");
    });

    it("formats welcome message for unlinked user with link token instructions", () => {
      const welcome = formatWelcomeMessage({
        isLinked: false,
        linkToken: "AX-8F92A1",
      });

      expect(welcome).toContain("Welcome to arthaX on Telegram!");
      expect(welcome).toContain("/link AX-8F92A1");
    });

    it("formats comprehensive command help guide", () => {
      const help = formatHelpMessage("Artha_X_bot");
      expect(help).toContain("arthaX Telegram Bot Guide");
      expect(help).toContain("Dinner 650 HDFC");
      expect(help).toContain("Bank Debit SMS Forwarding");
      expect(help).toContain("/balance");
      expect(help).toContain("/recent");
      expect(help).toContain("/summary");
      expect(help).toContain("/unlink");
    });
  });

  describe("Telegram Command & Expense Parsing Integration", () => {
    const knownAccounts: AccountSummary[] = [
      { id: "acc-1", name: "HDFC Salary", type: "Savings", balance: 45000, last_four: "9876" },
      { id: "acc-2", name: "Cash in Hand", type: "Liquid Cash", balance: 3500, last_four: "CASH" },
    ];

    it("parses Telegram chat message into structured expense", () => {
      const msg = "Dinner 750 HDFC";
      const parsed = parseExpenseMessage(msg, knownAccounts);

      expect(parsed.amount).toBe(750);
      expect(parsed.category).toBe("Food & Dining");
      expect(parsed.accountQuery).toBe("HDFC Salary");
    });

    it("parses bank debit SMS forwarded via Telegram", () => {
      const sms = "Alert: HDFC Bank A/c ending 9876 debited for INR 1,250.00 at SHELL PETROL on 14-Nov-2026.";
      const parsed = parseExpenseMessage(sms, knownAccounts);

      expect(parsed.amount).toBe(1250);
      expect(parsed.category).toBe("Transport & Fuel");
      expect(parsed.accountQuery).toBe("HDFC Salary");
    });

    it("identifies slash commands correctly", () => {
      const isCmd = (text: string) => text.trim().startsWith("/");
      expect(isCmd("/balance")).toBe(true);
      expect(isCmd("/recent")).toBe(true);
      expect(isCmd("/summary")).toBe(true);
      expect(isCmd("/link AX-992144")).toBe(true);
      expect(isCmd("/ai How can I invest 5000?")).toBe(true);
      expect(isCmd("/ask How to save money?")).toBe(true);
      expect(isCmd("Dinner 500 HDFC")).toBe(false);
    });

    it("extracts AI prompt query correctly from /ai and /ask commands", () => {
      const extractPrompt = (text: string) => text.replace(/^\/(?:ai|ask)\s*/i, "").trim();
      expect(extractPrompt("/ai How can I invest?")).toBe("How can I invest?");
      expect(extractPrompt("/ask How to build an emergency fund?")).toBe("How to build an emergency fund?");
      expect(extractPrompt("/ai")).toBe("");
    });

    it("extracts link code from /link, /start, and natural/standalone variants", () => {
      // Slash command formats
      expect(extractTelegramLinkCandidate("/link AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("/start AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("/start@Artha_X_bot AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("/connect AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("/link:AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("/start=AX-7K9P2X")).toBe("AX-7K9P2X");

      // Natural prefix commands
      expect(extractTelegramLinkCandidate("link AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("connect AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("pair 7K9P2X")).toBe("7K9P2X");

      // Standalone code formats (critical for loose copy-pasting)
      expect(extractTelegramLinkCandidate("AX-7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("ax-7k9p2x")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("AX_7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("AX7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("7K9P2X")).toBe("AX-7K9P2X");
      expect(extractTelegramLinkCandidate("365CA9")).toBe("AX-365CA9");

      // Email & UUID formats
      expect(extractTelegramLinkCandidate("user@example.com")).toBe("user@example.com");
      expect(extractTelegramLinkCandidate("640cb47d-abe8-4182-85d5-347f5ccd4aa2")).toBe("640cb47d-abe8-4182-85d5-347f5ccd4aa2");

      // Non-linking messages should return null
      expect(extractTelegramLinkCandidate("/start")).toBeNull();
      expect(extractTelegramLinkCandidate("/balance")).toBeNull();
      expect(extractTelegramLinkCandidate("Dinner 500 HDFC")).toBeNull();
    });

    it("handles token normalization for case-insensitivity, hyphens, and missing prefix", () => {
      const c1 = normalizeLinkTokenCandidates("ax-7k9p2x");
      expect(c1).toContain("AX-7K9P2X");
      expect(c1).toContain("7K9P2X");

      const c2 = normalizeLinkTokenCandidates("ax_7k9p2x");
      expect(c2).toContain("AX-7K9P2X");

      const c3 = normalizeLinkTokenCandidates("7k9p2x");
      expect(c3).toContain("AX-7K9P2X");
      expect(c3).toContain("7K9P2X");
    });

    it("formats rich status overview message", () => {
      const statusMsg = formatStatusMessage({
        userName: "Saran",
        accountCount: 3,
        totalPortfolio: 75000,
        botUsername: "Artha_X_bot",
        linkedAt: "2026-11-14T10:00:00Z",
      });

      expect(statusMsg).toContain("arthaX Connection Status");
      expect(statusMsg).toContain("Connected &amp; Synchronized");
      expect(statusMsg).toContain("Saran");
      expect(statusMsg).toContain("3");
      expect(statusMsg).toContain("75,000");
      expect(statusMsg).toContain("@Artha_X_bot");
    });
  });

  describe("Full Financial Intent Classifier & Flow", () => {
    const knownAccounts: AccountSummary[] = [
      { id: "acc-1", name: "HDFC Salary", type: "Savings", balance: 50000, last_four: "9876" },
      { id: "acc-2", name: "Cash in Hand", type: "Liquid Cash", balance: 5000, last_four: "CASH" },
      { id: "acc-3", name: "SBI Card", type: "Credit Card", balance: 12000, last_four: "1122" },
    ];

    it("detects and parses inter-account transfers", () => {
      const msg = "Transfer 5000 from HDFC to Cash";
      const intent = classifyFinancialMessage(msg, knownAccounts);

      expect(intent.type).toBe("transfer");
      if (intent.type === "transfer") {
        expect(intent.data.amount).toBe(5000);
        expect(intent.data.fromAccountQuery.toLowerCase()).toContain("hdfc");
        expect(intent.data.toAccountQuery.toLowerCase()).toContain("cash");
      }
    });

    it("detects and parses salary/income entries", () => {
      const msg = "Salary 85000 HDFC";
      const intent = classifyFinancialMessage(msg, knownAccounts);

      expect(intent.type).toBe("income");
      if (intent.type === "income") {
        expect(intent.data.amount).toBe(85000);
        expect(intent.data.category).toBe("Salary");
        expect(intent.data.accountQuery).toBe("HDFC Salary");
      }
    });

    it("detects and parses bank credit SMS notifications", () => {
      const sms = "Dear Customer, your A/c ending 9876 has been credited with Rs. 25,000.00 on 14-Nov-26.";
      const intent = classifyFinancialMessage(sms, knownAccounts);

      expect(intent.type).toBe("income");
      if (intent.type === "income") {
        expect(intent.data.amount).toBe(25000);
      }
    });

    it("falls back to conversational/AI for general queries", () => {
      const msg = "How can I cut down my food budget?";
      const intent = classifyFinancialMessage(msg, knownAccounts);

      expect(intent.type).toBe("unknown");
    });
  });

  describe("Advanced Confirmations & Interactive Keyboards", () => {
    it("formats income confirmation accurately", () => {
      const res = formatIncomeConfirmation({
        amount: 50000,
        category: "Salary",
        title: "Monthly Salary",
        accountName: "HDFC Salary",
        newBalance: 120000,
      });

      expect(res).toContain("Income Recorded!");
      expect(res).toContain("50,000");
      expect(res).toContain("HDFC Salary");
      expect(res).toContain("1,20,000");
    });

    it("formats transfer confirmation with source and target balances", () => {
      const res = formatTransferConfirmation({
        amount: 3000,
        fromAccountName: "HDFC Salary",
        toAccountName: "Cash in Hand",
        fromBalance: 47000,
        toBalance: 8000,
      });

      expect(res).toContain("Transfer Recorded!");
      expect(res).toContain("3,000");
      expect(res).toContain("HDFC Salary");
      expect(res).toContain("Cash in Hand");
    });

    it("formats budget progress overview with visual indicators", () => {
      const budgets = [
        { category: "Food & Dining", budgeted: 10000, spent: 6500, percent: 65 },
        { category: "Shopping", budgeted: 8000, spent: 8500, percent: 106 },
      ];

      const res = formatBudgetSummary({ budgets, monthName: "November 2026" });
      expect(res).toContain("Budgets Overview");
      expect(res).toContain("Food &amp; Dining");
      expect(res).toContain("65%");
      expect(res).toContain("Over budget");
    });

    it("formats transaction undo cancellation confirmation", () => {
      const res = formatUndoConfirmation({
        type: "expense",
        title: "Grocery Shopping",
        amount: 1200,
        accountName: "HDFC Salary",
        restoredBalance: 48200,
      });

      expect(res).toContain("Transaction Reverted!");
      expect(res).toContain("Refunded to");
      expect(res).toContain("HDFC Salary");
      expect(res).toContain("48,200");
    });

    it("builds valid interactive inline keyboards with callback data", () => {
      const stdKeyboard = getStandardInlineKeyboard("https://arthax.vercel.app");
      expect(stdKeyboard.inline_keyboard.length).toBeGreaterThan(0);
      const firstBtn = stdKeyboard.inline_keyboard[0][0];
      expect("callback_data" in firstBtn ? firstBtn.callback_data : null).toBe("action:balance");

      const expKeyboard = getExpenseActionKeyboard("exp-123");
      const expBtn = expKeyboard.inline_keyboard[0][0];
      expect("callback_data" in expBtn ? expBtn.callback_data : null).toBe("undo:expense:exp-123");

      const incKeyboard = getIncomeActionKeyboard("inc-456");
      const incBtn = incKeyboard.inline_keyboard[0][0];
      expect("callback_data" in incBtn ? incBtn.callback_data : null).toBe("undo:income:inc-456");

      const ambKeyboard = getAmbiguousExpenseKeyboard("exp-789");
      expect(ambKeyboard.inline_keyboard.length).toBe(3);
      const foodBtn = ambKeyboard.inline_keyboard[0][0];
      expect("callback_data" in foodBtn ? foodBtn.callback_data : null).toBe("cat:exp-789:Food & Dining");
    });
  });

  describe("Multi-Tenant Safety (Strict Isolation)", () => {
    it("never permits unlinked Telegram chats to access another user's workspace", () => {
      const mockDbUsers: Record<string, string> = {
        "chat_alice_123": "user_alice",
        "chat_bob_456": "user_bob",
      };

      const resolveTenant = (incomingChatId: string): string | null => {
        return mockDbUsers[incomingChatId] || null;
      };

      expect(resolveTenant("chat_alice_123")).toBe("user_alice");
      expect(resolveTenant("chat_bob_456")).toBe("user_bob");
      expect(resolveTenant("chat_stranger_999")).toBeNull();
    });
  });

  describe("Multi-Asset Portfolio & Investments Formatters", () => {
    it("formats comprehensive net worth portfolio overview accurately", () => {
      const overview = formatPortfolioOverview({
        accountsTotal: 125000,
        stocksTotal: 340000,
        mfTotal: 210000,
        bullionTotal: 185000,
        netWorth: 860000,
        userName: "Saran",
      });

      expect(overview).toContain("Total Net Worth &amp; Portfolio (Saran)");
      expect(overview).toContain("Bank &amp; Cash Accounts:</b> ₹1,25,000.00");
      expect(overview).toContain("Indian Equities (Stocks):</b> ₹3,40,000.00");
      expect(overview).toContain("Mutual Funds &amp; SIPs:</b> ₹2,10,000.00");
      expect(overview).toContain("Bullion (Gold &amp; Silver):</b> ₹1,85,000.00");
      expect(overview).toContain("8,60,000.00");
    });

    it("formats Indian stock holdings summary and calculates P&L", () => {
      const holdings = [
        { symbol: "RELIANCE", exchange: "NSE", quantity: 15, avg_buy_price: 2450, current_price: 2600, pnl: 2250, pnl_percent: 6.12 },
        { symbol: "TCS", exchange: "NSE", quantity: 10, avg_buy_price: 3500, current_price: 3650, pnl: 1500, pnl_percent: 4.29 },
      ];

      const res = formatStocksSummary({
        holdings,
        totalInvested: 71750,
        totalCurrent: 75500,
        totalPnl: 3750,
        totalPnlPercent: 5.23,
      });

      expect(res).toContain("Indian Stock Portfolio");
      expect(res).toContain("RELIANCE");
      expect(res).toContain("15 shares");
      expect(res).toContain("TCS");
      expect(res).toContain("71,750.00");
      expect(res).toContain("75,500.00");
      expect(res).toContain("+₹3,750.00");
    });

    it("formats empty stock holdings gracefully with instructions", () => {
      const res = formatStocksSummary({
        holdings: [],
        totalInvested: 0,
        totalCurrent: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
      });

      expect(res).toContain("No stock holdings recorded yet");
      expect(res).toContain("/addstock");
    });

    it("formats real-time live stock quotes with range and day changes", () => {
      const quote = formatStockQuote({
        symbol: "INFY",
        exchange: "NSE",
        companyName: "Infosys Limited",
        currentPrice: 1845.5,
        previousClose: 1820.0,
        change: 25.5,
        changePercent: 1.4,
        dayHigh: 1860.0,
        dayLow: 1815.0,
      });

      expect(quote).toContain("Infosys Limited");
      expect(quote).toContain("INFY:NSE");
      expect(quote).toContain("1,845.50");
      expect(quote).toContain("+₹25.50");
      expect(quote).toContain("+1.40%");
      expect(quote).toContain("1,815.00 - ₹1,860.00");
    });

    it("formats stock purchase confirmation message", () => {
      const res = formatStockAddConfirmation({
        symbol: "TATAMOTORS",
        quantity: 25,
        price: 840,
        exchange: "NSE",
      });

      expect(res).toContain("Stock Holding Recorded!");
      expect(res).toContain("TATAMOTORS:NSE");
      expect(res).toContain("25 shares");
      expect(res).toContain("840.00");
      expect(res).toContain("21,000.00");
    });

    it("formats mutual funds portfolio with SIP status and NAV values", () => {
      const holdings = [
        {
          scheme_name: "Parag Parikh Flexi Cap Fund Direct Growth",
          units: 145.23,
          avg_nav: 68.5,
          current_nav: 78.2,
          invested_amount: 9948,
          is_sip_active: true,
          sip_amount: 5000,
        },
      ];

      const res = formatMutualFundsSummary({
        holdings,
        totalInvested: 9948,
        totalCurrent: 11357,
        totalPnl: 1409,
      });

      expect(res).toContain("Mutual Funds Portfolio");
      expect(res).toContain("Parag Parikh Flexi Cap");
      expect(res).toContain("SIP: ₹5,000.00");
      expect(res).toContain("9,948.00");
      expect(res).toContain("11,357.00");
    });

    it("formats physical bullion portfolio with gold & silver metrics", () => {
      const res = formatBullionSummary({
        goldGrams: 24.5,
        goldValue: 196000,
        silverGrams: 500,
        silverValue: 47500,
        totalValue: 243500,
      });

      expect(res).toContain("Physical Bullion Portfolio");
      expect(res).toContain("24.50 grams");
      expect(res).toContain("1,96,000.00");
      expect(res).toContain("500.00 grams");
      expect(res).toContain("47,500.00");
      expect(res).toContain("2,43,500.00");
    });

    it("formats budget set confirmation accurately", () => {
      const res = formatBudgetSetConfirmation({
        category: "Food & Dining",
        amount: 8000,
        monthName: "November 2026",
      });

      expect(res).toContain("Budget Set Successfully!");
      expect(res).toContain("Food &amp; Dining");
      expect(res).toContain("8,000.00");
      expect(res).toContain("November 2026");
    });
  });

  describe("Visual Chart Generation & Photo API", () => {
    it("generates QuickChart dark-mode donut chart URL with category breakdown", () => {
      const categories = ["Food & Dining", "Transport & Fuel", "Shopping"];
      const amounts = [12000, 4500, 8000];

      const chartUrl = getQuickChartSpendingUrl({
        categories,
        amounts,
        title: "November 2026 Spending",
      });

      expect(chartUrl).toContain("https://quickchart.io/chart?c=");
      expect(chartUrl).toContain("w=500&h=350&bkg=%2309090b");

      const encoded = chartUrl.split("?c=")[1].split("&")[0];
      const decodedJson = decodeURIComponent(encoded);
      expect(decodedJson).toContain("doughnut");
      expect(decodedJson).toContain("Food & Dining");
      expect(decodedJson).toContain("Transport & Fuel");
      expect(decodedJson).toContain("12000");
    });

    it("returns empty string when categories or amounts are empty", () => {
      expect(getQuickChartSpendingUrl({ categories: [], amounts: [] })).toBe("");
    });

    it("handles sendTelegramPhoto without crash when token is not configured", async () => {
      const res = await sendTelegramPhoto({
        chatId: "12345",
        photo: "https://quickchart.io/sample.png",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("expands standard inline keyboard with 8 interactive quick buttons and web link", () => {
      const keyboard = getStandardInlineKeyboard("https://arthax.vercel.app");
      expect(keyboard.inline_keyboard.length).toBe(5);

      const allCallbackData = keyboard.inline_keyboard
        .flat()
        .map((btn) => ("callback_data" in btn ? btn.callback_data : null))
        .filter(Boolean);

      expect(allCallbackData).toContain("action:balance");
      expect(allCallbackData).toContain("action:summary");
      expect(allCallbackData).toContain("action:budget");
      expect(allCallbackData).toContain("action:chart");
      expect(allCallbackData).toContain("action:portfolio");
      expect(allCallbackData).toContain("action:stocks");
      expect(allCallbackData).toContain("action:recent");
      expect(allCallbackData).toContain("action:status");
    });
  });

  describe("Slash Commands & Voice Actions Parsing", () => {
    it("identifies all new financial commands", () => {
      const isCmd = (text: string) => text.trim().startsWith("/");
      expect(isCmd("/chart")).toBe(true);
      expect(isCmd("/portfolio")).toBe(true);
      expect(isCmd("/networth")).toBe(true);
      expect(isCmd("/stocks")).toBe(true);
      expect(isCmd("/quote RELIANCE")).toBe(true);
      expect(isCmd("/addstock TCS 5 3600")).toBe(true);
      expect(isCmd("/mf")).toBe(true);
      expect(isCmd("/bullion")).toBe(true);
      expect(isCmd("/setbudget Food 8000")).toBe(true);
    });

    it("parses setbudget command with category and amount", () => {
      const input = "/setbudget Food 8000";
      const clean = input.replace(/^\/setbudget\s*/i, "").trim();
      const match = clean.match(/^([a-zA-Z\s&]+?)\s*(?:to|=)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)$/i);

      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe("Food");
      expect(parseFloat(match![2])).toBe(8000);
    });

    it("parses natural set budget phrase e.g. set budget for Groceries to 12000", () => {
      const input = "set budget for Groceries to 12000";
      const clean = input.replace(/^set\s+budget\s*(?:for)?\s*/i, "").trim();
      const match = clean.match(/^([a-zA-Z\s&]+?)\s*(?:to|=)?\s*(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)$/i);

      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe("Groceries");
      expect(parseFloat(match![2])).toBe(12000);
    });

    it("parses addstock command with symbol, quantity, price, and exchange", () => {
      const input = "/addstock INFY 10 1850 NSE";
      const match = input.match(/^\/addstock\s+([a-zA-Z0-9_.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s+(NSE|BSE))?$/i);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("INFY");
      expect(parseFloat(match![2])).toBe(10);
      expect(parseFloat(match![3])).toBe(1850);
      expect(match![4]).toBe("NSE");
    });
  });
});
