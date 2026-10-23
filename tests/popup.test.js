const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popupScript = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

function createPopupContext(savedStorage = {}) {
    const listeners = new Map();
    let runtimeListener = null;
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
    element('status').hidden = true;
    elements.get('status').dataset = {};
    element('start-date');
    element('end-date');
    element('export-btn');
    element('debug-raw-btn');
    for (const id of checkboxIds) element(id);
    for (const key of [
        'allTransactions', 'income', 'expenses', 'netWorth', 'investments',
        'netWorthBreakdown', 'wealthAccounts', 'budgetLensBundle'
    ]) element(`name-${key}`);
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
            getItem: key => savedStorage[key] ?? null,
            setItem(key, value) { savedStorage[key] = value; }
        },
        setTimeout: callback => callback(),
        chrome: {
            runtime: {
                lastError: null,
                onMessage: { addListener(callback) { runtimeListener = callback; } }
            },
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
    const status = () => {
        const el = elements.get('status');
        return el.hidden ? null : { text: el.textContent, kind: el.dataset.kind };
    };
    return {
        context, elements, listeners, sentMessages, savedStorage, status,
        sendRuntimeMessage: message => runtimeListener(message)
    };
}

test('current wealth account snapshots can export without a historical date range', () => {
    const { status, elements, listeners, sentMessages } = createPopupContext();
    elements.get('wealthAccountsCheckbox').checked = true;

    listeners.get('export-btn:click')();

    assert.notEqual(status()?.kind, 'error');
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].csvTypes.wealthAccounts, true);
    assert.equal(sentMessages[0].startDate, '');
    assert.equal(sentMessages[0].endDate, '');
});

test('historical exports still require both dates', () => {
    const { status, elements, listeners, sentMessages } = createPopupContext();
    elements.get('netWorthCheckbox').checked = true;

    listeners.get('export-btn:click')();

    assert.equal(status().text, 'Please select both start and end dates.');
    assert.equal(status().kind, 'error');
    assert.deepEqual(sentMessages, []);
});

test('BudgetLens bundle is sent as a distinct export type', () => {
    const { status, elements, listeners, sentMessages } = createPopupContext();
    elements.get('budgetLensBundleCheckbox').checked = true;
    elements.get('start-date').value = '2026-01-01';
    elements.get('end-date').value = '2026-07-30';

    listeners.get('export-btn:click')();

    assert.notEqual(status()?.kind, 'error');
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].csvTypes.budgetLensBundle, true);
    assert.equal(sentMessages[0].csvTypes.allTransactions, false);
});

test('custom file names are sent, trimmed, and blank names are omitted', () => {
    const { elements, listeners, sentMessages } = createPopupContext();
    elements.get('name-allTransactions').value = '  my_transactions ';
    elements.get('name-income').value = '   ';
    elements.get('wealthAccountsCheckbox').checked = true;

    listeners.get('export-btn:click')();

    assert.equal(JSON.stringify(sentMessages[0].fileNames), JSON.stringify({ allTransactions: 'my_transactions' }));
});

test('custom file names are remembered and restored', () => {
    const first = createPopupContext();
    first.elements.get('name-netWorth').value = 'nw';
    first.listeners.get('name-netWorth:input')();
    assert.equal(first.savedStorage.fileNames, JSON.stringify({ netWorth: 'nw' }));

    const second = createPopupContext(first.savedStorage);
    assert.equal(second.elements.get('name-netWorth').value, 'nw');
    assert.equal(second.elements.get('name-income').value, '');
});

test('popup settings are saved when changed and restored on the next open', () => {
    const first = createPopupContext();
    first.elements.get('start-date').value = '2026-01-01';
    first.listeners.get('start-date:change')();
    first.elements.get('budgetLensBundleCheckbox').checked = false;
    first.elements.get('netWorthCheckbox').checked = true;
    first.listeners.get('netWorthCheckbox:change')();
    first.elements.get('col-notes').checked = false;
    first.listeners.get('col-notes:change')();
    first.elements.get('useApiCheckbox').checked = false;
    first.listeners.get('useApiCheckbox:change')();

    const second = createPopupContext(first.savedStorage);

    assert.equal(second.elements.get('start-date').value, '2026-01-01');
    assert.equal(second.elements.get('netWorthCheckbox').checked, true);
    assert.equal(second.elements.get('budgetLensBundleCheckbox').checked, false);
    assert.equal(second.elements.get('col-notes').checked, false);
    assert.equal(second.elements.get('col-date').checked, true);
    assert.equal(second.elements.get('useApiCheckbox').checked, false);
});

test('corrupt or partial saved settings fall back to the defaults', () => {
    const corrupt = createPopupContext({ settings: '{not json' });
    assert.equal(corrupt.elements.get('col-date').checked, true);
    assert.equal(corrupt.elements.get('start-date').value, '');

    const partial = createPopupContext({ settings: JSON.stringify({ 'col-date': 'yes', 'end-date': 5 }) });
    assert.equal(partial.elements.get('col-date').checked, true);
    assert.equal(partial.elements.get('end-date').value, '');
});

test('selecting no export shows an inline error instead of an alert', () => {
    const { elements, listeners, sentMessages, status } = createPopupContext();
    elements.get('budgetLensBundleCheckbox').checked = false;

    listeners.get('export-btn:click')();

    assert.equal(status().text, 'Please select at least one file to generate.');
    assert.equal(status().kind, 'error');
    assert.equal(sentMessages.length, 0);
});

test('export button stays disabled until the content script reports completion', () => {
    const { elements, listeners, status, sendRuntimeMessage } = createPopupContext();
    elements.get('wealthAccountsCheckbox').checked = true;

    listeners.get('export-btn:click')();

    assert.equal(elements.get('export-btn').disabled, true);
    assert.equal(status().kind, 'info');

    sendRuntimeMessage({ action: 'exportFinished', status: 'success', message: 'Export complete: 3 transactions.' });

    assert.equal(elements.get('export-btn').disabled, false);
    assert.equal(status().text, 'Export complete: 3 transactions.');
    assert.equal(status().kind, 'success');
});

test('export failures reported by the content script are shown and re-enable the button', () => {
    const { elements, listeners, status, sendRuntimeMessage } = createPopupContext();
    elements.get('wealthAccountsCheckbox').checked = true;
    listeners.get('export-btn:click')();

    sendRuntimeMessage({ action: 'exportFinished', status: 'error', message: 'Error during data export: boom' });

    assert.equal(elements.get('export-btn').disabled, false);
    assert.equal(status().text, 'Error during data export: boom');
    assert.equal(status().kind, 'error');
});

test('unrelated runtime messages are ignored', () => {
    const { elements, listeners, status, sendRuntimeMessage } = createPopupContext();
    elements.get('wealthAccountsCheckbox').checked = true;
    listeners.get('export-btn:click')();

    sendRuntimeMessage({ action: 'somethingElse' });

    assert.equal(elements.get('export-btn').disabled, true);
    assert.equal(status().kind, 'info');
});

test('quick date ranges cover the expected days', () => {
    const { context } = createPopupContext();
    const now = new Date(2026, 6, 30); // July 30, 2026
    const range = name => {
        const { start, end } = context.quickRangeValues(name, now);
        return `${start}..${end}`;
    };

    assert.equal(range('last-30'), '2026-06-30..2026-07-30');
    assert.equal(range('last-90'), '2026-05-01..2026-07-30');
    assert.equal(range('ytd'), '2026-01-01..2026-07-30');
    assert.equal(range('last-month'), '2026-06-01..2026-06-30');
    assert.equal(range('last-year'), '2025-01-01..2025-12-31');
});

test('quick date ranges handle month and year boundaries', () => {
    const { context } = createPopupContext();
    const march = new Date(2026, 2, 1);
    const january = new Date(2026, 0, 5);
    const range = (name, now) => {
        const { start, end } = context.quickRangeValues(name, now);
        return `${start}..${end}`;
    };

    assert.equal(range('last-30', march), '2026-01-30..2026-03-01');
    assert.equal(range('last-month', january), '2025-12-01..2025-12-31');
    assert.equal(range('last-90', january), '2025-10-07..2026-01-05');
    assert.equal(context.quickRangeValues('nonsense', march), null);
});
