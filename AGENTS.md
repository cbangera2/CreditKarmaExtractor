# Agent instructions

- Follow [CONTRIBUTING.md](CONTRIBUTING.md), including its testing and sensitive-data rules.
- Never commit HAR files, credentials, or real Credit Karma financial data.
- Run the documented checks before submitting changes.
- If you make changes in a fork or a local checkout, open a pull request against the upstream repository (`cbangera2/CreditKarmaExtractor`) so everyone benefits. Do not leave improvements only in a fork or on a local branch; if you cannot open the pull request yourself, tell the user the exact steps.
- Pull requests that change the popup or any other UI must include screenshots (attach them with `gh pr create --attach`).
- Pull requests are squash merged. Tell the user before merging, and only merge once the checks pass and everything has been verified.
- Use a Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`) in commit messages and pull request titles, and give pull requests **Summary** and **Validation** sections as described in CONTRIBUTING.md.

## AI transparency

Pull requests generated or materially assisted by an LLM must include an **AI assistance** section that:

- clearly states that AI was used and names the tool or model when known;
- distinguishes automated checks from human review or manual testing; and
- says explicitly when the changes have not been manually tested by a human.

Do not present AI-generated work as solely human-authored.
