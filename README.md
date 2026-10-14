# CareerScout — Step 9.1: classification fixes and evidence quality

CareerScout is a local Node.js application for the TinyFish Careers Finder bounty. Step 9.1 is a classification-focused patch on top of Step 8. It preserves Search → Fetch → bounded crawling and fixes the observed false-positive patterns found in the Step 8 live report: ATS-host attribution (for example, Greenhouse shown instead of Glean) and a generic “Internship Openings” or role-prefixed “Software Engineering Internship Program” page classified as an individual vacancy. These changes are covered by fixtures; run a fresh live test before submission.

## Requirements

- Node.js 22 or newer
- TinyFish API key from https://agent.tinyfish.ai/api-keys
- Internet access
- TinyFish documentation: https://docs.tinyfish.ai

No third-party npm packages are required.

## Run on Windows PowerShell

1. Extract the ZIP into a new folder, for example `Documents\CareerScout-Step9.1`.
2. Open PowerShell in that folder and run:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

3. Add your API key after `TINYFISH_API_KEY=` in `.env`. Keep this file local. Do not paste the key into chat, frontend code, screenshots, or a public repository.
4. Save the file, then run:

   ```powershell
   npm start
   ```

5. Open http://127.0.0.1:3000.

The server binds to `127.0.0.1` and prints whether a key is configured. `/api/health` confirms local configuration only; it does not validate the key with TinyFish.

## Step 8 base features retained

### 1. Optional expanded discovery

The **Discovery breadth** control offers:

- **Standard — 1 search query:** lower-cost default.
- **Expanded — up to 3 search queries:** a preference search, a specific-posting search, and an employer/ATS-oriented search. Expanded mode may consume more API credits.

Search variants are run independently. If one variant fails but another succeeds, the app continues with the successful results and reports failed variants in the normalized summary. If every variant fails, the app returns a meaningful error.

### 2. Source diversity

Initial Fetch targets are selected round-robin across query variants, deduplicated by canonical URL, and biased toward distinct hosts. This reduces the chance that the first Fetch batch is spent entirely on one job board.

### 3. Better application-link evidence

TinyFish link objects and Markdown anchors are parsed for labels such as `Apply`, `Apply Now`, and `Submit application`, even if the URL path itself does not contain the word `apply`. Specific ATS role links receive priority during bounded crawling. The interface distinguishes direct-apply-style links from role pages, filtered searches, related careers pages, and fallbacks.

**Important:** a direct-application label is based on explicit link evidence, not a click test. CareerScout does not submit applications or guarantee that the destination is live.

### 4. Field-level evidence and deduplication

Normalized records retain evidence for title, location, seniority, eligibility, and application route. Cross-source records with the same normalized title, company, and location can be merged while retaining stronger application-link and eligibility evidence. Different locations are kept distinct.

### 5. Existing fit checks retained

Role-title signals carry more weight than incidental body mentions. Explicit location and seniority mismatches are penalized, uncertain internship level is flagged for review, and generic job-board landing pages remain source leads rather than individual openings.

### 6. Bounded API usage

- At most 5 URLs per Fetch batch.
- At most 3 Fetch batches (15 attempted page URLs per discovery).
- Standard mode uses one Search query; expanded mode uses up to three.
- Search variants that fail are reported in a visible Search strategy diagnostics panel; one failed source does not discard other successful results.
- Result filters operate client-side and do not trigger another paid search.

## Discovery flow

1. Read user preferences and choose standard or expanded breadth.
2. Build one or three role/location/keyword/seniority-aware TinyFish Search queries.
3. Parse `data.results[]`, merge query variants, and select a diverse initial Fetch batch.
4. Fetch pages in batches of up to five and follow relevant job/career links for at most two more passes.
5. Normalize fetched text and labeled links, merge redirects/errors, and deduplicate records.
6. Classify individual-opening candidates separately from careers pages and generic aggregators.
7. Extract title, company, location, eligibility excerpt, deadline text, application route, source provenance, and field-level evidence where supported.
8. Score role, keyword, location, and seniority fit heuristically and display review/mismatch labels.

## API routes

- `GET /api/health` — local service status and whether the API key is configured.
- `GET /api/search?query=...&location=IN&language=en` — raw TinyFish Search response for debugging.
- `POST /api/fetch` with `{ "urls": ["https://example.com/careers"] }` — TinyFish Fetch, 1–5 URLs per request.
- `POST /api/discover` — complete preference-based Search → Fetch → link-crawl → normalization pipeline.

Example `/api/discover` request:

```json
{
  "role": "quant research internship",
  "location": "India",
  "keywords": "finance, C++, machine learning",
  "seniority": "Intern",
  "visa": "No preference",
  "countryCode": "IN",
  "language": "en",
  "searchBreadth": "expanded"
}
```

## Test suite

Run:

```powershell
npm test
```

The 33 fixture-based tests cover TinyFish response shapes, multi-level crawling, response merging, redirect and cross-source deduplication, blocked pages, job versus aggregator classification, location and seniority fit, eligibility extraction, link-label interpretation, unsafe/unrelated links, field-level evidence, expanded query strategy, source diversity, ATS URL prioritization, ATS-vs-employer attribution, and generic opening-page suppression. Tests do not make paid TinyFish requests.

## Live acceptance checks before submission

Run at least three searches with materially different preferences:

1. Software engineering internships in India.
2. Remote data science internships.
3. Quant research internships in India.

For each run, check:
- Search variants attempted/succeeded/failed match the selected breadth.
- Candidate titles, employers, locations, and seniority make sense.
- Individual openings remain separate from generic source pages.
- Application-link labels match the available evidence.
- Duplicate listings are merged without combining different locations.
- Missing deadlines or eligibility are left blank rather than invented.
- One blocked source does not fail the entire run.

The crawler caps a run at 15 fetched page URLs, so it will not inspect every search result. A fetched page is not proof that a vacancy remains open.

## Before bounty submission

- Confirm the bounty's exact requirement for TinyFish Search, Fetch, and Agent usage. This project demonstrably uses Search and Fetch; do not claim Agent integration unless it is implemented and verified.
- Prepare a working demo and source/repository link.
- Include concise setup instructions and a short explanation of search, fetch, crawling, deduplication, and fit scoring.
- Complete the required LinkedIn and X posts tagging TinyFish and the Discord `#showcase` post, following the bounty instructions provided to you.
- Keep `.env` out of Git and screenshots.

## Security and deployment limits

This is a local prototype, not a hardened public deployment. The manual Fetch route rejects embedded URL credentials and localhost/non-public local hostnames, but it is not a complete outbound-network security boundary. Before hosting publicly, add authentication, rate limiting, comprehensive private-network/IP controls, redacted request logging, monitoring, and proper secret management. Do not expose the API key to browser code.
