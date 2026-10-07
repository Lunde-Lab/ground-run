#!/usr/bin/env python3
"""Estimate the influence coefficient (alpha) per engine from completed jobs.

Reads every job in data/jobs/ (hand-written job files or "Export data (JSON)"
files from the app), estimates alpha per job and pooled per engine, and prints
how well each estimate would have predicted the runs.

  python3 scripts/analyze.py            # report only
  python3 scripts/analyze.py --write    # also update data/priors.json and the
                                        # PRIOR block in index.html

Method: see docs/CALCULATION.md ("Prior alpha from earlier jobs").
"""
import cmath, glob, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Must match RTB.CLOCK / BM.MAG in index.html
CLOCK = {12: -5.5, 1: 5.5, 2: 54, 3: 66, 4: 114, 5: 126, 6: 174.5, 7: 185.5, 8: 234, 9: 246, 10: 294, 11: 306}
MAG = {"Al": 0.96, "Ti": 1.58, "St": 2.54}
DEFAULT_DANG, DEFAULT_DMAG = 30.0, 0.15  # range used until there are >= 3 jobs per engine


def polar(r, deg): return cmath.rect(r, math.radians(deg))
def meas(ips, deg): return polar(ips, (40 - deg) % 360)          # reading -> chart vector
def weight(setup): return sum((polar(MAG[t], CLOCK[p]) for p, t in setup), 0j)
def fmt(z): return f"{abs(z):.2f}∠{math.degrees(cmath.phase(z)):.1f}°"
def num(v): return float(str(v).replace(",", ".")) if str(v).strip() != "" else None


def parse_setup(items):
    out = []
    for it in items:
        if isinstance(it, str):
            p, t = it.split(); out.append((int(p), t.capitalize()))
        else:
            out.append((int(it[0]), str(it[1]).capitalize()))
    return out


def from_app_engine(eng, o, src):
    """Convert one engine object from an app export into the job format."""
    def pos_to_setup(pos): return [(j + 1, t) for j, l in enumerate(pos or []) for t in l]
    runs = []
    for r in o.get("runs", []):
        ips, deg = num(r.get("ips", "")), num(r.get("deg", ""))
        if ips is None or deg is None: continue
        use = r["use"] if "use" in r else r.get("cyc", True) is not False
        runs.append({"ips": ips, "deg": deg, "after": pos_to_setup(r.get("pos")), "use": bool(use)})
    if len(runs) < 2: return None
    return {"engine": eng, "file": src, "start": pos_to_setup(o.get("start")), "runs": runs}


def load_jobs():
    jobs = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "jobs", "*.json"))):
        d = json.load(open(f, encoding="utf-8")); name = os.path.basename(f)
        if d.get("app") == "Ground Run":           # export from the app
            for e in (1, 2):
                j = from_app_engine(e, d.get(f"engine{e}") or {}, name)
                if j: j["date"] = d.get("date", ""); jobs.append(j)
            continue
        runs = [{"ips": num(r["ips"]), "deg": num(r["deg"]), "after": parse_setup(r.get("after", [])),
                 "use": r.get("use", True)} for r in d["runs"]]
        jobs.append({"engine": int(d["engine"]), "file": name, "date": d.get("date", ""),
                     "start": parse_setup(d.get("start", [])), "runs": runs})
    return jobs


def steps(job):
    """Consecutive run pairs (both used): (dV, dW, k)."""
    out, prev_setup = [], job["start"]
    rs = job["runs"]
    setups = [job["start"]] + [r["after"] for r in rs]   # setup during run k = setups[k]
    for k in range(len(rs) - 1):
        a, b = rs[k], rs[k + 1]
        if not (a["use"] and b["use"]): continue
        dV = meas(b["ips"], b["deg"]) - meas(a["ips"], a["deg"])
        dW = weight(setups[k + 1]) - weight(setups[k])
        if abs(dW) > 1e-9: out.append((dV, dW, k + 1))
    return out


def alpha_from_steps(st):
    den = sum(abs(dW) ** 2 for _, dW, _ in st)
    return sum(dW.conjugate() * dV for dV, dW, _ in st) / den if den else None


def report_job(j):
    st = steps(j); a = alpha_from_steps(st)
    print(f"\n{j['file']}  (engine {j['engine']}, {len(j['runs'])} runs, {len(st)} usable steps)")
    if a is None: print("  no usable steps"); return None
    print(f"  alpha = {fmt(a)}")
    for dV, dW, k in st:
        err = abs(dV - a * dW)
        print(f"  step {k}->{k + 1}: |dW| {abs(dW):.2f}  step alpha {fmt(dV / dW)}  error {err:.2f} IPS")
    return a


def main():
    write = "--write" in sys.argv
    jobs = load_jobs()
    if not jobs: print("No jobs in data/jobs/"); return
    per_job = {1: [], 2: []}
    for j in jobs:
        a = report_job(j)
        if a is not None: per_job[j["engine"]].append((j, a))

    prior = {}
    print("\n=== Prior per engine ===")
    for e in (1, 2):
        lst = per_job[e]
        if not lst: print(f"Engine {e}: no jobs"); continue
        allst = [s for j, _ in lst for s in steps(j)]
        a = alpha_from_steps(allst)
        n = len(lst)
        if n >= 3:   # spread from job-to-job scatter, 2 sigma, clamped
            dang = [math.degrees(cmath.phase(aj / a)) for _, aj in lst]
            dmag = [abs(aj) / abs(a) - 1 for _, aj in lst]
            dA = min(45, max(15, 2 * math.sqrt(sum(x * x for x in dang) / n)))
            dM = min(0.3, max(0.1, 2 * math.sqrt(sum(x * x for x in dmag) / n)))
        else:
            dA, dM = DEFAULT_DANG, DEFAULT_DMAG
        prior[str(e)] = {"mag": round(abs(a), 2), "ang": round(math.degrees(cmath.phase(a)), 1),
                         "jobs": n, "dAng": round(dA), "dMag": round(dM, 2)}
        print(f"Engine {e}: alpha {fmt(a)} from {n} job(s), range ±{dA:.0f}° / ±{dM * 100:.0f}%")
        for j, aj in lst:
            print(f"   {j['file']}: {fmt(aj)}  (Δ angle {math.degrees(cmath.phase(aj / a)):+.0f}°)")
        if n >= 2:   # leave-one-job-out: how well would the others have predicted this job's first step?
            for j, _ in lst:
                others = [s for jj, _ in lst if jj is not j for s in steps(jj)]
                ao = alpha_from_steps(others); st = steps(j)
                if ao is not None and st:
                    dV, dW, k = st[0]
                    print(f"   LOO {j['file']}: first step error {abs(dV - ao * dW):.2f} IPS")

    if write:
        json.dump(prior, open(os.path.join(ROOT, "data", "priors.json"), "w"), indent=2)
        p = os.path.join(ROOT, "index.html"); s = open(p, encoding="utf-8").read()
        new = "  var PRIOR = " + json.dumps(prior, separators=(", ", ": ")) + ";"
        s2, n = re.subn(r"(// PRIOR-ALPHA:BEGIN[^\n]*\n)  var PRIOR = .*?;\n", lambda m: m.group(1) + new + "\n", s, flags=re.S)
        if n != 1: sys.exit("PRIOR block not found in index.html")
        open(p, "w", encoding="utf-8").write(s2)
        print("\nWrote data/priors.json and updated PRIOR in index.html")


if __name__ == "__main__":
    main()
