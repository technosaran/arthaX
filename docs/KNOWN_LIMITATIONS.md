# ArthaX Known Limitations & Future Roadmap

## 1. Current Architectural Limits

### 1.1 Live Market Data & Real-Time Feeds
- **Current Behavior**: ArthaX computes holdings and valuations based on the latest available closing prices, manual entry prices, or Kite API sync snapshots. Live intraday streaming tickers (e.g. WebSocket tick feeds) are intentionally not embedded directly into the browser to avoid high battery and bandwidth drain on mobile clients.
- **Future Enhancement**: Optional opt-in WebSocket feeds for active equity and crypto intraday trading desks.

### 1.2 Multi-Currency Portfolio Valuation
- **Current Behavior**: The platform natively supports INR as the primary base currency with dynamic USD/INR FX conversions for cryptocurrency holdings and global accounts.
- **Future Enhancement**: Full user-selectable multi-base currency mode (e.g. viewing total net worth natively in USD, EUR, or GBP with historical FX rate conversion tables).

### 1.3 Tax Engine Jurisdiction Scope
- **Current Behavior**: Statutory capital gains tax and tax-loss harvesting rules are calibrated for the **Indian Income Tax Act, 1961 (FY 2024-25 / AY 2025-26 under Union Budget 2024)**.
- **Future Enhancement**: Pluggable jurisdictional tax engines for US (IRS Form 8949 / Schedule D), UK (HMRC Capital Gains), and UAE (Corporate / Individual Tax).

### 1.4 Automated Bank Statement Parsing
- **Current Behavior**: Statement parser processes standard CSV and Excel formats from major Indian banks (HDFC, ICICI, SBI, Axis). Password-protected PDFs must be unlocked before parsing.
- **Future Enhancement**: Direct Account Aggregator (AA) framework integration via RBI-licensed NBFC-AAs (e.g., Setu, OneMoney) for zero-upload bank sync.
