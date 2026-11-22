import { describe, it, expect } from "vitest";
import {
  generateBankPasswordPermutations,
  getBankPasswordFormatDescription,
} from "@/utils/bankPasswords";

describe("Automated Bank Password Permutations Generator", () => {
  it("generates authentic SBI passwords from PAN and DOB including YONO @ format", () => {
    const permutations = generateBankPasswordPermutations({
      pan: "ABCDE1234F",
      dob: "1995-08-15",
      phone: "9876543210",
      name: "Saran Kumar",
    });

    // SBI YONO format: DDMM@phoneLast4, DDMM@phoneLast5, reverse, and DDMMYYYY@phoneLast4
    expect(permutations).toContain("1508@3210");
    expect(permutations).toContain("3210@1508");
    expect(permutations).toContain("1508@43210");
    expect(permutations).toContain("43210@1508");
    expect(permutations).toContain("15081995@3210");
    expect(permutations).toContain("3210@15081995");

    // SBI Credit Card & Indian Bank: DDMMYYYY + phoneLast4, and reverse
    expect(permutations).toContain("150819953210");
    expect(permutations).toContain("321015081995");

    // SBI primary: First 5 of PAN uppercase + DDMM
    expect(permutations).toContain("ABCDE1508");
    // SBI primary: First 5 of PAN lowercase + DDMM
    expect(permutations).toContain("abcde1508");
    // SBI standard: DDMM + last 5 of phone
    expect(permutations).toContain("150843210");
    // SBI standard: last 5 of phone + DDMM
    expect(permutations).toContain("432101508");
    // SBI standard: DDMM + last 4 of phone
    expect(permutations).toContain("15083210");
    // SBI standard: last 4 of phone + DDMM
    expect(permutations).toContain("32101508");
    // DOB formats
    expect(permutations).toContain("15081995");
    expect(permutations).toContain("150895");
    expect(permutations).toContain("1508");
    // ICICI format: First 4 of name lowercase + DDMM
    expect(permutations).toContain("sara1508");
    // Standalone PAN
    expect(permutations).toContain("ABCDE1234F");
  });

  it("generates authentic Indian Bank and Axis passwords including account number combinations", () => {
    const permutations = generateBankPasswordPermutations({
      name: "Saran Kumar",
      pan: "ABCDE1234F",
      dob: "15/08/1995",
      phone: "9876543210",
      accountNumber: "50100412345678",
    });

    // Rule 1: Account number
    expect(permutations).toContain("50100412345678");
    expect(permutations).toContain("5678");
    expect(permutations).toContain("45678");

    // Axis Bank format: First 4 letters of name uppercase + last 4 of account number
    expect(permutations).toContain("SARA5678");
    expect(permutations).toContain("sara5678");

    // Account Number + DOB combinations
    expect(permutations).toContain("15085678");
    expect(permutations).toContain("56781508");
    expect(permutations).toContain("150819955678");
    expect(permutations).toContain("567815081995");

    // Account Number + PAN combinations
    expect(permutations).toContain("ABCDE5678");
    expect(permutations).toContain("5678ABCDE");

    // Rule 2: DDMMYYYY + last 4 of phone
    expect(permutations).toContain("150819953210");
    // Reverse: last 4 of phone + DDMMYYYY
    expect(permutations).toContain("321015081995");
    // SBI standard permutations
    expect(permutations).toContain("150843210");
    expect(permutations).toContain("432101508");
  });

  it("handles DD/MM/YYYY and DD-MM-YYYY formats properly", () => {
    const permsSlash = generateBankPasswordPermutations({
      pan: "XYZPA9999K",
      dob: "05/12/1990",
    });
    expect(permsSlash).toContain("XYZPA0512");
    expect(permsSlash).toContain("05121990");

    const permsDash = generateBankPasswordPermutations({
      pan: "XYZPA9999K",
      dob: "05-12-1990",
    });
    expect(permsDash).toContain("XYZPA0512");
  });

  it("returns human-friendly bank password format descriptions", () => {
    expect(getBankPasswordFormatDescription("SBI")).toBe(
      "SBI YONO format is 4 digits of DOB (DDMM) + '@' + last 4 digits of mobile (e.g., 0101@9876). SBI NetBanking format is DDMM + last 5 digits of mobile, or PAN."
    );
    expect(getBankPasswordFormatDescription("State Bank of India")).toBe(
      "SBI YONO format is 4 digits of DOB (DDMM) + '@' + last 4 digits of mobile (e.g., 0101@9876). SBI NetBanking format is DDMM + last 5 digits of mobile, or PAN."
    );
    expect(getBankPasswordFormatDescription("HDFC Bank")).toBe(
      "Customer ID, PAN (uppercase), or first 4 letters of name in lowercase + DDMM."
    );
    expect(getBankPasswordFormatDescription("ICICI")).toBe(
      "First 4 letters of name in lowercase + DDMM (e.g. sara1508)."
    );
    expect(getBankPasswordFormatDescription("Axis")).toBe(
      "10-digit PAN in uppercase, or first 4 letters of name in uppercase + last 4 digits of account number."
    );
    expect(getBankPasswordFormatDescription("Indian Bank")).toBe(
      "Full account number, or DDMMYYYY + last 4 digits of mobile."
    );
    expect(getBankPasswordFormatDescription("Kotak Mahindra Bank")).toBe(
      "CRN (Customer Relationship Number) or DDMMYYYY."
    );
    expect(getBankPasswordFormatDescription("Unknown Bank")).toBe(
      "Standard formats include PAN (uppercase), DOB (DDMMYYYY or DDMM), or combinations of Name/DOB/mobile/account number."
    );
  });
});
