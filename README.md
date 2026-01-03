# Credit Karma Transaction Extractor Chrome Extension

![GitHub stars](https://img.shields.io/github/stars/cbangera2/CreditKarmaExtractor?style=social)
![GitHub forks](https://img.shields.io/github/forks/cbangera2/CreditKarmaExtractor?style=social)
![GitHub top language](https://img.shields.io/github/languages/top/cbangera2/CreditKarmaExtractor)
![GitHub last commit](https://img.shields.io/github/last-commit/cbangera2/CreditKarmaExtractor?color=red)

The **Credit Karma Transaction Extractor** allows you to instantly export your entire transaction history from Credit Karma to CSV.

**🎉 New in v2.0:** I've completely rewritten the engine. It now uses Credit Karma's internal API (GraphQL) to fetch thousands of transactions in seconds, capturing details like Account Names, Categories, and Merchant info that were previously inaccessible or required slow manual scraping.

## Features

- **Instant Extraction**: Uses the specific `GetTransactions` API to fetch data 100x faster than scrolling.
- **Deep History**: Easily download transactions from years ago without waiting for the page to load.
- **Customizable Output**: Choose exactly which columns you want (Date, Description, Amount, Category, Type, Account, Notes, Labels).
- **Modern UI**: Beautiful interface with Dark Mode support and Quick Date presets (YTD, Last Year).
- **Instant Stop**: Cancel huge extractions immediately without losing data—what you've fetched is saved.
- **Smart Export**: Automatically generates `All Data`, `Income Only`, and `Expenses Only` files.

## Quick Start

1. **Install the Extension**:
   - Clone this repository or download the files.
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** (top right toggle).
   - Click **Load unpacked** and select the extension directory.

2. **Export Transactions**:
   - Go to [Credit Karma Transactions](https://www.creditkarma.com/networth/transactions).
   - Click the extension icon.
   - Select your date range (or click "Last Year").
   - Click **Export Transactions**.
   - Watch the progress indicator and wait for your CSV files!

## Analyze Your Data

Once you have your CSVs, you can use them with:

1. **[BudgetLens](https://github.com/cbangera2/BudgetLens)**: Modern web dashboard for visualizing your financial data.
2. **[TMOAP Budget Tool](https://themeasureofaplan.com/budget-tracking-tool/)**: Comprehensive spreadsheet for detailed financial analysis.
3. Any spreadsheet software (Excel, Google Sheets, Numbers).

## Changelog

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

Contributions are welcome! Feel free to:
1. Fork the repository.
2. Create a feature branch.
3. Submit a pull request.

## Credits

- Developed by [Chirag Bangera](https://github.com/cbangera2).
- Not affiliated with or endorsed by Credit Karma.
