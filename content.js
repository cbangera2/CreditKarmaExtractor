// ============================================
// API-Based Transaction Extraction
// ============================================

const API_ENDPOINT = 'https://api.creditkarma.com/graphql';
const CLIENT_NAME = 'prime_web';
const CLIENT_VERSION = '2.0.8';
const DEVICE_TYPE = 'Desktop';

// Cache for the access token
let cachedAccessToken = null;

/**
 * Get the access token from CKAT cookie
 * The CKAT cookie contains two JWT tokens separated by ; or %3B (URL encoded)
 * We need only the first token (access token), not the second (refresh token)
 */
async function getAccessToken() {
    // Return cached token if available
    if (cachedAccessToken) {
        return cachedAccessToken;
    }

    // Get the CKAT cookie value
    let cookieValue = getCookieValue('CKAT');
    if (cookieValue) {
        // URL decode if needed
        if (cookieValue.includes('%')) {
            try {
                cookieValue = decodeURIComponent(cookieValue);
            } catch (e) {
                console.log('[API] Cookie was not URL encoded');
            }
        }

        // The CKAT cookie contains two tokens separated by ;
        // First token is access token, second is refresh token
        // We only need the first one
        const tokens = cookieValue.split(';');
        const accessToken = tokens[0].trim();

        if (accessToken && accessToken.startsWith('eyJ')) {
            console.log('[API] Found access token in CKAT cookie (JWT format)');
            cachedAccessToken = accessToken;
            return accessToken;
        } else {
            console.warn('[API] CKAT cookie does not contain valid JWT token');
        }
    }

    // Try to extract from page context using script injection
    return new Promise((resolve, reject) => {
        // Create a unique ID for this request
        const requestId = 'ck_token_' + Date.now();

        // Listen for the response from the injected script
        const handler = (event) => {
            if (event.data && event.data.type === requestId) {
                window.removeEventListener('message', handler);
                if (event.data.token) {
                    console.log('[API] Found access token from page context');
                    cachedAccessToken = event.data.token;
                    resolve(event.data.token);
                } else {
                    reject(new Error('No access token found in page context'));
                }
            }
        };
        window.addEventListener('message', handler);

        // Inject script to get the token from page context
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                var token = window._ACCESS_TOKEN || null;
                window.postMessage({ type: '${requestId}', token: token }, '*');
            })();
        `;
        document.documentElement.appendChild(script);
        script.remove();

        // Timeout after 2 seconds
        setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('Timeout waiting for access token'));
        }, 2000);
    });
}

/**
 * Get authentication headers required for API calls
 * Extracts tokens and IDs from cookies and page context
 */
async function getAuthHeaders() {
    const accessToken = await getAccessToken();
    const cookieId = getCookieValue('CKTRKID');
    const traceId = getCookieValue('CKTRACEID') || generateTraceId();



    if (!accessToken) {
        throw new Error('No access token found. Please ensure you are logged in to Credit Karma.');
    }

    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'ck-client-name': CLIENT_NAME,
        'ck-client-version': CLIENT_VERSION,
        'ck-cookie-id': cookieId || '',
        'ck-device-type': DEVICE_TYPE,
        'ck-trace-id': traceId
    };
}

/**
 * Get cookie value by name
 */
function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

/**
 * Generate a random trace ID if not available
 */
function generateTraceId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Main API entry point: Orchestrates fetching recent + historical data
 */
async function fetchTransactionsViaAPI(startDate, endDate, onProgress, signal) {
    // 1. Fetch recent data using the fast GetTransactionsList endpoint
    console.log('[API] Phase 1: Fetching recent transactions...');
    let transactions = await fetchRecentTransactions(startDate, endDate, onProgress, signal);

    if (!transactions) {
        transactions = [];
    }

    // Sort to find the oldest date we have
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let oldestDate = new Date();
    if (transactions.length > 0) {
        oldestDate = new Date(transactions[transactions.length - 1].date);
    }

    const reqStartDate = new Date(startDate);

    // Check if we need to fetch older history
    // Allow 7 day buffer
    const daysDiff = (oldestDate - reqStartDate) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
        console.log(`[API] Gap detected: ${daysDiff.toFixed(1)} days. Phase 2: Fetching historical data...`);
        if (onProgress) onProgress(`Fetching older history (${daysDiff.toFixed(0)} days gap)...`);

        // Start from the day before our oldest known transaction
        const historyEndDate = new Date(oldestDate);
        historyEndDate.setDate(historyEndDate.getDate() - 1);

        const historicalTransactions = await fetchHistoricalTransactions(startDate, historyEndDate, onProgress, signal);

        if (historicalTransactions.length > 0) {
            console.log(`[API] Merging ${historicalTransactions.length} historical transactions`);
            transactions = [...transactions, ...historicalTransactions];
        }
    }

    return transactions;
}

/**
 * Fetch recent transactions using GetTransactionsList 
 */
async function fetchRecentTransactions(startDate, endDate, onProgress, signal) {
    console.log('[API] Starting API-based transaction fetch (Recent)');

    const headers = await getAuthHeaders();

    // Convert dates for filtering
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    // GetTransactionsList hash - returns ALL transactions in one call
    const TRANSACTIONS_LIST_HASH = 'c3c0a630b5cd938595c5901807f63b807e63c71f54a8fcb55e8c9084cb70832a';

    if (onProgress) {
        onProgress('Fetching all recent transactions...');
    }

    try {
        const requestBody = {
            extensions: {
                persistedQuery: {
                    sha256Hash: TRANSACTIONS_LIST_HASH,
                    version: 1
                }
            },
            operationName: "GetTransactionsList",
            variables: {
                input: {
                    accountInput: {},
                    categoryInput: {
                        categoryId: null,
                        primeCategoryType: null
                    }
                }
            }
        };

        console.log('[API] Sending GetTransactionsList request...');

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify(requestBody),
            signal: signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API] Response error:', errorText);

            // Handle token refresh
            if (response.status === 401 && errorText.includes('TOKEN_NEEDS_REFRESH')) {
                console.log('[API] Token needs refresh, clearing cache and retrying...');
                cachedAccessToken = null;
                const newHeaders = await getAuthHeaders();

                const retryResponse = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: newHeaders,
                    credentials: 'include',
                    body: JSON.stringify(requestBody)
                });

                if (!retryResponse.ok) {
                    throw new Error(`API request failed after token refresh: ${retryResponse.status}`);
                }

                const retryData = await retryResponse.json();
                return processTransactionResponse(retryData, startDateTime, endDateTime, onProgress);
            }

            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return processTransactionResponse(data, startDateTime, endDateTime, onProgress);

    } catch (error) {
        console.error('[API] Error fetching recent transactions:', error);
        return []; // Return empty to allow fallback or history fetch
    }
}

/**
 * Fetch historical transactions using robust pagination
 * Since date filtering seems ignored, we page from the top and skip what we already have
 */
async function fetchHistoricalTransactions(startDate, endDate, onProgress, signal) {
    console.log(`[API] Starting historical fetch via pagination (Target: < ${convertDateFormat(endDate.toISOString())})`);

    // Hash for the filtered/paginated query
    const TRANSACTIONS_QUERY_HASH = 'f669c7e42eb464861cb77d9f27826d0847ddfb5f5079a6ab7e5e2470c9617db8';

    const targetEndDate = new Date(endDate); // We want transactions OLDER than this
    const finalStart = new Date(startDate);

    let allHistoricalTransactions = [];
    let hasNextPage = true;
    let afterCursor = null;
    let pageCount = 0;
    let retryCount = 0;
    const maxRetries = 3;

    // We expect to skip the first ~12 pages (since we have them from Phase 1)
    // But we need to paginate through them to get the cursor for the older data

    while (hasNextPage) {
        if (stopScrolling) {
            console.log('[API] User requested stop');
            break;
        }

        pageCount++;
        if (onProgress) {
            if (allHistoricalTransactions.length === 0) {
                onProgress(`Scanning history page ${pageCount}...`);
            } else {
                onProgress(`Fetching history page ${pageCount} (${allHistoricalTransactions.length} transactions found)...`);
            }
        }

        try {
            // Refresh headers periodically
            const headers = await getAuthHeaders();

            // Build request
            const variables = {
                input: {
                    accountInput: {},
                    categoryInput: {
                        categoryId: null,
                        primeCategoryType: null
                    },
                    datePeriodInput: {
                        datePeriod: null // Explicitly null as we are scanning
                    },
                    paginationInput: {}
                }
            };

            // Only add cursor if we have one
            if (afterCursor) {
                variables.input.paginationInput.afterCursor = afterCursor;
            }

            const requestBody = {
                extensions: {
                    persistedQuery: {
                        sha256Hash: TRANSACTIONS_QUERY_HASH,
                        version: 1
                    }
                },
                operationName: "GetTransactions",
                variables: variables
            };

            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(requestBody),
                signal: signal
            });

            if (!response.ok) {
                const errText = await response.text();
                // Handle token refresh
                if (response.status === 401 && errText.includes('TOKEN_NEEDS_REFRESH')) {
                    console.log('[API] Token refresh needed in history fetch...');
                    cachedAccessToken = null;
                    retryCount++;
                    if (retryCount <= maxRetries) continue;
                }
                throw new Error(`History API failed: ${response.status}`);
            }

            const data = await response.json();

            if (data.errors) {
                console.error('[API] History GraphQL Errors:', JSON.stringify(data.errors));
                // If it's a pagination error, we might be done
                break;
            }

            // Parse response
            // Structure: data.prime.transactionsHub.transactionPage
            const transactionPage = data.data?.prime?.transactionsHub?.transactionPage;
            if (!transactionPage) {
                console.log('[API] No transactionPage in history response');
                break;
            }

            const transactions = transactionPage.transactions || [];
            const pageInfo = transactionPage.pageInfo;

            if (transactions.length === 0) {
                hasNextPage = false;
                break;
            }

            // Process transactions
            let newItemsInPage = 0;
            let oldestInPage = null;

            for (const txn of transactions) {
                const txnDate = new Date(txn.date);
                oldestInPage = txnDate;

                // If this transaction is NEWER than our targetEndDate, we technically already have it (from Phase 1)
                // BUT, duplicate handling is done later.
                // Efficiency: Only convert/add if it's <= targetEndDate

                if (txnDate <= targetEndDate && txnDate >= finalStart) {
                    const amount = txn.amount?.value || 0;
                    const categoryType = txn.category?.type || '';
                    const isCredit = amount > 0 || categoryType === 'INCOME';

                    allHistoricalTransactions.push({
                        id: txn.id,
                        description: txn.description || txn.merchant?.name || '',
                        category: txn.category?.name || '',
                        amount: Math.abs(amount),
                        date: txn.date,
                        transactionType: isCredit ? 'credit' : 'debit',
                        accountName: txn.account?.name || '',
                        accountType: txn.account?.type || '',
                        provider: txn.account?.providerName || ''
                    });
                    newItemsInPage++;
                }
            }

            // Check if we are done (passed the start date)
            if (oldestInPage && oldestInPage < finalStart) {
                console.log(`[API] Reached past start date (${oldestInPage.toISOString()}), stopping history fetch.`);
                hasNextPage = false;
                break;
            }

            // Check page info
            hasNextPage = pageInfo?.hasNextPage || false;
            afterCursor = pageInfo?.endCursor || null;

            // Rate limiting delay
            // Adaptive: If we are scanning (skipping), go faster. If collecting, go slower.
            const delay = newItemsInPage > 0 ? 800 : 300;
            await new Promise(resolve => setTimeout(resolve, delay));

            retryCount = 0; // Reset retries on success

        } catch (e) {
            if (e.name === 'AbortError') {
                console.log('[API] Historical scan aborted by user.');
                break;
            }
            console.error('[API] Error in history page:', e);
            retryCount++;
            if (retryCount > maxRetries) {
                console.warn('[API] Max retries hit for history pagination');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
    }

    return allHistoricalTransactions;
}

/**
 * Process the GetTransactionsList response and filter by date range
 */
function processTransactionResponse(data, startDateTime, endDateTime, onProgress) {
    if (data.errors && data.errors.length > 0) {
        console.error('[API] GraphQL errors:', JSON.stringify(data.errors, null, 2));
        throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    // Navigate to the correct response structure
    // Different endpoints have different structures:
    // - GetTransactions: data.prime.transactionsHub.transactionPage.transactions
    // - GetTransactionsList: data.prime.transactionList.transactions
    const transactionPage = data.data?.prime?.transactionsHub?.transactionPage;
    const transactionList = data.data?.prime?.transactionList; // Note: singular "List"

    console.log('[API] Response keys under prime:', Object.keys(data.data?.prime || {}));
    if (transactionList) {
        console.log('[API] transactionList keys:', Object.keys(transactionList));
    }

    let transactions = [];
    if (transactionPage?.transactions) {
        console.log('[API] Found transactions in transactionsHub.transactionPage');
        transactions = transactionPage.transactions;
    } else if (transactionList?.transactions) {
        console.log('[API] Found transactions in transactionList.transactions');
        transactions = transactionList.transactions;
    } else if (Array.isArray(transactionList)) {
        console.log('[API] transactionList is an array directly');
        transactions = transactionList;
    } else if (data.data?.transactions) {
        console.log('[API] Found transactions directly in data');
        transactions = data.data.transactions;
    }

    if (!transactions || transactions.length === 0) {
        console.log('[API] No transactions in response. Response structure:', Object.keys(data.data || {}));
        console.log('[API] Prime structure:', Object.keys(data.data?.prime || {}));
        console.log('[API] Full response preview:', JSON.stringify(data).substring(0, 1500));
        return [];
    }

    console.log(`[API] Received ${transactions.length} total transactions from API`);

    if (onProgress) {
        onProgress(`Processing ${transactions.length} transactions...`);
    }

    // Filter and transform transactions
    const allTransactions = [];
    for (const txn of transactions) {
        const transactionDate = new Date(txn.date);

        // Filter by date range
        if (transactionDate >= startDateTime && transactionDate <= endDateTime) {
            const amount = txn.amount?.value || 0;
            const categoryType = txn.category?.type || '';
            const isCredit = amount > 0 || categoryType === 'INCOME';

            allTransactions.push({
                id: txn.id,
                description: txn.description || txn.merchant?.name || '',
                category: txn.category?.name || '',
                amount: Math.abs(amount),
                date: txn.date,
                transactionType: isCredit ? 'credit' : 'debit',
                accountName: txn.account?.name || '',
                accountType: txn.account?.type || '',
                provider: txn.account?.providerName || ''
            });
        }
    }

    console.log(`[API] Filtered to ${allTransactions.length} transactions in date range`);
    return allTransactions;
}

/**
 * Fetch transaction detail to get account name
 * Used when account info is not available in the list view
 */
async function fetchTransactionDetail(transactionUrn) {
    console.log('[API] Fetching transaction detail:', transactionUrn);

    const headers = await getAuthHeaders();

    try {
        const query = {
            operationName: "GetTransactionDetail",
            variables: {
                urn: transactionUrn
            },
            query: `
                query GetTransactionDetail($urn: String!) {
                    transaction(urn: $urn) {
                        id
                        urn
                        description
                        amount {
                            value
                            currencyCode
                        }
                        transactionDate
                        category {
                            name
                        }
                        account {
                            id
                            name
                            accountType
                            provider {
                                name
                            }
                        }
                        transactionType
                        merchant {
                            name
                        }
                    }
                }
            `
        };

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify(query)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.errors) {
            console.warn('[API] Transaction detail errors:', data.errors);
            return null;
        }

        return data.data?.transaction;

    } catch (error) {
        console.error('[API] Error fetching transaction detail:', error);
        return null;
    }
}

/**
 * Enrich transactions with account names by fetching details
 * Only called when fetchAccountNames option is enabled
 */
async function enrichTransactionsWithAccountNames(transactions, onProgress) {
    console.log('[API] Enriching transactions with account names');

    const enrichedTransactions = [];
    let processed = 0;

    for (const transaction of transactions) {
        // Skip if already has account name
        if (transaction.accountName) {
            enrichedTransactions.push(transaction);
            processed++;
            continue;
        }

        if (transaction.urn) {
            const detail = await fetchTransactionDetail(transaction.urn);
            if (detail && detail.account) {
                transaction.accountName = detail.account.name || '';
                transaction.accountType = detail.account.accountType || '';
                transaction.provider = detail.account.provider?.name || '';
            }
        }

        enrichedTransactions.push(transaction);
        processed++;

        if (onProgress && processed % 10 === 0) {
            onProgress(`Fetching account details... ${processed}/${transactions.length}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return enrichedTransactions;
}

// ============================================
// Original DOM-based extraction (Fallback)
// ============================================

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

function convertToCSV(transactions, columns) {
    // Default to all true if columns not provided
    const cols = columns || {
        date: true, description: true, amount: true, category: true,
        type: true, account: true, notes: true, labels: true
    };

    let headerParts = [];
    if (cols.date) headerParts.push('Date');
    if (cols.description) headerParts.push('Description');
    if (cols.amount) headerParts.push('Amount');
    if (cols.category) headerParts.push('Category');
    if (cols.type) headerParts.push('Transaction Type');
    if (cols.account) {
        headerParts.push('Account Name');
        headerParts.push('Account Type');
        headerParts.push('Provider');
    }
    if (cols.labels) headerParts.push('Labels');
    if (cols.notes) headerParts.push('Notes');

    const header = headerParts.join(',') + '\n';

    const rows = transactions.map(transaction => {
        const escape = (str) => String(str || '').replace(/"/g, '""');
        let rowParts = [];

        if (cols.date) rowParts.push(`"${convertDateFormat(transaction.date)}"`);
        if (cols.description) rowParts.push(`"${escape(transaction.description)}"`);
        if (cols.amount) rowParts.push(`"${transaction.amount}"`);
        if (cols.category) rowParts.push(`"${escape(transaction.category)}"`);
        if (cols.type) rowParts.push(`"${transaction.transactionType}"`);
        if (cols.account) {
            rowParts.push(`"${escape(transaction.accountName || '')}"`);
            rowParts.push(`"${escape(transaction.accountType || '')}"`);
            rowParts.push(`"${escape(transaction.provider || '')}"`);
        }
        if (cols.labels) rowParts.push(`""`); // Placeholder
        if (cols.notes) rowParts.push(`""`); // Placeholder

        return rowParts.join(',') + '\n';
    });

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

/**
 * Main capture function - tries API first, falls back to scroll-based extraction
 * @param {string} startDate - Start date for the transaction range
 * @param {string} endDate - End date for the transaction range
 * @param {boolean} fetchAccountNames - Whether to fetch account names for each transaction
 * @param {boolean} useApi - Whether to try API extraction first (default: true)
 */
async function captureTransactionsInDateRange(startDate, endDate, fetchAccountNames = false, useApi = true) {
    console.log(`Starting capture: ${startDate} to ${endDate} (fetchAccountNames: ${fetchAccountNames}, useApi: ${useApi})`);

    // Reset stop flag
    stopScrolling = false;

    // Create stop button (for both API and Scroll modes)
    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop Extraction';
    stopButton.style.position = 'fixed';
    stopButton.style.bottom = '20px';
    stopButton.style.left = '20px';
    stopButton.style.zIndex = '10000';
    stopButton.style.padding = '10px 20px';
    stopButton.style.backgroundColor = '#ff3b30';
    stopButton.style.color = 'white';
    stopButton.style.border = 'none';
    stopButton.style.borderRadius = '5px';
    stopButton.style.fontWeight = 'bold';
    stopButton.style.cursor = 'pointer';
    stopButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    // Create AbortController for API requests
    const abortController = new AbortController();

    stopButton.addEventListener('mouseover', () => { stopButton.style.backgroundColor = '#d9342b'; });
    stopButton.addEventListener('mouseout', () => { stopButton.style.backgroundColor = '#ff3b30'; });
    stopButton.addEventListener('click', () => {
        stopScrolling = true;
        abortController.abort(); // Cancel pending API requests
        stopButton.textContent = 'Stopping...';
        stopButton.style.backgroundColor = '#999';
        stopButton.disabled = true;
    });
    document.body.appendChild(stopButton);

    // Create info overlay
    const counterElement = document.createElement('div');
    counterElement.style.position = 'fixed';
    counterElement.style.bottom = '80px';
    counterElement.style.left = '20px';
    counterElement.style.zIndex = '10000';
    counterElement.style.padding = '10px';
    counterElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
    counterElement.style.color = 'white';
    counterElement.style.borderRadius = '5px';
    counterElement.style.fontSize = '14px';
    counterElement.textContent = 'Initializing...';
    document.body.appendChild(counterElement);

    // Try API-based extraction first if enabled
    if (useApi) {
        try {
            console.log('[API] Attempting API-based extraction...');
            counterElement.textContent = 'Connecting to Credit Karma API...';

            let transactions = await fetchTransactionsViaAPI(startDate, endDate, (msg) => {
                console.log('[API Progress]', msg);
                counterElement.textContent = msg;
            }, abortController.signal);

            if (transactions && transactions.length > 0) {
                console.log(`[API] Successfully fetched ${transactions.length} transactions via API`);

                // Sort by date (newest first)
                transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                // Check if we covered the full date range
                // The API might limit results (e.g. last 1000 txns or 1 year)
                // If oldest transaction is still significantly newer than startDate, we assume incomplete data
                const oldestTxDate = new Date(transactions[transactions.length - 1].date);
                const reqStartDate = new Date(startDate);

                // Allow a small buffer (e.g. 7 days) in case there were just no transactions that week
                // But if gap is > 30 days, it's suspicious for most users
                const daysDiff = (oldestTxDate - reqStartDate) / (1000 * 60 * 60 * 24);


                console.log(`[API] Oldest transaction date: ${transactions[transactions.length - 1].date}`);
                console.log(`[API] Requested start date: ${startDate}`);

                // We trust the API hybrid strategy (Phase 1 + Phase 2) to have fetched everything possible.
                // If there's still a gap, it's likely a legitimate gap in user activity.
                // So we do NOT enforce a gap check here anymore.


                // Optionally enrich with account names
                if (fetchAccountNames && !stopScrolling) {
                    const needsEnrichment = transactions.filter(t => !t.accountName).length;
                    if (needsEnrichment > 0) {
                        console.log(`[API] Enriching ${needsEnrichment} transactions with account names...`);
                        transactions = await enrichTransactionsWithAccountNames(transactions, (msg) => {
                            console.log('[API Progress]', msg);
                            counterElement.textContent = msg;
                        });
                    }
                }

                // Cleanup UI elements before returning
                if (stopButton.parentNode) stopButton.parentNode.removeChild(stopButton);
                if (counterElement.parentNode) counterElement.parentNode.removeChild(counterElement);

                return {
                    allTransactions: transactions,
                    filteredTransactions: transactions
                };
            }
        } catch (apiError) {
            if (apiError.name === 'AbortError') {
                console.log('[API] Extraction aborted by user.');
                if (stopButton.parentNode) stopButton.parentNode.removeChild(stopButton);
                if (counterElement.parentNode) counterElement.parentNode.removeChild(counterElement);
                return { allTransactions: [], filteredTransactions: [] };
            }
            console.warn('[API] API extraction failed, falling back to scroll method:', apiError.message);
            console.error('[API] Full error:', apiError);
            console.error('[API] Stack trace:', apiError.stack);
        }
    }

    // Fallback to scroll-based extraction
    console.log('[Scroll] Using scroll-based extraction...');

    let allTransactions = [];
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    let lastTransactionCount = 0;
    let unchangedCount = 0;
    let scrollAttempts = 0;
    let foundTargetDateRange = false;
    let consecutiveTargetDateMatches = 0;



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
            const { startDate, endDate, csvTypes, fetchAccountNames = false, useApi = true, columns } = request;
            console.log(`Received request to capture transactions from ${startDate} to ${endDate} (useApi: ${useApi}, fetchAccountNames: ${fetchAccountNames})`);

            // Create a visual indicator that extraction is in progress - moved to left side
            const indicator = document.createElement('div');
            indicator.id = 'ck-extractor-indicator';
            indicator.style.position = 'fixed';
            indicator.style.top = '10px';
            indicator.style.left = '20px'; // Changed from right to left
            indicator.style.padding = '10px 20px';
            indicator.style.background = 'rgba(0, 0, 0, 0.8)';
            indicator.style.color = 'white';
            indicator.style.borderRadius = '5px';
            indicator.style.zIndex = '9999';
            indicator.style.fontSize = '14px';
            indicator.textContent = useApi ? 'Extracting transactions via API...' : 'Extracting transactions via scrolling...';
            document.body.appendChild(indicator);

            // Immediately respond to avoid connection issues
            sendResponse({ status: 'started', message: 'Transaction capture started' });

            // Capture transactions (API-first with scroll fallback)
            captureTransactionsInDateRange(startDate, endDate, fetchAccountNames, useApi).then(({ allTransactions, filteredTransactions }) => {
                console.log(`Capture complete. Found ${filteredTransactions.length} transactions in range`);

                // Remove the indicator
                if (indicator.parentNode) indicator.parentNode.removeChild(indicator);

                if (filteredTransactions.length === 0) {
                    console.warn('No transactions found in the specified date range!');
                    alert('No transactions found in the specified date range. Make sure the dates are correct and try scrolling manually on the page first.');
                    return;
                }

                // Generate and save CSVs
                if (csvTypes.allTransactions) {
                    const allCsvData = convertToCSV(filteredTransactions, columns);
                    saveCSVToFile(allCsvData, `all_transactions_${startDate.replace(/\//g, '-')}_to_${endDate.replace(/\//g, '-')}.csv`);
                }

                if (csvTypes.income) {
                    const creditTransactions = filteredTransactions.filter(transaction => transaction.transactionType === 'credit');
                    const creditCsvData = convertToCSV(creditTransactions, columns);
                    saveCSVToFile(creditCsvData, `income_${startDate.replace(/\//g, '-')}_to_${endDate.replace(/\//g, '-')}.csv`);
                }

                if (csvTypes.expenses) {
                    const debitTransactions = filteredTransactions.filter(transaction => transaction.transactionType === 'debit');
                    const debitCsvData = convertToCSV(debitTransactions, columns);
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
