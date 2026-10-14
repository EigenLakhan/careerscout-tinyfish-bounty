# CareerScout — Submission Package (Draft)

**Bounty:** Job Portal / Careers Finder — TinyFish Student Bounty Drop 001  
**Build:** CareerScout Step 9.1 (local Node.js web app; Step 8 live evidence retained)  
**Package status:** Assembled for final review; **not yet cleared for submission** based on the attached live run.

## What's included

- `app/` — Step 9.1 application source with ATS/employer attribution and generic-opening/program-title classification fixes, plus regression tests.
- `evidence/Step8-Live-Run.pdf` — the live-run report supplied after testing Step 8.
- `docs/SUBMISSION_DRAFT.md` — copy-ready project description and truthful TinyFish usage notes.
- `docs/TECHNICAL_OVERVIEW.md` — architecture and API-flow explanation.
- `docs/LIVE_VALIDATION.md` — quantitative results and issues observed in the live report.
- `docs/KNOWN_LIMITATIONS_AND_BLOCKERS.md` — issues to resolve before representing this as submission-ready.
- `docs/FINAL_ACCEPTANCE_CHECKLIST.md` — final verification list.
- `docs/CLASSIFICATION_FIXES.md` — exact Step 9.1 classification changes and fixture coverage.
- `submission-assets/` — drafts for LinkedIn, X and Discord `#showcase`, plus a demo walkthrough.

## Run the app

Requires Node.js 22+ and a TinyFish API key. No third-party npm packages are required.

1. Open PowerShell in `app/`.
2. Run `Copy-Item .env.example .env`.
3. Edit `.env` and set `TINYFISH_API_KEY=...`. Never share or commit `.env`.
4. Run `npm start`.
5. Visit `http://127.0.0.1:3000`.

Run fixture tests with `npm test` inside `app/`. The Step 9.1 test suite has 33 fixture-based tests; these do not make paid TinyFish requests.

## Official bounty rules and final-submission warning

Read `docs/BOUNTY_RULES_AND_SUBMISSION_PLAN.md` and `docs/FINAL_ACCEPTANCE_CHECKLIST.md`. The supplied rules permit one individual submission per person per bounty, and submissions are final. The bounty is open for 18 days from its launch date; check the actual deadline in the dashboard. Only the top three builds are approved, so passing basic tests does not guarantee approval. A LinkedIn post tagging TinyFish and a Discord `#showcase` post are required. X is optional under the general rules unless the specific Careers Finder bounty instructions explicitly require it. Never include API keys or personal data.

## Before you submit

Read `docs/KNOWN_LIMITATIONS_AND_BLOCKERS.md` first. The attached Step 8 live test is honest evidence of working Search/Fetch plumbing, but it also exposes weak result quality: **40 leads, 15 pages fetched, 2 job candidates, 0 strong matches, and 1 direct-apply-style link**. Step 9.1 contains code-level fixes for ATS/company attribution plus generic internship and role-prefixed program-page false positives; these are regression-tested but still need a fresh live check before submission.

The Step 9.1 application uses **TinyFish Search and Fetch**. It does **not** call the TinyFish Agent API in this release. Do not claim Agent integration unless it is implemented and verified and the bounty's criteria are checked against the original brief.

The application currently runs locally; this package does not contain a public deployment URL or repository URL. Fill those into the submission draft only after publishing them.
