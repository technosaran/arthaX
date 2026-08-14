import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isin = searchParams.get("isin");

  if (!isin) {
    return NextResponse.json({ error: "ISIN required" }, { status: 400 });
  }

  // Simulate a live NSE/BSE API quote lookup
  await new Promise(resolve => setTimeout(resolve, 200));

  // We add some minor random fluctuation to simulate live market
  const randomFluctuation = (Math.random() - 0.5) * 5; 
  
  // Base mock prices based on ISIN
  const basePrices: Record<string, number> = {
    "IN0020230085": 1005.50,
    "IN0020210244": 955.20,
    "INE901L07347": 1250.00,
    "INE020B07355": 1195.00,
    "INE516F07409": 990.00,
    "INE895D07849": 1002.00,
    "INE121A07QD6": 1010.00,
    "INE155A08356": 1025.00,
    "INE866I08279": 1010.00
  };

  const basePrice = basePrices[isin] || 1000;
  const current_price = Number((basePrice + randomFluctuation).toFixed(2));

  return NextResponse.json({
    isin,
    current_price,
    timestamp: new Date().toISOString()
  });
}
