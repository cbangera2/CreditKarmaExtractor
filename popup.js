document.getElementById('export-btn').addEventListener('click', () => {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    // Get checkbox states - extraction options
    const useApiChecked = document.getElementById('useApiCheckbox').checked;
    const fetchAccountNamesChecked = document.getElementById('fetchAccountNamesCheckbox').checked;

    // Get checkbox states - CSV types
    const allTransactionsChecked = document.getElementById('allTransactionsCheckbox').checked;
    const incomeChecked = document.getElementById('incomeCheckbox').checked;
    const expensesChecked = document.getElementById('expensesCheckbox').checked;

    if (startDate && endDate) {
        // Show loading indicator
        const exportBtn = document.getElementById('export-btn');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Processing...';
        exportBtn.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'captureTransactions',
                startDate,
                endDate,
                useApi: useApiChecked,
                fetchAccountNames: fetchAccountNamesChecked,
                csvTypes: {
                    allTransactions: allTransactionsChecked,
                    income: incomeChecked,
                    expenses: expensesChecked
                }
            }, (response) => {
                // Reset the button state after response
                setTimeout(() => {
                    exportBtn.textContent = originalText;
                    exportBtn.disabled = false;
                }, 3000);

                if (response) {
                    console.log(response.status);
                } else {
                    console.error('No response from content script');
                    alert('Please make sure you are on the Credit Karma transactions page and try again.');
                }
            });
        });
    } else {
        alert('Please select both start and end dates.');
    }
});

const darkModeToggle = document.getElementById('dark-mode-toggle');
const body = document.body;

// Load dark mode preference from localStorage
if (localStorage.getItem('darkMode') === 'enabled') {
    body.classList.add('dark-mode');
    darkModeToggle.checked = true;
}

darkModeToggle.addEventListener('change', () => {
    if (darkModeToggle.checked) {
        body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
    }
});