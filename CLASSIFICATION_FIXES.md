# Step 9.1 — Classification Fixes

## Why this patch exists

The Step 8 live report contained two specific errors: a Greenhouse-hosted role was labeled as `Greenhouse` instead of the hiring company `Glean`, and `MERL — Internship Openings` was shown as an individual-opening candidate.

## What changed

1. **ATS hosts are no longer employer fallbacks.** The normalizer identifies common ATS domains, uses evidence from the job-board title, snippet, or fetched text when available, and returns a blank company with an explanatory evidence basis when it cannot establish the hiring company.
2. **Generic opening/program titles are suppressed.** Titles such as `Internship Openings`, `Internships`, `Careers`, and `Early Career Opportunities` do not become individual vacancies merely because their page mentions generic qualifications/responsibilities. Individual candidates now require a specific role title plus supporting posting evidence.
3. **Role-prefixed program-title guard:** a title such as `Software Engineering Internship Program` remains a source/program page when no specific job ID/path supports an individual opening.
4. **Specific URL detection is stricter.** General `/jobs/<keyword>` searches are no longer automatically treated as specific role pages or given specific-role application labels.
5. **Evidence follows the classification.** The Company field's evidence object now states where the company name was found or why the ATS host could not establish it.

## Regression evidence

Run `npm test` in `app/`. The 33 fixture-based tests include:

- Glean inferred from the exact `Glean is the Work AI platform...` search snippet on a Greenhouse ATS URL;
- generic `Internship Openings` with qualifications language remains a source/program page;
- role-prefixed `Software Engineering Internship Program` remains a source/program page;
- unknown employer on an ATS-hosted page remains unestablished, not the ATS brand;
- broad job-board search URLs are not labeled specific role pages.

**Scope limitation:** these are fixture tests, not a fresh TinyFish live run. Re-run all three acceptance queries and check the actual cards before submission. If the live page doesn't contain enough employer evidence, blank company is the correct outcome; don't guess.
