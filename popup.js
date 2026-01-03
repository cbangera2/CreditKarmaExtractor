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
        expenses: document.getElementById('expensesCheckbox').checked
    };

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

        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'captureTransactions',
            startDate,
            endDate,
            useApi,
            fetchAccountNames: false, // Legacy override
            csvTypes,
            columns
        }, (response) => {
            // Handle error (e.g. content script not loaded)
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                alert('Connection error: Make sure you are on the Credit Karma page and reload.');
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