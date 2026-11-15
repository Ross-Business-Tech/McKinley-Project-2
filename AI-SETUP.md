# Turning on the UM GPT reading step

The board can ask UM GPT to read each new request (it can raise a priority, never lower one). Until this is set up, the board quietly keeps using its built-in rules, so nothing is broken without it.

```
Staff or resident website  ->  small AI server (holds the key)  ->  UM GPT
```

The website is public, so it never holds the key. The small server (`server/ai-proxy.mjs`) keeps the key in its own private settings and makes the call.

**Never put the key in the repository, in a chat, or in the website's settings.** Only in the AI server's private settings in Render.

## What you need from whoever owns the UM GPT access

| Ask for | Goes into |
|---|---|
| The address UM GPT is called at. Either the full chat address or the "base" address the portal shows both work: `/chat/completions` is added if it is missing. Keep anything after a `?`. | `UMGPT_BASE_URL` |
| The key, and whether it is sent as `Authorization: Bearer ...` or as an `api-key` header | `UMGPT_API_KEY`, `UMGPT_AUTH_STYLE` |
| The model name you may use | `UMGPT_MODEL` |
| Whether the key may be shared across a project team, and any usage limit | (a rule to follow) |

Only **made-up sample data** may be sent: the text of each request goes to UM GPT.

## Step 1: create the AI server on Render

1. In Render choose **New + -> Web Service -> Public Git Repository**, paste the repository address, and press **Connect**.
2. Branch: the branch this file is on (later, the main app branch).
3. Settings: **Build Command** `echo no build needed`, **Start Command** `node server/ai-proxy.mjs`, Plan **Free**.
4. Under **Environment**, add these variables:

| Name | Value |
|---|---|
| `UMGPT_API_KEY` | the key (type it here only) |
| `UMGPT_BASE_URL` | UM GPT's address (full chat address or base address) |
| `UMGPT_MODEL` | the model name |
| `ALLOWED_ORIGINS` | the website's address only, for example `https://mckinley-maintenance-hub.onrender.com` (no path, no slash needed). Add the resident site too if it is on another address, separated by a comma. |
| `UMGPT_AUTH_STYLE` | only if needed: `api-key` (the default is `bearer`) |
| `UMGPT_TOKEN_FIELD` | `max_completion_tokens` for newer models (UM GPT's gpt-6.1-sol needs it). The default is `max_tokens`. |
| `UMGPT_TEMPERATURE` | only if needed: some models reject it, so leave it out |
| `UMGPT_MAX_TOKENS` | optional: the length limit for each answer, default 2000 |
| `RATE_LIMIT_PER_HOUR` | optional, default 120 calls per visitor per hour |

5. Create the service. When it is live, open `https://<your-ai-server>.onrender.com/health`. You should see `{"ok":true,"configured":true}`. If `configured` is `false`, one of the first four variables is missing.

## Step 2: point the website at it

1. Open the website's Render **static site** -> **Environment** and add:
   `VITE_AI_URL` = `https://<your-ai-server>.onrender.com/ai-read`
2. Run **Manual Deploy -> Clear build cache & deploy**. The address is built into the site, so it only takes effect after a new build.
3. Sign in as a supervisor. Requests now show a **AI read** tag, and the card explains what the AI saw.

## If something is off

| What you see | Likely cause |
|---|---|
| No "AI read" tags, nothing else wrong | `VITE_AI_URL` not set, or the site was not rebuilt after setting it |
| `/health` says `configured: false` | A required variable is missing |
| The AI server answers `origin_not_allowed` | `ALLOWED_ORIGINS` does not exactly match the website's address |
| The AI server answers `upstream_error` with a number | UM GPT refused the call: 401/403 means a wrong key or auth style, 404 a wrong address, 400 a model or setting it dislikes (try `UMGPT_TOKEN_FIELD` or remove `UMGPT_TEMPERATURE`) |
| `upstream status 500` or `400` and you are unsure of the model name | Switch on the model list: add the variable `ALLOW_MODEL_LIST` = `1`, deploy, open `https://<your-ai-server>.onrender.com/models`, copy the exact ID you want into `UMGPT_MODEL`, then **delete `ALLOW_MODEL_LIST`** and deploy again |
| The first request after a quiet spell is slow | The free Render plan sleeps when idle. The board falls back to its rules for that moment |

## Safety built in

- The key is never sent to the browser and never logged. The server only logs the status number when UM GPT fails.
- Only the website's own address may call the server, calls are rate limited, and the size of a call is capped.
- The AI can raise a priority but never lower one (`src/triage/engine.js`), and an answer the board cannot trust is thrown away.
- If the key is ever exposed (pasted into a chat, an email or a file), have the account owner revoke it and make a new one.

Run the checks for this part with: `node --test server/ai-proxy.test.mjs server/ai-client.test.mjs`
