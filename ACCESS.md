# Sign-in and who sees what

| Role | Sees | Signs in with |
|---|---|---|
| **Property manager** (one per property; one person can manage several) | Only their own properties: requests, routes, maps, planning, stats, their supervisors' and technicians' PINs, residents' codes | Work email (on the team's here.now site), or a passcode for demos and shared tablets |
| **Supervisor** | Only the properties they oversee | Work email, or name + PIN |
| **Technician** | Only their own approved jobs and planned work | Work email, or name + PIN |
| **Resident** | Only their own requests | Property + unit + code (last 4 digits of their lease phone, or a code their manager set) |

IT is not a role in the app. IT decides **who the property managers are** and **which properties each one runs**.

## For IT: the property manager list

The list is `src/access/managers.json`. One entry per manager:

```json
{
  "id": "PM-AA",
  "area": "Ann Arbor",
  "emailHash": "<SHA-256 of the manager's work email, lowercase>",
  "passcodeHash": "<SHA-256 of a passcode, optional>",
  "properties": ["Evergreen", "Glencoe Hills", "Spruce Knob"]
}
```

This repository is public, so the file holds only scrambled fingerprints (SHA-256 hashes), never emails or
passcodes. To make a fingerprint on your own computer:

```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1].trim().toLowerCase()).digest('hex'))" 'jane.smith@mckinley.com'
```

For a passcode, use the same command without lowercasing (or just keep passcodes lowercase).

**Adding a manager:** add an entry and merge the change. **Removing one:** delete their entry and remove their
email from the here.now site's access list; they're locked out right away.

Recommended: ask the repository admins to make IT the required reviewer for `src/access/` (a CODEOWNERS
rule), so no one else can change who the managers are.

## Signing in with work email

On a here.now site set to **Specific emails or domains** (for example everyone `@mckinley.com`), here.now asks
for a work email and emails a one-time code to that inbox. Knowing someone's email is not enough to sign in as
them. The app reads the verified email and opens the right view:

- the email's fingerprint is in `managers.json` → property manager for those properties
- the email is on a supervisor or technician in the Teams tab → that person's view

## Sample managers (for demos)

| Area | Demo passcode |
|---|---|
| Ann Arbor | `annarbor-demo` |
| Ypsilanti | `ypsilanti-demo` |
| Orlando | `orlando-demo` |
| Winter Park & Brevard | `winterpark-demo` |

Managers can change their passcode on the Access tab. Replace these sample entries before real use.

## Limits

PIN and passcode checks run in the browser, and today every browser receives all the data, then shows each
person only their part. That's fine for a demo or pilot. Before real resident data is used, the data should come
from a server that returns each signed-in person only their own properties' records (McKinley IT, connected to
Yardi or Databricks), and the resident app should be separate from the staff app.
