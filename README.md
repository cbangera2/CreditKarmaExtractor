# Credit Karma Transaction Extractor Chrome Extension

![GitHub stars](https://img.shields.io/github/stars/cbangera2/CreditKarmaExtractor?style=social)
![GitHub forks](https://img.shields.io/github/forks/cbangera2/CreditKarmaExtractor?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/cbangera2/CreditKarmaExtractor?style=social)
![GitHub repo size](https://img.shields.io/github/repo-size/cbangera2/CreditKarmaExtractor)
![GitHub language count](https://img.shields.io/github/languages/count/cbangera2/CreditKarmaExtractor)
![GitHub top language](https://img.shields.io/github/languages/top/cbangera2/CreditKarmaExtractor)
![GitHub last commit](https://img.shields.io/github/last-commit/cbangera2/CreditKarmaExtractor?color=red)

The **Credit Karma Transaction Extractor** Chrome extension allows you to easily export your Credit Karma transactions to CSV format for analysis in your preferred financial tools. Whether you're tracking expenses, analyzing spending patterns, or maintaining financial records, this extension streamlines the data extraction process.

## Screenshots

<img width="335" alt="Extension Interface" src="https://github.com/user-attachments/assets/c03e0761-0c7a-46a7-ad83-b9afd5c6e051">

## Features

- **Date Range Selection**: Choose specific start and end dates for transaction export
- **Smart Data Export**: Automatically generates three CSV files:
  - `all_transactions.csv`: Complete transaction history
  - `expenses.csv`: Debit transactions only
  - `income.csv`: Credit transactions only
- **Dark Mode Support**: Seamless experience in both light and dark themes
- **Automatic Scrolling**: Intelligently scrolls through all transactions in the selected date range
- **CSV Format**: Export data in a format compatible with popular financial tools

## Quick Start

1. **Install the Extension**:
   - Clone this repository or download the files
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select the extension directory

2. **Export Transactions**:
   - Go to [Credit Karma Transactions](https://www.creditkarma.com/networth/transactions)
   - Click the extension icon
   - Select your date range
   - Click "Export" and wait for the files to download

## Analyze Your Data

After exporting, you have several options to analyze your transactions:

1. **[BudgetLens](https://github.com/cbangera2/BudgetLens)**: Modern web dashboard for visualizing your financial data
2. **[TMOAP Budget Tool](https://themeasureofaplan.com/budget-tracking-tool/)**: Comprehensive spreadsheet for detailed financial analysis
3. Import into your preferred spreadsheet or financial software

## Changelog

### Version 1.1 (December 2024)
- Added dark mode support with toggle switch
- Improved date range scrolling functionality
- Enhanced UI with modern design and better organization
- Added quick links to analysis tools
- Fixed cross-month date range scrolling issues
- Improved security with updated content security policy
- Enhanced responsive design for better usability

### Version 1.0 (May 2024)
- Initial release
- Basic transaction extraction functionality
- Date range selection
- CSV export capability
- Auto-scrolling feature

## Troubleshooting

If you encounter issues:

1. **No Data Extracted**
   - Verify you're logged into Credit Karma
   - Ensure you're on the correct transactions page
   - Check if the date range is valid

2. **Scrolling Issues**
   - Try selecting a smaller date range
   - Refresh the page and try again
   - Check console for any error messages

## Roadmap

- Transaction search and filtering
- Additional export formats (JSON, Excel)
- Smart transaction categorization
- Progress indicator during extraction
- Batch processing for multiple date ranges
- Enhanced error handling and recovery
- Custom category mapping

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

For major changes, please open an issue first to discuss the proposed changes.


## Credits

- Developed by [Chirag Bangera](https://github.com/cbangera2).
---
*This extension is not affiliated with or endorsed by Credit Karma.