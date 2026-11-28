"""
Financial Calculation Engine - Indian Merchant & Entity Database
Curated directory of Indian merchants, Q-commerce, fuel/EV networks, utility boards,
telecom providers, insurers, SaaS platforms, and financial institutions.
"""

import re
from typing import Dict, Any, Optional, List, Tuple


INDIAN_ENTITIES: Dict[str, Dict[str, Any]] = {
    # Food & Dining
    "SWIGGY": {"name": "Swiggy", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["swiggy@icici", "swiggy@kotak", "swiggy@axis", "swiggy@hdfcbank", "swiggyupi@axisbank"]},
    "ZOMATO": {"name": "Zomato", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["zomato@icici", "zomatopay@icici", "zomato@hdfc", "zomato@hdfcbank", "zomato.rzp@icici"]},
    "EATSURE": {"name": "EatSure", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["eatsure@icici"]},
    "MCDONALDS": {"name": "McDonald's", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["mcdonalds@icici", "mcd@hdfcbank"]},
    "DOMINOS": {"name": "Domino's Pizza", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["dominos@icici", "jubilant@icici"]},
    "PIZZA HUT": {"name": "Pizza Hut", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "STARBUCKS": {"name": "Starbucks", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["starbucks@icici", "tata.starbucks@axis"]},
    "THIRD WAVE": {"name": "Third Wave Coffee", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["thirdwave@icici"]},
    "BLUE TOKAI": {"name": "Blue Tokai", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "KFC": {"name": "KFC", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["kfc@icici"]},
    "BURGER KING": {"name": "Burger King", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["burgerking@icici"]},
    "SUBWAY": {"name": "Subway", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "CHAAYOS": {"name": "Chaayos", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "CHAI POINT": {"name": "Chai Point", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "HALDIRAM": {"name": "Haldiram's", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["haldiram@icici"]},
    "BIKANERVALA": {"name": "Bikanervala", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},

    # Groceries & Quick Commerce
    "BLINKIT": {"name": "Blinkit", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["blinkit@icici", "grofers@icici", "blinkit@hdfcbank"]},
    "ZEPTO": {"name": "Zepto", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["zepto@icici", "zeptopay@icici", "zeptowork@icici"]},
    "INSTAMART": {"name": "Swiggy Instamart", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["instamart@icici"]},
    "BIGBASKET": {"name": "BigBasket", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["bigbasket@icici", "bbdaily@icici", "innovative@icici"]},
    "DMART": {"name": "DMart", "category": "Groceries", "type": "SHOPPING", "vpas": ["dmart@icici", "avenue@icici"]},
    "D-MART": {"name": "DMart", "category": "Groceries", "type": "SHOPPING", "vpas": ["dmart@icici"]},
    "JIOMART": {"name": "JioMart", "category": "Groceries", "type": "SHOPPING", "vpas": ["jiomart@icici", "jiomart@jio"]},
    "NATURE BASKET": {"name": "Nature's Basket", "category": "Groceries", "type": "FOOD_DINING", "vpas": []},
    "SPENCERS": {"name": "Spencer's Retail", "category": "Groceries", "type": "SHOPPING", "vpas": []},
    "COUNTRY DELIGHT": {"name": "Country Delight", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["countrydelight@icici"]},
    "LICIOUS": {"name": "Licious", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["licious@icici"]},

    # Shopping & E-Commerce
    "AMAZON PAY": {"name": "Amazon", "category": "Shopping", "type": "SHOPPING", "vpas": ["amazon@apl", "amazonpay@icici", "amazon@icici", "amazonindia@apl"]},
    "AMAZON": {"name": "Amazon", "category": "Shopping", "type": "SHOPPING", "vpas": ["amazon@apl", "amazonpay@icici", "amazon@icici"]},
    "FLIPKART": {"name": "Flipkart", "category": "Shopping", "type": "SHOPPING", "vpas": ["flipkart@icici", "flipkartpay@axis", "flipkart@axisbank"]},
    "MYNTRA": {"name": "Myntra", "category": "Shopping", "type": "SHOPPING", "vpas": ["myntra@icici", "myntra@axisbank"]},
    "AJIO": {"name": "Ajio", "category": "Shopping", "type": "SHOPPING", "vpas": ["ajio@icici", "reliance@icici"]},
    "MEESHO": {"name": "Meesho", "category": "Shopping", "type": "SHOPPING", "vpas": ["meesho@icici"]},
    "NYKAA": {"name": "Nykaa", "category": "Shopping", "type": "SHOPPING", "vpas": ["nykaa@icici"]},
    "TATA CLIQ": {"name": "Tata CLiQ", "category": "Shopping", "type": "SHOPPING", "vpas": ["tatacliq@icici"]},
    "ZUDIO": {"name": "Zudio", "category": "Shopping", "type": "SHOPPING", "vpas": ["trent@icici"]},
    "WESTSIDE": {"name": "Westside", "category": "Shopping", "type": "SHOPPING", "vpas": []},
    "CROMA": {"name": "Croma", "category": "Electronics", "type": "SHOPPING", "vpas": ["croma@icici"]},
    "RELIANCE DIGITAL": {"name": "Reliance Digital", "category": "Electronics", "type": "SHOPPING", "vpas": []},
    "VIJAY SALES": {"name": "Vijay Sales", "category": "Electronics", "type": "SHOPPING", "vpas": []},
    "IKEA": {"name": "IKEA", "category": "Home & Real Estate", "type": "SHOPPING", "vpas": ["ikea@icici"]},
    "DECATHLON": {"name": "Decathlon", "category": "Sports & Fitness", "type": "SHOPPING", "vpas": ["decathlon@icici"]},
    "LENSKART": {"name": "Lenskart", "category": "Shopping", "type": "SHOPPING", "vpas": ["lenskart@icici"]},
    "PEPPERFRY": {"name": "Pepperfry", "category": "Home & Real Estate", "type": "SHOPPING", "vpas": ["pepperfry@icici"]},
    "TANISHQ": {"name": "Tanishq", "category": "Shopping", "type": "SHOPPING", "vpas": []},

    # Travel, Commute & Fuel
    "UBER": {"name": "Uber", "category": "Transportation", "type": "TRAVEL", "vpas": ["uber@axisbank", "uber@icici", "uberindia@hdfc"]},
    "OLA": {"name": "Ola Cabs", "category": "Transportation", "type": "TRAVEL", "vpas": ["olacabs@icici", "olamoney@icici"]},
    "RAPIDO": {"name": "Rapido", "category": "Transportation", "type": "TRAVEL", "vpas": ["rapido@icici"]},
    "BLUSMART": {"name": "BluSmart", "category": "Transportation", "type": "TRAVEL", "vpas": ["blusmart@icici", "blusmart@axis"]},
    "NAMMA YATRI": {"name": "Namma Yatri", "category": "Transportation", "type": "TRAVEL", "vpas": ["nammayatri@icici"]},
    "DMRC": {"name": "Delhi Metro", "category": "Transportation", "type": "TRAVEL", "vpas": []},
    "BMRCL": {"name": "Namma Metro", "category": "Transportation", "type": "TRAVEL", "vpas": []},
    "IRCTC": {"name": "IRCTC", "category": "Travel", "type": "TRAVEL", "vpas": ["irctc@icici", "irctc@sbi", "irctcpay@icici"]},
    "MAKEMYTRIP": {"name": "MakeMyTrip", "category": "Travel", "type": "TRAVEL", "vpas": ["makemytrip@icici", "mmt@icici"]},
    "GOIBIBO": {"name": "Goibibo", "category": "Travel", "type": "TRAVEL", "vpas": ["goibibo@icici"]},
    "CLEARTRIP": {"name": "Cleartrip", "category": "Travel", "type": "TRAVEL", "vpas": ["cleartrip@icici"]},
    "IXIGO": {"name": "ixigo", "category": "Travel", "type": "TRAVEL", "vpas": ["ixigo@icici"]},
    "INDIGO": {"name": "IndiGo Airlines", "category": "Travel", "type": "TRAVEL", "vpas": ["indigo@icici", "goindigo@icici"]},
    "AIR INDIA": {"name": "Air India", "category": "Travel", "type": "TRAVEL", "vpas": ["airindia@icici"]},
    "AKASA": {"name": "Akasa Air", "category": "Travel", "type": "TRAVEL", "vpas": []},
    "REDBUS": {"name": "RedBus", "category": "Travel", "type": "TRAVEL", "vpas": ["redbus@icici"]},
    "RED BUS": {"name": "RedBus", "category": "Travel", "type": "TRAVEL", "vpas": ["redbus@icici"]},
    "AIRBNB": {"name": "Airbnb", "category": "Travel", "type": "TRAVEL", "vpas": []},
    "FASTAG": {"name": "NETC FASTag", "category": "Transportation", "type": "TRAVEL", "vpas": ["netc.fastag@icici", "fastag@paytm"]},
    "INDIAN OIL": {"name": "IndianOil", "category": "Transportation", "type": "FUEL", "vpas": ["iocl@icici"]},
    "IOCL": {"name": "IndianOil", "category": "Transportation", "type": "FUEL", "vpas": ["iocl@icici"]},
    "BPCL": {"name": "Bharat Petroleum", "category": "Transportation", "type": "FUEL", "vpas": ["bpcl@icici"]},
    "HPCL": {"name": "Hindustan Petroleum", "category": "Transportation", "type": "FUEL", "vpas": ["hpcl@icici"]},
    "SHELL FUEL": {"name": "Shell Fuel", "category": "Transportation", "type": "FUEL", "vpas": ["shell@icici"]},
    "SHELL PETROL": {"name": "Shell Fuel", "category": "Transportation", "type": "FUEL", "vpas": ["shell@icici"]},

    # Software, SaaS & AI
    "OPENAI": {"name": "OpenAI / ChatGPT", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CHATGPT": {"name": "OpenAI / ChatGPT", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "GITHUB": {"name": "GitHub", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CURSOR": {"name": "Cursor AI", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "ANTHROPIC": {"name": "Anthropic Claude", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CLAUDE": {"name": "Anthropic Claude", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "VERCEL": {"name": "Vercel", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "AWS": {"name": "Amazon Web Services", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "GOOGLE CLOUD": {"name": "Google Cloud", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CANVA": {"name": "Canva", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "FIGMA": {"name": "Figma", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "NOTION": {"name": "Notion", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "ADOBE": {"name": "Adobe", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "URBAN COMPANY": {"name": "Urban Company", "category": "Home & Personal Care", "type": "MERCHANT_EXPENSE", "vpas": ["urbancompany@icici", "urbanclap@icici"]},

    # Utilities & Telecom
    "BESCOM": {"name": "BESCOM Electricity", "category": "Utilities", "type": "UTILITIES", "vpas": ["bescom@icici"]},
    "TNEB": {"name": "TANGEDCO / TNEB", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "TANGEDCO": {"name": "TANGEDCO / TNEB", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "TATA POWER": {"name": "Tata Power", "category": "Utilities", "type": "UTILITIES", "vpas": ["tatapower@icici"]},
    "MAHAVITARAN": {"name": "MSEDCL Electricity", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "MSEDCL": {"name": "MSEDCL Electricity", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "BSES": {"name": "BSES Electricity", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "BWSSB": {"name": "BWSSB Water", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "JIOFIBER": {"name": "JioFiber", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "AIRTEL XSTREAM": {"name": "Airtel Xstream", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "AIRTEL": {"name": "Airtel", "category": "Utilities", "type": "UTILITIES", "vpas": ["airtel@airtel", "airtelbills@icici", "airtelpayments@axl"]},
    "JIO": {"name": "Reliance Jio", "category": "Utilities", "type": "UTILITIES", "vpas": ["jio@icici", "reljio@icici"]},
    "VODAFONE": {"name": "Vi (Vodafone Idea)", "category": "Utilities", "type": "UTILITIES", "vpas": ["vi@icici"]},
    "VI POSTPAID": {"name": "Vi Postpaid", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "BSNL": {"name": "BSNL", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "ADANI GAS": {"name": "Adani Total Gas", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "MAHANAGAR GAS": {"name": "Mahanagar Gas", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "INDRAPRASTHA GAS": {"name": "Indraprastha Gas", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "ACT FIBERNET": {"name": "ACT Fibernet", "category": "Utilities", "type": "UTILITIES", "vpas": ["act@icici"]},
    "TATA PLAY": {"name": "Tata Play DTH", "category": "Utilities", "type": "UTILITIES", "vpas": []},

    # Investments, Broking & Insurance
    "ZERODHA COIN": {"name": "Zerodha Coin", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["coin@icici"]},
    "ZERODHA": {"name": "Zerodha", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["zerodha@icici", "zerodha@hdfc", "zerodha.broking@hdfcbank"]},
    "GROWW": {"name": "Groww", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["groww@icici", "groww@axis", "groww@hdfcbank"]},
    "UPSTOX": {"name": "Upstox", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["upstox@icici"]},
    "ANGEL ONE": {"name": "Angel One", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["angelone@icici"]},
    "PPFAS": {"name": "PPFAS Mutual Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "ICCL": {"name": "BSE Star MF / ICCL", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["iccl@icici", "bsestarmf@icici"]},
    "CAMS": {"name": "CAMS Mutual Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "KFINTECH": {"name": "KFintech Mutual Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "INDMONEY": {"name": "INDmoney", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["indmoney@icici"]},
    "KUVERA": {"name": "Kuvera", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "SAFEGOLD": {"name": "SafeGold Bullion", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "MMTC-PAMP": {"name": "MMTC-PAMP Bullion", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "LIC OF INDIA": {"name": "LIC Insurance", "category": "Insurance", "type": "INSURANCE", "vpas": []},
    "HDFC LIFE": {"name": "HDFC Life Insurance", "category": "Insurance", "type": "INSURANCE", "vpas": []},
    "ICICI PRUDENTIAL": {"name": "ICICI Prudential", "category": "Insurance", "type": "INSURANCE", "vpas": []},
    "SBI LIFE": {"name": "SBI Life Insurance", "category": "Insurance", "type": "INSURANCE", "vpas": []},
    "STAR HEALTH": {"name": "Star Health Insurance", "category": "Insurance", "type": "INSURANCE", "vpas": []},
    "ACKO": {"name": "Acko Insurance", "category": "Insurance", "type": "INSURANCE", "vpas": ["acko@icici"]},

    # Credit Card & Bill Payments
    "CRED": {"name": "CRED", "category": "Credit Card Payment", "type": "CREDIT_CARD_PAYMENT", "vpas": ["cred@axisbank", "cred@icici", "cred.club@axisbank"]},
    "BILLDESK": {"name": "BillDesk", "category": "Utilities", "type": "MERCHANT_EXPENSE", "vpas": ["billdesk@icici"]},
    "RAZORPAY": {"name": "Razorpay", "category": "Payment Gateway", "type": "MERCHANT_EXPENSE", "vpas": ["razorpay@icici", "rzp@icici"]},
    "PAYTM": {"name": "Paytm", "category": "Payment Gateway", "type": "MERCHANT_EXPENSE", "vpas": ["paytm@paytm"]},
    "PHONEPE": {"name": "PhonePe", "category": "Payment Gateway", "type": "MERCHANT_EXPENSE", "vpas": ["phonepe@ybl", "phonepe@axl"]},
    "GPAY": {"name": "Google Pay", "category": "Payment Gateway", "type": "MERCHANT_EXPENSE", "vpas": ["gpay@okaxis", "gpay@okhdfcbank"]},

    # Entertainment & Subscriptions
    "NETFLIX": {"name": "Netflix", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["netflix@icici"]},
    "SPOTIFY": {"name": "Spotify", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["spotify@icici"]},
    "HOTSTAR": {"name": "Disney+ Hotstar", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["hotstar@icici"]},
    "PRIME VIDEO": {"name": "Amazon Prime", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": []},
    "BOOKMYSHOW": {"name": "BookMyShow", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["bms@icici", "bookmyshow@icici"]},
    "PVR": {"name": "PVR Cinemas", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["pvr@icici"]},
    "INOX": {"name": "INOX Leisure", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["inox@icici"]},
    "YOUTUBE": {"name": "YouTube Premium", "category": "Entertainment", "type": "MERCHANT_EXPENSE", "vpas": ["google@icici"]},
    "APPLE SERVICES": {"name": "Apple Services", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": ["apple@icici"]},
    "APPLE.COM": {"name": "Apple Services", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "GOOGLE PLAY": {"name": "Google Play", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},

    # Housing & Rent
    "NOBROKER": {"name": "NoBroker", "category": "Rent & Housing", "type": "RENT", "vpas": ["nobroker@icici"]},
    "MYGATE": {"name": "MyGate Maintenance", "category": "Rent & Housing", "type": "RENT", "vpas": ["mygate@icici"]},
    "APNACOMPLEX": {"name": "ApnaComplex", "category": "Rent & Housing", "type": "RENT", "vpas": []},

    # Health & Fitness
    "CULT.FIT": {"name": "Cult.fit", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": ["curefit@icici"]},
    "CUREFIT": {"name": "Cult.fit", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": ["curefit@icici"]},
    "APOLLO": {"name": "Apollo Pharmacy", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": ["apollo@icici"]},
    "1MG": {"name": "Tata 1mg", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": ["1mg@icici"]},
    "PHARMEASY": {"name": "PharmEasy", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": ["pharmeasy@icici"]},
    "NETMEDS": {"name": "Netmeds", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": ["netmeds@icici"]},
    "MEDPLUS": {"name": "MedPlus", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": []},
    "PRACTO": {"name": "Practo", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": []},
    "THYROCARE": {"name": "Thyrocare", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": []},
    "DR LAL PATHLABS": {"name": "Dr Lal PathLabs", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": []},

    # Taxes & Government
    "CBDT": {"name": "Income Tax Department", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "CHALLAN 280": {"name": "Income Tax Challan", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "TIN NSDL": {"name": "Income Tax / TIN NSDL", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "GST": {"name": "GST Payment", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "EPFO": {"name": "Employees Provident Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
}

# Precompile longest-first patterns with word boundaries to eliminate substring collisions
_COMPILED_ENTITY_PATTERNS: List[Tuple[str, re.Pattern[str], Dict[str, Any]]] = [
    (
        key,
        re.compile(r"(?<![A-Z0-9])" + re.escape(key) + r"(?![A-Z0-9])"),
        entity,
    )
    for key, entity in sorted(INDIAN_ENTITIES.items(), key=lambda kv: len(kv[0]), reverse=True)
]

_VPA_LOOKUP: Dict[str, Dict[str, Any]] = {}
for _entity in INDIAN_ENTITIES.values():
    for _vpa in _entity.get("vpas", []):
        _VPA_LOOKUP[_vpa.lower().strip()] = _entity


def lookup_merchant_by_name(text: str) -> Optional[Dict[str, Any]]:
    """Finds best-matching merchant definition in narration using word boundaries and longest key first."""
    if not text:
        return None
    upper = text.upper()
    for _, pattern, entity in _COMPILED_ENTITY_PATTERNS:
        if pattern.search(upper):
            return entity
    return None


def lookup_merchant_by_vpa(vpa: str) -> Optional[Dict[str, Any]]:
    """Finds merchant by exact UPI VPA handle or normalized VPA prefix."""
    if not vpa:
        return None
    clean_vpa = vpa.lower().strip()
    if clean_vpa in _VPA_LOOKUP:
        return _VPA_LOOKUP[clean_vpa]

    prefix = clean_vpa.split("@")[0]
    prefix_clean = re.sub(r"[^a-z0-9]", "", prefix)
    for entity in INDIAN_ENTITIES.values():
        canonical = re.sub(r"[^a-z0-9]", "", entity["name"].lower())
        if prefix_clean == canonical or prefix_clean.startswith(canonical) and len(canonical) >= 4:
            return entity
    return None
