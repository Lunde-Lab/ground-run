# Ground Run

Single-page web app for S-92 ground runs, used by helicopter technicians on an **iPad mini 4 (iPadOS 15, Safari 15)**:

- **Engine 1 / Engine 2** – HSS vibration polar chart + runs table (Al/Ti/St set screws), **HUMS** card (HUMS predicted IPS/deg + rec. weights per run; always visible, HUMS point in chart), optional **Advanced (BETA)** balance calculator.
- **MR Balance** and **TR Balance** – record forms.

Live: https://lunde-lab.github.io/ground-run/ (GitHub Pages from `main`, root). Installed on iPads via Safari → Add to Home Screen; works offline.

## Working with André

- André is an S-92 technician (B1). Write to him in **Norwegian**, short and direct, no fluff. When there is a choice, give **numbered alternatives** and a recommendation.
- The **app UI is English**. Numbers use `.` as decimal separator in the UI.
- Domain claims (AMM values, limits) come from André or the AMM – never invent them. If something is uncertain, say so.
- Show the result of a change (what changed, tested how) – don't recap steps.

## Files

| Path | What |
|---|---|
| `index.html` | The whole app: HTML + CSS + JS inline. **Source of truth – edit directly.** |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline/PWA. Bump `VERSION` in `sw.js` on each release: `scripts/bump-sw.sh` |
| `docs/CALCULATION.md` | How the balance math works. Keep in sync with code changes. |
| `data/jobs/*.json` | Real completed jobs (see `data/README.md`). |
| `scripts/analyze.py` | Estimates α per engine from the jobs; `--write` updates the `PRIOR` block in `index.html` and `data/priors.json`. |
| `tests/smoke.js`, `tests/test_analyze.py` | Tests (below). |

## Hard constraints

- **Safari 15**: no `color-mix()` (use `rgba(var(--x-rgb), a)` / the `--cr` tokens), no `:has()`, no top-level `await`, no newer JS than ES2019-ish in hot paths. Test on 768×1024.
- One file, no build step, no JS libraries. Touch targets ≥ 44 px. Tabs must not scroll.
- **Never rename localStorage keys** (data on iPads would be lost): `vibrasjonsdiagram-v4` (Engine 1), `vibrasjonsdiagram-v4-engine2`, `vibrasjonsdiagram-mrtb`, `vibrasjonsdiagram-trbal`, `vibrasjonsdiagram-tab`, `vibrasjonsdiagram-beta`, `vibrasjonsdiagram-view`, `vibrasjonsdiagram-job`. Schema changes must stay backward compatible (see `tidy()`).
- Code comments may be Norwegian or English; UI strings English.

## Domain conventions (see docs/CALCULATION.md)

- Chart angle `θ = (40 − deg) mod 360`; screw hole angles in `RTB.CLOCK` (uneven spacing).
- Screws: Al 0.96 / Ti 1.58 / St 2.54 IPS – always shown in **IPS** (not grams). Max one per position.
- Runs table: weights in row *k* are fitted **after** run *k*; row 0 = start weights.
- HSS limits: target < 0.30, limit 0.50, index output shaft > 4.0 IPS (AMM 18-12-02).
- MR Balance: weight in oz, PCR in notches; limits roll 0.20, vertical 0.20, lateral 0.25 IPS, split 20. TR Balance: 0.20 IPS, max weight 300 g. Split / Recorded IPS cells are split in *Predicted* (top) / *Recorded* (bottom).
- Engine 1 and 2 have **different α** (≈ 1∠−171° vs 1∠−115°). Engine 1 matches the hand rule "weight at the dot".

## Behaviour André has decided (don't undo without asking)

- No built-in "standard α"; run-1 suggestions use `PRIOR` from real jobs, clearly marked with a range. From run 2 the job's own fit is used.
- "Next" / "Next ≈" in the chart only when weights are entered after the last run.
- Last run < 0.30 → "Within target – no change needed". > 4.0 → index alert, no suggestions.
- Removed on request – do not reintroduce: page titles/hint texts, Merknad column, manual start-α card, α library per tail number, status line, motor/sensor-offset texts, clock-chart toggles, "Screws fitted after run" legend, "x of 4 weights" picker text, calibration-run card, per-run Use toggle (all runs count), "looks like an average" check.
- IPS keypad: digits without decimal point, `1041` → `1.041`.
- Export asks for tail number + date; "New job" clears all tabs; "Load example" loads the real Engine 1/2 job.

## Adding job data (improves run-1 suggestions)

André may paste run data as text (e.g. "Kjøring 1 = 2.105 / 60 – la på 1 St, 6 Al, 10 Ti") or drop an app export. Then:

1. Write `data/jobs/YYYY-MM-DD_engine<N>.json` (format in `data/README.md`). `after` is the **full** setup after the run – confirm with André if it is unclear whether old screws were removed.
2. `python3 scripts/analyze.py` – check step errors and the job α vs. the engine prior; report anything odd to André before writing.
3. `python3 scripts/analyze.py --write`, update the table in `docs/CALCULATION.md` §6, run tests, commit.

## Test and release

```
python3 tests/test_analyze.py
NODE_PATH=$(npm root -g) node tests/smoke.js     # Playwright + Chromium are preinstalled in the cloud env
scripts/bump-sw.sh                               # before committing a release
git push origin main                             # Pages updates in ~1 min; iPads get it on next open
```

For visual checks, screenshot with Playwright at 768×1024 (iPad portrait) and 390 wide (phone).
