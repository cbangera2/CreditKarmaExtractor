// Theme Handling
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Initialize theme
const currentTheme = localStorage.getItem('theme') || 'light';
body.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
    const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Custom file names (blank = default dated name), remembered between sessions
const FILE_NAME_KEYS = [
    'allTransactions',
    'income',
    'expenses',
    'netWorth',
    'investments',
    'netWorthBreakdown',
    'wealthAccounts',
    'budgetLensBundle'
];

function readSavedFileNames() {
    try {
        return JSON.parse(localStorage.getItem('fileNames')) || {};
    } catch (error) {
        return {};
    }
}

function collectFileNames() {
    const fileNames = {};
    for (const key of FILE_NAME_KEYS) {
        const value = document.getElementById(`name-${key}`).value.trim();
        if (value) fileNames[key] = value;
    }
    return fileNames;
}

const savedFileNames = readSavedFileNames();
for (const key of FILE_NAME_KEYS) {
    const input = document.getElementById(`name-${key}`);
    input.value = savedFileNames[key] || '';
    input.addEventListener('input', () => {
        localStorage.setItem('fileNames', JSON.stringify(collectFileNames()));
    });
}

// Remember the date range, export choices, columns, and Fast API setting between sessions
const PERSISTED_CHECKBOX_IDS = [
    'budgetLensBundleCheckbox',
    'allTransactionsCheckbox',
    'incomeCheckbox',
    'expensesCheckbox',
    'netWorthCheckbox',
    'investmentsCheckbox',
    'wealthAccountsCheckbox',
    'useApiCheckbox',
    'col-date',
    'col-desc',
    'col-amount',
    'col-category',
    'col-type',
    'col-account',
    'col-notes',
    'col-labels'
];
const PERSISTED_VALUE_IDS = ['start-date', 'end-date'];

function readSavedSettings() {
    try {
        return JSON.parse(localStorage.getItem('settings')) || {};
    } catch (error) {
        return {};
    }
}

function saveSettings() {
    const settings = {};
    for (const id of PERSISTED_CHECKBOX_IDS) {
        settings[id] = document.getElementById(id).checked;
    }
    for (const id of PERSISTED_VALUE_IDS) {
        settings[id] = document.getElementById(id).value;
    }
    localStorage.setItem('settings', JSON.stringify(settings));
}

const savedSettings = readSavedSettings();
for (const id of PERSISTED_CHECKBOX_IDS) {
    const input = document.getElementById(id);
    if (typeof savedSettings[id] === 'boolean') input.checked = savedSettings[id];
    input.addEventListener('change', saveSettings);
}
for (const id of PERSISTED_VALUE_IDS) {
    const input = document.getElementById(id);
    if (typeof savedSettings[id] === 'string') input.value = savedSettings[id];
    input.addEventListener('change', saveSettings);
}

// Quick Date Logic
function formatDateInput(date) {
    // Format as YYYY-MM-DD using local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function quickRangeValues(range, now = new Date()) {
    let start, end;

    if (range === 'last-30' || range === 'last-90') {
        const days = range === 'last-30' ? 30 : 90;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
        end = now;
    } else if (range === 'ytd') {
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
    } else if (range === 'last-month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (range === 'last-year') {
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
    }

    return start && end ? { start: formatDateInput(start), end: formatDateInput(end) } : null;
}

document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const values = quickRangeValues(btn.dataset.range);
        if (values) {
            document.getElementById('start-date').value = values.start;
            document.getElementById('end-date').value = values.end;
            saveSettings();
        }
    });
});

// Inline status line (replaces alert() dialogs, which are jarring in an extension popup)
const statusLine = document.getElementById('status');

// The status line lives in the fixed action bar so it is always visible without scrolling.
// Keep the page padding in step with the bar so no content is hidden underneath it.
function syncActionBarPadding() {
    const bar = document.getElementById('action-bar');
    if (bar && document.body.style) {
        document.body.style.paddingBottom = `${bar.offsetHeight + 12}px`;
    }
}

function showStatus(message, kind = 'info') {
    statusLine.textContent = message;
    statusLine.dataset.kind = kind;
    statusLine.hidden = false;
    syncActionBarPadding();
}

function clearStatus() {
    statusLine.textContent = '';
    statusLine.hidden = true;
    syncActionBarPadding();
}

/**
 * Send a message to the content script. If it doesn't answer (stale or missing
 * content script — e.g. the page was loaded before the extension was updated),
 * inject content.js into the tab and retry once.
 */
function sendMessageWithInjection(tab, message, callback) {
    const tabId = tab.id;
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (!chrome.runtime.lastError) {
            callback(response, null);
            return;
        }
        console.warn('Content script not responding, injecting fresh copy...', chrome.runtime.lastError.message);

        let tabUrl;
        try {
            tabUrl = new URL(tab.url);
        } catch (error) {
            callback(null, 'The active tab does not have a valid URL.');
            return;
        }

        if (tabUrl.protocol !== 'https:' || tabUrl.hostname !== 'www.creditkarma.com') {
            callback(null, 'Open a page on https://www.creditkarma.com before using the extension.');
            return;
        }

        chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
            if (chrome.runtime.lastError) {
                callback(null, chrome.runtime.lastError.message);
                return;
            }
            chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                callback(retryResponse, chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
            });
        });
    });
}

// Debug: dump raw API responses to a JSON file
document.getElementById('debug-raw-btn').addEventListener('click', () => {
    clearStatus();
    const btn = document.getElementById('debug-raw-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Dumping...';
    btn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            showStatus('No active tab found.', 'error');
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }
        sendMessageWithInjection(tabs[0], { action: 'debugDumpRaw', maxHubPages: 5 }, (response, error) => {
            if (error) {
                showStatus(`Connection error (${error}): Make sure you are on creditkarma.com and reload the page.`, 'error');
            } else if (response?.status === 'error') {
                showStatus(`Raw API dump failed: ${response.message}`, 'error');
            }
            btn.textContent = originalText;
            btn.disabled = false;
        });
    });
});

// Export Logic
const exportBtn = document.getElementById('export-btn');
const exportBtnText = exportBtn.textContent;

function resetExportButton() {
    exportBtn.textContent = exportBtnText;
    exportBtn.disabled = false;
}

// The content script reports back when an export finishes (or fails)
chrome.runtime.onMessage?.addListener(message => {
    if (message?.action !== 'exportFinished') return;
    showStatus(message.message, message.status === 'success' ? 'success' : 'error');
    resetExportButton();
});

document.getElementById('export-btn').addEventListener('click', () => {
    clearStatus();
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    // Get Settings
    const useApi = document.getElementById('useApiCheckbox').checked;

    // Get File Types
    const csvTypes = {
        budgetLensBundle: document.getElementById('budgetLensBundleCheckbox').checked,
        allTransactions: document.getElementById('allTransactionsCheckbox').checked,
        income: document.getElementById('incomeCheckbox').checked,
        expenses: document.getElementById('expensesCheckbox').checked,
        netWorth: document.getElementById('netWorthCheckbox').checked,
        investments: document.getElementById('investmentsCheckbox').checked,
        wealthAccounts: document.getElementById('wealthAccountsCheckbox').checked
    };

    if (!Object.values(csvTypes).some(Boolean)) {
        showStatus('Please select at least one file to generate.', 'error');
        return;
    }

    const needsDateRange = Object.entries(csvTypes)
        .some(([type, selected]) => type !== 'wealthAccounts' && selected);
    if (needsDateRange && (!startDate || !endDate)) {
        showStatus('Please select both start and end dates.', 'error');
        return;
    }

    // Get Column Preferences
    const columns = {
        date: document.getElementById('col-date').checked,
        description: document.getElementById('col-desc').checked,
        amount: document.getElementById('col-amount').checked,
        category: document.getElementById('col-category').checked,
        type: document.getElementById('col-type').checked,
        account: document.getElementById('col-account').checked,
        notes: document.getElementById('col-notes').checked,
        labels: document.getElementById('col-labels').checked
    };

    // UI Feedback
    exportBtn.textContent = 'Processing...';
    exportBtn.disabled = true;

    // Send to Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            showStatus('No active tab found.', 'error');
            resetExportButton();
            return;
        }

        sendMessageWithInjection(tabs[0], {
            action: 'captureTransactions',
            startDate,
            endDate,
            useApi,
            fetchAccountNames: false, // Legacy override
            csvTypes,
            columns,
            fileNames: collectFileNames()
        }, (response, error) => {
            // Handle error (e.g. content script not loaded)
            if (error) {
                console.error(error);
                showStatus(`Connection error (${error}): Make sure you are on creditkarma.com and reload the page.`, 'error');
                resetExportButton();
                return;
            }

            if (response && response.status === 'started') {
                // Stay disabled until the content script reports the export finished
                showStatus('Exporting... keep this Credit Karma tab open.');
            } else {
                if (response?.status === 'error') showStatus(response.message, 'error');
                resetExportButton();
            }
        });
    });
});
