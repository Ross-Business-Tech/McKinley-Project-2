// End-to-end checks of the main journeys, in a real (headless) browser at phone size.
// Run with:  npm test   (builds first, then starts a local preview of dist/).
//
//  1. Resident sends a request in the resident app and gives OK to enter
//  2. Supervisor sees it ("From resident app") and approves it
//  3. Technician taps On my way, Started, Done
//  4. Resident sees "finished" and answers "Yes"; supervisor sees "Resident: fixed"
//  5. Security: the resident app has no staff sign-in; wrong PINs are refused;
//     a manager only sees their own properties
const { spawn } = require('node:child_process')
const path = require('node:path')

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p)
    } catch {
      /* try next */
    }
  }
  return null
}

const PORT = 4188
const BASE = `http://localhost:${PORT}`
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` (${detail})` : ''}`)
}

;(async () => {
  const pw = loadPlaywright()
  if (!pw) {
    console.log('JOURNEY TESTS SKIPPED: Playwright is not available here.')
    return
  }
  let browser
  for (const opts of [{}, { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }]) {
    try {
      browser = await pw.chromium.launch(opts)
      break
    } catch {
      /* try next */
    }
  }
  if (!browser) {
    console.log('JOURNEY TESTS SKIPPED: no browser available.')
    return
  }
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 2500))
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const wait = (ms = 250) => page.waitForTimeout(ms)
  const staff = async (kind, id, pin) => {
    await page.goto(`${BASE}/`)
    if (kind === 'tech') await page.click('.seg >> text=Technician')
    if (kind === 'manager') await page.click('.seg >> text=Manager')
    if (id) await page.selectOption('form select', id)
    await page.fill('input[type=password]', pin)
    await page.click('button:text-is("Sign in")')
    await wait(400)
  }
  const signOut = async () => {
    await page.click('text=Sign out')
    await wait()
  }
  const resident = async () => {
    await page.goto(`${BASE}/resident/`)
    await wait()
    if (await page.$('text=Sign out')) await signOut()
    await page.selectOption('.rolepick select', 'Bella Casa')
    await page.fill('input[inputmode=numeric] >> nth=0', '150')
    await page.fill('input[type=password]', '0108')
    await page.click('button:text-is("Sign in")')
    await wait(400)
  }
  // Urgent (no hot water), so it is routed both in regular hours and to the on-call technician at night.
  const TEXT = 'No hot water since this morning (journey test)'

  try {
    // 5a. The resident app has no staff sign-in in it
    await page.goto(`${BASE}/resident/`)
    await wait()
    check('Resident app has no staff sign-in', (await page.$$('text=Staff sign-in')).length === 0 && (await page.$$('text=Property manager passcode')).length === 0)

    // 1. Resident sends a request and gives OK to enter
    await resident()
    check('Resident signs in with property, unit and code', (await page.textContent('header p')).includes('Unit 150'))
    await page.click('.tabs >> text=New request')
    await page.fill('textarea', TEXT)
    await page.click('text=Send to maintenance')
    await wait()
    const mine = page.locator(`article:has-text("${TEXT}")`)
    check('Resident sees the new request as received', (await mine.count()) === 1 && (await mine.textContent()).includes('reviewing'))
    await mine.locator('text=Yes, you may enter').click()
    await wait()
    await signOut()

    // 5b. Wrong PIN is refused
    await staff('supervisor', 'SUP-OR', '0000')
    check('Wrong staff PIN is refused', (await page.textContent('body')).includes('PIN is not right'))

    // 2. Supervisor approves it
    await staff('supervisor', 'SUP-OR', '1203')
    await page.selectOption('.sitepick select', 'Bella Casa')
    await wait()
    const card = page.locator(`article:has-text("${TEXT}")`)
    check('Supervisor sees the resident request', (await card.count()) === 1 && (await card.textContent()).includes('From resident app'))
    await card.locator('button:text-is("Approve")').click()
    await wait()
    const techName = ((await card.locator('.chip.c-tech').textContent()) || '').trim()
    check('Approved job is assigned to a technician', !!techName, techName)
    await signOut()

    // 3. Technician works the job
    const techIds = { Carlos: ['BC1', '2107'], Alicia: ['BC2', '2108'], Terrence: ['PO1', '2109'], Mei: ['PO2', '2110'], Andre: ['TP1', '2111'], Lena: ['TP2', '2112'] }
    const [tid, tpin] = techIds[techName] || []
    await staff('tech', tid, tpin)
    const job = page.locator(`article:has-text("${TEXT}")`)
    check('Technician sees the job on My day', (await job.count()) === 1)
    await job.locator('.progbtns button').nth(0).click()
    await job.locator('.progbtns button').nth(1).click()
    await job.locator('.techbtns button').last().click()
    await wait()
    await signOut()

    // 4. Resident confirms, supervisor sees it
    await resident()
    const done = page.locator(`article:has-text("${TEXT}")`)
    check('Resident sees the repair as finished', (await done.textContent()).includes('finished'))
    await done.locator('text=Yes, all good').click()
    await wait()
    await signOut()
    await staff('supervisor', 'SUP-OR', '1203')
    await page.selectOption('.sitepick select', 'Bella Casa')
    check('Supervisor sees "Resident: fixed"', (await page.locator(`article:has-text("${TEXT}")`).textContent()).includes('Resident: fixed'))
    await signOut()

    // 5c. A manager only sees their own properties
    await staff('manager', null, 'ypsilanti-demo')
    const opts = await page.$$eval('.sitepick option', (o) => o.map((x) => x.textContent))
    check('Manager sees only their own properties', !opts.some((t) => /Bella Casa|Evergreen/.test(t)) && opts.some((t) => /Roundtree/.test(t)), `${opts.length - 2} properties`)
    await signOut()

    check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  } catch (e) {
    check('Journey ran to the end', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    server.kill()
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`)
  process.exitCode = failed ? 1 : 0
})()
