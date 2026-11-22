import { describe, it, expect } from "vitest";
import { generateBankPasswordPermutations } from "@/utils/bankPasswords";

describe("Automated Bank Password Permutations Generator", () => {
  it("generates authentic SBI passwords from PAN and DOB", () => {
    const permutations = generateBankPasswordPermutations({
      pan: "ABCDE1234F",
      dob: "1995-08-15",
      phone: "9876543210",
      name: "Saran Kumar",
    });

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
    // Indian Bank standard: DDMMYYYY + last 4 of phone
    expect(permutations).toContain("150819953210");
    // Indian Bank standard: last 4 of phone + DDMMYYYY
    expect(permutations).toContain("321015081995");
    // DOB formats
    expect(permutations).toContain("15081995");
    expect(permutations).toContain("150895");
    expect(permutations).toContain("1508");
    // ICICI format: First 4 of name lowercase + DDMM
    expect(permutations).toContain("sara1508");
    // Standalone PAN
    expect(permutations).toContain("ABCDE1234F");
  });

  it("generates authentic Indian Bank passwords including account number", () => {
    const permutations = generateBankPasswordPermutations({
      dob: "15/08/1995",
      phone: "9876543210",
      accountNumber: "50100412345678",
    });

    // Rule 1: Account number
    expect(permutations).toContain("50100412345678");
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
});
