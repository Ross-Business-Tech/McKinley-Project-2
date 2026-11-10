# Case file format (`plan-case/v1`)

The Plan Evaluator and any planner (a rules engine, an AI model, a person, a scheduling tool) are **separate apps**. They share nothing except this one JSON file. A planner writes a case file; the evaluator reads it and grades the plan.

Everything in a case file is **made-up sample data** unless your team decides otherwise. Do not put real resident information in a file that is committed to this public repository.

You can see a complete example any time: in the evaluator, open **Test day** and press **Download example with a plan**.

## Shape

```json
{
  "format": "plan-case/v1",
  "title": "Tuesday, Ann Arbor",
  "source": "where this day came from (optional)",
  "shift": { "start": "08:00", "end": "16:00" },
  "communities": {
    "SK": { "name": "Spruce Knob", "region": "Michigan" }
  },
  "travel": {
    "within": 5,
    "pairs": [{ "a": "SK", "b": "GH", "minutes": 12 }]
  },
  "crew": [
    { "id": "T1", "name": "Dale", "trade": "HVAC + plumbing", "skills": ["hvac", "plumbing"], "base": "SK", "rate": 38 }
  ],
  "requests": [
    {
      "id": "W1",
      "resident": "R008",
      "community": "SK",
      "skill": "plumbing",
      "durationMin": 60,
      "window": ["09:00", "15:00"],
      "urgency": 3,
      "mustTell": "callback",
      "text": "What the resident wrote",
      "note": "Staff note the technician must receive"
    }
  ],
  "plan": {
    "planner": "Name of whatever made this plan",
    "assignments": {
      "T1": [{ "id": "W1", "start": "09:30", "note": "Staff note passed to the technician" }]
    },
    "urgency": { "W1": 3 }
  }
}
```

## Fields

**Required:** `communities`, `crew`, `requests`. Each crew member needs `id`, `skills` and `base`. Each request needs `id`, `community`, `skill` (or `trade`) and `durationMin`.

**Times** are `"HH:MM"` (24 hour) or `"8:30 AM"`, or a number of minutes after midnight.

**Drive times:** `within` is minutes between two stops in the same community (default 5). Any pair of communities not listed in `pairs` cannot be driven in a day, unless `travel.otherMinutes` is set. Technicians only cover requests in their own `region`.

**Crew pay** (for the cost estimate): `rate` is dollars per hour. For an outside vendor use `"vendor": true` and `"flat"` (dollars per visit).

**Crew extra:** `serves` is a list of community codes a technician covers. If it is left out, a technician covers every community in the same `region` as their `base`.

**On hold:** give a request `"hold": "reason"` when the planner deliberately did not schedule it (for example, waiting on the resident's OK to enter, or the unit could not be found). Held requests are listed on the scorecard and are not scheduled or scored. A held request whose `urgency` is 3 is flagged as needing a person today. A held request may leave out `community`, `skill` and `durationMin`.

**Request extras (all optional):**
- `urgency`: the **reference** answer, 3 = Urgent, 2 = Soon, 1 = Routine (or `"urgent"`, `"soon"`, `"routine"`). It is what a careful person would decide. If no request has one, the "no emergency treated as less urgent" gate is skipped and says so.
- `mustTell`: a phrase that must appear in the note the technician receives. If absent, the note check is skipped for that request.
- `window`: when the resident allows entry. Defaults to the whole shift.
- `facts`: a list of short strings (pets, language, contact preference) shown on screen.
- `source`: free text label, such as a spreadsheet row.

**`plan` (optional):** leave it out to describe the day only (the evaluator then grades its built-in rule-based planner on that day). Include it to have that plan graded.
- `assignments`: for each crew id, the requests in visiting order. `start` is optional; if left out, the technician goes as soon as they can and waits for the entry window.
- `urgency`: **the planner's own** urgency rating for each request, so the evaluator can catch an emergency being played down.

## What the evaluator does with it

1. **Checks** the plan could work in real life: every request covered once, nobody in two places at once, nothing outside working hours.
2. **Compares** it with a naive by-hand plan for the same day: requests worked in the order they are listed in the file (so list them in the order they came in), each to the first technician with the right skill who covers that site, with no reordering by urgency and no waiting for entry windows.
3. **Scores** both: drive time, wasted trips, jobs finished, cost, wrong-skill visits, resident notes passed on.
4. **Gates** (must pass): no emergency treated as less urgent than it is, and the plan is not worse than by hand.

A plan that fails a check or a gate fails, whatever its other numbers say.
