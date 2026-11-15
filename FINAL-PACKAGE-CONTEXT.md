# Context: McKinley Project 2 (Business+Tech AI Sprint 26), final package

Paste this whole file into a new chat. Ask for help writing the final package deliverables (slide deck, test results sheet, demo videos, user guide, README, exit email). Everything below comes from a review of the team's GitHub repository on Nov 15, 2026. The demo/reveal is **November 17**.

---

## 1. The client and the problem

- **Client:** McKinley (apartment property management company with 49 communities in Michigan (Ann Arbor, Ypsilanti) and Florida (Orlando, Winter Park, Brevard)).
- **User:** the maintenance supervisor/manager.
- **Problem:** each morning the manager faces a pile of resident work orders. Deciding what to fix first, who goes where, and whether a visit is even needed takes time and is easy to get wrong. Emergencies (gas, flooding, no heat) must never be missed, and the same unit shouldn't keep getting the same repair.
- **Promise / tagline:** "Know what to fix first." The tool shows what to handle first **and why**. The manager always has the final say.
- **Rules the tool must never break:** never downgrade an emergency; never produce a plan worse than one made by hand; show the reason for every ranking; flag when unsure and let the manager decide; made-up data only.

## 2. What we built: two connected tools

### A. Triage Board (the main app)
React web app. Separate **staff app** and **resident app** (at `/resident/`).

**Staff tabs:** Priority (ranked queue), Routes (each technician's day), Map (work orders on each property's site plan), Planning (move-out turns and preventive maintenance), Stats (incl. weekly team-hours chart), Teams (sites, supervisors, technicians), Add (friendly resident-chat intake form), Access (PINs, resident codes).

**Key features**
- **Ranked queue:** severity 1–5 (Cosmetic → Routine → Soon → Urgent → Emergency), each with a reason and a time target (Go now / Same day / 48 h / week / when convenient). Colored cards.
- **Rules engine:** keyword rules force minimum priorities (gas, fire, flood, sewage, sparks = Emergency; no heat/AC, lockout, no hot water, dead fridge = Urgent). Attaches pets, entry windows, contact preferences ("never call before 10 AM", "text first") and repeat-repair flags. Suggests outside vendors (e.g. pests, mold, major HVAC). Understands spoken unit numbers ("building eleven unit one forty three").
- **AI step (Claude):** reads the resident's message once and saves the answer: severity, reason, likely cause, whether a visit is needed, a safe resident tip, hidden risks (babies, elderly, water near electrical), and an English translation. **AI can raise priority, never lower it.** It runs through a here.now proxy, so no API key is in the website. Without the key (test links), the app falls back to its built-in rules.
- **Emergency banner** with one-tap directions, call, and done buttons.
- **Routes and on-call schedule:** groups jobs by property and nearby buildings, respects entry windows and shifts. Regular vs after-hours; on-call technicians get urgent jobs and routine work waits.
- **Roles and sign-in:** property manager (sees only their own properties), supervisor (by area), technician ("My day" in their own language: English, Spanish, Portuguese, Haitian Creole), resident (property + unit + code; sees only their own requests).
- **Job progress:** on the way → started → waiting on parts → done, with photos. Resident confirms "is it fixed?".
- **Export day for evaluation:** saves an approved day and its plan as a case file that the Evaluator grades (only the signed-in supervisor's own properties).
- **Data:** McKinley's 49 real communities (public addresses, leasing phones, 42 site-plan images). All residents, technicians, supervisors and work orders are **made up** (from the sprint's sample resident spreadsheet, R001–R020 plus more).

### B. Plan Evaluator (the proof tool)
A separate app that grades **any** planner (our rules engine, an AI model, a person) against a **naive by-hand plan** (requests in order received, each to the first technician with the right skill). Planners and evaluator share only a JSON "case file" (`plan-case/v1`). The planner never sees the answer key.

**8 steps:** 1 Write the test day → 2 Planner makes a plan → 3 Plan handed back → 4 Check (could it work in real life?) → 5 Compare (plan the same day by hand) → 6 Score (both graded the same way) → 7 Gates (must-pass) → 8 Scorecard.

**Must-pass checks:** every request covered once; nobody in two places at once; no job starts before the shift.
**Gates:** no emergency treated as less urgent; plan not worse than by hand (jobs finished, wasted trips, cost). A plan that fails a gate is capped at 40.
**0–100 score:** jobs done on time inside entry windows (35), urgent jobs reached quickly (20), right skill sent (15), resident notes reached the technician (15), time working vs driving (15). Extra credit up to +10 for more jobs finished and shorter routes (only if every gate passes). Verdicts: Strong ≥85, Good ≥70, Fair ≥50, Weak.
Can load several case files at once and gives an overall job-weighted score. A "Compare planners" screen (Shivaji's branch) tests planners over many days with paired statistics.

## 3. Test results (real numbers from Nov 15 runs)

| Test | Result |
|---|---|
| Triage rules: 22 made-up test orders vs expected answer | **22 / 22 correct** |
| Spoken unit numbers read correctly | **5 / 5** |
| Gas / flood / no-heat always Emergency | **Pass (5 orders)** |
| End-to-end browser journeys (resident request → supervisor approves → tech assigned → tech does it → resident confirms; wrong PIN refused; resident app has no staff sign-in; manager sees only own properties; no page errors) | **11 / 11 pass** |
| Evaluator on the exported "Maintenance Hub Tue (22 requests)" day (16 jobs scheduled) | Triage Board plan **99/100** vs by hand **91/100**; all checks and gates pass; **final 101** with extra credit |
| — breakdown | 16/16 jobs done in window; 16/16 right skill; urgent jobs reached in 55 min on average; 93% of on-clock time spent working, not driving; resident-notes measure not applicable on that day |

**The 22 test orders (one row each for the test sheet):**

| ID | Resident | Message (short) | Expected |
|---|---|---|---|
| W01 | R001 | AC blowing warm, 82°, third time this year; dog Biscuit | Urgent (4), repeat |
| W02 | R008 | Sink leaking again, 4th time | ≥ Urgent, vendor |
| W03 | R010 | Smell gas near stove, cat hiding | Emergency (5) |
| W04 | R005 | No heat, 54°, furnace not coming on | Emergency (5) |
| W05 | R015 | Roaches again, treat neighbors | Vendor |
| W06 | R003 | Bathroom outlet out, after 11 AM | Routine (2) |
| W07 | R018 | Locked out, key snapped | Urgent (4) |
| W08 | R004 | Water pouring from washer, flooding hallway | Emergency (5) |
| W09 | R017 | Dishwasher not draining | Soon (3) |
| W10 | R011 | Closet door off track | Routine (2), hold |
| W11 | R002 | Toilet keeps running | ≥ Routine |
| W12 | R012 | "No hay agua caliente" (Spanish) | Urgent (4) |
| W13 | R020 | Smoke alarm chirping, burning smell from outlet | Emergency (5) |
| W14 | R013 | Scuffed paint, nail hole | Cosmetic (1), hold |
| W15 | R006 | Hallway light out | ≥ Cosmetic |
| W16 | R009 | Fridge stopped cooling | Urgent (4) |
| W17 | R007 | Gym door by pool won't latch | No unit entry needed |
| W18 | unknown | Ceiling leak, baby in next room | Flag resident not found, ≥ Urgent |
| W19 | R016 | Mold on bathroom ceiling, growing | Vendor |
| W20 | unknown | "Apartment 222", heater dead, freezing | Emergency (5) |
| W21 | unknown | "building eleven, unit one forty three", water through ceiling light | Emergency (5), matched to R007 |
| W22 | unknown | "Building eleven unit four", toilet overflowing | Read as Building 11 Unit 4, not found |

Resident test cases from the sample sheet: R001 recurring AC; R003 never call before 10 AM, text first; R008 missed manager callback; R010 cat must not get out; R012 Spanish-speaking; R014 and R019 never contact the office.

Not yet measured: the AI step's accuracy with the real API key (runs only once the instructor adds `ANTHROPIC_API_KEY` in here.now). Earlier testing showed the demo-video claim "0 of 4 gas leaks ranked low"; re-verify before using it.

## 4. Demo videos (drafts exist)

Both are 60-second, keynote-minimal, music only. **Voiceover not recorded yet; screens are mockups.** Open items: record voiceover, replace `[URL]` and placeholder logo, re-record screens from the real app, fill in real numbers.

**Triage Board voiceover:** "Forty messages came in overnight. / One is an emergency. / Meet Triage Board. / Know what to fix first. / Open the board. / Every request is ranked, with the reason. / Approve in one click. / Your crew has their day. / Then test the plan. / Against one you'd make by hand. / Zero gas leaks ranked low. / Know what to fix first. / See it live November 17."

**Evaluator voiceover:** "An AI built today's plan. / Would you trust it? / Meet Evaluator. / Prove the plan is safe. / Run a made-up day. / The answer key stays hidden. / Plan the same day by hand. / Then check both. / Pass the gates first. / Then see the score. / [N] of [N] checks pass. / Prove the plan is safe. / See it live November 17." (suggested fill: "5 of 5 checks pass", or use the 99 vs 91 score)

The 2–3 minute workflow walkthrough is **not made yet**. Suggested flow: resident submits request on phone → supervisor sees it ranked with reason → approve and assign → technician's My day (in Spanish) → progress + photo → resident confirms fixed → export day → Evaluator scorecard.

## 5. How it works (for README / architecture slide)

1. **Data:** sample resident spreadsheet + made-up technicians, supervisors, vendors, travel times, 22 test orders; McKinley's public community list and site plans. Settings in one file so real data can replace it later.
2. **Rules engine:** severity floors, entry rules, pets, repeat-repair flags, vendor suggestions.
3. **AI step:** Claude reads each message once; can only raise priority; treats resident text as data, not instructions.
4. **Scheduler:** builds each technician's day by property, entry window, shift, on-call.
5. **Manager app:** ranked queue, routes, map, approvals, roles.
6. **Evaluator:** grades the plan vs a by-hand plan; must-pass gates; 0–100 score.

**Tech:** React + Vite static website hosted on **here.now** (not Vercel/Render). Shared saved data uses here.now Site Data (one "events" collection). AI calls go through a here.now proxy route that adds the API key server-side.

**Keeping it running:**
- Instructor/IT must add `ANTHROPIC_API_KEY` in here.now (workspace + dev-site account) for the AI step; otherwise rules-only mode.
- Property managers are listed in `src/access/managers.json` as SHA-256 fingerprints of their work email (no real emails in the public repo); demo passcodes `annarbor-demo`, `ypsilanti-demo`, `orlando-demo`, `winterpark-demo` must be replaced before real use. Staff PINs are samples.
- Run `npm test` to recheck rules + browser journeys after any change.
- **Limits (be honest in README):** PIN checks run in the browser and every browser receives all data; fine for a demo/pilot, but real resident data needs a server (McKinley IT via Yardi / RentCafe / Databricks) that returns only each person's records, with the resident app on a separate site.
- Next steps / future: connect Yardi, RentCafe, Voyager, Databricks; get McKinley's real entry-notice rules, vendor list, technician roster and drive times; measure AI accuracy on real messages.

## 6. Current state of the code: what must happen before the "Live tool" link works

**Important:** the `main` branch still shows only the **blank starter page**. All real work sits on separate, unmerged branches, and the team's `development` branch (where merged work feeds the dev site) **does not exist yet**.

| Branch | What's on it | Status |
|---|---|---|
| `claude/shayla-evaluator-export` | **Most complete Triage Board** (Shayla's work + Macy's resident chat/look + export to Evaluator). Builds; 22/22 + 11/11 tests pass. | Not merged |
| `Shayla` | Same as above minus the export button | Not merged |
| `Macy`, `claude/lucid-newton-xvurbh` | Earlier triage board: site maps, emergency banner, resident chat | Folded into Shayla's |
| `claude/compassionate-clarke-i8894k` | **Most complete Plan Evaluator** (multi-file grading, extra credit). Builds. | Not merged |
| `Shivaji` (+ `Shivaji-evalcompare`) | Earlier evaluator + "Compare planners" statistics over many days | PR #2 merged into Shivaji, not main |
| `johnson` | Demo video drafts | Merged to main (PR #1) |
| `claude/ecstatic-maxwell-j9y3o3` | Early triage board prototype | Superseded |
| `claude/dazzling-davinci-oh68xj`, `claude/gallant-bardeen-5mo89m` | Unrelated practice projects (welding-robot risk board, referral inbox) | Ignore |

Also: 42 site-map images sit loose in the repo root on `main` (Shayla's branch moves them into `public/site_maps/`).

**To-do for a live link:** ask staff/instructor to create the `development` branch; open a PR of the Triage Board branch into it; decide how to host the Evaluator (second site, or a tab/route inside the same app, since both currently replace the same main page and will conflict); have the instructor add the API key; verify on a phone.

## 7. Deliverables checklist (from the course slide)

| Deliverable | What it is | Status / notes |
|---|---|---|
| **Live tool** | Link the client opens on their device | Team dev site / public address (here.now). Needs merging first (section 6). Resident link = `<site>/resident/`. |
| **Slide deck** (8–10, Google Slides) | Problem → recommendation | Suggested: 1 Title · 2 Problem · 3 Who uses it · 4 Solution (Triage Board) · 5 How it works · 6 AI with guardrails · 7 Proof: Evaluator · 8 Results (22/22, 11/11, 99 vs 91) · 9 Rollout & limits · 10 Recommendation / next steps |
| **Test results sheet** (Google Sheets) | One row per example, score at top | Use the 22 orders in section 3 (columns: ID, resident, message, expected, actual, pass). Score at top: 22/22 (100%). Second tab: 11 journey checks. Third tab: Evaluator scorecard. |
| **Demo videos** | 2–3 min walkthrough + 60-s overview | Two 60-s drafts exist (need voiceover + real screens). Walkthrough not yet recorded. |
| **User guide** (PDF) | Step by step with screenshots | By role: resident, supervisor, technician, property manager; plus Evaluator. Screenshots from the live link. |
| **README** (PDF, one page) | How it works + how to keep it running | Live link at the top. Use section 5. |
| **Exit email** | Folder link, access ending, client data deleted | Sent by team lead after presentation. Note: no real client data was ever used (all synthetic); API key and here.now access will be removed by staff; repo is public. |

All data in this project is made up. Never put real resident information into any deliverable.
