import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BankLogo from "@/components/ui/bank-logo";
import { getBankDomain, searchBanks } from "@/lib/banks";

describe("Bank Domain Resolution", () => {
  it("resolves domain for exact bank names and abbreviations", () => {
    expect(getBankDomain("State Bank of India")).toBe("sbi.co.in");
    expect(getBankDomain("SBI")).toBe("sbi.co.in");
    expect(getBankDomain("SBI Savings Account")).toBe("sbi.co.in");
    expect(getBankDomain("HDFC Bank")).toBe("hdfcbank.com");
    expect(getBankDomain("ICICI")).toBe("icicibank.com");
    expect(getBankDomain("Axis Bank")).toBe("axisbank.com");
    expect(getBankDomain("Kotak Mahindra Bank")).toBe("kotak.com");
  });

  it("searches banks correctly", () => {
    const sbiResults = searchBanks("SBI");
    expect(sbiResults.length).toBeGreaterThan(0);
    expect(sbiResults[0].domain).toBe("sbi.co.in");

    const hdfcResults = searchBanks("HDFC");
    expect(hdfcResults.length).toBeGreaterThan(0);
    expect(hdfcResults[0].domain).toBe("hdfcbank.com");
  });
});

describe("BankLogo Component", () => {
  it("renders brand initials fallback when image is not loaded", () => {
    render(<BankLogo bankName="State Bank of India" accountName="SBI Salary" size={40} />);
    const initialsElement = screen.getByText("SBI");
    expect(initialsElement).toBeDefined();
  });

  it("renders brand abbreviation for HDFC Bank", () => {
    render(<BankLogo bankName="HDFC Bank" size={40} />);
    const initialsElement = screen.getByText("HDFC");
    expect(initialsElement).toBeDefined();
  });

  it("renders generic placeholder icon when queryName is empty", () => {
    const { container } = render(<BankLogo bankName="" accountName="" size={40} />);
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeDefined();
  });

  it("updates initials correctly when props change", () => {
    const { rerender } = render(<BankLogo bankName="SBI" size={40} />);
    expect(screen.getByText("SBI")).toBeDefined();

    rerender(<BankLogo bankName="ICICI Bank" size={40} />);
    expect(screen.getByText("ICICI")).toBeDefined();
  });
});
