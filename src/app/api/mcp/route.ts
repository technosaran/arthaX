import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in environment variables.");
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    server: "FinanceOS MCP HTTP Bridge",
    version: "1.0.0",
    tools: [
      "get_financial_overview",
      "list_accounts",
      "list_recent_transactions",
      "add_transaction",
      "get_portfolio_summary",
      "search_ledger",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, arguments: args } = body;

    const supabase = getSupabaseClient();

    if (name === "get_financial_overview") {
      const [{ data: accountsArr }, { data: expensesArr }, { data: incomesArr }, { data: liabilitiesArr }] = await Promise.all([
        supabase.from("accounts").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("incomes").select("*"),
        supabase.from("liabilities").select("*"),
      ]);

      const totalBalance = (accountsArr || []).reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
      const totalExpenses = (expensesArr || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const totalIncomes = (incomesArr || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const totalLiabilities = (liabilitiesArr || []).reduce((acc, curr) => acc + Number(curr.remaining_amount || 0), 0);

      const netWorth = totalBalance - totalLiabilities;

      return NextResponse.json({
        success: true,
        result: {
          net_worth: netWorth,
          total_bank_balance: totalBalance,
          total_incomes: totalIncomes,
          total_expenses: totalExpenses,
          total_liabilities: totalLiabilities,
          accounts_count: accountsArr?.length || 0,
          accounts: accountsArr?.map((a) => ({ name: a.name, type: a.type, balance: a.balance, currency: a.currency })),
        },
      });
    }

    if (name === "list_accounts") {
      const { data: accountsArr, error } = await supabase.from("accounts").select("*");
      if (error) throw error;
      return NextResponse.json({ success: true, result: accountsArr || [] });
    }

    if (name === "list_recent_transactions") {
      const type = args?.type || "all";
      const category = args?.category;
      const limit = Number(args?.limit || 20);

      let query = supabase.from("transactions").select("*").order("date", { ascending: false }).limit(limit);
      if (type !== "all") query = query.eq("type", type);
      if (category) query = query.ilike("category", `%${category}%`);

      const { data: transactionsArr, error } = await query;
      if (error) throw error;

      return NextResponse.json({ success: true, result: transactionsArr || [] });
    }

    if (name === "add_transaction") {
      const type = args?.type;
      const amount = Number(args?.amount);
      const description = args?.description;
      const category = args?.category;
      const accountInput = args?.account_name_or_id;

      if (!type || !amount || !description || !category) {
        return NextResponse.json({ error: "Missing required fields: type, amount, description, category" }, { status: 400 });
      }

      let account: any = null;
      const { data: allAccounts } = await supabase.from("accounts").select("*");

      if (allAccounts && allAccounts.length > 0) {
        if (accountInput) {
          account = allAccounts.find(
            (a) => a.id === accountInput || a.name.toLowerCase().includes(accountInput.toLowerCase())
          );
        }
        if (!account) account = allAccounts[0];
      }

      const userId = account?.user_id || "00000000-0000-0000-0000-000000000000";
      const accountId = account?.id || null;

      let newBalance = Number(account?.balance || 0);
      const oldBalance = newBalance;

      if (type === "expense") newBalance -= amount;
      else newBalance += amount;

      if (accountId) {
        await supabase.from("accounts").update({ balance: newBalance.toString() }).eq("id", accountId);
      }

      const { data: newTx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          account_id: accountId,
          type,
          amount: amount.toString(),
          description,
          category,
          date: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (txErr) throw txErr;

      if (type === "expense") {
        await supabase.from("expenses").insert({
          user_id: userId,
          account_id: accountId,
          description,
          amount: amount.toString(),
          category,
          date: new Date().toISOString(),
        });
      } else {
        await supabase.from("incomes").insert({
          user_id: userId,
          account_id: accountId,
          description,
          amount: amount.toString(),
          category,
          date: new Date().toISOString(),
        });
      }

      await supabase.from("ledger_logs").insert({
        user_id: userId,
        account_id: accountId,
        account_name: account?.name || "General",
        action_type: type === "expense" ? "ADJUST_DOWN" : "ADJUST_UP",
        amount: amount.toString(),
        previous_balance: oldBalance.toString(),
        new_balance: newBalance.toString(),
        details: `MCP Transaction: ${description} (${category})`,
        source_type: type,
      });

      return NextResponse.json({
        success: true,
        result: {
          message: `Logged ${type} of ₹${amount} for '${description}' under '${category}'.`,
          account_updated: account?.name || "N/A",
          old_balance: oldBalance,
          new_balance: newBalance,
          transaction: newTx,
        },
      });
    }

    if (name === "get_portfolio_summary") {
      const [{ data: stocks }, { data: mutualFunds }, { data: bonds }, { data: altAssets }] = await Promise.all([
        supabase.from("investments").select("*"),
        supabase.from("mutual_funds").select("*"),
        supabase.from("bonds").select("*"),
        supabase.from("alternative_assets").select("*"),
      ]);

      const stocksValue = (stocks || []).reduce((acc, curr) => acc + Number(curr.quantity || 0) * Number(curr.current_price || 0), 0);
      const mfValue = (mutualFunds || []).reduce((acc, curr) => acc + Number(curr.units || 0) * Number(curr.current_nav || 0), 0);
      const bondsValue = (bonds || []).reduce((acc, curr) => acc + Number(curr.current_value || 0), 0);
      const altAssetsValue = (altAssets || []).reduce((acc, curr) => acc + Number(curr.current_value || 0), 0);

      return NextResponse.json({
        success: true,
        result: {
          total_portfolio_value: stocksValue + mfValue + bondsValue + altAssetsValue,
          stocks: { count: stocks?.length || 0, total_value: stocksValue, items: stocks },
          mutual_funds: { count: mutualFunds?.length || 0, total_value: mfValue, items: mutualFunds },
          bonds: { count: bonds?.length || 0, total_value: bondsValue, items: bonds },
          alternative_assets: { count: altAssets?.length || 0, total_value: altAssetsValue, items: altAssets },
        },
      });
    }

    if (name === "search_ledger") {
      const queryStr = args?.query || "";
      const limit = Number(args?.limit || 20);

      let query = supabase.from("ledger_logs").select("*").order("created_at", { ascending: false }).limit(limit);

      if (queryStr) {
        query = query.or(`details.ilike.%${queryStr}%,account_name.ilike.%${queryStr}%`);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      return NextResponse.json({ success: true, result: logs || [] });
    }

    return NextResponse.json({ error: `Unknown tool name: ${name}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
