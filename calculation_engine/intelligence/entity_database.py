"""
Financial Calculation Engine - Indian Merchant & Entity Database
Curated directory of 200+ Indian merchants, platforms, utility boards, and financial institutions.
"""

from typing import Dict, Any, Optional


INDIAN_ENTITIES: Dict[str, Dict[str, Any]] = {
    # Food & Dining
    "SWIGGY": {"name": "Swiggy", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["swiggy@icici", "swiggy@kotak", "swiggy@axis"]},
    "ZOMATO": {"name": "Zomato", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["zomato@icici", "zomatopay@icici", "zomato@hdfc"]},
    "BLINKIT": {"name": "Blinkit", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["blinkit@icici", "grofers@icici"]},
    "ZEPTO": {"name": "Zepto", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["zepto@icici", "zeptopay@icici"]},
    "INSTAMART": {"name": "Swiggy Instamart", "category": "Groceries", "type": "FOOD_DINING", "vpas": []},
    "BIGBASKET": {"name": "BigBasket", "category": "Groceries", "type": "FOOD_DINING", "vpas": ["bigbasket@icici", "bbdaily@icici"]},
    "MCDONALDS": {"name": "McDonald's", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["mcdonalds@icici"]},
    "DOMINOS": {"name": "Domino's Pizza", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["dominos@icici"]},
    "STARBUCKS": {"name": "Starbucks", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["starbucks@icici", "tata.starbucks@axis"]},
    "KFC": {"name": "KFC", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["kfc@icici"]},
    "BURGER KING": {"name": "Burger King", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": ["burgerking@icici"]},
    "SUBWAY": {"name": "Subway", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "CHAAYOS": {"name": "Chaayos", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},
    "CHAI POINT": {"name": "Chai Point", "category": "Food & Dining", "type": "FOOD_DINING", "vpas": []},

    # Shopping & E-Commerce
    "AMAZON": {"name": "Amazon", "category": "Shopping", "type": "SHOPPING", "vpas": ["amazon@apl", "amazonpay@icici", "amazon@icici"]},
    "FLIPKART": {"name": "Flipkart", "category": "Shopping", "type": "SHOPPING", "vpas": ["flipkart@icici", "flipkartpay@axis"]},
    "MYNTRA": {"name": "Myntra", "category": "Shopping", "type": "SHOPPING", "vpas": ["myntra@icici"]},
    "AJIO": {"name": "Ajio", "category": "Shopping", "type": "SHOPPING", "vpas": ["ajio@icici", "reliance@icici"]},
    "MEESHO": {"name": "Meesho", "category": "Shopping", "type": "SHOPPING", "vpas": ["meesho@icici"]},
    "NYKAA": {"name": "Nykaa", "category": "Shopping", "type": "SHOPPING", "vpas": ["nykaa@icici"]},
    "TATA CLIQ": {"name": "Tata CLiQ", "category": "Shopping", "type": "SHOPPING", "vpas": ["tatacliq@icici"]},
    "CROMĀ": {"name": "Croma", "category": "Electronics", "type": "SHOPPING", "vpas": ["croma@icici"]},
    "CROMA": {"name": "Croma", "category": "Electronics", "type": "SHOPPING", "vpas": ["croma@icici"]},
    "RELIANCE DIGITAL": {"name": "Reliance Digital", "category": "Electronics", "type": "SHOPPING", "vpas": []},
    "IKEA": {"name": "IKEA", "category": "Home & Real Estate", "type": "SHOPPING", "vpas": ["ikea@icici"]},
    "DECATHLON": {"name": "Decathlon", "category": "Sports & Fitness", "type": "SHOPPING", "vpas": ["decathlon@icici"]},
    "DMART": {"name": "DMart", "category": "Groceries", "type": "SHOPPING", "vpas": ["dmart@icici", "avenue@icici"]},
    "D-MART": {"name": "DMart", "category": "Groceries", "type": "SHOPPING", "vpas": ["dmart@icici"]},

    # Travel & Commute
    "UBER": {"name": "Uber", "category": "Transportation", "type": "TRAVEL", "vpas": ["uber@axisbank", "uber@icici", "uberindia@hdfc"]},
    "OLA": {"name": "Ola Cabs", "category": "Transportation", "type": "TRAVEL", "vpas": ["olacabs@icici", "olamoney@icici"]},
    "RAPIDO": {"name": "Rapido", "category": "Transportation", "type": "TRAVEL", "vpas": ["rapido@icici"]},
    "BLUSMART": {"name": "BluSmart", "category": "Transportation", "type": "TRAVEL", "vpas": ["blusmart@icici", "blusmart@axis"]},
    "NAMMA YATRI": {"name": "Namma Yatri", "category": "Transportation", "type": "TRAVEL", "vpas": ["nammayatri@icici"]},
    "IRCTC": {"name": "IRCTC", "category": "Travel", "type": "TRAVEL", "vpas": ["irctc@icici", "irctc@sbi", "irctcpay@icici"]},
    "MAKEMYTRIP": {"name": "MakeMyTrip", "category": "Travel", "type": "TRAVEL", "vpas": ["makemytrip@icici", "mmt@icici"]},
    "GOIBIBO": {"name": "Goibibo", "category": "Travel", "type": "TRAVEL", "vpas": ["goibibo@icici"]},
    "CLEARTRIP": {"name": "Cleartrip", "category": "Travel", "type": "TRAVEL", "vpas": ["cleartrip@icici"]},
    "INDIGO": {"name": "IndiGo Airlines", "category": "Travel", "type": "TRAVEL", "vpas": ["indigo@icici", "goindigo@icici"]},
    "AIR INDIA": {"name": "Air India", "category": "Travel", "type": "TRAVEL", "vpas": ["airindia@icici"]},
    "RED BUS": {"name": "RedBus", "category": "Travel", "type": "TRAVEL", "vpas": ["redbus@icici"]},
    "REDBUS": {"name": "RedBus", "category": "Travel", "type": "TRAVEL", "vpas": ["redbus@icici"]},
    "FASTAG": {"name": "NETC FASTag", "category": "Transportation", "type": "TRAVEL", "vpas": ["netc.fastag@icici"]},

    # Software, SaaS & AI
    "OPENAI": {"name": "OpenAI / ChatGPT", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CHATGPT": {"name": "OpenAI / ChatGPT", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "GITHUB": {"name": "GitHub", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CURSOR": {"name": "Cursor AI", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CLAUDE": {"name": "Anthropic Claude", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "VERCEL": {"name": "Vercel", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "AWS": {"name": "Amazon Web Services", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "GOOGLE CLOUD": {"name": "Google Cloud Platform", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "CANVA": {"name": "Canva", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": []},
    "URBAN COMPANY": {"name": "Urban Company", "category": "Home & Personal Care", "type": "MERCHANT_EXPENSE", "vpas": ["urbancompany@icici", "urbanclap@icici"]},
    "LENSKART": {"name": "Lenskart", "category": "Shopping", "type": "SHOPPING", "vpas": ["lenskart@icici"]},
    "PEPPERFRY": {"name": "Pepperfry", "category": "Home & Real Estate", "type": "SHOPPING", "vpas": ["pepperfry@icici"]},

    # Utilities & Bills
    "BESCOM": {"name": "BESCOM Electricity", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "TATA POWER": {"name": "Tata Power", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "MAHAVITARAN": {"name": "MSEDCL Electricity", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "AIRTEL": {"name": "Airtel", "category": "Utilities", "type": "UTILITIES", "vpas": ["airtel@airtel", "airtelbills@icici"]},
    "JIO": {"name": "Reliance Jio", "category": "Utilities", "type": "UTILITIES", "vpas": ["jio@icici", "reljio@icici"]},
    "VODAFONE": {"name": "Vi (Vodafone Idea)", "category": "Utilities", "type": "UTILITIES", "vpas": ["vi@icici"]},
    "VI POSTPAID": {"name": "Vi Postpaid", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "ADANI GAS": {"name": "Adani Total Gas", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "IGL": {"name": "Indraprastha Gas", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "MGL": {"name": "Mahanagar Gas", "category": "Utilities", "type": "UTILITIES", "vpas": []},
    "ACT FIBERNET": {"name": "ACT Fibernet", "category": "Utilities", "type": "UTILITIES", "vpas": []},

    # Investments & Broking
    "ZERODHA": {"name": "Zerodha", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["zerodha@icici", "zerodha@hdfc"]},
    "GROWW": {"name": "Groww", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["groww@icici", "groww@axis"]},
    "UPSTOX": {"name": "Upstox", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["upstox@icici"]},
    "ANGEL ONE": {"name": "Angel One", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["angelone@icici"]},
    "CAMS": {"name": "CAMS Mutual Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "KFINTECH": {"name": "KFintech Mutual Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "KFIN": {"name": "KFintech", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "INDMONEY": {"name": "INDmoney", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": ["indmoney@icici"]},
    "KUIDU": {"name": "Kuvera", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
    "COIN": {"name": "Zerodha Coin", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},

    # Credit Card & Bill Payments
    "CRED": {"name": "CRED", "category": "Credit Card Payment", "type": "MERCHANT_EXPENSE", "vpas": ["cred@axisbank", "cred@icici"]},
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
    "APPLE": {"name": "Apple Services", "category": "Software & Services", "type": "MERCHANT_EXPENSE", "vpas": ["apple@icici"]},
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
    "MEDPLUS": {"name": "MedPlus", "category": "Healthcare & Fitness", "type": "MERCHANT_EXPENSE", "vpas": []},

    # Taxes & Government
    "CBDT": {"name": "Income Tax Department", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "CHALLAN 280": {"name": "Income Tax Challan", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "GST": {"name": "GST Payment", "category": "Taxes", "type": "TAX_PAYMENT", "vpas": []},
    "EPFO": {"name": "Employees Provident Fund", "category": "Investments", "type": "INVESTMENT_PURCHASE", "vpas": []},
}


def lookup_merchant_by_name(text: str) -> Optional[Dict[str, Any]]:
    """Finds merchant definition by matching keywords in narration."""
    upper = text.upper()
    for key, entity in INDIAN_ENTITIES.items():
        if key in upper:
            return entity
    return None


def lookup_merchant_by_vpa(vpa: str) -> Optional[Dict[str, Any]]:
    """Finds merchant by UPI VPA handle."""
    clean_vpa = vpa.lower().strip()
    for entity in INDIAN_ENTITIES.values():
        if any(clean_vpa == v.lower() for v in entity.get("vpas", [])):
            return entity
        prefix = clean_vpa.split("@")[0]
        if prefix == entity["name"].lower().replace(" ", "").replace("'", ""):
            return entity
    return None
