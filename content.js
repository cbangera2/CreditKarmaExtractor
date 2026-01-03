function convertDateFormat(inputDate) {
    // Handle various date formats that might appear in Credit Karma
    var parsedDate;
    if (typeof inputDate === 'string') {
        if (inputDate.includes('/')) {
            // Already in MM/DD/YYYY format
            return inputDate;
        } else if (inputDate.includes('-')) {
            // YYYY-MM-DD format
            const parts = inputDate.split('-');
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        } else if (inputDate.match(/[A-Za-z]+\s\d+,\s\d+/)) {
            // Month DD, YYYY format (e.g., "January 15, 2023")
            parsedDate = new Date(inputDate);
        } else if (inputDate.match(/[A-Za-z]+\s\d+/)) {
            // Month DD format without year (e.g., "January 15") - assume current year
            parsedDate = new Date(inputDate + ', ' + new Date().getFullYear());
        } else {
            // Try direct parsing
            parsedDate = new Date(inputDate);
        }
    } else {
        parsedDate = new Date(inputDate);
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
        console.error(`Invalid date format: ${inputDate}`);
        return '';
    }

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
    return Array.from(transactionElements, element => extractTransactionInfo(element))
        // Filter out incomplete transactions (may be still loading)
        .filter(t => t.description || t.amount);
}

function combineTransactions(existingTransactions, newTransactions) {
    // Create a unique key using multiple fields to avoid false deduplication
    // Credit Karma may recycle data-index values for virtual scrolling
    const createTransactionKey = (t) => `${t.description}_${t.amount}_${t.date}_${t.category}`;

    const existingKeys = new Set(existingTransactions.map(createTransactionKey));

    const uniqueNewTransactions = newTransactions.filter(newTransaction => {
        const key = createTransactionKey(newTransaction);
        if (existingKeys.has(key)) {
            return false; // Already have this transaction
        }
        existingKeys.add(key); // Add to set to prevent duplicates within newTransactions
        return true;
    });

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
    // Use moderate scroll increments to balance speed and reliability
    // Credit Karma uses virtual scrolling, so we need some overlap
    const currentPosition = window.scrollY;
    window.scrollTo({
        top: currentPosition + window.innerHeight,
        behavior: 'smooth'
    });
}

// Variable to control scrolling
let stopScrolling = false;

async function captureTransactionsInDateRange(startDate, endDate) {
    console.log(`Starting capture: ${startDate} to ${endDate}`);
    let allTransactions = [];
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    let lastTransactionCount = 0;
    let unchangedCount = 0;
    let scrollAttempts = 0;
    let foundTargetDateRange = false;
    let consecutiveTargetDateMatches = 0;

    // Reset stop flag
    stopScrolling = false;

    // Create stop button - moved to left side
    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop Scrolling';
    stopButton.style.position = 'fixed';
    stopButton.style.bottom = '20px';
    stopButton.style.left = '20px'; // Changed from right to left
    stopButton.style.zIndex = '10000';
    stopButton.style.padding = '10px 20px';
    stopButton.style.backgroundColor = '#ff3b30';
    stopButton.style.color = 'white';
    stopButton.style.border = 'none';
    stopButton.style.borderRadius = '5px';
    stopButton.style.fontWeight = 'bold';
    stopButton.style.cursor = 'pointer';
    stopButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    // Add hover effect
    stopButton.addEventListener('mouseover', () => {
        stopButton.style.backgroundColor = '#d9342b';
    });
    stopButton.addEventListener('mouseout', () => {
        stopButton.style.backgroundColor = '#ff3b30';
    });

    stopButton.addEventListener('click', () => {
        stopScrolling = true;
        stopButton.textContent = 'Stopping...';
        stopButton.style.backgroundColor = '#999';
        stopButton.disabled = true;
    });

    document.body.appendChild(stopButton);

    // Update counter element - moved to left side
    const counterElement = document.createElement('div');
    counterElement.style.position = 'fixed';
    counterElement.style.bottom = '80px';
    counterElement.style.left = '20px'; // Changed from right to left
    counterElement.style.zIndex = '10000';
    counterElement.style.padding = '10px';
    counterElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
    counterElement.style.color = 'white';
    counterElement.style.borderRadius = '5px';
    counterElement.style.fontSize = '14px';
    document.body.appendChild(counterElement);

    try {
        // Helper function to wait for DOM to stabilize after scroll
        const waitForDOMUpdate = async (timeout = 2000) => {
            return new Promise((resolve) => {
                let lastCount = document.querySelectorAll('[data-index]').length;
                let stableCount = 0;
                const checkInterval = 100; // Check every 100ms
                const requiredStableChecks = 3; // DOM must be stable for 3 checks
                let elapsed = 0;

                const check = () => {
                    const currentCount = document.querySelectorAll('[data-index]').length;
                    if (currentCount === lastCount) {
                        stableCount++;
                    } else {
                        stableCount = 0;
                        lastCount = currentCount;
                    }

                    elapsed += checkInterval;

                    if (stableCount >= requiredStableChecks || elapsed >= timeout) {
                        resolve();
                    } else {
                        setTimeout(check, checkInterval);
                    }
                };

                setTimeout(check, checkInterval);
            });
        };

        while (!stopScrolling) {
            scrollAttempts++;
            counterElement.textContent = `Scroll: ${scrollAttempts} | Found: ${allTransactions.length} total | In range: ${allTransactions.filter(t => {
                try {
                    const date = new Date(t.date).getTime();
                    return date >= startDateTime && date <= endDateTime;
                } catch (e) { return false; }
            }).length}`;

            // CRITICAL FIX: Wait for DOM to stabilize BEFORE extracting
            // This ensures lazy-loaded content is fully rendered
            await waitForDOMUpdate();

            const newTransactions = extractAllTransactions();

            // Log every batch of transactions we find
            if (newTransactions.length > 0) {
                console.log(`Found ${newTransactions.length} transactions on this scroll`);

                // Sort transactions by date (newest to oldest)
                const sortedTransactions = [...newTransactions].sort((a, b) => {
                    try {
                        return new Date(b.date).getTime() - new Date(a.date).getTime();
                    } catch (e) {
                        return 0;
                    }
                });

                if (sortedTransactions.length > 0) {
                    console.log(`Newest transaction date: ${sortedTransactions[0].date}`);
                    console.log(`Oldest transaction date: ${sortedTransactions[sortedTransactions.length - 1].date}`);
                }
            }

            allTransactions = combineTransactions(allTransactions, newTransactions);

            // Check if we have any transactions in our target date range
            const transactionsInRange = newTransactions.filter(transaction => {
                try {
                    const transactionDate = new Date(transaction.date);
                    const transactionDateTime = transactionDate.getTime();
                    return transactionDateTime >= startDateTime && transactionDateTime <= endDateTime;
                } catch (e) {
                    console.error(`Error parsing date: ${transaction.date}`, e);
                    return false;
                }
            });

            if (transactionsInRange.length > 0) {
                console.log(`Found ${transactionsInRange.length} transactions in target range on this scroll`);
                foundTargetDateRange = true;
                consecutiveTargetDateMatches++;

                // If we've found transactions in our range for 3 consecutive scrolls, we can use a shorter wait time
                if (consecutiveTargetDateMatches >= 3) {
                    console.log('Found transactions in target range for 3 consecutive scrolls - will speed up scrolling');
                }
            } else {
                consecutiveTargetDateMatches = 0;
            }

            // Determine if we've scrolled past our date range
            let scrolledPastDateRange = false;

            // Find the oldest transaction in the current batch
            const oldestTransaction = newTransactions.reduce((oldest, current) => {
                try {
                    const currentDate = new Date(current.date).getTime();
                    const oldestDate = oldest ? new Date(oldest.date).getTime() : Infinity;
                    return currentDate < oldestDate ? current : oldest;
                } catch (e) {
                    return oldest;
                }
            }, null);

            if (oldestTransaction) {
                try {
                    const oldestDateTime = new Date(oldestTransaction.date).getTime();
                    console.log(`Oldest transaction on this scroll: ${oldestTransaction.date} (${new Date(oldestDateTime).toLocaleDateString()})`);
                    console.log(`Target start date: ${startDate} (${new Date(startDateTime).toLocaleDateString()})`);

                    // Only consider we've scrolled past if:
                    // 1. We've found some transactions in our range already
                    // 2. The oldest transaction is significantly older than our start date (2 weeks)
                    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
                    if (foundTargetDateRange && oldestDateTime < (startDateTime - twoWeeksInMs)) {
                        scrolledPastDateRange = true;
                        console.log('Scrolled past target date range by at least 2 weeks');
                    }
                } catch (e) {
                    console.error(`Error comparing dates: ${oldestTransaction.date}`, e);
                }
            }

            // Stop conditions:
            // 1. If we've found transactions in our range AND we've scrolled past our date range
            // 2. If we haven't gotten new transactions in several attempts
            if (foundTargetDateRange && scrolledPastDateRange) {
                console.log('Found target date range and scrolled past it, stopping scroll');
                break;
            }

            // Break if we're not getting any new transactions after several tries
            if (allTransactions.length === lastTransactionCount) {
                unchangedCount++;
                console.log(`No new transactions found. Unchanged count: ${unchangedCount}/5`);
                if (unchangedCount >= 5) {
                    console.log('No new transactions after 5 attempts, stopping scroll');
                    break;
                }
            } else {
                unchangedCount = 0;
                console.log(`Found ${allTransactions.length - lastTransactionCount} new transactions`);
            }

            lastTransactionCount = allTransactions.length;

            // Scroll down and adjust wait time based on whether we've found transactions in our range
            scrollDown();

            // Adaptive wait time - shorter if we've already found some transactions in our range
            const waitTime = (foundTargetDateRange && consecutiveTargetDateMatches >= 3) ? 1000 : 1500;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    } finally {
        // Clean up UI elements
        document.body.removeChild(stopButton);
        document.body.removeChild(counterElement);
    }

    console.log(`Total transactions found: ${allTransactions.length}`);

    // Filter transactions by date range
    const filteredTransactions = allTransactions.filter(transaction => {
        try {
            const transactionDateTime = new Date(transaction.date).getTime();
            const isInRange = transactionDateTime >= startDateTime && transactionDateTime <= endDateTime;

            // For debugging
            if (isInRange) {
                console.log(`Transaction in range: ${transaction.date}, ${transaction.description}, $${transaction.amount}`);
            }

            return isInRange;
        } catch (e) {
            console.error(`Error filtering transaction date: ${transaction.date}`, e);
            return false;
        }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`Filtered transactions: ${filteredTransactions.length}`);

    return { allTransactions, filteredTransactions };
}

// Listener for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureTransactions') {
        try {
            const { startDate, endDate, csvTypes } = request;
            console.log(`Received request to capture transactions from ${startDate} to ${endDate}`);

            // Create a visual indicator that scraping is in progress - moved to left side
            const indicator = document.createElement('div');
            indicator.style.position = 'fixed';
            indicator.style.top = '10px';
            indicator.style.left = '20px'; // Changed from right to left
            indicator.style.padding = '10px 20px';
            indicator.style.background = 'rgba(0, 0, 0, 0.8)';
            indicator.style.color = 'white';
            indicator.style.borderRadius = '5px';
            indicator.style.zIndex = '9999';
            indicator.style.fontSize = '14px';
            indicator.textContent = 'Scraping transactions... Please wait.';
            document.body.appendChild(indicator);

            // Immediately respond to avoid connection issues
            sendResponse({ status: 'started', message: 'Transaction capture started' });

            // Capture transactions
            captureTransactionsInDateRange(startDate, endDate).then(({ allTransactions, filteredTransactions }) => {
                console.log(`Capture complete. Found ${filteredTransactions.length} transactions in range`);

                // Remove the indicator
                document.body.removeChild(indicator);

                if (filteredTransactions.length === 0) {
                    console.warn('No transactions found in the specified date range!');
                    alert('No transactions found in the specified date range. Make sure the dates are correct and try scrolling manually on the page first.');
                    return;
                }

                // Generate and save CSVs
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

                // Show completion notification - moved to left side
                const completionNotice = document.createElement('div');
                completionNotice.style.position = 'fixed';
                completionNotice.style.top = '10px';
                completionNotice.style.left = '20px'; // Changed from right to left
                completionNotice.style.padding = '10px 20px';
                completionNotice.style.background = 'rgba(0, 128, 0, 0.8)';
                completionNotice.style.color = 'white';
                completionNotice.style.borderRadius = '5px';
                completionNotice.style.zIndex = '9999';
                completionNotice.style.fontSize = '14px';
                completionNotice.textContent = `Export complete! Found ${filteredTransactions.length} transactions.`;
                document.body.appendChild(completionNotice);

                setTimeout(() => {
                    document.body.removeChild(completionNotice);
                }, 5000);

            }).catch(error => {
                // Remove the indicator in case of error
                document.body.removeChild(indicator);

                console.error('Error during transaction capture:', error);
                alert(`Error during transaction capture: ${error.message}`);
            });

        } catch (error) {
            console.error('Error in message handler:', error);
            sendResponse({ status: 'error', message: error.message });
        }
    }
    // Return true to indicate we'll send a response asynchronously
    return true;
});
