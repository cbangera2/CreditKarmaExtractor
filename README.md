# Credit Karma Transaction Extractor Chrome Extension

![GitHub stars](https://img.shields.io/github/stars/cbangera2/CreditKarmaExtractor?style=social)
![GitHub forks](https://img.shields.io/github/forks/cbangera2/CreditKarmaExtractor?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/cbangera2/CreditKarmaExtractor?style=social)
![GitHub repo size](https://img.shields.io/github/repo-size/cbangera2/CreditKarmaExtractor)
![GitHub language count](https://img.shields.io/github/languages/count/cbangera2/CreditKarmaExtractor)
![GitHub top language](https://img.shields.io/github/languages/top/cbangera2/CreditKarmaExtractor)
![GitHub last commit](https://img.shields.io/github/last-commit/cbangera2/CreditKarmaExtractor?color=red)

The **Credit Karma Transaction Extractor** Chrome extension allows users to extract transaction data from Credit Karma and save it as a CSV file. This extension is particularly useful for users who need to analyze their financial transactions or import them into other financial management tools.

## Features

- **Date Range Extraction**: Users can specify a start and end month to extract transactions within a specific date range.
- **CSV Export**: Extracted transactions are saved as CSV files, making it easy to analyze or import data into spreadsheets or financial software.
- **User Interface**: Provides a simple popup interface with controls to start and stop extraction.
- **BudgetLens Integration**: The exported CSV files are fully compatible with [BudgetLens](https://github.com/cbangera2/BudgetLens), a modern financial dashboard that provides powerful visualization and analysis of your Credit Karma transaction data.

## Installation

To install and use the extension:

1. **Download Extension Files**:
   - Clone or download the extension files from the repository.

2. **Load the Extension in Chrome**:
   - Open Google Chrome and go to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click on "Load unpacked" and select the directory where you cloned or downloaded the extension files.

3. **Usage**:
   - Navigate to `https://www.creditkarma.com/networth/transactions` in a Chrome tab.
   - Click on the extension icon to open the popup.
   - Select a start and end month for the transactions you want to extract.
   - Click "Start Extraction" to begin extracting transactions.
   - Click "Stop Extraction" if you want to stop the extraction process.
   - Will download 3 files (all_transactions.csv, expenses.csv, and income.csv)
   - Import exported data to a budget tracker my favorite is linked here: [TMOAP V4.2](https://themeasureofaplan.com/budget-tracking-tool/)
   - Use [BudgetLens](https://github.com/cbangera2/BudgetLens) to visualize and analyze your Credit Karma transaction data with an intuitive, modern dashboard interface

## Screenshots

<img width="335" alt="image" src="https://github.com/user-attachments/assets/c03e0761-0c7a-46a7-ad83-b9afd5c6e051">


## Troubleshooting

- **No Data Extracted**: Ensure you are logged into Credit Karma and on the transactions page (`https://www.creditkarma.com/networth/transactions`).
- **Errors**: If you encounter any errors, check the console for error messages or reload the extension.

## TODO

Future improvements planned for the extension:

- **Dark Mode Support**: Add dark mode detection and filtering for better transaction extraction in dark mode
- **Transaction Categories**: Add support for extracting and preserving Credit Karma's transaction categories
- **Auto-Categorization**: Implement smart transaction categorization based on merchant names
- **Export Format Options**: Support additional export formats beyond CSV (e.g., JSON, Excel)
- **Real-time Progress**: Add a progress indicator during extraction
- **Error Recovery**: Implement automatic retry mechanism for failed extractions
- **Search & Filter**: Add ability to search and filter transactions before export
- **Batch Processing**: Support for processing multiple date ranges in one go

Feel free to contribute to any of these features or suggest new ones by creating an issue or pull request!

## Credits

- Developed by [Chirag Bangera](https://github.com/cbangera2).
