# Contributing

Thanks for helping improve Credit Karma Data Extractor.

## Development workflow

1. Fork the repository and create a focused branch.
2. Make your changes without adding captured financial data, credentials, or generated archives.
3. Run the local checks:

   ```sh
   node --check background.js
   node --check content.js
   node --check popup.js
   node --test
   ```

4. Load the repository as an unpacked extension from `chrome://extensions` and test the affected export on Credit Karma.
5. Open a pull request that explains the problem, the change, and how you tested it.

## Recording a HAR for API changes

A HAR (HTTP Archive) can help identify changed GraphQL operations or response shapes. HAR files can also contain authentication material and private financial information, so handle them as sensitive files.

1. Sign in to Credit Karma and open the page related to the issue.
2. Open Chrome DevTools, select **Network**, and make sure recording is enabled.
3. Clear the network log, then reload the page and reproduce only the behavior being investigated.
4. Optionally select **Fetch/XHR** to limit the captured requests.
5. Use **Export HAR (sanitized)**, or right-click the request list and select **Save all listed as HAR (sanitized)**.

Chrome documents these steps in its [Network features reference](https://developer.chrome.com/docs/devtools/network/reference/#save-all-as-har).

### Before sharing a HAR

- Never commit a HAR file to this repository.
- Never attach an unreviewed HAR to a public issue or pull request.
- Use the sanitized export. Do not enable Chrome's option to export HAR files with sensitive data.
- Open the HAR in a text editor and check for cookies, authorization headers, tokens, email addresses, names, account identifiers, balances, transactions, and other personal data.
- Prefer sharing a minimal redacted request/response sample or schema instead of the full HAR.
- If a full HAR is genuinely required, ask a maintainer how to share it privately before sending it.

If you accidentally publish a HAR containing sensitive information, remove it immediately and treat any exposed session or credentials as compromised.

## Pull request guidelines

- Keep changes focused and avoid unrelated formatting edits.
- Add or update tests when changing parsers or export formats.
- Do not include real Credit Karma data in tests; use small synthetic fixtures.
- Ensure CI passes before requesting review.
