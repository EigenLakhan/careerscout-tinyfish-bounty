# Known Limitations & Submission Blockers

## Hold before final submission

### P0 — Company attribution can confuse an ATS with the employer

**Code fix implemented in Step 9.1; fresh live verification pending.** The Step 8 report lists a Greenhouse-hosted `Software Engineer, Machine Learning` role but assigns the company as `Greenhouse`, while the page snippet mentions Glean. Step 9.1 checks explicit employer evidence in snippet/page content and never uses a recognized ATS hostname as the hiring-company fallback. If evidence is insufficient, the company remains blank. A fixture proves the Glean example; rerun live discovery before marking this blocker closed.

### P0 — Generic internship pages can be misclassified as individual openings

**Code fix implemented in Step 9.1; fresh live verification pending.** Step 9.1 detects generic titles such as `Internship Openings` and `Software Engineering Internship Program` and requires a specific role title with supporting page/URL evidence. Generic qualifications/responsibilities text is no longer enough to classify a generic program page as a vacancy. The MERL-like false-positive case is covered by a fixture; rerun live discovery before marking this blocker closed.

### P0 — Live result quality is still low

The run produced 40 leads but only 2 job candidates, no strong matches, and one direct-apply-style link. Many results were broad landing pages (including city-specific Internshala pages), generic informational pages, or social/community sources. The Step 9.1 patch fixes ATS attribution, generic opening-title, and role-prefixed program-title classification rules but does not itself prove higher candidate yield or stronger matches. Re-run source-diverse live searches and inspect candidates manually; do not inflate candidate counts just to make the metric look better.

### P0 — Agent API requirement must be resolved

The app uses TinyFish Search and Fetch only. TinyFish documents Agent as a separate goal-based API. Check the original bounty acceptance criteria; if Agent use is required, add an explicit, credit-aware, user-initiated Agent feature and test it. Do not falsely claim Agent usage in the submission copy.

### P1 — No public demo or repository URL is included yet

The app is a local Node.js prototype. Publish the source to a clean repository and provide a reviewer-accessible demo or another demo format accepted by the bounty. Never commit `.env`, API keys or sensitive local files. A public deployment needs additional security controls; do not deploy the current local prototype without reviewing the security section in `app/README.md`.

## Known product limits

- `page_checked_opening_candidate` is a classification label, not proof that a vacancy remains active.
- Direct-apply classification depends on explicit link/URL evidence; the destination is not necessarily click-tested.
- The page crawl is capped at 15 URLs per run, so many leads remain uninspected.
- Fit scores are heuristics; they are not an eligibility or hiring decision.
- Current tests are fixture-based. They do not prove all external portals work consistently.
