chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureTransactions') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: captureTransactionsInDateRange,
                args: [request.startDate, request.endDate]
            });
            sendResponse({status: 'started'});
        });
        return true;  // Indicates that the response is asynchronous
    }
});