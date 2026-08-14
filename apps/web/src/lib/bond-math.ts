export type InterestFrequency = "Monthly" | "Quarterly" | "Semi-Annual" | "Annual" | "Cumulative";

export interface BondCashflow {
  date: string;
  type: "Interest" | "Principal";
  amount: number;
}

export function calculateAccruedInterest(
  faceValue: number,
  quantity: number,
  couponRatePercent: number,
  lastInterestDateStr: string,
  currentDateStr: string = new Date().toISOString().split("T")[0]
): number {
  if (couponRatePercent <= 0) return 0;

  const lastDate = new Date(lastInterestDateStr);
  const currentDate = new Date(currentDateStr);
  
  if (currentDate <= lastDate) return 0;

  // Exact days calculation
  const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // (Face Value * Quantity) * (Coupon Rate / 100) * (Days / 365)
  const totalPrincipal = faceValue * quantity;
  const annualInterest = totalPrincipal * (couponRatePercent / 100);
  const accrued = annualInterest * (diffDays / 365);
  
  return accrued;
}

export function generateRepaymentSchedule(
  purchaseDateStr: string,
  maturityDateStr: string,
  faceValue: number,
  quantity: number,
  couponRatePercent: number,
  frequency: InterestFrequency
): BondCashflow[] {
  const purchaseDate = new Date(purchaseDateStr);
  const maturityDate = new Date(maturityDateStr);
  
  if (maturityDate <= purchaseDate) return [];

  const totalPrincipal = faceValue * quantity;
  const annualInterest = totalPrincipal * (couponRatePercent / 100);
  
  let monthsIncrement = 12;
  let interestPerPayout = annualInterest;

  if (frequency === "Monthly") {
    monthsIncrement = 1;
    interestPerPayout = annualInterest / 12;
  } else if (frequency === "Quarterly") {
    monthsIncrement = 3;
    interestPerPayout = annualInterest / 4;
  } else if (frequency === "Semi-Annual") {
    monthsIncrement = 6;
    interestPerPayout = annualInterest / 2;
  } else if (frequency === "Cumulative") {
    // Only paid at maturity
    monthsIncrement = 0; 
  }

  const cashflows: BondCashflow[] = [];
  
  if (frequency !== "Cumulative") {
    let nextPayout = new Date(purchaseDate);
    nextPayout.setMonth(nextPayout.getMonth() + monthsIncrement);
    
    // Normalize to handle end of month issues (basic approach)
    while (nextPayout < maturityDate) {
      cashflows.push({
        date: nextPayout.toISOString().split("T")[0],
        type: "Interest",
        amount: interestPerPayout
      });
      nextPayout = new Date(nextPayout);
      nextPayout.setMonth(nextPayout.getMonth() + monthsIncrement);
    }
  }

  // Final payout at maturity (Principal + final interest if any)
  if (frequency === "Cumulative") {
    // Calculate compound interest or simple interest for cumulative
    // Assuming simple interest for the whole duration for simplicity if cumulative
    const diffTime = Math.abs(maturityDate.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalInterest = annualInterest * (diffDays / 365);
    
    cashflows.push({
      date: maturityDate.toISOString().split("T")[0],
      type: "Interest",
      amount: totalInterest
    });
  } else {
    // Add the final fractional interest or regular interest at maturity
    const lastRegularPayout = cashflows.length > 0 ? new Date(cashflows[cashflows.length - 1].date) : purchaseDate;
    const diffTime = Math.abs(maturityDate.getTime() - lastRegularPayout.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const finalInterest = annualInterest * (diffDays / 365);
    
    cashflows.push({
      date: maturityDate.toISOString().split("T")[0],
      type: "Interest",
      amount: finalInterest
    });
  }
  
  // Principal repayment
  cashflows.push({
    date: maturityDate.toISOString().split("T")[0],
    type: "Principal",
    amount: totalPrincipal
  });

  return cashflows;
}
