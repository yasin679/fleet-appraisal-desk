// End-to-end test: full appraisal walk-through plus navigation, against BASE.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:5077/';
const API = process.env.MODE !== 'local';
let pass = 0, fail = 0; const errs = [];
function ok(c, m) { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } }
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const settle = () => p.waitForTimeout(500);
  const text = () => p.innerText('#app');
  async function login(id) {
    if (await p.$('[data-act="logout"]')) { await p.click('[data-act="logout"]'); await settle(); }
    await p.waitForSelector('#loginForm');
    await p.fill('#lid', id); await p.fill('#lpw', process.env.PW || 'demo');
    await p.click('#loginForm button[type="submit"]'); await settle();
  }
  async function open(id) { await p.evaluate(h => location.hash = h, '#app.' + id); await settle(); await p.waitForSelector('#act-panel, .panel'); }
  async function act(k) { await p.click(`[data-act="do"][data-k="${k}"]`); await p.waitForTimeout(800); }
  async function rateAll(key, v) { const n = await p.$$eval(`[data-act="rate"][data-key="${key}"][data-v="${v}"]`, x => x.length); for (let i = 0; i < n; i++) await p.click(`[data-act="rate"][data-key="${key}"][data-gi="${i}"][data-v="${v}"]`); return n; }
  const stageText = async () => (await p.innerText('ol.steps')).replace(/\s+/g, ' ');

  console.log('1. Login screen and deep link');
  await p.goto(BASE + '#compare'); await settle();
  ok(await p.$('#loginForm'), 'unauthenticated deep link shows sign-in');
  await p.fill('#lid', 'V1-AB1'); await p.fill('#lpw', 'wrong'); await p.click('#loginForm button[type="submit"]'); await settle();
  if (API) ok(/is wrong/i.test(await text()) && await p.$('#loginForm'), 'wrong password refused');
  await p.fill('#lpw', 'demo'); await p.click('#loginForm button[type="submit"]'); await settle();
  ok(p.url().endsWith('#compare'), 'returns to the deep-linked page after sign-in (' + p.url().split('#')[1] + ')');

  const ID = 'A2026-V1-AB1';
  console.log('2. Seafarer sets goals');
  await p.click('a[href="#mine"]'); await settle();
  ok(p.url().endsWith('#mine') || p.url().includes('#app.'), 'My appraisal tab navigates (' + p.url().split('#')[1] + ')');
  await open(ID);
  if (!(await p.$('#gt0'))) await p.click('[data-act="tplgoals"]'), await settle();
  ok(await p.$('#gt0'), 'goal editor shown');
  ok((await p.innerText('#wt-total')).trim() === '100%', 'template weights total 100%');
  await act('submitGoals');
  ok(/Goals review|Agree/i.test(await stageText()) || /sent|waiting/i.test(await text()), 'goals sent to appraiser');

  console.log('3. Appraiser agrees goals');
  await login('V1-CO');
  ok(p.url().endsWith('#work'), 'HOD lands on My work');
  ok((await text()).includes('Budi Kusuma'), 'worklist shows Budi Kusuma');
  await p.click(`a[href="#app.${ID}"]`); await settle();
  ok(p.url().endsWith('#app.' + ID), 'worklist row opens appraisal by URL');
  await act('agreeGoals');

  console.log('4. Seafarer self-evaluation');
  await login('V1-AB1'); await open(ID);
  ok(await p.$eval('#submit-btn', e => e.disabled), 'submit disabled before ratings');
  const n = await rateAll('self', 4);
  await p.fill('#ss1', 'Kept every watch and drill on time.'); await p.dispatchEvent('#ss1', 'input');
  await settle();
  ok(!(await p.$eval('#submit-btn', e => e.disabled)), `submit enabled after rating ${n} goals`);
  await act('submitSelf');

  console.log('5. Appraiser evaluation');
  await login('V1-CO'); await open(ID);
  await rateAll('mgr', 4);
  for (const [id, v] of [['#ap1', 'Reliable on watch.'], ['#ap2', 'Take more initiative.']]) { await p.fill(id, v); await p.dispatchEvent(id, 'input'); }
  await p.selectOption('#ap3', { label: 'Recommended' }); await p.dispatchEvent('#ap3', 'change');
  const opts = await p.$$eval('#ap4 option', o => o.map(x => x.textContent));
  await p.selectOption('#ap4', { label: opts.find(o => /next year/i.test(o)) || opts[1] }); await p.dispatchEvent('#ap4', 'change');
  await settle();
  await act('submitMgr');
  ok(/Acknowledge/i.test(await text()) || !(await p.$('#ap1')), 'evaluation submitted');

  console.log('6. Acknowledge, countersign, office approval');
  await login('V1-AB1'); await open(ID);
  ok((await text()).includes('Exceeds'), 'seafarer sees appraiser ratings now');
  await p.check('input[name="agree"][value="true"]'); await settle();
  await act('submitAck');
  await login('V1-MST'); await open(ID); await act('countersign');
  await login('CREWING'); await open(ID);
  await p.selectOption('#of1', { label: 'Approved' }); await p.dispatchEvent('#of1', 'change'); await settle();
  await act('approve');
  if (API) { await p.reload(); await settle(); } await p.waitForSelector('ol.steps');
  ok(/Office decision/.test(await text()) && /Approved/.test(await text()), 'appraisal closed and survives refresh');

  console.log('7. Navigation');
  await p.click('a[href="#team"]'); await settle();
  await p.click('a[href="#compare"]'); await settle();
  ok(p.url().endsWith('#compare'), 'compare tab');
  await p.goBack(); await settle(); ok(p.url().endsWith('#team'), 'browser Back returns to team');
  await p.goForward(); await settle(); ok(p.url().endsWith('#compare'), 'browser Forward');
  await p.evaluate(() => location.hash = '#compare.V1-2O.2025'); await settle();
  await p.reload(); await settle(); await p.waitForTimeout(500);
  ok((await text()).includes('Joseph Santos'), 'deep link to a person-year comparison survives refresh');
  ok(/higher than|percentile/i.test(await text()), 'comparison figures shown');
  await p.evaluate(() => location.hash = '#nowhere'); await settle();
  ok(/not found|isn.t available|doesn.t exist/i.test(await text()), 'unknown page shows not-found');
  await login('V1-2O');
  await p.evaluate(() => location.hash = '#bench'); await settle();
  ok(/not found|isn.t available|doesn.t exist/i.test(await text()), 'seafarer cannot open office pages');
  await p.evaluate(() => location.hash = '#compare'); await settle();
  ok(!(await text()).includes('Budi Kusuma'), 'seafarer comparison hides colleagues\' names');
  if (API) {
    console.log('8. Account and sign-out');
    await p.click('a[href="#account"]'); await settle();
    ok(await p.$('#pwForm'), 'account page has change-password form');
    await p.click('[data-act="logout"]'); await settle();
    ok(await p.$('#loginForm'), 'signed out');
    const r = await p.evaluate(() => fetch('/api/worklist', { credentials: 'include' }).then(r => r.status));
    ok(r === 401, 'API refuses after sign-out');
  }
  ok(errs.length === 0, 'no JavaScript errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  if (process.env.SHOT_DIR) await p.screenshot({ path: require('path').join(process.env.SHOT_DIR, 'final-' + (API ? 'api' : 'local') + '.png'), fullPage: true });
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
