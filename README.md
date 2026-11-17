# McKinley Maintenance Hub

A maintenance work-order tool for McKinley apartment communities, built in the Business+Tech AI Sprint. It ranks resident requests by urgency, routes technicians building by building on each property's site map, translates work orders into each technician's language, and lets residents follow their repair.

- **Staff app:** https://mckinley-maintenance-hub.rossbusinesstech.here.now/
- **Resident app:** https://mckinley-maintenance-hub.rossbusinesstech.here.now/resident/
- **Step-by-step guide with screenshots:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md) · **Who sees what:** [ACCESS.md](ACCESS.md)

## How it works

```
Resident app ──request──▶ shared data ◀──approve / plan── Staff app (managers, supervisors)
                            ▲    │
          status, "fixed?" ─┘    └──▶ Technician "My day" (own jobs, own language) ──progress──▶ back to everyone
```

1. **Read the request.** Fixed rules classify the problem and set a severity from 1 to 5. Gas, fire, flooding and no heat in Michigan are always emergencies. An optional AI reading (Claude, through a secure here.now proxy) can **raise** a priority but never lower it. Unit numbers are read even when spelled out ("building eleven unit four").
2. **Check the rules.** Entry notice (Florida 12 hours, Michigan 24), the resident's permission and time window, pets, repeat problems, vendor needs and missing information. Missing information gets a ready-to-send message.
3. **Plan the day.** Approved jobs are locked to a technician by skill, property, shift and on-call days. Routes put emergencies first, then the nearest buildings on McKinley's site maps (42 maps, 1,186 buildings), and drive times between properties use real locations.
4. **Do the work.** Technicians report On my way, Started, Waiting on parts and Done, with photos and parts used. Supervisors and residents see each step.
5. **Plan ahead and measure.** Move-out turns, preventive maintenance, vendor tracking and a scoreboard (response time, first-visit fixes, resident satisfaction, driving saved).

**Built with:** React + Vite (a static website, with no server of its own), hosted on **here.now**. Shared data uses here.now **Site Data**, so every device sees the same thing within seconds. The AI reading uses a here.now **proxy route**, so the API key never sits in the website.

## Project layout

| Path | What's there |
|---|---|
| `src/App.jsx`, `src/staff/` | Staff app: supervisor, manager and technician screens |
| `src/resident/`, `resident/index.html` | Resident app (no staff code inside it) |
| `src/triage/` | Rules: severity, entry notice, routing, translations, sample data |
| `src/shared.js`, `src/store.js` | Shared saved data (here.now Site Data, or this device on test links) |
| `src/access/managers.json` | Property managers and their properties. **Owned by IT** (see ACCESS.md) |
| `public/site_maps/`, `public/.herenow/` | Site plan images, Site Data and proxy settings |
| `tests/journeys.cjs`, `src/triage/tests.mjs` | Automatic checks |

## Keeping it running

| Task | How |
|---|---|
| **Check nothing broke** | `npm test`: 22 triage checks, plus 13 checks in a real browser covering the resident → supervisor → technician → resident journey and sign-in rules |
| **Publish a test link** | `npm run publish:preview` (signed in to here.now: link lasts 7 days and is shared) |
| **Team dev site** | Merge a pull request into `development`. GitHub Actions publishes it, and the public site updates when staff merge into `main`. |
| **Turn on AI reading** | An instructor or IT adds the variable `ANTHROPIC_API_KEY` in here.now. Without it the app uses its rules. |
| **Add or remove a property manager** | IT edits `src/access/managers.json` (see ACCESS.md) |
| **Add staff, vendors or properties** | In the app: **Teams** tab. New properties require a site map. |
| **Reset someone's PIN** | Property manager → **Access** tab |

## Limits and next steps

- **Sample data:** residents, technicians, vendors and history are made up. Next is connecting McKinley's systems (Yardi, RentCafe, Databricks).
- **Security:** PINs and codes are checked in the browser, and every browser receives all the shared data. For real use, run the staff app on a members-only here.now site and the resident app on a public one, with a small server that returns each person only their own records.
- **Messages:** texts and emails open the phone's own app. Automatic sending needs a texting service set up by IT.
- **Photos:** shrunk and stored in pieces, about 100 per hour across the site. A file store is needed at full scale.
- **Assumptions to confirm with McKinley:** severity scale, entry-notice hours, on-call rules, vendor list and preventive maintenance schedule. This is not legal advice.
