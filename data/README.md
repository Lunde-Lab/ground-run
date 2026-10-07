# Job data

Every finished balance job makes the run-1 suggestions better. Drop one file per job in `data/jobs/`, then run:

```
python3 scripts/analyze.py            # check the job and see the new α
python3 scripts/analyze.py --write    # update PRIOR in index.html + data/priors.json
```

## Two accepted formats

**1. Export from the app** – "Export data (JSON)" at the bottom of the app. Copy the file in as-is. Both engines are read; engines with fewer than two runs are ignored. Runs switched off under *Use in fit* are skipped. Remove the tail number from the file if the repo is public and you prefer not to publish it.

**2. Hand-written** (e.g. from a paper job sheet):

```json
{
  "engine": 1,
  "date": "2026-10-07",
  "note": "free text",
  "start": [],
  "runs": [
    { "ips": 2.105, "deg": 60,  "after": ["1 St", "6 Al", "10 Ti"] },
    { "ips": 0.386, "deg": 235, "after": ["3 St", "9 Al", "10 St"] },
    { "ips": 0.285, "deg": 322, "after": [] }
  ]
}
```

- `after` = the **complete** set of screws fitted after that run (not only the changes). Format `"<position> <Al|Ti|St>"`.
- `start` = screws fitted before run 1 (usually empty).
- `"hums": [ips, deg]` (optional) = HUMS-predicted reading for the **next** run with the `after` screws. The app export carries this automatically (HUMS pred. IPS / ° columns). If the screws fitted were not the ones HUMS recommended, add `"hums_w": ["7 St", ...]` (HUMS's recommended full setup); the app export carries this as *HUMS rec. weights*.
- `"use": false` on a run that should not count (not power cycled, bad reading).
- File name: `YYYY-MM-DD_engine<1|2>.json` (add a suffix if two jobs share a date).

## Checklist for a new job

1. Weights in each row are the full setup? (Old screws removed → not listed.)
2. Hard-to-read values → add `"note"`; if very doubtful, `"use": false`.
3. Run `analyze.py`. A step error above ~0.5 IPS or a job α far (> 45°) from the engine's prior → check the data before `--write`.
