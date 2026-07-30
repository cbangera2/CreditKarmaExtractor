const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popupScript = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

function createPopupContext() {
    const listeners = new Map();
    const alerts = [];
    const sentMessages = [];
    const checkboxIds = [
        'useApiCheckbox',
        'budgetLensBundleCheckbox',
        'allTransactionsCheckbox',
        'incomeCheckbox',
        'expensesCheckbox',
        'netWorthCheckbox',
        'investmentsCheckbox',
        'wealthAccountsCheckbox',
        'col-date',
        'col-desc',
        'col-amount',
        'col-category',
        'col-type',
        'col-account',
        'col-notes',
        'col-labels'
    ];
    const elements = new Map();

    function element(id) {
        const result = {
            id,
            checked: false,
            value: '',
            textContent: id,
            disabled: false,
            addEventListener(type, callback) {
                listeners.set(`${id}:${type}`, callback);
            }
        };
        elements.set(id, result);
        return result;
    }

    element('theme-toggle');
    element('start-date');
    element('end-date');
    element('export-btn');
    element('debug-raw-btn');
    for (const id of checkboxIds) element(id);
    elements.get('useApiCheckbox').checked = true;
    for (const id of checkboxIds.filter(id => id.startsWith('col-'))) {
        elements.get(id).checked = true;
    }

    const body = {
        theme: 'light',
        setAttribute(_name, value) { this.theme = value; },
        getAttribute() { return this.theme; }
    };
    const context = {
        URL,
        console,
        document: {
            body,
            getElementById: id => elements.get(id),
            querySelectorAll: () => []
        },
        localStorage: {
            getItem: () => null,
            setItem() {}
        },
        alert: message => alerts.push(message),
        setTimeout: callback => callback(),
        chrome: {
            runtime: { lastError: null },
            scripting: { executeScript() {} },
            tabs: {
                query(_options, callback) {
                    callback([{ id: 7, url: 'https://www.creditkarma.com/networth' }]);
                },
                sendMessage(_tabId, message, callback) {
                    sentMessages.push(message);
                    callback({ status: 'started' });
                }
            }
        }
    };

    vm.createContext(context);
    vm.runInContext(popupScript, context);
    return { alerts, elements, listeners, sentMessages };
}

test('current wealth account snapshots can export without a historical date range', () => {
    const { alerts, elements, listeners, sentMessages } = createPopupContext();
    elements.get('wealthAccountsCheckbox').checked = true;

    listeners.get('export-btn:click')();

    assert.deepEqual(alerts, []);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].csvTypes.wealthAccounts, true);
    assert.equal(sentMessages[0].startDate, '');
    assert.equal(sentMessages[0].endDate, '');
});

test('historical exports still require both dates', () => {
    const { alerts, elements, listeners, sentMessages } = createPopupContext();
    elements.get('netWorthCheckbox').checked = true;

    listeners.get('export-btn:click')();

    assert.deepEqual(alerts, ['Please select both start and end dates.']);
    assert.deepEqual(sentMessages, []);
});

test('BudgetLens bundle is sent as a distinct export type', () => {
    const { alerts, elements, listeners, sentMessages } = createPopupContext();
    elements.get('budgetLensBundleCheckbox').checked = true;
    elements.get('start-date').value = '2026-01-01';
    elements.get('end-date').value = '2026-07-30';

    listeners.get('export-btn:click')();

    assert.deepEqual(alerts, []);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].csvTypes.budgetLensBundle, true);
    assert.equal(sentMessages[0].csvTypes.allTransactions, false);
});
