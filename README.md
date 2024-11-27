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

## Screenshots

<img width="338" alt="image" src="https://github.com/cbangera2/CreditKarmaExtractor/assets/18430740/881aae4c-ec2a-498e-b3fd-a64c88c4fb1f">

## Troubleshooting

- **No Data Extracted**: Ensure you are logged into Credit Karma and on the transactions page (`https://www.creditkarma.com/networth/transactions`).
- **Errors**: If you encounter any errors, check the console for error messages or reload the extension.

## Credits

- Developed by [Chirag Bangera](https://github.com/cbangera2).
