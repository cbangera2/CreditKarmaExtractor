const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const contentScript = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const context = {
    chrome: { runtime: { onMessage: { addListener() {} } } },
    console,
    setTimeout,
    clearTimeout
};

vm.createContext(context);
vm.runInContext(`${contentScript}\n;globalThis.testExports = {
    extractGraphHistory,
    convertGraphHistoryToCSV,
    graphDateToISO,
    WEALTH_ACCOUNT_TYPES,
    parseFormattedBalance,
    extractNetWorthSegmentRows,
    extractWealthAccountRows,
    convertNetWorthBreakdownToCSV,
    convertWealthAccountsToCSV,
    shouldExportCurrentWealth
};`, context);

const {
    extractGraphHistory,
    convertGraphHistoryToCSV,
    graphDateToISO,
    WEALTH_ACCOUNT_TYPES,
    parseFormattedBalance,
    extractNetWorthSegmentRows,
    extractWealthAccountRows,
    convertNetWorthBreakdownToCSV,
    convertWealthAccountsToCSV,
    shouldExportCurrentWealth
} = context.testExports;

function point(date, value) {
    return {
        xValueLabel: { spans: [{ text: date }] },
        yValue: value
    };
}

function responseWithDatasets(datasets, rootKey = 'networth') {
    return {
        data: {
            prime: {
                [rootKey]: {
                    cards: [{
                        item: {
                            views: [{
                                dataVisualizationGroupDataSets: datasets
                            }]
                        }
                    }]
                }
            }
        }
    };
}

function dataset(key, points) {
    return {
        dataSetKey: key,
        dataVisualizationDataSet: { lines: [{ points }] }
    };
}

test('extractGraphHistory selects All, filters dates, deduplicates, and sorts', () => {
    const data = responseWithDatasets([
        dataset('1M', [point('Jul 20, 2026', 999)]),
        dataset('All', [
            point('Jul 22, 2026', 300),
            point('Jul 20, 2026', 100),
            point('Jul 21, 2026', 200),
            point('Jul 21, 2026', 250),
            point('not a date', 400)
        ])
    ]);

    const history = extractGraphHistory(data, 'networth', '2026-07-20', '2026-07-21');
    assert.deepEqual(JSON.parse(JSON.stringify(history)), [
        { date: '2026-07-20', value: 100 },
        { date: '2026-07-21', value: 250 }
    ]);
});

test('extractGraphHistory falls back to the dataset with the most points', () => {
    const data = responseWithDatasets([
        dataset('1M', [point('Jul 20, 2026', 100)]),
        dataset('3M', [point('Jul 20, 2026', 100), point('Jul 21, 2026', 200)])
    ], 'networthByAccountType');

    const history = extractGraphHistory(
        data,
        'networthByAccountType',
        '2026-07-01',
        '2026-07-31'
    );
    assert.equal(history.length, 2);
});

test('graph CSV has stable headers and ISO dates', () => {
    assert.equal(graphDateToISO('July 22, 2026'), '2026-07-22');
    assert.equal(
        convertGraphHistoryToCSV([{ date: '2026-07-22', value: 123.45 }], 'Net Worth'),
        'Date,Net Worth\n"2026-07-22","123.45"\n'
    );
});

test('current wealth snapshots request every account segment exposed by Credit Karma', () => {
    assert.deepEqual(Array.from(WEALTH_ACCOUNT_TYPES), ['cash', 'investments', 'property']);
});

test('net worth history automatically includes current detailed snapshots', () => {
    assert.equal(shouldExportCurrentWealth({ netWorth: true, wealthAccounts: false }), true);
    assert.equal(shouldExportCurrentWealth({ netWorth: false, wealthAccounts: true }), true);
    assert.equal(shouldExportCurrentWealth({ netWorth: false, wealthAccounts: false }), false);
});

function formattedText(text) {
    return { spans: [{ text }] };
}

function accountResponse(views) {
    return {
        data: {
            prime: {
                networthByAccountType: {
                    cards: [{ item: { views } }]
                }
            }
        }
    };
}

function accountRow(label, balance, descriptor) {
    return {
        __typename: 'KPLRowView',
        rowTitle: formattedText(label),
        rowValue: formattedText(balance),
        statusText: descriptor == null ? null : formattedText(descriptor)
    };
}

function composableText(id, text) {
    return {
        __typename: 'FabricComposableFormattedText',
        composableId: id,
        composableFormattedTextModel: formattedText(text)
    };
}

function netWorthBreakdownResponse(cards) {
    return {
        data: {
            prime: {
                networth: {
                    cards: cards.map(views => ({
                        item: { composableRoot: { composableRootViews: views } }
                    }))
                }
            }
        }
    };
}

test('net worth snapshot extracts ordered asset and debt segment totals', () => {
    const data = netWorthBreakdownResponse([
        [
            composableText('cash-title', 'Cash'),
            composableText('cash-count', '2 accounts'),
            composableText('cash-value', '$1,200.50'),
            composableText('investments-title', 'Investments'),
            composableText('investments-count', '1 account'),
            composableText('investments-value', '$8,000')
        ],
        [
            composableText('property-title', 'Property'),
            composableText('property-count', '1 asset'),
            composableText('property-value', '$10,000')
        ],
        [
            composableText('credit-cards-title', 'Credit cards'),
            composableText('credit-cards-count', '3 accounts'),
            composableText('credit-cards-value', '$500.25')
        ],
        [
            composableText('loans-title', 'Loans'),
            composableText('loans-count', '2 from your report'),
            composableText('loans-value', '$2,500')
        ]
    ]);

    const rows = extractNetWorthSegmentRows(data, new Date('2026-07-29T12:00:00.000Z'));

    assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
        {
            asOf: '2026-07-29T12:00:00.000Z',
            section: 'assets',
            segment: 'cash',
            balance: 1200.5,
            descriptor: '2 accounts'
        },
        {
            asOf: '2026-07-29T12:00:00.000Z',
            section: 'assets',
            segment: 'investments',
            balance: 8000,
            descriptor: '1 account'
        },
        {
            asOf: '2026-07-29T12:00:00.000Z',
            section: 'assets',
            segment: 'property',
            balance: 10000,
            descriptor: '1 asset'
        },
        {
            asOf: '2026-07-29T12:00:00.000Z',
            section: 'debts',
            segment: 'creditCards',
            balance: 500.25,
            descriptor: '3 accounts'
        },
        {
            asOf: '2026-07-29T12:00:00.000Z',
            section: 'debts',
            segment: 'loans',
            balance: 2500,
            descriptor: '2 from your report'
        }
    ]);
});

test('net worth breakdown CSV keeps section and stable segment identifiers', () => {
    assert.equal(
        convertNetWorthBreakdownToCSV([{
            asOf: '2026-07-29T12:00:00.000Z',
            section: 'debts',
            segment: 'creditCards',
            balance: 25.5,
            descriptor: 'One "reported" account'
        }]),
        'As Of,Section,Segment,Balance,Descriptor\n' +
        '"2026-07-29T12:00:00.000Z","debts","creditCards","25.5","One ""reported"" account"\n'
    );
});

test('parseFormattedBalance handles formatted, numeric, and negative values', () => {
    assert.equal(parseFormattedBalance(formattedText('$1,234.56')), 1234.56);
    assert.equal(parseFormattedBalance(formattedText('($45.67)')), -45.67);
    assert.equal(parseFormattedBalance(formattedText('\u2212 $8.90')), -8.9);
    assert.equal(parseFormattedBalance(-12.34), -12.34);
    assert.equal(parseFormattedBalance(formattedText('$0.00')), 0);
    assert.equal(parseFormattedBalance(formattedText('12%')), null);
    assert.equal(parseFormattedBalance(null), null);
});

test('account snapshots include direct and nested lookalike rows and deduplicate copies', () => {
    const direct = accountRow('Daily Cash', '$1,234.56', 'Connected');
    const nested = accountRow('Brokerage', '$8,765.44', 'Manual account');
    const duplicate = accountRow('Daily Cash', '$1,234.56', 'Connected');
    const data = accountResponse([
        nested,
        { __typename: 'KPLExperimentationView', lookalikeViews: [duplicate] },
        { rowTitle: formattedText('Missing balance'), rowValue: null },
        direct
    ]);
    const asOf = new Date('2026-07-22T15:30:00.000Z');

    const rows = extractWealthAccountRows(data, 'cash', asOf);

    assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
        {
            asOf: '2026-07-22T15:30:00.000Z',
            accountType: 'cash',
            sourceLabel: 'Brokerage',
            balance: 8765.44,
            descriptor: 'Manual account'
        },
        {
            asOf: '2026-07-22T15:30:00.000Z',
            accountType: 'cash',
            sourceLabel: 'Daily Cash',
            balance: 1234.56,
            descriptor: 'Connected'
        }
    ]);
});

test('account snapshots tolerate reordered fields, missing descriptors, and negative balances', () => {
    const data = accountResponse([{
        rowValue: formattedText('-$25.00'),
        presentationMetadata: null,
        rowTitle: formattedText('Example Source')
    }]);

    const rows = extractWealthAccountRows(
        data,
        'property',
        new Date('2026-07-22T16:00:00.000Z')
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].sourceLabel, 'Example Source');
    assert.equal(rows[0].balance, -25);
    assert.equal(rows[0].descriptor, '');
});

test('account snapshots use KPL status-dot text as the descriptor', () => {
    const data = accountResponse([{
        rowTitle: formattedText('Example Source'),
        rowValue: formattedText('$50.00'),
        rowStatusDot: { statusDotText: formattedText('Needs attention') }
    }]);

    const rows = extractWealthAccountRows(data, 'cash', new Date('2026-07-22T16:00:00.000Z'));
    assert.equal(rows[0].descriptor, 'Needs attention');
});

test('account snapshot parser rejects responses without the expected account root', () => {
    assert.throws(
        () => extractWealthAccountRows({}, 'cash', new Date()),
        /did not return current cash account balances/
    );
});

test('account CSV uses stable columns and escapes text without changing numeric balances', () => {
    assert.equal(
        convertWealthAccountsToCSV([{
            asOf: '2026-07-22T15:30:00.000Z',
            accountType: 'investments',
            sourceLabel: 'Brokerage "A"',
            balance: -25.5,
            descriptor: 'Manual'
        }]),
        'As Of,Account Type,Source Label,Balance,Descriptor\n' +
        '"2026-07-22T15:30:00.000Z","investments","Brokerage ""A""","-25.5","Manual"\n'
    );
});
