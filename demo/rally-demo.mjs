// Rally video demo — Playwright script (no test runner needed).
//
// Walks the deterministic demo flow on a phone viewport and records it:
// onboarding -> plan -> log 3 sessions (Explore tiles) -> pet+activity ->
// quests -> matchup + share link -> venue booking -> Plus demo purchase.
//
// Run:
//   cd demo && npm install && npx playwright install chromium
//   DEMO_URL=http://localhost:5173 npm run demo
// Point DEMO_URL at the Render URL to record the deployed app instead.
// HEADFUL=1 watches the run in a visible browser.
// BROWSER_WS=ws://... connects to an already-running Playwright server
//   (e.g. `npx playwright run-server`) instead of launching Chromium.
//
// Output: demo/videos/rally-demo.webm + stills in demo/shots/.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(root, 'shots');
const videosDir = join(root, 'videos');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(videosDir, { recursive: true });

const BASE = process.env.DEMO_URL || 'http://localhost:5173';
const HEADFUL = process.env.HEADFUL === '1';
const WS = process.env.BROWSER_WS || '';

const browser = WS
  ? await chromium.connect(WS)
  : await chromium.launch({ headless: !HEADFUL, slowMo: HEADFUL ? 120 : 0 });

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  permissions: ['clipboard-read', 'clipboard-write'],
  recordVideo: { dir: videosDir, size: { width: 390, height: 844 } },
});
const page = await context.newPage();

let shot = 0;
async function snap(name) {
  shot += 1;
  await page.screenshot({ path: join(shotsDir, `${String(shot).padStart(2, '0')}-${name}.png`) });
}
async function beat(ms = 900) {
  await page.waitForTimeout(ms);
}
async function tab(name) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name }).click();
}

async function logSport(name) {
  // Explore tile -> instant prefilled draft in a Review modal (no key needed).
  await tab('Explore');
  await page.getByRole('button', { name: `Log ${name}` }).click();
  await page.getByRole('button', { name: 'Confirm and log' }).click();
  await page.getByText('Session saved').waitFor();
  await beat(1200);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.keyboard.press('Escape');
  await beat(600);
}

// --- 1. Onboarding + Today ------------------------------------------------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
const welcome = page.getByRole('dialog');
await welcome.waitFor({ timeout: 120000 }); // cold starts can be slow
await welcome.getByPlaceholder('Alex').fill('Will');
await welcome.getByRole('button', { name: 'tennis' }).click();
await welcome.getByRole('button', { name: 'running' }).click();
await snap('welcome');
await welcome.getByRole('button', { name: 'Start coaching' }).click();
await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
await beat();
await snap('today');

// --- 2. Plan my week (deterministic, no model key needed) -------------------
// The chip sends a prompt; without a key it falls back to the plan modal.
await page.getByRole('button', { name: 'Plan my week' }).click();
await page.getByRole('button', { name: 'Draft plan' }).waitFor();
await page.getByRole('button', { name: 'Draft plan' }).click();
await page.getByRole('button', { name: /Weekly plan/ }).click();
await page.getByRole('button', { name: 'Save plan to this device' }).click();
await page.keyboard.press('Escape');
await beat();
await snap('plan');

// --- 3. Log three sessions --------------------------------------------------
await logSport('Tennis');
await snap('receipt');
await logSport('Running');
await logSport('Chess');

// --- 4. Pet + activity ----------------------------------------------------------
await tab('You');
await page.getByRole('button', { name: 'Open pet' }).click();
await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
await beat();
await snap('pet-activity');

// --- 5. Quests ------------------------------------------------------------------
await page.getByRole('button', { name: 'See rewards & quests' }).click();
await page.locator('.quest', { hasText: 'Log 3 sessions' }).getByRole('button', { name: 'Claim' }).click();
await beat();
await snap('rewards');

// --- 6. Matchup + share link ----------------------------------------------------
await tab('Friends');
await page.getByRole('button', { name: 'New matchup' }).click();
await page.getByRole('button', { name: 'Tennis', exact: true }).click();
await page.getByLabel('Friend').fill('Sam');
await page.getByRole('button', { name: 'Create invite' }).click();
await page.getByRole('button', { name: 'Copy' }).click();
await beat();
await snap('matchup');
const link = await page.locator('.linkbox code').textContent();
const guest = await context.newPage();
await guest.goto(link.trim(), { waitUntil: 'domcontentloaded' });
await guest.getByRole('heading', { name: 'Match invite' }).waitFor();
await guest.waitForTimeout(900);
await guest.screenshot({ path: join(shotsDir, `${String(++shot).padStart(2, '0')}-shared-link.png`) });
await guest.getByRole('button', { name: 'Save to my matches' }).click();
await guest.close();
await page.bringToFront();

// --- 7. Venue booking (demo data) -------------------------------------------------
await tab('Explore');
await page.getByRole('button', { name: 'Search' }).click();
await page.getByRole('button', { name: 'View' }).first().click();
await page.locator('.slot:not(.booked)').first().click();
await page.getByRole('button', { name: 'Book court' }).click();
await page.getByRole('button', { name: 'Done' }).click();
await beat();
await snap('venue');

// --- 8. Plus paywall (labelled demo purchase) --------------------------------------
await tab('You');
await page.getByRole('button', { name: 'See Plus' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await snap('paywall');
await page.getByRole('button', { name: 'Confirm demo' }).click();
await page.getByText('Welcome to Plus').waitFor();
await beat();
await snap('plus');
await page.getByRole('button', { name: 'Meet my coach' }).click();
await beat(1500);

// --- Wrap -----------------------------------------------------------------------
await context.close();
const video = await page.video().path();
const finalPath = join(videosDir, 'rally-demo.webm');
await page.video().saveAs(finalPath);
await browser.close();
console.log(`\nDemo recorded: ${finalPath} (raw: ${video})\nStills in: ${shotsDir}`);
