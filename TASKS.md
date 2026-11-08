# Architecture Task Split: AI Maintenance Triage Board

Based on the Architecture PDF. Task numbers match the PDF's to-do list. All data stays **synthetic** (made-up people and properties only).

## At a glance

| Person | Focus | Tasks |
|---|---|---|
| **Shivaji** | Data and scheduler | 4, 5, 6, 7, 8, 13 |
| **Macy** | Rules and AI | 9, 10, 11, 12 |
| **Shayla** | Manager screen | 14, 15, 16, 17 |
| **Everyone** | Setup and proving it works | 1, 2, 3, 18, 19 |

## Shivaji: Data (steps 1-2) and Scheduler (step 5)

Builds the shared database everyone else reads from, plus the scheduler that uses the travel times created here.

- [ ] 4. Load the resident spreadsheet into SQLite.
- [ ] 5. Create the technician table: names, region, skills, shifts.
- [ ] 6. Create the vendor table: one each for HVAC, plumbing and pest.
- [ ] 7. Set rough travel times between the four communities.
- [ ] 8. Write 20 test orders covering each README test case, with the expected result for each.
- [ ] 13. Build the scheduler and the by-hand baseline, plus the comparison.

**Hands off to:** Macy (test orders and database to run rules on) and Shayla (day plans to display).

## Macy: Rules engine (step 3) and AI step (step 4)

Builds the "brains": the fixed rules that must always be right, and the AI that reads messy text.

- [ ] 9. Write the priority floor rules (leaks, no heat or cooling by region, lockouts, smoke or gas).
- [ ] 10. Write the entry-rule and repeat-repair checks (3 or more repeat repairs gets flagged).
- [ ] 11. Write the AI prompt and its JSON output format.
- [ ] 12. Add the "never lower priority" and low-confidence checks on the AI output.

**Hands off to:** Shayla (ranked priority, reasons and flags for each job card).

## Shayla: Manager app (steps 6-7)

Builds the one screen the maintenance manager opens each day.

- [ ] 14. Build the ranked queue with job cards (red/amber/green edge, one-line reason, tags).
- [ ] 15. Build the chat panel with its fixed set of lookups.
- [ ] 16. Build the printable day plans with the savings line.
- [ ] 17. Add the Approve and assign, Change priority and Call resident buttons, with every decision logged.

Also covers the layout from the design summary: summary strip, ranked queue (left, wider), side panel with crew split and repeat-problems chart (right), data table (bottom).

**Depends on:** Shivaji's data and scheduler, and Macy's rules and AI output. Start with sample data so the screen can be built in parallel.

## Everyone (shared)

- [ ] 1. Confirm the team's language and tools (Python assumed). *Decide together on day one.*
- [ ] 2. Tell the sprint organizers the README's example column doesn't match row R001. *Shivaji sends it, since that person works with the spreadsheet.*
- [ ] 3. Get an AI API key for the prototype. *Macy asks the instructor. Never put keys in the code; use a here.now proxy route.*
- [ ] 18. Run all 20 test orders and compare against expected results. *All three, once the pieces connect.*
- [ ] 19. Prepare a short demo showing time saved versus the by-hand plan. *Shayla leads; the others supply their parts.*

## Midpoint to-dos

- [ ] Define the problems
- [ ] Discuss what we need
- [ ] Show the interface (at least the user interface), led by Shayla
- [ ] Send the deck to the client a day before the call

## Suggested order

1. **Day one, together:** tasks 1 and 3.
2. **In parallel:** Shivaji starts the data (4-8), Macy writes the rules (9-10), Shayla builds the screen with sample data (14-17).
3. **Then:** Macy adds the AI step (11-12), Shivaji builds the scheduler (13).
4. **Last, together:** tasks 18 and 19.
