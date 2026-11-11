# Sign-in and PINs

- **Residents** sign in with property + unit + a 4-digit code (the last 4 digits of their lease phone,
  unless the property manager sets a different code on the Access tab).
- **Supervisors and technicians** sign in with their name + a 4-digit PIN. The property manager sets and
  resets PINs on the **Access** tab; anyone can change their own PIN from their screen.
- **Property manager** signs in with a passcode (8+ characters). Only its SHA-256 hash is stored.

## For IT: setting the property manager passcode

The demo passcode is `mckinley-demo`. To replace it, build the site with these environment variables:

```bash
# Make the hash of the new passcode (run on your own computer, don't share the passcode):
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" 'your-new-passcode'
```

- `VITE_PM_PASSCODE_HASH` = the hash printed above
- `VITE_PM_EMAILS` = optional, comma-separated emails allowed in as property manager when signed in
  through a members-only here.now site (no passcode needed for them)

The manager can change the passcode later on the Access tab (the new hash is saved with the team's data).

## Limits

These checks run in the browser, so they keep people out of screens that aren't theirs but are not
full security. For real resident and staff data, run the staff app on a members-only here.now site
(here.now blocks anyone not invited) and keep resident records on a server that only returns each
person's own records.
