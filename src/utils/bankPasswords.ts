/**
 * Automated Indian Bank Statement Password Generator
 * Generates all standard password permutations for SBI, HDFC, ICICI, Axis, Kotak, PNB, etc.
 * from user's Date of Birth (DOB), PAN Number, Phone Number, and Name.
 */

export interface BankingIdentityDetails {
  dob?: string | null;       // Formats: "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", "DDMMYYYY"
  pan?: string | null;       // e.g. "ABCDE1234F"
  phone?: string | null;     // e.g. "9876543210", "+919876543210"
  name?: string | null;      // e.g. "Saran Kumar"
  accountNumber?: string | null; // e.g. "123456789012"
}

interface ParsedDOB {
  dd: string;
  mm: string;
  yyyy: string;
  yy: string;
}

function parseDOB(raw?: string | null): ParsedDOB | null {
  if (!raw) return null;
  const clean = raw.trim();
  if (!clean) return null;

  // Handle YYYY-MM-DD or YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const yyyy = ymd[1];
    const mm = ymd[2].padStart(2, "0");
    const dd = ymd[3].padStart(2, "0");
    return { dd, mm, yyyy, yy: yyyy.slice(-2) };
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return { dd, mm, yyyy, yy: yyyy.slice(-2) };
  }

  // Handle DDMMYYYY (8 digits)
  const dmyDigits = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (dmyDigits) {
    const dd = dmyDigits[1];
    const mm = dmyDigits[2];
    const yyyy = dmyDigits[3];
    return { dd, mm, yyyy, yy: yyyy.slice(-2) };
  }

  return null;
}

/**
 * Generates all candidate password permutations for Indian bank PDFs.
 */
export function generateBankPasswordPermutations(identity: BankingIdentityDetails): string[] {
  const candidates = new Set<string>();

  const dob = parseDOB(identity.dob);
  const pan = (identity.pan || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const phoneDigits = (identity.phone || "").replace(/\D/g, "");
  const phoneLast4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : "";
  const phoneLast5 = phoneDigits.length >= 5 ? phoneDigits.slice(-5) : "";

  const rawName = (identity.name || "").trim().replace(/[^a-zA-Z]/g, "");
  const name4 = rawName.slice(0, 4);

  // 1. Phone + DOB combinations (SBI standard, Indian Bank, Bank of Baroda)
  if (dob) {
    const ddmm = `${dob.dd}${dob.mm}`;
    const mmdd = `${dob.mm}${dob.dd}`;
    const ddmmyyyy = `${dob.dd}${dob.mm}${dob.yyyy}`;
    const ddmmyy = `${dob.dd}${dob.mm}${dob.yy}`;
    const yyyymmdd = `${dob.yyyy}${dob.mm}${dob.dd}`;

    // SBI standard: DDMM + last 5 of mobile, and reverse (e.g. 150843210, 432101508)
    if (phoneLast5) {
      candidates.add(`${ddmm}${phoneLast5}`);
      candidates.add(`${phoneLast5}${ddmm}`);
      candidates.add(`${phoneLast5}${ddmmyy}`);
      candidates.add(`${phoneLast5}${ddmmyyyy}`);
    }
    if (phoneLast4) {
      // SBI & Indian Bank: DDMM + phoneLast4, phoneLast4 + DDMM
      candidates.add(`${ddmm}${phoneLast4}`);
      candidates.add(`${phoneLast4}${ddmm}`);
      // Indian Bank standard: DDMMYYYY + phoneLast4, and reverse (e.g. 150819953210, 321015081995)
      candidates.add(`${ddmmyyyy}${phoneLast4}`);
      candidates.add(`${phoneLast4}${ddmmyyyy}`);
      candidates.add(`${phoneLast4}${ddmmyy}`);
    }

    // 2. PAN + DOB combinations (Standard SBI Netbanking, Axis, HDFC)
    if (pan.length >= 5) {
      const pan5Upper = pan.slice(0, 5);
      const pan5Lower = pan5Upper.toLowerCase();
      const pan4Upper = pan.slice(0, 4);
      const pan4Lower = pan4Upper.toLowerCase();

      // SBI Netbanking: First 5 of PAN + DDMM (e.g. ABCDE1508)
      candidates.add(`${pan5Upper}${ddmm}`);
      candidates.add(`${pan5Lower}${ddmm}`);
      candidates.add(`${pan4Upper}${ddmm}`);
      candidates.add(`${pan4Lower}${ddmm}`);
      candidates.add(`${pan5Upper}${dob.dd}`);
      candidates.add(`${pan5Upper}${ddmmyyyy}`);
      candidates.add(`${pan5Upper}${ddmmyy}`);
    }

    // 3. Name + DOB combinations (Standard ICICI, Axis)
    if (name4.length >= 4) {
      const name4Lower = name4.toLowerCase();
      const name4Upper = name4.toUpperCase();
      const name4Cap = name4.charAt(0).toUpperCase() + name4.slice(1).toLowerCase();

      // ICICI Primary: First 4 letters of name + DDMM (e.g. sara1508)
      candidates.add(`${name4Lower}${ddmm}`);
      candidates.add(`${name4Upper}${ddmm}`);
      candidates.add(`${name4Cap}${ddmm}`);
      candidates.add(`${name4Lower}${ddmmyyyy}`);
      candidates.add(`${name4Lower}${dob.dd}`);
    }

    // 4. DOB standalone variations (HDFC, Axis, PNB)
    candidates.add(ddmmyyyy);
    candidates.add(ddmmyy);
    candidates.add(ddmm);
    candidates.add(yyyymmdd);
    candidates.add(mmdd);
  }

  // 5. Standalone PAN (HDFC, Kotak, Axis)
  if (pan) {
    candidates.add(pan);
    candidates.add(pan.toLowerCase());
  }

  // 6. Standalone Phone numbers (PNB, BOB)
  if (phoneLast4) {
    candidates.add(phoneLast4);
  }
  if (phoneLast5) {
    candidates.add(phoneLast5);
  }

  // 7. Standalone Account Number (Indian Bank Rule 1)
  if (identity.accountNumber) {
    const cleanAcc = identity.accountNumber.trim();
    if (cleanAcc) {
      candidates.add(cleanAcc);
    }
  }

  return Array.from(candidates);
}
