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
    graphDateToISO
};`, context);

const { extractGraphHistory, convertGraphHistoryToCSV, graphDateToISO } = context.testExports;

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
