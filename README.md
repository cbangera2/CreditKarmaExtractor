# Credit Karma Data Extractor Chrome Extension

[![Build Extension](https://github.com/cbangera2/CreditKarmaExtractor/actions/workflows/build-extension.yml/badge.svg)](https://github.com/cbangera2/CreditKarmaExtractor/actions/workflows/build-extension.yml)
![GitHub stars](https://img.shields.io/github/stars/cbangera2/CreditKarmaExtractor?style=social)
![GitHub forks](https://img.shields.io/github/forks/cbangera2/CreditKarmaExtractor?style=social)
![GitHub top language](https://img.shields.io/github/languages/top/cbangera2/CreditKarmaExtractor)
![GitHub last commit](https://img.shields.io/github/last-commit/cbangera2/CreditKarmaExtractor?color=red)

The **Credit Karma Data Extractor** exports transaction history, net worth history, and investment values from Credit Karma to CSV.

## Screenshots
<img width="373" height="572" alt="image" src="https://github.com/user-attachments/assets/bc8268f8-3093-4caf-92ba-3e5e596516bb" />

## Features

- **Instant Extraction**: Uses the specific `GetTransactions` API to fetch data 100x faster than scrolling.
- **Deep History**: Easily download transactions from years ago without waiting for the page to load.
- **Customizable Output**: Choose exactly which columns you want (Date, Description, Amount, Category, Type, Account, Notes, Labels).
- **Modern UI**: Beautiful interface with Dark Mode support and Quick Date presets (YTD, Last Year).
- **Instant Stop**: Cancel huge extractions immediately without losing data—what you've fetched is saved.
- **Smart Export**: Automatically generates `All Data`, `Income Only`, and `Expenses Only` files.
- **Wealth History**: Export the full Net Worth and Investment graph series as separate, date-filtered CSV files.
- **Current Net Worth Breakdown**: Export current Cash, Investments, Property, Credit cards, and Loans totals to `net_worth_breakdown_<date>.csv`, plus available cash, investment, and property source balances to `wealth_accounts_<date>.csv`. These snapshots are not filtered by the selected historical date range.

## Quick Start

1. **Install the Extension**:
   - Clone this repository or download the files.
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** (top right toggle).
   - Click **Load unpacked** and select the extension directory.

2. **Export Data**:
   - Go to [Credit Karma Transactions](https://www.creditkarma.com/networth/transactions).
   - Click the extension icon.
   - Select your date range (or click "Last Year").
   - Choose the transaction and/or wealth-history files to generate. **Net Worth History + Current Details** creates the total history plus current asset/debt segment totals and the detailed source rows Credit Karma makes available.
   - Choose **Current Details Only** when you want the current breakdown and account balances without a historical date range.
   - Click **Export Selected Data**.
   - Watch the progress indicator and wait for your CSV files!

## Analyze Your Data

Once you have your CSVs, you can use them with:

1. **[BudgetLens](https://github.com/cbangera2/BudgetLens)**: Modern web dashboard for visualizing your financial data.
2. **[TMOAP Budget Tool](https://themeasureofaplan.com/budget-tracking-tool/)**: Comprehensive spreadsheet for detailed financial analysis.
3. Any spreadsheet software (Excel, Google Sheets, Numbers).

## Changelog

### Version 2.2 (July 2026)
- Added current snapshot exports for Cash, Investments, Property, Credit cards, and Loans totals, plus individual cash, investment, and property sources. Credit Karma's captured responses do not provide per-source history, so these files are intentionally independent of the date-range fields.

### Version 2.1 (July 2026)
- Added separate CSV exports for Net Worth and Investment graph values.
- Wealth exports use the complete graph dataset and respect the selected date range.
- Updated transaction exports to preserve user-corrected categories through the paginated `transactionsHub` API, with safer pagination and a fallback for incomplete responses—thanks to [@CarterDunn](https://github.com/CarterDunn) for the contribution.
- Added automatic content-script reinjection and a raw API JSON debug export for easier troubleshooting.

### Version 2.0 (January 2026)
- **Major Rewrite**: Switched to GraphQL API-based extraction.
- **New UI**: Complete visual overhaul with Cards, Dark Mode, and compact layout.
- **Column Selection**: Users can now filter specific columns from the CSV.
- **Performance**: Extraction is now near-instantaneous.
- **Robustness**: Better error handling and "Instant Stop" functionality using AbortController.

### Version 1.2 (March 2025)
- Added real-time transaction counter.
- Basic "Stop" functionality.
- Adaptive scrolling speeds.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, pull request guidelines, and instructions for safely recording a sanitized HAR when investigating Credit Karma API changes.

## Credits

- Developed by [Chirag Bangera](https://github.com/cbangera2).
- Not affiliated with or endorsed by Credit Karma.
