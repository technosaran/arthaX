import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError } from "@/utils/apiResponse";

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 10, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const format = (query.get("format") || "json").toLowerCase();
    const entity = (query.get("entity") || "all").toLowerCase();

    try {
      // 1. Fetch user data scoped strictly to authenticated userId
      const [accountsRes, expensesRes, incomeRes, transfersRes, statementsRes, auditRes] = await Promise.all([
        supabaseAdmin.from("accounts").select("*").eq("user_id", userId!),
        supabaseAdmin.from("expenses").select("*").eq("user_id", userId!).order("expense_date", { ascending: false }),
        supabaseAdmin.from("income").select("*").eq("user_id", userId!).order("received_date", { ascending: false }),
        supabaseAdmin.from("transfers").select("*").eq("user_id", userId!).order("transfer_date", { ascending: false }),
        supabaseAdmin.from("bank_statements").select("*").eq("user_id", userId!).order("period_end", { ascending: false }),
        supabaseAdmin.from("financial_audit_logs").select("*").eq("user_id", userId!).order("timestamp", { ascending: false }).limit(200),
      ]);

      const exportBundle = {
        metadata: {
          user_id: userId,
          exported_at: new Date().toISOString(),
          version: "2.0.0",
          platform: "ArthaX Personal Finance",
        },
        accounts: accountsRes.data || [],
        expenses: expensesRes.data || [],
        income: incomeRes.data || [],
        transfers: transfersRes.data || [],
        bank_statements: statementsRes.data || [],
        audit_trail: auditRes.data || [],
      };

      if (format === "csv") {
        let csvContent = "";
        const nowStr = new Date().toISOString().split("T")[0];

        if (entity === "expenses" || entity === "all") {
          csvContent += "=== EXPENSES ===\n";
          csvContent += "ID,Date,Title,Category,Amount,Account_ID,Merchant,Notes\n";
          for (const e of exportBundle.expenses) {
            csvContent += `"${e.id}","${e.expense_date}","${(e.title || "").replace(/"/g, '""')}","${e.category}","${e.amount}","${e.account_id || ''}","${(e.merchant || '').replace(/"/g, '""')}","${(e.notes || '').replace(/"/g, '""')}"\n`;
          }
        }

        if (entity === "income" || entity === "all") {
          csvContent += "\n=== INCOME ===\n";
          csvContent += "ID,Date,Title,Category,Amount,Account_ID,Notes\n";
          for (const i of exportBundle.income) {
            csvContent += `"${i.id}","${i.received_date}","${(i.title || "").replace(/"/g, '""')}","${i.category}","${i.amount}","${i.account_id || ''}","${(i.notes || '').replace(/"/g, '""')}"\n`;
          }
        }

        if (entity === "accounts" || entity === "all") {
          csvContent += "\n=== ACCOUNTS ===\n";
          csvContent += "ID,Name,Type,Classification,Balance,Last_Four,Active\n";
          for (const a of exportBundle.accounts) {
            csvContent += `"${a.id}","${(a.name || '').replace(/"/g, '""')}","${a.type}","${a.classification || ''}","${a.balance}","${a.last_four || ''}","${a.is_active}"\n`;
          }
        }

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="arthax_export_${entity}_${nowStr}.csv"`,
          },
        });
      }

      // JSON format
      return apiSuccess(exportBundle, undefined, 200, req);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
  },
});
