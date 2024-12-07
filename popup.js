document.getElementById('export-btn').addEventListener('click', () => {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    // Get checkbox states
    const allTransactionsChecked = document.getElementById('allTransactionsCheckbox').checked;
    const incomeChecked = document.getElementById('incomeCheckbox').checked;
    const expensesChecked = document.getElementById('expensesCheckbox').checked;
    
    if (startDate && endDate) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'captureTransactions', 
                startDate, 
                endDate,
                csvTypes: {
                    allTransactions: allTransactionsChecked,
                    income: incomeChecked,
                    expenses: expensesChecked
                }
            }, (response) => {
                console.log(response.status);
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