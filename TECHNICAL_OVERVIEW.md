# Technical Overview

## User flow

1. User enters role/opportunity type, preferred location, keywords, level and work-authorization preference.
2. User selects Standard (one query) or Expanded (up to three Search variants).
3. CareerScout queries TinyFish Search and merges distinct results.
4. It selects initial Fetch targets with source diversity in mind, then fetches pages in batches of up to five.
5. Relevant links found in fetched pages can be followed in subsequent bounded batches, up to 15 attempted page URLs total.
6. The Step 9.1 normalizer classifies records as specific-opening candidates or source pages, requires a specific title with supporting evidence, extracts available fields, assigns evidence/provenance, scores fit and deduplicates records. It avoids treating ATS hosts as employers and leaves employer identity blank when ATS-page evidence does not establish it.
7. The UI shows diagnostics and lets users filter candidates by fit without repeating paid Search calls.

## TinyFish primitives in this build

### Search

Used for live discovery and structured results (URL, title, snippet, source host). Expanded mode builds up to three queries and reports the status of each variant. Search does not verify that a vacancy is open.

### Fetch

Used to retrieve clean page content and link data for selected URLs. Fetch errors are tracked per URL so one blocked source does not erase successful pages. The 15-page cap is deliberate to limit latency and API usage.

### Agent

The Step 9.1 code does not call TinyFish Agent. Agent API documentation describes a separate goal-based automation API (`POST https://agent.tinyfish.ai/v1/automation/run`, `/run-async`, or `/run-sse`). If the original bounty criteria require Agent use rather than merely an explanation of the available primitives, this is a submission blocker until integrated and live-tested.

## Local processing

The Node.js pipeline handles query orchestration, bounded crawling, URL canonicalization, scoring, candidate classification, field-level evidence and output shaping. Scores are heuristic signals and not a hiring or eligibility decision. The app does not submit applications or enter credentials.

## Safety / secrets

- API key is server-side only in `app/.env`.
- `.env` is excluded by `.gitignore`; `.env.example` contains an empty placeholder.
- The app binds to `127.0.0.1` by default and is intended as a local prototype. It is not hardened for public deployment without authentication, rate limiting, strict outbound-network controls and production secret management.
