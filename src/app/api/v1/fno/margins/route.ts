import { NextRequest, NextResponse } from "next/server";
import { extractRequestId } from "@/utils/apiResponse";

export interface MarginRequestLeg {
  symbol: string;
  instrumentType: "CE" | "PE" | "FUT";
  strikePrice?: number;
  side: "BUY" | "SELL";
  product: "NRML" | "MIS";
  lots: number;
  lotSize: number;
  price: number;
}

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);

  try {
    const body = await req.json();
    const legs: MarginRequestLeg[] = body.legs || [];

    if (!Array.isArray(legs) || legs.length === 0) {
      return NextResponse.json(
        { error: "At least one trade leg is required" },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

    let totalPremium = 0;
    let totalSpanMargin = 0;
    let totalExposureMargin = 0;
    let totalBrokerage = 0;
    let totalStt = 0;
    let totalExchangeCharges = 0;
    let totalSebi = 0;
    let totalStampDuty = 0;
    let totalGst = 0;

    for (const leg of legs) {
      const qty = leg.lots * leg.lotSize;
      const turnover = qty * leg.price;

      // Zerodha Brokerage: flat ₹20 or 0.03%
      const bkg = Math.min(20, +(turnover * 0.0003).toFixed(2));
      totalBrokerage += bkg;

      if (leg.instrumentType === "FUT") {
        // Futures Margin: ~12% to 15% SPAN + Exposure
        const span = turnover * 0.10;
        const exposure = turnover * 0.03;
        totalSpanMargin += span;
        totalExposureMargin += exposure;

        if (leg.side === "SELL") {
          totalStt += turnover * 0.0002;
        }
        totalExchangeCharges += turnover * 0.000019;
        if (leg.side === "BUY") {
          totalStampDuty += turnover * 0.00002;
        }
      } else {
        // Options
        if (leg.side === "BUY") {
          // Buyers only pay premium
          totalPremium += turnover;
          totalStampDuty += turnover * 0.00003;
        } else {
          // Sellers require SPAN + Exposure margin (approx ₹1,10,000 to ₹1,40,000 per lot for NIFTY/BANKNIFTY)
          // Simplified standard Zerodha margin rule
          const baseUnderlyingEst = (leg.strikePrice || 24000) * qty;
          const span = baseUnderlyingEst * 0.085;
          const exposure = baseUnderlyingEst * 0.02;
          totalSpanMargin += span;
          totalExposureMargin += exposure;

          totalStt += turnover * 0.00125; // 0.125% STT on options sell
        }

        totalExchangeCharges += turnover * 0.000495;
      }

      totalSebi += turnover * 0.000001;
    }

    // Spread Margin Benefit (Hedging benefit):
    // In Zerodha Kite, having opposite legs (e.g. Bull Call Spread, Iron Condor) reduces margin by ~60-70%
    const buyLegs = legs.filter((l) => l.side === "BUY");
    const sellLegs = legs.filter((l) => l.side === "SELL");
    const isHedged = buyLegs.length > 0 && sellLegs.length > 0;
    const hedgeDiscount = isHedged ? 0.65 : 0; // 65% reduction on SPAN

    const effectiveSpan = totalSpanMargin * (1 - hedgeDiscount);
    const totalMarginRequired = +(totalPremium + effectiveSpan + totalExposureMargin).toFixed(2);

    totalGst = +((totalBrokerage + totalExchangeCharges + totalSebi) * 0.18).toFixed(2);
    const totalTaxesAndCharges = +(
      totalBrokerage +
      totalStt +
      totalExchangeCharges +
      totalSebi +
      totalStampDuty +
      totalGst
    ).toFixed(2);

    return NextResponse.json(
      {
        success: true,
        summary: {
          marginRequired: totalMarginRequired,
          premiumRequired: +totalPremium.toFixed(2),
          spanMargin: +effectiveSpan.toFixed(2),
          exposureMargin: +totalExposureMargin.toFixed(2),
          hedgeBenefit: isHedged ? +(totalSpanMargin * hedgeDiscount).toFixed(2) : 0,
          chargesBreakdown: {
            brokerage: +totalBrokerage.toFixed(2),
            stt: +totalStt.toFixed(2),
            exchangeCharges: +totalExchangeCharges.toFixed(2),
            sebi: +totalSebi.toFixed(2),
            stampDuty: +totalStampDuty.toFixed(2),
            gst: +totalGst.toFixed(2),
            totalCharges: totalTaxesAndCharges,
          },
        },
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    console.error("[F&O Margins] Error:", err);
    return NextResponse.json({ error: "Failed to calculate margins" }, { status: 500 });
  }
}
