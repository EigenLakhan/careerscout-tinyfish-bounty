# Final Acceptance Checklist

Use this as a strict go/no-go gate. Do not mark a box complete just because a code path exists; demonstrate it with the current release. Because the bounty rules say submissions are final and only one submission per person per bounty is allowed, do not submit while P0 issues remain.

## Eligibility and timing

- [ ] Confirm registration in TinyFish Students or Ambassadors program.
- [ ] Confirm the bounty's actual launch date and deadline (18 days from launch) in TinyBounties.
- [ ] Confirm this is an individual build and this will be the one submission for this bounty.

## Product quality

Step 9.1 adds unit-tested code fixes for ATS company attribution and generic-opening suppression. Keep the live-validation boxes unchecked until the new build has been run against TinyFish and the resulting cards inspected.

- [ ] Correct ATS/company attribution; unresolved employer remains blank rather than guessed.
- [ ] Generic careers/program pages do not appear as individual job candidates.
- [ ] Individual candidate title, location and seniority are supported by evidence.
- [ ] Role-specific search produces useful candidates across different input combinations.
- [ ] Direct-apply vs specific-role vs generic careers links are accurately labeled.
- [ ] Duplicates are merged only when title/company/location identity is sufficiently strong.
- [ ] Blocked URLs are reported without failing the whole discovery run.
- [ ] No fake sources, recycled/copied work, or artificial TinyFish calls to inflate usage.

## Live testing

- [ ] Software engineering internships — India.
- [ ] Data science internships — remote.
- [ ] Quant research internships — India.
- [ ] Record search variants, successful fetches, candidate count, strong matches, direct links, and failures for each run.
- [ ] Manually inspect the top candidate from each run and verify the source page is an individual opening.
- [ ] Confirm no secrets are visible in screenshots or exported JSON.

## TinyFish requirement fit

- [x] Search API is integrated.
- [x] Fetch API is integrated.
- [ ] Read the exact Careers Finder bounty-specific criteria and confirm whether Agent API integration is required, or whether the requirement is only to explain Search/Fetch/Agent usage.
- [ ] If Agent use is required, integrate it as a real, useful, user-initiated feature and live-test it; otherwise accurately disclose that Agent is not integrated.
- [ ] Verify that TinyFish performs meaningful live-web work and that the app handles different inputs end to end.

## Packaging and publishing

- [ ] Run `npm test` in `app/` from the final extracted package.
- [ ] Run local UI/health smoke test and fresh live requests for all three test scenarios above.
- [ ] Publish a repository without `.env`, `node_modules`, or API keys.
- [ ] Make a reviewer-accessible build link available (repository, live demo, or cookbook PR as accepted by the bounty).
- [ ] Replace public demo/repository placeholders in `docs/SUBMISSION_DRAFT.md`.
- [ ] Publish the required LinkedIn post tagging TinyFish.
- [ ] Share the required Discord `#showcase` post.
- [ ] Publish on X only if required by this specific bounty's own instructions; X is optional under the general rules supplied.
- [ ] Confirm all additional requirements on the specific Careers Finder bounty page are satisfied.
- [ ] Submit the build link plus notes on what it does and how TinyFish is used through the official dashboard.

## Decision

**Current decision: HOLD pending fresh live verification.** Step 9.1 fixes the observed classification bugs in code and the 33/33 fixture suite passes. The Step 8 live report remains the last live evidence and still shows 2 candidates and 0 strong matches. Rerun the acceptance searches, confirm employer attribution and generic-page suppression in the actual UI, then resolve the remaining blockers before the single final submission.
