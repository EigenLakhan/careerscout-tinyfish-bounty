# Bounty Rules & Submission Plan

This checklist is based on the official rules supplied by the builder. It is a planning aid, not a claim of approval.

## Eligibility and deadline

- Confirm the account is registered in the TinyFish Students or Ambassadors program.
- Confirm the exact bounty launch date and calculate the 18-day submission window. The launch date is not recorded in this package, so the deadline must be checked in the TinyBounties dashboard.
- New bounties generally drop on the first Monday of each month; do not infer this bounty's exact closing time from that recurrence.

## One-shot submission warning

- One individual entry per person per bounty. Do not submit as a team.
- Claiming a bounty does not reserve it or guarantee approval.
- Submissions are final. Treat the final acceptance checklist as a hard go/no-go gate; do not submit a known-bad build intending to replace it later.
- Only the top three builds per bounty are approved. Meeting the minimum criteria is necessary, but approval is competitive and not guaranteed.

## Required submission items

- A reviewer-accessible working build link (repository, live demo, or cookbook PR, as accepted by the bounty). Include concise notes explaining what it does and exactly how TinyFish is used.
- A LinkedIn post about the build, tagging TinyFish: https://www.linkedin.com/company/tinyfish-ai/
- A post in the TinyFish Discord `#showcase` channel.
- X is optional under the general rules supplied here, **unless this specific bounty's own submission instructions explicitly require it**. Re-check the bounty-specific page before omitting it.
- Complete every additional requirement listed on the Careers Finder bounty page.

## Approval criteria to demonstrate

- TinyFish performs meaningful live-web work (searches and/or reads live pages; not canned fixture results).
- The workflow works end to end across different role/location/keyword inputs, not just one scripted query.
- The build is original and purpose-built for this bounty.
- Every bounty-specific approval criterion passes. The supplied project history says the Careers Finder brief asks for live openings, preferences, structured/deduplicated listings with application links, and an explanation of TinyFish Search, Fetch, and Agent usage. Confirm whether Agent must actually be invoked or whether the brief asks only for a usage explanation; do not claim Agent integration unless implemented and tested.

## Current go/no-go decision

**HOLD — do not submit yet.** Step 9.1 contains code-level fixes for the ATS/employer attribution error and generic MERL internship-page false positive, with fixtures in the 33-test suite. The Step 8 live report remains the only live evidence (40 leads, 15 pages fetched, 2 candidates, 0 strong matches, 1 direct-apply-style link). Complete fresh live acceptance searches, inspect the classifications, improve low result quality if needed, verify Agent expectations against the exact bounty page, and publish reviewer-accessible links before making the one final submission.

## Fair-play and security

- Do not use copied/recycled work, fabricated sources, or artificial TinyFish calls just to inflate usage.
- Never publish API keys, passwords, or other people's personal data. Keep `.env` out of the repository and screenshots.
- Do not invent vacancy status, eligibility, deadline, company identity, or successful application destinations when the evidence does not support them.
