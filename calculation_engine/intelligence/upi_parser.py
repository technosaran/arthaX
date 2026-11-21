"""
Financial Calculation Engine - UPI Narration Parser
Extracts structured components (mode, reference, counterparty, VPA) from Indian UPI bank narrations.
"""

import re
from typing import Dict, Any, Optional


VPA_REGEX = re.compile(r"([a-zA-Z0-9.\-_]{2,50}@[a-zA-Z]{2,30})")
UPI_RRN_REGEX = re.compile(r"\b(\d{12})\b")


KNOWN_MERCHANTS = {
    "AMAZON": ("Amazon", "Shopping"),
    "SWIGGY": ("Swiggy", "Food & Dining"),
    "ZOMATO": ("Zomato", "Food & Dining"),
    "VODAFON": ("Vodafone", "Bills & Utilities"),
    "VODAFONE": ("Vodafone", "Bills & Utilities"),
    "GOOGLE": ("Google Pay", "Payment Gateway"),
    "PAYTM": ("Paytm", "Payment Gateway"),
    "ONE MOBI": ("Mobikwik", "Payment Gateway"),
    "FLIPKART": ("Flipkart", "Shopping"),
    "UBER": ("Uber", "Transport"),
    "OLA": ("Ola", "Transport"),
    "AIRTEL": ("Airtel", "Bills & Utilities"),
    "JIO": ("Jio", "Bills & Utilities"),
}


def clean_upi_counterparty(raw_name: str) -> str:
    """Cleans broken spacing and normalizes merchant and individual names."""
    if not raw_name:
        return "UPI Transfer"

    clean = raw_name.strip()
    upper = clean.upper()

    for prefix, (brand, _) in KNOWN_MERCHANTS.items():
        if prefix in upper:
            return brand

    clean = re.sub(r"(?i)\bHemakum\s*ar\b", "Hemakumar", clean)
    clean = re.sub(r"(?i)\bVODAFON\s*E\b", "Vodafone", clean)
    clean = re.sub(r"(?i)\bSWIGGY\s*I\b", "Swiggy", clean)
    clean = re.sub(r"(?i)\bAmazon\s*B\b", "Amazon", clean)
    clean = re.sub(r"(?i)\bSA\s*Engin\b", "SA Engineering", clean)
    clean = re.sub(r"(?i)\bBunk\s*Shop\b", "Bunk Shop", clean)
    clean = re.sub(r"(?i)\bJam\s*Jam\b", "Jam Jam Store", clean)
    clean = re.sub(r"(?i)\bNaidu\s*ho\b", "Naidu Hotel", clean)
    clean = re.sub(r"(?i)\bSelva\s*ho\b", "Selva Hotel", clean)
    clean = re.sub(r"(?i)\bOne\s*Mobi\b", "Mobikwik", clean)
    clean = re.sub(r"(?i)\bPoongodi\s*S\b", "Poongodi S", clean)
    clean = re.sub(r"(?i)\bM\s*Muruga\b", "M Murugan", clean)
    clean = re.sub(r"(?i)\bAlbert\s*J\b", "Albert J", clean)
    clean = re.sub(r"(?i)\bMr\s*R\s*Saran\b", "Self Transfer (R Saran)", clean)
    clean = re.sub(r"(?i)\bR\s*VALLI\b", "R Valli", clean)
    clean = re.sub(r"(?i)\bRATHANP\s*R\b", "Rathan P R", clean)
    clean = re.sub(r"(?i)\bBISMILLA\b", "Bismilla", clean)
    clean = re.sub(r"(?i)\bMADURAI\b", "Madurai Store", clean)
    clean = re.sub(r"(?i)\bKALAI\s*SE\b", "Kalai Selvi", clean)
    clean = re.sub(r"(?i)\bMr\s*Ramas\b", "Mr Ramasamy", clean)
    clean = re.sub(r"(?i)\bMr\s*Valla\b", "Mr Vallavan", clean)
    clean = re.sub(r"(?i)\bSAHIL\s*SHA\b", "Sahil Shah", clean)
    clean = re.sub(r"(?i)\bShanthi\s*K\b", "Shanthi K", clean)

    words = clean.split()
    formatted = []
    for w in words:
        if w.upper() in ("MR", "DR", "CR", "TFR", "WDL", "DEP", "UPI"):
            formatted.append(w.capitalize())
        elif len(w) <= 2 and w.isalpha():
            formatted.append(w.upper())
        else:
            formatted.append(w.capitalize())

    return " ".join(formatted)


def parse_upi_narration(narration: str) -> Optional[Dict[str, Any]]:
    """
    Parses complex UPI string and returns structured metadata.
    Returns None if text does not contain UPI signatures.
    """
    upper = narration.upper()
    if "UPI" not in upper and "@" not in narration:
        return None

    vpa_match = VPA_REGEX.search(narration)
    vpa = vpa_match.group(1).lower() if vpa_match else None

    rrn_match = UPI_RRN_REGEX.search(narration)
    rrn = rrn_match.group(1) if rrn_match else None

    # Detect P2M (merchant) vs P2P (person)
    mode = "OTHER"
    if "P2M" in upper or "/P2M/" in upper:
        mode = "P2M"
    elif "P2P" in upper or "/P2P/" in upper:
        mode = "P2P"

    # Extract counterparty name token
    counterparty = None
    parts = narration.replace("\\", "/").split("/")
    if len(parts) >= 4 and any(k in parts[0].upper() for k in ("UPI", "WDL", "DEP", "TFR")):
        # Typically WDL TFR UPI / MODE / RRN / NAME / VPA ...
        candidate = parts[3].strip()
        if candidate and not candidate.isdigit() and "@" not in candidate:
            counterparty = candidate
    elif len(parts) >= 3 and "UPI" in parts[0].upper():
        candidate = parts[2].strip()
        if candidate and not candidate.isdigit() and "@" not in candidate:
            counterparty = candidate
    elif vpa:
        # Prefix of VPA as fallback name
        raw_prefix = vpa.split("@")[0].replace(".", " ")
        counterparty = raw_prefix.title()

    return {
        "channel": "UPI",
        "mode": mode,
        "vpa": vpa,
        "reference_number": rrn,
        "counterparty_name": counterparty,
        "clean_name": clean_upi_counterparty(counterparty) if counterparty else None,
    }
