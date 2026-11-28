import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiNotFound } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { isValidUuid } from "@/lib/backend/queryParams";
import { logger } from "@/utils/logger";
import {
  roundMoney,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  percentMoney,
} from "@/utils/money";
import { z } from "zod";

const AddBondSchema = z.object({
  isin: z.string().min(8, "ISIN must be at least 8 characters").max(16).transform((v) => v.toUpperCase().trim()),
  name: z.string().min(2, "Bond name is required").max(200),
  issuer_name: z.string().min(2, "Issuer name is required").max(200),
  bond_type: z.enum(["CORPORATE", "GOVERNMENT", "STATE_DEVELOPMENT", "SGB", "TAX_FREE", "OTHER"]).default("CORPORATE"),
  platform: z.enum(["INDIABONDS", "GOLDENPI", "ZERODHA", "WINT_WEALTH", "OTHER"]).default("INDIABONDS"),
  demat_account_id: z.string().uuid().optional().nullable(),
  demat_broker: z.string().default("ZERODHA"),
  face_value: z.number().positive("Face value must be positive").default(1000),
  quantity: z.number().positive("Quantity must be greater than 0"),
  avg_buy_price: z.number().nonnegative("Purchase price must be non-negative"),
  current_price: z.number().nonnegative().optional().nullable(),
  coupon_rate: z.number().nonnegative("Coupon rate must be non-negative").default(0),
  ytm: z.number().nonnegative().optional().nullable(),
  coupon_frequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "CUMULATIVE_AT_MATURITY"]).default("ANNUAL"),
  next_coupon_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Maturity date is required (YYYY-MM-DD)"),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  credit_rating: z.string().max(50).default("CRISIL AAA"),
  rating_agency: z.string().max(50).default("CRISIL"),
  seniority: z.enum(["SENIOR_SECURED", "SENIOR_UNSECURED", "SUBORDINATED_TIER_2", "PERPETUAL_AT1", "GOVERNMENT_GUARANTEED"]).default("SENIOR_SECURED"),
  tax_status: z.enum(["TAXABLE", "TAX_FREE", "TDS_EXEMPT"]).default("TAXABLE"),
  order_reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateBondSchema = z.object({
  id: z.string().uuid("Invalid holding ID"),
  name: z.string().min(2).max(200).optional(),
  issuer_name: z.string().min(2).max(200).optional(),
  bond_type: z.enum(["CORPORATE", "GOVERNMENT", "STATE_DEVELOPMENT", "SGB", "TAX_FREE", "OTHER"]).optional(),
  platform: z.enum(["INDIABONDS", "GOLDENPI", "ZERODHA", "WINT_WEALTH", "OTHER"]).optional(),
  demat_account_id: z.string().uuid().optional().nullable(),
  demat_broker: z.string().optional(),
  face_value: z.number().positive().optional(),
  quantity: z.number().nonnegative().optional(),
  avg_buy_price: z.number().nonnegative().optional(),
  current_price: z.number().nonnegative().optional().nullable(),
  coupon_rate: z.number().nonnegative().optional(),
  ytm: z.number().nonnegative().optional().nullable(),
  coupon_frequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "CUMULATIVE_AT_MATURITY"]).optional(),
  next_coupon_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  credit_rating: z.string().max(50).optional(),
  rating_agency: z.string().max(50).optional(),
  seniority: z.enum(["SENIOR_SECURED", "SENIOR_UNSECURED", "SUBORDINATED_TIER_2", "PERPETUAL_AT1", "GOVERNMENT_GUARANTEED"]).optional(),
  tax_status: z.enum(["TAXABLE", "TAX_FREE", "TDS_EXEMPT"]).optional(),
  order_reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// GET: Fetch all bond holdings, transactions, and calculated portfolio metrics
export const GET = createApiRoute({
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const [holdingsRes, transactionsRes, accountsRes] = await Promise.all([
      supabaseAdmin
        .from("bond_holdings")
        .select("*")
        .eq("user_id", userId!)
        .order("maturity_date", { ascending: true }),
      supabaseAdmin
        .from("bond_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("transaction_date", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("accounts")
        .select("id, name, type, balance, last_four")
        .eq("user_id", userId!),
    ]);

    if (holdingsRes.error) {
      return apiError(holdingsRes.error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    const holdings = holdingsRes.data || [];
    const transactions = transactionsRes.data || [];
    const accounts = accountsRes.data || [];

    const zerodhaAccount = accounts.find((a) =>
      a.name.toLowerCase().includes("zerodha") || a.type.toLowerCase().includes("investment")
    );

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalFaceValue = 0;
    let totalAnnualInterest = 0;
    let weightedCouponNumerator = 0;
    let weightedYtmNumerator = 0;
    let weightedYtmDenominator = 0;

    const platformBreakdown: Record<string, { count: number; invested: number }> = {
      INDIABONDS: { count: 0, invested: 0 },
      GOLDENPI: { count: 0, invested: 0 },
      ZERODHA: { count: 0, invested: 0 },
      WINT_WEALTH: { count: 0, invested: 0 },
      OTHER: { count: 0, invested: 0 },
    };

    const typeBreakdown: Record<string, { count: number; value: number }> = {};
    const ratingBreakdown: Record<string, { count: number; value: number }> = {};
    const upcomingCoupons: Array<{
      id: string;
      name: string;
      issuer: string;
      isin: string;
      nextDate: string;
      expectedPayout: number;
      couponRate: number;
      frequency: string;
      platform: string;
    }> = [];

    for (const bond of holdings) {
      const qty = Number(bond.quantity) || 0;
      const faceVal = Number(bond.face_value) || 1000;
      const buyPrice = Number(bond.avg_buy_price) || faceVal;
      const curPrice = Number(bond.current_price) > 0 ? Number(bond.current_price) : buyPrice;
      const couponRate = Number(bond.coupon_rate) || 0;
      const ytm = Number(bond.ytm) || couponRate;

      const bondFaceTotal = mulMoney(qty, faceVal);
      const bondInvested = Number(bond.invested_amount) > 0 ? Number(bond.invested_amount) : mulMoney(qty, buyPrice);
      const bondCurrent = mulMoney(qty, curPrice);
      const bondAnnualCoupon = divMoney(mulMoney(bondFaceTotal, couponRate), 100);

      totalInvested = addMoney(totalInvested, bondInvested);
      totalCurrentValue = addMoney(totalCurrentValue, bondCurrent);
      totalFaceValue = addMoney(totalFaceValue, bondFaceTotal);
      totalAnnualInterest = addMoney(totalAnnualInterest, bondAnnualCoupon);
      weightedCouponNumerator = addMoney(weightedCouponNumerator, bondAnnualCoupon);

      if (ytm > 0) {
        weightedYtmNumerator = addMoney(weightedYtmNumerator, mulMoney(ytm, bondInvested));
        weightedYtmDenominator = addMoney(weightedYtmDenominator, bondInvested);
      }

      const plt = bond.platform || "INDIABONDS";
      if (!platformBreakdown[plt]) {
        platformBreakdown[plt] = { count: 0, invested: 0 };
      }
      platformBreakdown[plt].count += 1;
      platformBreakdown[plt].invested = addMoney(platformBreakdown[plt].invested, bondInvested);

      const bType = bond.bond_type || "CORPORATE";
      if (!typeBreakdown[bType]) {
        typeBreakdown[bType] = { count: 0, value: 0 };
      }
      typeBreakdown[bType].count += 1;
      typeBreakdown[bType].value = addMoney(typeBreakdown[bType].value, bondCurrent);

      const rating = bond.credit_rating || "CRISIL AAA";
      if (!ratingBreakdown[rating]) {
        ratingBreakdown[rating] = { count: 0, value: 0 };
      }
      ratingBreakdown[rating].count += 1;
      ratingBreakdown[rating].value = addMoney(ratingBreakdown[rating].value, bondCurrent);

      if (bond.next_coupon_date) {
        let perPayoutMultiplier = 1;
        if (bond.coupon_frequency === "MONTHLY") perPayoutMultiplier = 1 / 12;
        else if (bond.coupon_frequency === "QUARTERLY") perPayoutMultiplier = 1 / 4;
        else if (bond.coupon_frequency === "SEMI_ANNUAL") perPayoutMultiplier = 1 / 2;
        else if (bond.coupon_frequency === "CUMULATIVE_AT_MATURITY") perPayoutMultiplier = 0;

        const expectedPerPayout = mulMoney(bondAnnualCoupon, perPayoutMultiplier);

        upcomingCoupons.push({
          id: bond.id,
          name: bond.name,
          issuer: bond.issuer_name,
          isin: bond.isin,
          nextDate: bond.next_coupon_date,
          expectedPayout: expectedPerPayout,
          couponRate,
          frequency: bond.coupon_frequency,
          platform: bond.platform,
        });
      }
    }

    upcomingCoupons.sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());

    const weightedCouponRate = totalFaceValue > 0 ? (weightedCouponNumerator / totalFaceValue) * 100 : 0;
    const weightedYtm = weightedYtmDenominator > 0 ? weightedYtmNumerator / weightedYtmDenominator : 0;
    const totalPnl = subMoney(totalCurrentValue, totalInvested);
    const totalReturnsPercent = totalInvested > 0 ? percentMoney(totalPnl, totalInvested, { clamp: false }) : 0;

    return {
      holdings,
      transactions,
      accounts,
      zerodhaDematAccount: zerodhaAccount || null,
      stats: {
        totalHoldingsCount: holdings.length,
        totalInvested: roundMoney(totalInvested),
        totalCurrentValue: roundMoney(totalCurrentValue),
        totalFaceValue: roundMoney(totalFaceValue),
        totalAnnualInterest: roundMoney(totalAnnualInterest),
        monthlyPassiveIncome: roundMoney(divMoney(totalAnnualInterest, 12)),
        weightedCouponRate: roundMoney(weightedCouponRate),
        weightedYtm: roundMoney(weightedYtm),
        totalPnl: roundMoney(totalPnl),
        totalReturnsPercent: roundMoney(totalReturnsPercent),
        platformBreakdown,
        typeBreakdown,
        ratingBreakdown,
        upcomingCoupons,
      },
    };
  },
});

// POST: Add new bond holding (or average into existing holding)
export const POST = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  idempotent: true,
  schema: AddBondSchema,
  handler: async ({ userId, body, req }) => {
    const {
      isin,
      name,
      issuer_name,
      bond_type,
      platform,
      demat_account_id,
      demat_broker,
      face_value,
      quantity,
      avg_buy_price,
      current_price,
      coupon_rate,
      ytm,
      coupon_frequency,
      next_coupon_date,
      maturity_date,
      issue_date,
      credit_rating,
      rating_agency,
      seniority,
      tax_status,
      order_reference,
      notes,
      transaction_date,
    } = body;

    const { data: existing } = await supabaseAdmin
      .from("bond_holdings")
      .select("*")
      .eq("user_id", userId!)
      .eq("isin", isin)
      .maybeSingle();

    let holdingId: string;
    let finalQty = quantity;
    let finalBuyPrice = avg_buy_price;
    let finalInvested = mulMoney(quantity, avg_buy_price);

    if (existing) {
      const prevQty = Number(existing.quantity) || 0;
      const prevBuyPrice = Number(existing.avg_buy_price) || 0;
      finalQty = addMoney(prevQty, quantity);
      finalInvested = addMoney(mulMoney(prevQty, prevBuyPrice), mulMoney(quantity, avg_buy_price));
      finalBuyPrice = finalQty > 0 ? divMoney(finalInvested, finalQty) : avg_buy_price;

      const { error: updateErr } = await supabaseAdmin
        .from("bond_holdings")
        .update({
          name,
          issuer_name,
          bond_type,
          platform,
          demat_account_id: demat_account_id || existing.demat_account_id,
          demat_broker: demat_broker || existing.demat_broker,
          face_value,
          quantity: finalQty,
          avg_buy_price: roundMoney(finalBuyPrice),
          invested_amount: roundMoney(finalInvested),
          current_price: current_price ?? existing.current_price ?? finalBuyPrice,
          coupon_rate,
          ytm: ytm ?? existing.ytm,
          coupon_frequency,
          next_coupon_date: next_coupon_date ?? existing.next_coupon_date,
          maturity_date,
          credit_rating,
          rating_agency,
          seniority,
          tax_status,
          order_reference: order_reference || existing.order_reference,
          notes: notes || existing.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", userId!)
        .select()
        .single();

      if (updateErr) {
        return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }
      holdingId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("bond_holdings")
        .insert({
          user_id: userId!,
          isin,
          name,
          issuer_name,
          bond_type,
          platform,
          demat_account_id: demat_account_id || null,
          demat_broker: demat_broker || "ZERODHA",
          face_value,
          quantity,
          avg_buy_price,
          invested_amount: roundMoney(finalInvested),
          current_price: current_price ?? avg_buy_price,
          coupon_rate,
          ytm: ytm ?? coupon_rate,
          coupon_frequency,
          next_coupon_date: next_coupon_date || null,
          maturity_date,
          issue_date: issue_date || null,
          credit_rating,
          rating_agency,
          seniority,
          tax_status,
          order_reference: order_reference || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (insertErr) {
        return apiError(insertErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }
      holdingId = inserted.id;
    }

    // Record BUY transaction
    const { error: txErr } = await supabaseAdmin.from("bond_transactions").insert({
      user_id: userId!,
      holding_id: holdingId,
      isin,
      type: "BUY",
      quantity,
      price: avg_buy_price,
      amount: roundMoney(mulMoney(quantity, avg_buy_price)),
      platform,
      demat_account_id: demat_account_id || null,
      transaction_date: transaction_date || new Date().toISOString().split("T")[0],
      notes: `Purchased via ${platform}. Settled to ${demat_broker} Demat.`,
    });
    if (txErr) {
      logger.warn("Failed to record bond BUY transaction", "BondsAPI", { userId, holdingId, error: txErr.message });
    }

    // Invalidate caches across bonds, portfolio, and analytics
    await invalidateUserCaches(userId, ["BONDS", "PORTFOLIO", "ANALYTICS"]);

    return {
      message: existing ? "Bond holding updated successfully" : "New bond holding added successfully",
      holdingId,
    };
  },
});

// PUT: Update an existing bond holding
export const PUT = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  schema: UpdateBondSchema,
  handler: async ({ userId, body, req }) => {
    const { id, ...updates } = body;

    const updatePayload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.quantity !== undefined || updates.avg_buy_price !== undefined) {
      const { data: current } = await supabaseAdmin
        .from("bond_holdings")
        .select("quantity, avg_buy_price")
        .eq("id", id)
        .eq("user_id", userId!)
        .single();

      if (current) {
        const q = updates.quantity ?? Number(current.quantity);
        const p = updates.avg_buy_price ?? Number(current.avg_buy_price);
        updatePayload.invested_amount = roundMoney(mulMoney(q, p));
      }
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("bond_holdings")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId!)
      .select()
      .maybeSingle();

    if (updateErr) {
      return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
    if (!updated) {
      return apiNotFound("Bond holding not found", req);
    }

    await invalidateUserCaches(userId, ["BONDS", "PORTFOLIO", "ANALYTICS"]);

    return { message: "Bond updated successfully", holding: updated };
  },
});

// DELETE: Remove a bond holding
export const DELETE = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const id = query.get("id");

    if (!isValidUuid(id)) {
      return apiError("Valid Bond ID is required", "BAD_REQUEST", 400, undefined, req);
    }

    const { data: deleted, error: delErr } = await supabaseAdmin
      .from("bond_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId!)
      .select("id")
      .maybeSingle();

    if (delErr) {
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
    if (!deleted) {
      return apiNotFound("Bond holding not found", req);
    }

    await invalidateUserCaches(userId, ["BONDS", "PORTFOLIO", "ANALYTICS"]);

    return { message: "Bond holding deleted successfully" };
  },
});
