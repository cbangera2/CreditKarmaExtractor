function convertDateFormat(inputDate) {
    var parsedDate = new Date(inputDate);
    var day = ("0" + parsedDate.getDate()).slice(-2);
    var month = ("0" + (parsedDate.getMonth() + 1)).slice(-2);
    var year = parsedDate.getFullYear();
    var newDateFormat = month + "/" + day + "/" + year;
    return newDateFormat;
}

function extractNumber(inputString) {
    var match = inputString.match(/^-?\$?(\d{1,3}(,\d{3})*(\.\d+)?|\.\d+)$/);
    if (match) {
        var numberString = match[1].replace(/,/g, '');
        var extractedNumber = parseFloat(numberString);
        return inputString.startsWith('-') ? -extractedNumber : extractedNumber;
    }
    return NaN;
}

function extractAmount(element) {
    const selector1 = '.row-value div:nth-child(1)';
    const selector2 = '.f4.fw5.kpl-color-palette-green-50 div:nth-child(1)';
    let amountElement = element.querySelector(selector1);
    let temp = '';
    if (amountElement) {
        temp = amountElement.textContent.trim();
    } else {
        amountElement = element.querySelector(selector2);
        temp = amountElement ? amountElement.textContent.trim() : '';
    }
    return extractNumber(temp);
}

function extractTransactionInfo(element) {
    const transactionInfo = {
        dataIndex: '',
        description: '',
        category: '',
        amount: '',
        date: ''
    };
    transactionInfo.dataIndex = element.getAttribute('data-index');
    const descriptionElement = element.querySelector('.row-title div:nth-child(1)');
    transactionInfo.description = descriptionElement ? descriptionElement.textContent.trim() : '';
    const categoryElement = element.querySelector('.row-title div:nth-child(2)');
    transactionInfo.category = categoryElement ? categoryElement.textContent.trim() : '';
    transactionInfo.amount = extractAmount(element);
    transactionInfo.transactionType = transactionInfo.amount >= 0 ? 'credit' : 'debit';
    transactionInfo.amount = Math.abs(transactionInfo.amount);
    const dateElement = element.querySelector('.row-value div:nth-child(2), .f4.fw5.kpl-color-palette-green-50 div:nth-child(2)');
    transactionInfo.date = dateElement ? dateElement.textContent.trim() : '';
    return transactionInfo;
}

function extractAllTransactions() {
    const transactionElements = document.querySelectorAll('[data-index]');
    return Array.from(transactionElements, element => extractTransactionInfo(element));
}

function combineTransactions(existingTransactions, newTransactions) {
    const uniqueNewTransactions = newTransactions.filter(newTransaction =>
        !existingTransactions.some(existingTransaction => existingTransaction.dataIndex === newTransaction.dataIndex)
    );
    return [...existingTransactions, ...uniqueNewTransactions];
}

function filterEmptyTransactions(transactions) {
    return transactions.filter(transaction =>
        transaction.amount !== null && transaction.amount !== undefined && transaction.date !== ''
    );
}

function convertToCSV(transactions) {
    const header = 'Date,Description,Amount,Category,Transaction Type,Account Name,Labels,Notes\n';
    const rows = transactions.map(transaction =>
        `"${convertDateFormat(transaction.date)}","${transaction.description}","${transaction.amount}","${transaction.category}","${transaction.transactionType}",,,\n`
    );
    return header + rows.join('');
}

function saveCSVToFile(csvData, fileName) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}

function logResults(allTransactions, filteredTransactions, csvData) {
    console.log('Filtered Transactions:', filteredTransactions);
    console.log('CSV Data:', csvData);
}

function scrollDown() {
    window.scrollTo(0, window.scrollY + window.innerHeight);
}

async function captureTransactionsInDateRange(startDate, endDate) {
    let allTransactions = [];
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    let lastTransactionCount = 0;
    let unchangedCount = 0;
    
    while (true) {
        const newTransactions = extractAllTransactions();
        allTransactions = combineTransactions(allTransactions, newTransactions);
        
        // Check if we've reached a date before our start date
        const hasReachedPriorDate = newTransactions.some(transaction => {
            const transactionDateTime = new Date(transaction.date).getTime();
            return transactionDateTime < startDateTime;
        });
        
        // If we haven't gotten any new transactions in 3 attempts, break
        if (newTransactions.length === lastTransactionCount) {
            unchangedCount++;
            if (unchangedCount >= 3) {
                break;
            }
        } else {
            unchangedCount = 0;
        }
        
        lastTransactionCount = newTransactions.length;
        
        // Only break if we've reached a date before our start date
        if (hasReachedPriorDate) {
            break;
        }
        
        if (newTransactions.length === 0) {
            break;
        }
        
        scrollDown();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const filteredTransactions = allTransactions.filter(transaction => {
        const transactionDateTime = new Date(transaction.date).getTime();
        return transactionDateTime >= startDateTime && transactionDateTime <= endDateTime;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { allTransactions, filteredTransactions };
}

// Listener for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureTransactions') {
        const { startDate, endDate, csvTypes } = request;
        
        // Capture transactions first
        captureTransactionsInDateRange(startDate, endDate).then(({ allTransactions, filteredTransactions }) => {
            // Conditionally save CSV files based on checkbox states
            if (csvTypes.allTransactions) {
                const allCsvData = convertToCSV(filteredTransactions);
                saveCSVToFile(allCsvData, `all_transactions_${startDate.replace(/\//g, '-')}_to_${endDate.replace(/\//g, '-')}.csv`);
            }

            if (csvTypes.income) {
                const creditTransactions = filteredTransactions.filter(transaction => transaction.transactionType === 'credit');
                const creditCsvData = convertToCSV(creditTransactions);
                saveCSVToFile(creditCsvData, `income_${startDate.replace(/\//g, '-')}_to_${endDate.replace(/\//g, '-')}.csv`);
            }

            if (csvTypes.expenses) {
                const debitTransactions = filteredTransactions.filter(transaction => transaction.transactionType === 'debit');
                const debitCsvData = convertToCSV(debitTransactions);
                saveCSVToFile(debitCsvData, `expenses_${startDate.replace(/\//g, '-')}_to_${endDate.replace(/\//g, '-')}.csv`);
            }
        });
        
        sendResponse({status: 'started'});
    }
});
