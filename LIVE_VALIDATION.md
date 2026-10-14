# Step 8 Live Validation — Observed Results

**Source:** `../evidence/Step8-Live-Run.pdf` (18-page UI/PDF capture supplied after the Step 8 live run).  
**Test scenario:** software engineering internship; India; Python, C++, machine learning; level `Student`; expanded search.

## Observed summary

| Measure | Observed result |
|---|---:|
| Search results / linked leads | 40 |
| Search variants attempted | 3 |
| Search variants succeeded | 3 |
| Search variants failed | 0 |
| Pages fetched | 15 |
| Fetch failures | 0 |
| Follow-up links queued | 10 |
| Records classified as job candidates | 2 |
| Source leads | 38 |
| Strong matches | 0 |
| Potential matches | 2 |
| Direct-apply-style links | 1 |
| Specific role links | 1 |
| Duplicate groups merged | 0 |

## What worked

- The local app completed a live discovery run.
- All three Search variants returned successfully.
- The 15-page Fetch limit was respected and all 15 attempted fetches succeeded in this run.
- The UI exposed query diagnostics, candidate/source separation and field-level evidence.
- Application link types were labeled instead of presented as all equivalent.

## What the run does not prove

- It does not prove a vacancy is still open.
- It does not show strong matching performance; the strong-match count was zero.
- Two candidates out of 40 leads is a low candidate yield and both need manual review.
- The Greenhouse-hosted Glean role was attributed to `Greenhouse` as the company, even though the snippet describes Glean. This appears to be an ATS-host attribution bug.
- The `MERL — Internship Openings` page looks like a general internship/program page, yet was classified as an individual-opening candidate. It also surfaced research/publication qualifications that may not fit a typical software engineering internship. This appears to be a candidate-classification false positive.
- The single direct-apply-style link was not click-tested. The app notes this limitation.
- `0` Fetch failures means only that the selected URLs fetched successfully, not that source coverage or classification is good.

## Acceptance interpretation

This run validates Search/Fetch execution and diagnostics, but **does not yet validate the core value proposition strongly enough for an unqualified submission claim**. Fix the attribution and false-positive issues, improve candidate yield/source quality, and rerun at least three different queries before treating the app as acceptance-tested.


## Step 9.1 code-level regression update (not a new live run)

After reviewing the Step 8 report, the normalizer was patched and covered with new fixtures:

- **ATS/employer attribution:** a Greenhouse-hosted role whose snippet says “Glean is the Work AI platform…” now uses `Glean` from snippet evidence rather than `Greenhouse`. If ATS-hosted content does not establish the employer, the company remains blank and evidence says the ATS platform is not the hiring company.
- **Generic page classification:** an `Internship Openings` page and a `Software Engineering Internship Program` page with generic qualifications/responsibilities text remain source/program pages, not an individual-opening candidate.
- **Specific URL checks:** broad `/jobs/<search-slug>` routes are no longer automatically treated as specific postings/application links.
- **Automated tests:** `npm test` passes **33/33** fixture tests, including targeted employer/classification cases and broad-board-link coverage.

**Important:** the reported Step 8 live numbers above remain historical evidence. Step 9.1 has not yet been run against TinyFish live APIs after these fixes; the final acceptance checklist remains on hold until new live reports confirm the fixes.
