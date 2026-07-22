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

// Quick Date Logic
document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const range = btn.dataset.range;
        const now = new Date();
        let start, end;

        if (range === 'ytd') {
            start = new Date(now.getFullYear(), 0, 1);
            end = now;
        } else if (range === 'last-month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (range === 'last-year') {
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
        }

        if (start && end) {
            // Format as YYYY-MM-DD using local time
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            document.getElementById('start-date').value = formatDate(start);
            document.getElementById('end-date').value = formatDate(end);
        }
    });
});

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
    const btn = document.getElementById('debug-raw-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Dumping...';
    btn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            alert('No active tab found.');
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }
        sendMessageWithInjection(tabs[0], { action: 'debugDumpRaw', maxHubPages: 5 }, (response, error) => {
            if (error) {
                alert(`Connection error (${error}): Make sure you are on creditkarma.com and reload the page.`);
            } else if (response?.status === 'error') {
                alert(`Raw API dump failed: ${response.message}`);
            }
            btn.textContent = originalText;
            btn.disabled = false;
        });
    });
});

// Export Logic
document.getElementById('export-btn').addEventListener('click', () => {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }

    // Get Settings
    const useApi = document.getElementById('useApiCheckbox').checked;

    // Get File Types
    const csvTypes = {
        allTransactions: document.getElementById('allTransactionsCheckbox').checked,
        income: document.getElementById('incomeCheckbox').checked,
        expenses: document.getElementById('expensesCheckbox').checked,
        netWorth: document.getElementById('netWorthCheckbox').checked,
        investments: document.getElementById('investmentsCheckbox').checked
    };

    if (!Object.values(csvTypes).some(Boolean)) {
        alert('Please select at least one file to generate.');
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
    const exportBtn = document.getElementById('export-btn');
    const originalText = exportBtn.textContent;
    exportBtn.textContent = 'Processing...';
    exportBtn.disabled = true;

    // Send to Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            alert('No active tab found.');
            resetButton();
            return;
        }

        sendMessageWithInjection(tabs[0], {
            action: 'captureTransactions',
            startDate,
            endDate,
            useApi,
            fetchAccountNames: false, // Legacy override
            csvTypes,
            columns
        }, (response, error) => {
            // Handle error (e.g. content script not loaded)
            if (error) {
                console.error(error);
                alert(`Connection error (${error}): Make sure you are on creditkarma.com and reload the page.`);
                resetButton();
                return;
            }

            if (response && response.status === 'started') {
                // Keep button disabled for a bit to prevent double clicks
                setTimeout(resetButton, 3000);
            } else {
                resetButton();
            }
        });
    });

    function resetButton() {
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    }
});
