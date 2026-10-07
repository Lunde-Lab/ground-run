// Smoke test for index.html. Run: NODE_PATH=$(npm root -g) node tests/smoke.js
// Uses the preinstalled Playwright/Chromium. Exits 1 on any failure.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const txt = async (pg, s) => (await pg.textContent(s)).replace(/\s+/g, ' ');

(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: 768, height: 1024 } })).newPage(); // iPad mini 4 portrait
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('vibrasjonsdiagram-beta', '1'); localStorage.setItem('vibrasjonsdiagram-tab', '2'); });
  await pg.reload();

  // Engine 2 example (fresh storage) = full HSS #2 job, last run within target
  const e2 = await pg.evaluate(() => JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4-engine2')).runs.filter(r => r.ips).length);
  ok(e2 === 7, 'Engine 2 example has 7 runs');
  ok((await txt(pg, '#bOpt')).includes('Within target'), 'Engine 2 example shows "Within target"');
  ok((await pg.$$('.pred-dot')).length === 0, 'No Next point when no weights entered after last run');

  // Engine 1, single run -> run-1 suggestions from PRIOR
  await pg.evaluate(() => {
    const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)), E = () => Array.from({ length: 12 }, () => []);
    o.runs.forEach(r => { r.ips = ''; r.deg = ''; r.pos = E(); }); o.start = E(); o.runs[0].ips = '1,25'; o.runs[0].deg = '250';
    localStorage.setItem(k, JSON.stringify(o)); localStorage.setItem('vibrasjonsdiagram-tab', '1');
  });
  await pg.reload();
  const opt = await txt(pg, '#bOpt');
  ok(opt.includes('Run 1 suggestion'), 'Run-1 suggestion banner shown');
  ok((await pg.$$('#bOpt .opt2:not(.back)')).length >= 1, 'Run-1 suggestions listed');
  ok(/Range \d\.\d\d–\d\.\d\d IPS/.test(opt), 'Suggestions show a range');

  // Above 4.0 IPS -> no suggestions
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)); o.runs[0].ips = '4,5'; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  ok((await pg.$$('#bOpt .opt2:not(.back)')).length === 0 && !(await pg.isHidden('#idxAlert')), '> 4.0 IPS blocks suggestions and shows index alert');

  // MR / TR tabs render
  await pg.click('#tab3'); ok(await pg.isVisible('#mrView'), 'MR Balance tab visible');
  await pg.click('#tab4'); ok(await pg.isVisible('#trView'), 'TR Balance tab visible');

  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fail ? `\n${fail} failed` : '\nAll passed');
  process.exit(fail ? 1 : 0);
})();
