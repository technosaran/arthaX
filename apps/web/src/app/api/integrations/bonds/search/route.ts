import { NextResponse } from "next/server";

// In a production app, this would hit the NSE India API or a service like GoldenPi/CRISIL.
// For reliability in this dashboard, we simulate the external API lookup.
const EXTERNAL_BOND_DATABASE: Record<string, any> = {
  "IN0020230085": { bond_name: "7.18% GS 2033", issuer: "Government of India", bond_type: "Government", face_value: 1000, coupon_rate: 7.18, ytm: 7.18, interest_frequency: "Semi-Annual", credit_rating: "Sovereign", current_price: 1005.50, maturity_date: "2033-08-14" },
  "IN0020210244": { bond_name: "6.10% GS 2031", issuer: "Government of India", bond_type: "Government", face_value: 1000, coupon_rate: 6.10, ytm: 6.85, interest_frequency: "Semi-Annual", credit_rating: "Sovereign", current_price: 955.20, maturity_date: "2031-07-12" },
  "INE901L07347": { bond_name: "8.30% NHAI Tax Free 2034", issuer: "National Highways Authority of India", bond_type: "Tax-Free", face_value: 1000, coupon_rate: 8.30, ytm: 5.60, interest_frequency: "Annual", credit_rating: "AAA", current_price: 1250.00, maturity_date: "2034-01-25" },
  "INE020B07355": { bond_name: "8.71% REC Tax Free 2029", issuer: "REC Limited", bond_type: "Tax-Free", face_value: 1000, coupon_rate: 8.71, ytm: 5.45, interest_frequency: "Annual", credit_rating: "AAA", current_price: 1195.00, maturity_date: "2029-09-24" },
  "INE516F07409": { bond_name: "9.25% Piramal NCD 2027", issuer: "Piramal Enterprises Limited", bond_type: "Corporate", face_value: 1000, coupon_rate: 9.25, ytm: 9.50, interest_frequency: "Monthly", credit_rating: "AA", current_price: 990.00, maturity_date: "2027-06-18" },
  "INE895D07849": { bond_name: "8.75% Muthoot Finance NCD 2028", issuer: "Muthoot Finance Limited", bond_type: "Corporate", face_value: 1000, coupon_rate: 8.75, ytm: 8.90, interest_frequency: "Annual", credit_rating: "AA+", current_price: 1002.00, maturity_date: "2028-12-15" },
  "INE121A07QD6": { bond_name: "9.05% Shriram Finance NCD 2027", issuer: "Shriram Finance Limited", bond_type: "Corporate", face_value: 1000, coupon_rate: 9.05, ytm: 9.20, interest_frequency: "Monthly", credit_rating: "AA+", current_price: 1010.00, maturity_date: "2027-04-20" },
  "INE155A08356": { bond_name: "9.50% Tata Motors NCD 2026", issuer: "Tata Motors", bond_type: "Corporate", face_value: 1000, coupon_rate: 9.50, ytm: 8.10, interest_frequency: "Semi-Annual", credit_rating: "AA", current_price: 1025.00, maturity_date: "2026-09-10" },
  "INE866I08279": { bond_name: "10.50% InCred Financial 2025", issuer: "InCred Financial Services", bond_type: "Corporate", face_value: 1000, coupon_rate: 10.50, ytm: 10.10, interest_frequency: "Monthly", credit_rating: "A+", current_price: 1010.00, maturity_date: "2025-11-20" }
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Simulate network delay for API lookup
  await new Promise(resolve => setTimeout(resolve, 300));

  const results = Object.entries(EXTERNAL_BOND_DATABASE)
    .filter(([isin, data]) => 
      isin.toLowerCase().includes(q) || 
      data.bond_name.toLowerCase().includes(q) || 
      data.issuer.toLowerCase().includes(q)
    )
    .map(([isin, data]) => ({ isin, data }));

  return NextResponse.json({ results });
}
