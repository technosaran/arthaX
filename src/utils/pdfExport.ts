async function initPdf() {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default || autoTableModule;
  return { jsPDF, autoTable };
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDateDisplay(dateString?: string): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function addHeader(doc: any, title: string, subtitle: string, recordCount: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Top Dark Navy Brand Banner
  doc.setFillColor(21, 24, 31);
  doc.rect(0, 0, pageWidth, 22, "F");

  // Logo & App Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("arthaX", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Financial Intelligence & Management Statement", 38, 14);

  // Generation timestamp on top right
  doc.setFontSize(7.5);
  doc.text(`Generated: ${dateStr}`, pageWidth - 14, 14, { align: "right" });

  // Document Title
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 14, 33);

  // Subtitle / Scope
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${subtitle} • Total Records: ${recordCount}`, 14, 39);
}

function addFooter(doc: any) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "arthaX Financial Statement • Personal Audit Document • Confidential",
      14,
      pageHeight - 9
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 9, {
      align: "right",
    });
  }
}

/* =========================================================================
   1. CONSOLIDATED LEDGER STATEMENT PDF
   ========================================================================= */
export async function exportLedgerPDF(income: any[], expenses: any[], accounts: any[]) {
  const { jsPDF, autoTable } = await initPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateFileStr = new Date().toISOString().split("T")[0];

  interface UnifiedTx {
    id: string;
    date: string;
    type: "DEBIT" | "CREDIT";
    title: string;
    category: string;
    account_id: string | null;
    amount: number;
    notes: string | null;
  }

  const entries: UnifiedTx[] = [
    ...expenses.map((e) => ({
      id: e.id,
      date: e.expense_date,
      type: "DEBIT" as const,
      title: e.title,
      category: e.category,
      account_id: e.account_id,
      amount: Number(e.amount) || 0,
      notes: e.notes,
    })),
    ...income.map((i) => ({
      id: i.id,
      date: i.received_date,
      type: "CREDIT" as const,
      title: i.title,
      category: i.category,
      account_id: i.account_id,
      amount: Number(i.amount) || 0,
      notes: i.notes,
    })),
  ];

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalDebits = entries
    .filter((e) => e.type === "DEBIT")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalCredits = entries
    .filter((e) => e.type === "CREDIT")
    .reduce((sum, e) => sum + e.amount, 0);
  const netFlow = totalCredits - totalDebits;

  addHeader(
    doc,
    "Consolidated Financial Ledger",
    "Comprehensive Debits & Credits Master Statement",
    entries.length
  );

  // Executive Metric Cards (KPI summary)
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - 28 - 8) / 3;
  const boxY = 44;
  const boxH = 15;

  // Box 1: Total Credits (Inflow)
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setTextColor(22, 101, 52);
  doc.text("TOTAL INFLOW (CREDITS)", 18, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`+INR ${formatCurrency(totalCredits)}`, 18, boxY + 11);

  // Box 2: Total Debits (Outflow)
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14 + boxWidth + 4, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(153, 27, 27);
  doc.text("TOTAL OUTFLOW (DEBITS)", 18 + boxWidth + 4, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`-INR ${formatCurrency(totalDebits)}`, 18 + boxWidth + 4, boxY + 11);

  // Box 3: Net Cashflow
  const isNetPos = netFlow >= 0;
  if (isNetPos) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setTextColor(22, 101, 52);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.setTextColor(153, 27, 27);
  }
  doc.roundedRect(14 + (boxWidth + 4) * 2, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("NET CASHFLOW", 18 + (boxWidth + 4) * 2, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${isNetPos ? "+" : "-"}INR ${formatCurrency(Math.abs(netFlow))}`,
    18 + (boxWidth + 4) * 2,
    boxY + 11
  );

  // Table Data
  const tableData = entries.map((e) => {
    const acc = accounts.find((a) => a.id === e.account_id);
    return [
      formatDateDisplay(e.date),
      e.title + (e.notes ? `\n(${e.notes})` : ""),
      acc ? acc.name : "Cash / Unlinked",
      e.category || "General",
      e.type === "DEBIT" ? `-${formatCurrency(e.amount)}` : "—",
      e.type === "CREDIT" ? `+${formatCurrency(e.amount)}` : "—",
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [["Date", "Description & Notes", "Account", "Category", "Debit (-)", "Credit (+)"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [21, 24, 31],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 55 },
      2: { cellWidth: 32 },
      3: { cellWidth: 30 },
      4: { cellWidth: 24, halign: "right", textColor: [223, 81, 76] },
      5: { cellWidth: 24, halign: "right", textColor: [75, 180, 115] },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  addFooter(doc);
  doc.save(`arthaX_ledger_statement_${dateFileStr}.pdf`);
}

/* =========================================================================
   2. EXPENSES STATEMENT PDF
   ========================================================================= */
export async function exportExpensesPDF(expenses: any[], accounts: any[]) {
  const { jsPDF, autoTable } = await initPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateFileStr = new Date().toISOString().split("T")[0];

  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
  );

  const totalAmount = sortedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const avgExpense = sortedExpenses.length > 0 ? totalAmount / sortedExpenses.length : 0;

  addHeader(
    doc,
    "Expenses & Outflows Statement",
    "Detailed Audit of Debited Expenditures & Payments",
    sortedExpenses.length
  );

  // Executive Metric Cards
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - 28 - 4) / 2;
  const boxY = 44;
  const boxH = 15;

  // Box 1: Total Expenditure
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(153, 27, 27);
  doc.text("TOTAL EXPENDITURE", 18, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`INR ${formatCurrency(totalAmount)}`, 18, boxY + 11);

  // Box 2: Average per Expense
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14 + boxWidth + 4, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("AVERAGE TRANSACTION TICKET", 18 + boxWidth + 4, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`INR ${formatCurrency(avgExpense)}`, 18 + boxWidth + 4, boxY + 11);

  const tableData = sortedExpenses.map((e) => {
    const acc = accounts.find((a) => a.id === e.account_id);
    return [
      formatDateDisplay(e.expense_date),
      e.title + (e.notes ? `\n(${e.notes})` : ""),
      e.category || "Uncategorized",
      acc ? acc.name : "Cash / Direct",
      `INR ${formatCurrency(Number(e.amount) || 0)}`,
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [["Date", "Expense Title / Payee", "Category", "Paid From", "Amount (INR)"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [21, 24, 31],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 65 },
      2: { cellWidth: 35 },
      3: { cellWidth: 35 },
      4: { cellWidth: 28, halign: "right", textColor: [223, 81, 76] },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  addFooter(doc);
  doc.save(`arthaX_expenses_statement_${dateFileStr}.pdf`);
}

/* =========================================================================
   3. INCOME STATEMENT PDF
   ========================================================================= */
export async function exportIncomePDF(income: any[], accounts: any[]) {
  const { jsPDF, autoTable } = await initPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateFileStr = new Date().toISOString().split("T")[0];

  const sortedIncome = [...income].sort(
    (a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime()
  );

  const totalAmount = sortedIncome.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  addHeader(
    doc,
    "Income Streams Statement",
    "Detailed Record of Inflow, Salaries, Dividends & Earnings",
    sortedIncome.length
  );

  // Executive Metric Cards
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - 28 - 4) / 2;
  const boxY = 44;
  const boxH = 15;

  // Box 1: Total Cumulative Inflow
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 101, 52);
  doc.text("TOTAL RECORDED INFLOW", 18, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`+INR ${formatCurrency(totalAmount)}`, 18, boxY + 11);

  // Box 2: Total Sources Count
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14 + boxWidth + 4, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("ACTIVE INCOME STREAMS", 18 + boxWidth + 4, boxY + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${sortedIncome.length} Records`, 18 + boxWidth + 4, boxY + 11);

  const tableData = sortedIncome.map((item) => {
    const acc = accounts.find((a) => a.id === item.account_id);
    return [
      formatDateDisplay(item.received_date),
      item.title + (item.notes ? `\n(${item.notes})` : ""),
      item.category || "Salary",
      item.frequency || "Monthly",
      acc ? acc.name : "Liquid Cash",
      `+INR ${formatCurrency(Number(item.amount) || 0)}`,
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [["Date", "Source / Employer", "Category", "Cadence", "Deposited Into", "Amount (INR)"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [21, 24, 31],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25, halign: "right", textColor: [75, 180, 115] },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  addFooter(doc);
  doc.save(`arthaX_income_statement_${dateFileStr}.pdf`);
}

/* =========================================================================
   4. CATEGORY BUDGETS STATEMENT PDF
   ========================================================================= */
export async function exportBudgetsPDF(budgets: any[], expenses: any[]) {
  const { jsPDF, autoTable } = await initPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateFileStr = new Date().toISOString().split("T")[0];

  const totalBudgeted = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  addHeader(
    doc,
    "Category Budgets & Monthly Limits",
    "Monthly Expenditure Caps and Spending Constraints Matrix",
    budgets.length
  );

  const tableData = budgets.map((b) => {
    const spentInCategory = expenses
      .filter((e) => (e.category || "").toLowerCase() === (b.category || "").toLowerCase())
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const budgetLimit = Number(b.amount) || 0;
    const remaining = budgetLimit - spentInCategory;
    const utilPct = budgetLimit > 0 ? Math.round((spentInCategory / budgetLimit) * 100) : 0;

    return [
      b.category,
      `INR ${formatCurrency(budgetLimit)}`,
      `INR ${formatCurrency(spentInCategory)}`,
      remaining >= 0 ? `INR ${formatCurrency(remaining)}` : `-INR ${formatCurrency(Math.abs(remaining))}`,
      `${utilPct}%`,
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [["Category", "Allocated Limit", "Current Spent", "Remaining", "Utilization"]],
    body: tableData.length > 0 ? tableData : [["No category budgets set", "—", "—", "—", "0%"]],
    theme: "striped",
    headStyles: {
      fillColor: [21, 24, 31],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35, halign: "right" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 25, halign: "center" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  addFooter(doc);
  doc.save(`arthaX_budgets_report_${dateFileStr}.pdf`);
}

/* =========================================================================
   5. BANK & LIQUID ACCOUNTS PDF
   ========================================================================= */
export async function exportAccountsPDF(accounts: any[]) {
  const { jsPDF, autoTable } = await initPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateFileStr = new Date().toISOString().split("T")[0];

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  addHeader(
    doc,
    "Bank & Liquid Accounts Inventory",
    "Connected Banking Institutions, Wallets & Cash Reserves",
    accounts.length
  );

  const tableData = accounts.map((acc) => [
    acc.name,
    acc.type || "Savings",
    acc.account_number || (acc.last_four ? `••${acc.last_four}` : "Primary"),
    `INR ${formatCurrency(Number(acc.balance) || 0)}`,
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Account Name", "Type", "Account Identifier", "Current Balance (INR)"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [21, 24, 31],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 45 },
      3: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    foot: [["Total Liquid Net Worth", "", "", `INR ${formatCurrency(totalBalance)}`]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  addFooter(doc);
  doc.save(`arthaX_accounts_inventory_${dateFileStr}.pdf`);
}

/* =========================================================================
   6. COMPREHENSIVE MASTER PORTFOLIO PDF
   ========================================================================= */
export async function exportMasterPortfolioPDF(
  accounts: any[],
  income: any[],
  expenses: any[],
  budgets: any[]
) {
  const { jsPDF, autoTable } = await initPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateFileStr = new Date().toISOString().split("T")[0];

  const totalNetWorth = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalIncome = income.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netCashflow = totalIncome - totalExpenses;

  addHeader(
    doc,
    "Comprehensive Portfolio Statement",
    "Complete Financial Health, Accounts, Income & Expenses Audit",
    accounts.length + income.length + expenses.length
  );

  // Summary Metrics Banner
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - 28 - 12) / 4;
  const boxY = 44;
  const boxH = 14;

  // Box 1: Total Net Worth
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text("TOTAL NET WORTH", 17, boxY + 4.5);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`INR ${formatCurrency(totalNetWorth)}`, 17, boxY + 10);

  // Box 2: Total Inflows
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14 + boxWidth + 4, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 101, 52);
  doc.text("TOTAL INFLOW", 17 + boxWidth + 4, boxY + 4.5);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`+INR ${formatCurrency(totalIncome)}`, 17 + boxWidth + 4, boxY + 10);

  // Box 3: Total Outflows
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14 + (boxWidth + 4) * 2, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(153, 27, 27);
  doc.text("TOTAL OUTFLOW", 17 + (boxWidth + 4) * 2, boxY + 4.5);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`-INR ${formatCurrency(totalExpenses)}`, 17 + (boxWidth + 4) * 2, boxY + 10);

  // Box 4: Net Flow
  const isPos = netCashflow >= 0;
  if (isPos) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setTextColor(22, 101, 52);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.setTextColor(153, 27, 27);
  }
  doc.roundedRect(14 + (boxWidth + 4) * 3, boxY, boxWidth, boxH, 2, 2, "FD");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("NET CASHFLOW", 17 + (boxWidth + 4) * 3, boxY + 4.5);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${isPos ? "+" : "-"}INR ${formatCurrency(Math.abs(netCashflow))}`,
    17 + (boxWidth + 4) * 3,
    boxY + 10
  );

  // Section 1: Accounts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Connected Bank & Liquid Accounts", 14, 66);

  const accountsTable = accounts.map((a) => [
    a.name,
    a.type || "Savings",
    a.account_number || (a.last_four ? `••${a.last_four}` : "Primary"),
    `INR ${formatCurrency(Number(a.balance) || 0)}`,
  ]);

  autoTable(doc, {
    startY: 70,
    head: [["Account Name", "Type", "Identifier", "Balance (INR)"]],
    body: accountsTable,
    theme: "striped",
    headStyles: { fillColor: [21, 24, 31], fontSize: 7.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  // Section 2: Recent Transactions Ledger
  const lastY = (doc as any).lastAutoTable?.finalY || 100;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Financial Transactions Ledger", 14, lastY + 10);

  const unifiedTx = [
    ...expenses.map((e) => ({
      date: e.expense_date,
      title: e.title,
      type: "DEBIT",
      category: e.category,
      amount: Number(e.amount) || 0,
    })),
    ...income.map((i) => ({
      date: i.received_date,
      title: i.title,
      type: "CREDIT",
      category: i.category,
      amount: Number(i.amount) || 0,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const txTable = unifiedTx.map((tx) => [
    formatDateDisplay(tx.date),
    tx.title,
    tx.category || "General",
    tx.type,
    tx.type === "DEBIT"
      ? `-${formatCurrency(tx.amount)}`
      : `+${formatCurrency(tx.amount)}`,
  ]);

  autoTable(doc, {
    startY: lastY + 14,
    head: [["Date", "Description", "Category", "Type", "Amount (INR)"]],
    body: txTable,
    theme: "striped",
    headStyles: { fillColor: [21, 24, 31], fontSize: 7.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    columnStyles: {
      3: { halign: "center" },
      4: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  addFooter(doc);
  doc.save(`arthaX_full_financial_report_${dateFileStr}.pdf`);
}
