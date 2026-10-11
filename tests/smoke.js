// Smoke test for index.html. Run: NODE_PATH=$(npm root -g) node tests/smoke.js
// Uses the preinstalled Playwright/Chromium. Exits 1 on any failure.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const txt = async (pg, s) => (await pg.textContent(s)).replace(/\s+/g, ' ');
// Fixture: real Engine 2 job (HSS #2, data/jobs/2026-10_engine2_hss2.json) – the app has no built-in example.
// '.' decimals so the app's cleanup of the old built-in example (',' strings) leaves it alone.
const E2JOB = (() => {
  const E = () => Array.from({ length: 12 }, () => []);
  const run = (ips, deg, after) => { const pos = E(); after.forEach(([p, t]) => pos[p - 1].push(t)); return { ips, deg, pos }; };
  return JSON.stringify({ target: 0.3, nW: 3, start: E(), runs: [
    run('2.495', '153', [[4, 'Ti'], [7, 'Al'], [8, 'St']]), run('0.922', '295', [[2, 'Ti'], [6, 'St'], [9, 'Ti']]),
    run('0.314', '279', [[4, 'Ti'], [7, 'Al'], [8, 'Al']]), run('0.982', '37', [[2, 'Al'], [4, 'Al'], [8, 'St']]),
    run('0.338', '97', [[6, 'St'], [9, 'Al'], [12, 'Ti']]), run('0.329', '307', [[1, 'Al'], [6, 'Ti'], [8, 'Al']]),
    run('0.140', '248', [])] });
})();

(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: 768, height: 1024 } })).newPage(); // iPad mini 4 portrait
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('vibrasjonsdiagram-beta', '1'); localStorage.setItem('vibrasjonsdiagram-tab', '2'); });
  await pg.reload();
  ok(await pg.evaluate(() => ['vibrasjonsdiagram-v4', 'vibrasjonsdiagram-v4-engine2'].every(k => !JSON.parse(localStorage.getItem(k)).runs.some(r => r.ips))) && !(await pg.$('#loadEx')),
    'Fresh install: both engines empty, no Example button');
  // Untouched example data from earlier app versions is cleared on load
  await pg.evaluate(() => { const E = () => Array.from({ length: 12 }, () => []); localStorage.setItem('vibrasjonsdiagram-v4', JSON.stringify({ start: E(), runs: [['2,105', '60'], ['0,386', '235'], ['0,285', '322']].map(([ips, deg]) => ({ ips, deg, pos: E() })) })); });
  await pg.reload();
  ok(await pg.evaluate(() => !JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4')).runs.some(r => r.ips)), 'Old built-in Engine 1 example cleared from storage');
  await pg.evaluate(j => localStorage.setItem('vibrasjonsdiagram-v4-engine2', j), E2JOB);
  await pg.reload();

  // Engine 2 job fixture = full HSS #2 job, last run within target
  const e2 = await pg.evaluate(() => JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4-engine2')).runs.filter(r => r.ips).length);
  ok(e2 === 7, 'Engine 2 example has 7 runs');
  ok((await txt(pg, '#bOpt')).includes('Within target'), 'Engine 2 example shows "Within target"');
  ok((await pg.$$('.pred-dot')).length === 0, 'No Next point when no weights entered after last run');

  // Engine 2 example without run 7: Next for the HUMS setup fitted after run 6 must be near the measured 0.140 (from last reading, not run 4)
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4-engine2', o = JSON.parse(localStorage.getItem(k)); o.runs[6].ips = ''; o.runs[6].deg = ''; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  const nx = (await txt(pg, '#legend')).match(/Next \(predicted\) ([\d.]+) IPS/);
  ok(nx && +nx[1] < 0.30, 'Engine 2 run 1–6: Next for HUMS setup below 0.30 (' + (nx && nx[1]) + ')');
  await pg.evaluate(j => localStorage.setItem('vibrasjonsdiagram-v4-engine2', j), E2JOB);
  await pg.reload();

  // HUMS card outside Advanced: table + HUMS point in chart also with Advanced off
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4-engine2', o = JSON.parse(localStorage.getItem(k)); o.runs[6].hp = '0,12'; o.runs[6].hd = '200'; localStorage.setItem(k, JSON.stringify(o)); localStorage.setItem('vibrasjonsdiagram-beta', '0'); });
  await pg.reload();
  ok(await pg.isHidden('#betaView') && await pg.isVisible('#bTable button[data-act="hp"]'), 'HUMS table visible with Advanced off');
  ok((await pg.$$('.hums-dot')).length === 1 && (await txt(pg, '#legend')).includes('HUMS (predicted) 0.12 IPS / 200°') && !(await txt(pg, '#legend')).includes('Next'), 'HUMS point + values in chart with Advanced off, no Next');
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4-engine2', o = JSON.parse(localStorage.getItem(k)); delete o.runs[6].hp; delete o.runs[6].hd; localStorage.setItem(k, JSON.stringify(o)); localStorage.setItem('vibrasjonsdiagram-beta', '1'); });
  await pg.reload();
  ok(!(await txt(pg, '#legend')).includes('HUMS'), 'No HUMS legend item without HUMS prediction');

  // Use column removed: old use/cyc flags are dropped on load, all runs count
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4-engine2', o = JSON.parse(localStorage.getItem(k)); o.runs[1].use = false; o.runs[2].cyc = false; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  const fl = await pg.evaluate(() => JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4-engine2')).runs.some(r => 'use' in r || 'cyc' in r));
  ok(!fl && !(await txt(pg, '#bTable thead')).includes('Use') && !(await pg.$('#bTable button[data-act="use"]')), 'No Use column, old use/cyc flags dropped');

  // HUMS recommended weights: cell -> modal -> pos 7 St, pos 2 Ti -> compact cell, saved as hw
  await pg.click('#bTable tr[data-i="0"] button[data-act="hw"]');
  ok(await pg.isVisible('#hwModal'), 'HUMS rec. weights modal opens');
  await pg.click('#hwPos button[data-p="6"]'); await pg.click('#hwW button[data-w="St"]');
  await pg.click('#hwPos button[data-p="1"]'); await pg.click('#hwW button[data-w="Ti"]');
  await pg.click('#hwDone');
  ok((await txt(pg, '#bTable tr[data-i="0"] button[data-act="hw"]')).trim() === '2 Ti7 St', 'HUMS rec. weights cell shows 2 Ti, 7 St');
  const hw = await pg.evaluate(() => JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4-engine2')).runs[0].hw);
  ok(hw && hw[6][0] === 'St' && hw[1][0] === 'Ti', 'HUMS rec. weights saved');
  // Accuracy: HUMS pred. on run 1 -> one summary line, no systematic claim with < 3 comparisons
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4-engine2', o = JSON.parse(localStorage.getItem(k)); o.runs[0].hp = '0,95'; o.runs[0].hd = '290'; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  const md = await txt(pg, '#bMode');
  ok(/Prediction error \(RMS, 1 run\): HUMS [\d.]+ · tool ([\d.]+|–) IPS/.test(md), 'Accuracy shown as one line (' + md.match(/Prediction error[^\n]*/) + ')');
  ok(!md.includes('systematically') && !md.includes('historically') && !(await pg.$('#bAcc')), 'No accuracy table, no systematic claim with 1 comparison');

  // Use as fitted: run 1 already has weights -> confirm -> pos replaced
  await pg.click('#bTable tr[data-i="0"] button[data-act="hw"]'); await pg.click('#hwUse');
  ok(await pg.isVisible('#confirmModal'), 'Replacing existing run weights asks first');
  await pg.click('#cfYes');
  const pos0 = await pg.evaluate(() => JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4-engine2')).runs[0].pos);
  ok(pos0[6][0] === 'St' && pos0[1][0] === 'Ti' && pos0.flat().length === 2, 'HUMS rec. weights copied to run weights');

  // Engine 1, single run -> run-1 suggestions from PRIOR
  await pg.evaluate(() => {
    const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)), E = () => Array.from({ length: 12 }, () => []);
    o.runs.forEach(r => { r.ips = ''; r.deg = ''; r.pos = E(); }); o.start = E(); o.runs[0].ips = '1,25'; o.runs[0].deg = '250';
    localStorage.setItem(k, JSON.stringify(o)); localStorage.setItem('vibrasjonsdiagram-tab', '1');
  });
  await pg.reload();
  const opt = await txt(pg, '#bOpt');
  ok(opt.includes('Run 1 suggestion'), 'Run-1 suggestion banner shown');
  ok((await pg.$$('#bOpt .srow:not(.back)')).length >= 1, 'Run-1 suggestions listed');
  ok(/Range \d\.\d\d–\d\.\d\d/.test(opt), 'Suggestions show a range');
  ok(/^Data · Engine 1: \d+ earlier jobs? \(\d+ runs\) \+ this job \(1 run\)$/.test(await txt(pg, '#bData')), 'Beta shows how much data the suggestions use');
  ok((await pg.$$eval('#bOpt .srow .sips', els => els.every(e => /\d+°/.test(e.textContent)))), 'Every suggestion row shows predicted/measured degrees');
  ok(/Recommended: \d screws?|None below 0\.30/.test(opt) && !opt.includes('fewest') && !(await pg.$('.pern button.rec')), 'Recommendation as one line, recommended button styled like the others');

  // HUMS rec. weights on last run -> 'HUMS suggestion' row in Suggestions, Apply copies them to the run's weights
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)), E = Array.from({ length: 12 }, () => []); E[3] = ['St']; o.runs[0].hw = E; o.runs[0].hp = '0,20'; o.runs[0].hd = '90'; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  ok((await txt(pg, '#bOpt')).includes('HUMS suggestion · HUMS predicts 0.20 IPS'), 'Suggestions show HUMS suggestion when HUMS weights entered');
  ok((await pg.$$('.humsw-dot')).length === 1 && /HUMS weights \(tool\) ≈ [\d.]+ IPS \/ \d+°/.test(await txt(pg, '#legend')), 'Chart shows HUMS weights point with IPS / deg');
  ok((await txt(pg, '#legend')).includes('HUMS (predicted) 0.20 IPS / 90°'), 'Legend shows HUMS predicted IPS / deg');
  await pg.click('#bOpt button[data-apply="hums"]');
  ok((await pg.$$('.humsw-dot')).length === 0, 'HUMS weights point hidden once applied (shown as Next)');
  const posH = await pg.evaluate(() => JSON.parse(localStorage.getItem('vibrasjonsdiagram-v4')).runs[0].pos);
  ok(posH[3][0] === 'St' && posH.flat().length === 1, 'Apply HUMS suggestion sets run weights');
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)); delete o.runs[0].hw; delete o.runs[0].hp; delete o.runs[0].hd; o.runs[0].pos = Array.from({ length: 12 }, () => []); localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  ok(!(await txt(pg, '#bOpt')).includes('HUMS suggestion'), 'No HUMS suggestion without HUMS weights');
  ok((await pg.$$('.humsw-dot')).length === 0 && !(await txt(pg, '#legend')).includes('HUMS weights'), 'No HUMS wts point without HUMS weights');

  // Save image: PNG of Runs + HUMS (Chromium has no file share -> download fallback)
  const [dlImg] = await Promise.all([pg.waitForEvent('download'), pg.click('#saveImg')]);
  ok(/^ground-run-engine1-.*\.png$/.test(dlImg.suggestedFilename()), 'Save image downloads PNG (' + dlImg.suggestedFilename() + ')');

  // Above 4.0 IPS -> no suggestions
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)); o.runs[0].ips = '4,5'; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  ok((await pg.$$('#bOpt .srow:not(.back)')).length === 0 && !(await pg.isHidden('#idxAlert')), '> 4.0 IPS blocks suggestions and shows index alert');

  // Run 1 with HUMS prediction + PRIOR.hums.use (set by analyze.py when calibrated HUMS beats prior) -> HUMS-based run-1 α
  const fs = require('fs'), os = require('os');
  const tmp = path.join(os.tmpdir(), 'gr-hums.html');
  fs.writeFileSync(tmp, fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8')
    .replace(/(var PRIOR = .*?;)\n/, '$1 PRIOR["1"].hums = {"cMag": 1, "cAng": 0, "jobs": 3, "use": true};\n'));
  await pg.goto('file://' + tmp);
  await pg.evaluate(() => { const k = 'vibrasjonsdiagram-v4', o = JSON.parse(localStorage.getItem(k)); o.runs[0].ips = '1,25'; o.runs[0].hp = '0,40'; o.runs[0].hd = '100'; o.runs[0].pos[1] = ['St']; localStorage.setItem(k, JSON.stringify(o)); });
  await pg.reload();
  ok((await txt(pg, '#bOpt')).includes('HUMS prediction, calibrated from 3 earlier jobs'), 'Run 1 uses calibrated HUMS when PRIOR.hums.use');
  await pg.goto(URL);
  ok(/based on (one|\d+) earlier jobs? on engine/.test(await txt(pg, '#bOpt')), 'Without PRIOR.hums.use, run 1 uses prior α (HUMS entered)');
  fs.unlinkSync(tmp);

  // Version line + theme icon button in the top bar
  ok(/^Ground Run v\d+\.\d+ · \d{4}-\d\d-\d\d$/.test(await txt(pg, '#appVer')), 'App version and date shown');
  const th0 = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || ''), lb0 = await pg.getAttribute('#themeBtn', 'aria-label');
  await pg.click('#themeBtn');
  const th1 = await pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
  ok(th1 && th1 !== th0 && (await pg.getAttribute('#themeBtn', 'aria-label')) !== lb0 && !!(await pg.$('.topbar #themeBtn svg')), 'Theme icon button in top bar toggles theme');
  await pg.click('#themeBtn');

  // MR / TR tabs render
  await pg.click('#tab3'); ok(await pg.isVisible('#mrView'), 'MR Balance tab visible');
  await pg.click('#tab4'); ok(await pg.isVisible('#trView'), 'TR Balance tab visible');

  ok(errs.length === 0, 'No page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fail ? `\n${fail} failed` : '\nAll passed');
  process.exit(fail ? 1 : 0);
})();
