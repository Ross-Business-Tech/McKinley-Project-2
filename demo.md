# Demo: AI Maintenance Triage Board (McKinley)

Business+Tech AI Sprint 26. All data is **synthetic** (made-up residents, communities, technicians and vendors). No real person or property appears anywhere.

## The problem

McKinley's maintenance manager starts each day with a pile of work orders. Deciding what to handle first, who goes where, and whether a visit is needed at all takes time and is easy to get wrong. Emergencies must never be missed, and the same unit should not keep getting the same repair.

## What the tool does

One screen the manager opens first thing each day. It shows **what to handle first and why**, so the manager can decide quickly. The manager always has the final say.

## Who uses it

The maintenance manager.

- **Input:** new work orders (resident message, unit, category) plus the resident's history.
- **Output:** a ranked job queue, a suggested crew split for each technician, and a printable day plan.

## Demo script (about 5 minutes)

1. **Open the board.** The summary strip shows four counts: needs action today, repeat problems, open work orders, and may not need a visit.
2. **Read the ranked queue.** Each card has a colored edge (red urgent, amber soon, green routine), the request, the resident, and a one-line reason for its rank.
3. **Show the rules at work.** A leak or a no-heat/no-cooling call is forced up to a minimum priority. Entry rules and pets are attached to the job automatically.
4. **Show the AI step.** The AI reads the resident's message and the technician notes. It can raise a job's priority, never lower it. It spots hidden constraints, guesses the likely cause, and suggests whether a visit is needed. It flags low-confidence results for the manager.
5. **Show a repeat problem.** Resident R001 has a recurring AC problem. The card is tagged as a repeat, and units with 3 or more repeat repairs are flagged.
6. **Show the resident context.** Resident R010 has a cat that must not get out, and R003 should never be called before 10 AM. The card shows the entry window, pets and contact preference.
7. **Open the crew split.** The scheduler groups jobs by community and fits entry windows. It also builds a "by hand" plan and only shows its own plan if it is better. The savings line shows the time saved.
8. **Ask the chat box.** Questions like "Which units have repeat repairs?" are answered from the database using a fixed set of lookups.
9. **Approve.** Click Approve and assign, Change priority, or Call resident. Every decision is logged so the team can see where the tool was right or wrong.

## Screen layout

- **Summary strip** across the top.
- **Ranked queue** on the left (wider), one card per request, with Approve and assign, Change priority and Call resident buttons.
- **Side panel** on the right: suggested crew split by technician and time, plus a repeat-problems chart.
- **Data table** at the bottom: what data we have and what is still missing.

## How it works

| Step | Part | What it does |
|---|---|---|
| 1 | Data sources | The sample resident spreadsheet, plus invented technicians, vendors, travel times and 20 test orders. |
| 2 | Data adapter and database | Everything loads into one small database. The adapter is a swap point so real data can replace the spreadsheet later. |
| 3 | Rules engine | Fixed rules for what must always be right: emergency priority floors, entry rules and pets, repeat-repair flags. |
| 4 | AI step | Reads messages and notes. Can raise priority, never lower it. Each order is read once, then saved. |
| 5 | Scheduler | Ordinary code builds each technician's day and compares it with a by-hand plan. |
| 6 | Manager app | Ranked queue, chat box, printable day plans. |
| 7 | Manager decides | Approvals and changes are recorded. |

## Rules the tool must never break

- Never downgrade an emergency.
- Never produce a plan less efficient than one made by hand.
- Show the reason for every ranking.
- Flag it when unsure, and let the manager decide.
- Use made-up data only.

## Test cases from the sample data

| Resident | What it tests |
|---|---|
| R001 | Recurring AC problem (repeat repair) |
| R003 | Never call before 10 AM, text first |
| R005 | Renewal question asked twice |
| R006 | Repeated misdelivered packages |
| R008 | Missed manager callback (follow-up owed) |
| R010 | Cat that must not get out (pet entry rule) |
| R011 | Payment plan request |
| R012 | Spanish-speaking resident |
| R014, R019 | Never contact the office |
| R020 | Renewal negotiation |

The goal is to run all 20 test orders and compare each result with its expected answer.

## Open questions for the team

- Which language and tools will we use (Python assumed)?
- How do we get an AI API key for the prototype? Keys must never go in the code. Use a here.now proxy route set up by the instructor.
- The README's example column does not match row R001. Tell the sprint organizers.
- Later: access to Yardi, RentCafe, Voyager and Databricks, and the entry-notice rules.

## Sources

Google Drive folder "AI Tech Sprint 26": AI Sprint Architecture, Architecture, um_ai_sprint_sample_residents.xlsx, the "Map Your Build" worksheet photo, and the AI Sprint Company Brochure.
