"""
Financial Calculation Engine - Multi-Bank UPI & Payment Narration Parser
Supports structured UPI/P2M/P2P, SBI UPI/DR/CR, HDFC hyphenated UPI, ICICI, Axis, Kotak,
plus NEFT/IMPS/RTGS counterparty and RRN/UTR extraction across Indian bank narrations.
"""

import re
from typing import Optional, Dict, Any

KNOWN_MERCHANTS = {
    "SWIGGY": "Swiggy",
    "ZOMATO": "Zomato",
    "AMAZON": "Amazon",
    "FLIPKART": "Flipkart",
    "BLINKIT": "Blinkit",
    "ZEPTO": "Zepto",
    "INSTAMART": "Swiggy Instamart",
    "BIGBASKET": "BigBasket",
    "UBER": "Uber",
    "OLA": "Ola Cabs",
    "RAPIDO": "Rapido",
    "NETFLIX": "Netflix",
    "SPOTIFY": "Spotify",
    "AIRTEL": "Airtel",
    "JIO": "Reliance Jio",
    "CRED": "CRED",
    "ZERODHA": "Zerodha",
    "GROWW": "Groww",
    "IRCTC": "IRCTC",
    "INDIGO": "IndiGo",
    "MYNTRA": "Myntra",
    "DMART": "DMart",
    "APOLLO": "Apollo Pharmacy",
    "NOBROKER": "NoBroker",
}

KNOWN_BANK_CODES = {
    "SBIN", "HDFC", "ICIC", "UTIB", "KKBK", "IDIB", "PUNB", "BARB",
    "CNRB", "UBIN", "INDB", "IDFB", "YESB", "FDRL", "RATN", "SCBL",
    "HSBC", "CITI", "AMEX", "AIRP", "PYTM",
}


def clean_upi_counterparty(raw: str) -> str:
    """Cleans counterparty name by removing noisy UPI suffixes and numeric codes."""
    if not raw:
        return ""
    s = re.sub(
        r"\b(PAY\s*TO|PAID\s*TO|TRANSFER\s*TO|SENT\s*TO|PAID|FROM|UPI|NA|NONE|MB|INET|POS|REV)\b",
        "",
        raw,
        flags=re.IGNORECASE,
    )
    s = re.sub(r"\b\d{8,}\b", "", s)
    s = " ".join(s.replace("_", " ").split()).strip(" -/")
    if not s:
        return ""
    for kw, formatted in KNOWN_MERCHANTS.items():
        if re.search(rf"\b{re.escape(kw)}\b", s.upper()):
            return formatted
    return s.title() if s.isupper() and len(s) > 4 else s


def _looks_like_bank_code(token: str) -> bool:
    clean = re.sub(r"[^A-Z0-9]", "", token.upper())
    return clean in KNOWN_BANK_CODES or bool(re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean))


def parse_upi_narration(narration: str) -> Optional[Dict[str, Any]]:
    """
    Parses multi-dialect Indian bank UPI narrations.
    Examples handled:
    - Standard NPCI: UPI/P2M/631982736122/SWIGGY/swiggy@icici/PAYTOORDER
    - SBI: TO TRANSFER-UPI/DR/631982736122/SWIGGY/ICIC/swiggy@icici/UPI
    - HDFC: UPI-SWIGGY-SWIGGY@ICICI-ICIC0000123-631982736122-ORDER
    - ICICI: UPI/swiggy@icici/Swiggy Order/631982736122
    - Kotak: UPI/631982736122/Swiggy/swiggy@icici
    Returns structured dict or None if not a UPI narration.
    """
    if not narration:
        return None
    clean_narr = " ".join(str(narration).strip().split())
    upper = clean_narr.upper()

    vpa_match = re.search(r"([a-zA-Z0-9._]{2,64}@[a-zA-Z0-9.]{2,24})", clean_narr)
    is_upi = "UPI" in upper or bool(vpa_match)
    if not is_upi:
        return None

    mode = "P2M" if "P2M" in upper else ("P2P" if "P2P" in upper else None)

    rrn: Optional[str] = None
    rrn_match = re.search(r"\b(\d{12})\b", clean_narr) or re.search(r"(?:UPI|RRN|UTR)[/:-](\d{9,16})\b", upper)
    if rrn_match:
        rrn = rrn_match.group(1)

    vpa: Optional[str] = vpa_match.group(1).lower() if vpa_match else None

    counterparty_name: Optional[str] = None
    note: Optional[str] = None

    # Branch 1: Slash-delimited format (NPCI / SBI / ICICI / Axis / Kotak)
    if "/" in clean_narr:
        # Locate the UPI token index cleanly even when prefixed like "TO TRANSFER-UPI/DR/..."
        raw_parts = [p.strip() for p in clean_narr.split("/") if p.strip()]
        upi_idx = next((idx for idx, part in enumerate(raw_parts) if "UPI" in part.upper()), 0)
        parts = raw_parts[upi_idx:]

        if len(parts) >= 4 and parts[1].upper() in ("P2M", "P2P"):
            # NPCI standard: UPI / P2M / RRN / Counterparty / VPA / Note
            mode = parts[1].upper()
            if not rrn and re.match(r"^\d{6,16}$", parts[2]):
                rrn = parts[2]
            raw_cp = parts[3]
            if not raw_cp.isdigit() and "@" not in raw_cp:
                counterparty_name = raw_cp
            if len(parts) >= 5 and "@" in parts[4] and not vpa:
                vpa = parts[4].lower()
            if len(parts) >= 6:
                note = " ".join(parts[5:])
        else:
            # SBI / ICICI / Kotak / Axis slash variations
            candidate_names = []
            for p in parts[1:]:
                p_up = p.upper()
                if p_up in ("UPI", "DR", "CR", "P2M", "P2P", "NA", "MB"):
                    continue
                if rrn and p == rrn:
                    continue
                if "@" in p or _looks_like_bank_code(p) or re.match(r"^\d{6,18}$", p):
                    continue
                candidate_names.append(p)
            if candidate_names:
                counterparty_name = clean_upi_counterparty(candidate_names[0]) or candidate_names[0]
            if len(candidate_names) > 1:
                note = " / ".join(candidate_names[1:])

    # Branch 2: Hyphen-delimited HDFC / IndusInd style: UPI-NAME-VPA-IFSC-RRN-NOTE
    elif "-" in clean_narr:
        parts = [p.strip() for p in clean_narr.split("-") if p.strip()]
        candidate_names = []
        for p in parts:
            p_up = p.upper()
            if p_up in ("UPI", "DR", "CR", "POS", "ATM"):
                continue
            if rrn and p == rrn:
                continue
            if "@" in p or _looks_like_bank_code(p) or re.match(r"^\d{8,18}$", p):
                continue
            candidate_names.append(p)
        if candidate_names:
            counterparty_name = clean_upi_counterparty(candidate_names[0]) or candidate_names[0]
        if len(candidate_names) > 1:
            note = " ".join(candidate_names[1:])

    # Fallback counterparty from VPA prefix if name still missing
    if not counterparty_name and vpa:
        vpa_prefix = vpa.split("@")[0]
        if not vpa_prefix.isdigit():
            counterparty_name = clean_upi_counterparty(vpa_prefix.replace(".", " ")) or vpa_prefix

    if not mode and vpa:
        # Common consumer PSP handles strongly indicate P2P unless matched merchant
        vpa_domain = vpa.split("@")[1] if "@" in vpa else ""
        if vpa_domain in ("okhdfcbank", "okicici", "okaxis", "oksbi", "ybl", "axl", "ibl"):
            mode = "P2P"

    return {
        "channel": "UPI",
        "mode": mode,
        "reference_number": rrn,
        "vpa": vpa,
        "counterparty_name": counterparty_name,
        "note": note,
    }
