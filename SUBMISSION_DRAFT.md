# TinyFish Bounty Submission Draft

> **Draft only — hold submission until blockers in `KNOWN_LIMITATIONS_AND_BLOCKERS.md` are resolved and live revalidation is complete. Replace every bracketed placeholder.**

## Project name

CareerScout — Live Job & Internship Finder

## Bounty

Job Portal / Careers Finder — TinyFish Student Bounty Drop 001

## Build type

Agentic App / Skill (as labeled on the bounty board; confirm the dashboard's selectable option).

## Build / demo link

[PUBLIC_DEMO_URL — not yet supplied; the current application runs on localhost]

## Repository link

[PUBLIC_REPOSITORY_URL — create/publish a repository and verify it contains no `.env` or API key]

## Short description

CareerScout helps users discover job and internship opportunities across live career pages and job portals. Users enter a role, location, skills/keywords and level, then choose standard or expanded search. The app uses TinyFish Search to gather ranked web results, TinyFish Fetch to read selected pages and their links, then follows relevant job links within a bounded crawl. It normalizes and deduplicates records, ranks them against user preferences, separates specific-opening candidates from generic source pages, and preserves field-level evidence for title, location, seniority, eligibility and application-route classification.

CareerScout treats a fetched page as a candidate, not proof that a vacancy is currently open. Missing deadlines and eligibility details remain blank rather than being guessed. A direct-apply label indicates link evidence, not a click-tested application flow.

## TinyFish usage (truthful for this release)

- **Search — implemented:** one preference query or up to three targeted Search variants (preference, specific-posting, and employer/ATS-oriented). Expanded mode is optional because it uses more Search requests.
- **Fetch — implemented:** fetches selected pages in batches of up to five, with at most three batches / 15 attempted page URLs per discovery run. It reads page text and link evidence.
- **Web Agent — not integrated in Step 9.1:** CareerScout currently follows links and normalizes results with its own bounded Node.js pipeline; it does not invoke TinyFish's goal-based Agent endpoint. Do not describe this release as using Agent unless an Agent integration is added and tested. Check the exact bounty acceptance criteria before submission.

## Live test evidence

The attached Step 8 run completed all 3 Search variants and fetched 15 pages with 0 Fetch failures. Across 40 leads, it classified 2 as individual-opening candidates, found 1 direct-apply-style link, and scored 0 strong matches. That Step 8 run also revealed company-attribution and generic-page classification issues. Step 9.1 includes fixture-tested code fixes for both, but they have not yet been confirmed by a new live run; the acceptance gate remains on hold.

## Links / social posts

- LinkedIn post: see `../submission-assets/LINKEDIN_POST_DRAFT.md` (publish only after the final acceptance gate).
- X post: see `../submission-assets/X_POST_DRAFT.md`.
- Discord `#showcase`: see `../submission-assets/DISCORD_SHOWCASE_DRAFT.md`.

## Notes to reviewer

[After the final fixes, replace this paragraph with a concise list of changed files, test commands/results, what uses TinyFish, and the public demo/repository links. Do not claim unsupported outcomes or call opportunities verified active unless their state was actually checked.]
