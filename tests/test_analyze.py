"""Run: python3 tests/test_analyze.py"""
import cmath, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import analyze as A

# App export format is parsed (comma decimals, pos arrays, use/cyc flags)
E = lambda: [[] for _ in range(12)]
o = {"start": E(), "runs": [{"ips": "2,105", "deg": "60", "pos": E(), "cyc": True},
                            {"ips": "0,386", "deg": "235", "pos": E(), "cyc": True},
                            {"ips": "", "deg": "", "pos": E()}]}
o["runs"][0]["pos"][0] = ["St"]; o["runs"][0]["pos"][5] = ["Al"]; o["runs"][0]["pos"][9] = ["Ti"]
j = A.from_app_engine(1, o, "x.json")
assert len(j["runs"]) == 2 and j["runs"][0]["after"] == [(1, "St"), (6, "Al"), (10, "Ti")]
a = A.alpha_from_steps(A.steps(j))
assert abs(abs(a) - 1.005) < 0.01 and abs(math.degrees(cmath.phase(a)) + 172.7) < 0.2, A.fmt(a)

# Excluded runs break steps on both sides
j2 = {"start": [], "runs": [{"ips": 1, "deg": 0, "after": [(1, "Al")], "use": True},
                            {"ips": 1, "deg": 90, "after": [], "use": False},
                            {"ips": 1, "deg": 180, "after": [], "use": True}]}
assert A.steps(j2) == []
# HUMS: app export hp/hd and hand-written "hums" are parsed
o["runs"][0]["hp"] = "0,5"; o["runs"][0]["hd"] = "200"
assert A.from_app_engine(1, o, "x.json")["runs"][0]["hums"] == (0.5, 200.0)
assert A.parse_hums({"ips": 0.4, "deg": 10}) == (0.4, 10.0) and A.parse_hums(["", ""]) is None

# HUMS calibration: synthetic jobs where HUMS uses alpha 1∠180° but the truth is 1∠-150°
def synth(B, setups, a_true, a_hums):
    runs = []
    for k, W in enumerate(setups):
        V = B + a_true * A.weight(W)
        nxt = setups[k + 1] if k + 1 < len(setups) else None
        def toM(z): return (abs(z), (40 - math.degrees(cmath.phase(z))) % 360)
        r = {"ips": toM(V)[0], "deg": toM(V)[1], "after": nxt or [], "use": True}
        if nxt: r["hums"] = toM(V + a_hums * (A.weight(nxt) - A.weight(W)))
        runs.append(r)
    return {"engine": 1, "file": "s", "start": setups[0], "runs": runs}
at, ah = A.polar(1, -150), A.polar(1, 180)
js = [synth(A.polar(2, d), [[], [(p, "St")], [(p, "Ti"), (p + 3, "Al")]], at, ah) for d, p in ((30, 2), (100, 5), (250, 8))]
c = A.calib([s for j in js for s in A.hums_steps(j)])
assert abs(c - at / ah) < 1e-9, A.fmt(c)
h = A.hums_report(1, [(j, None) for j in js])
assert h["jobs"] == 3 and abs(h["cAng"] - 30) < 0.1 and h["use"] is False  # ties the prior exactly -> not used

# HUMS alpha differs per aircraft but tracks the truth (constant c) -> calibrated HUMS beats the pooled prior
js = [synth(A.polar(2, d), [[], [(p, "St")], [(p, "Ti"), (p + 3, "Al")]], A.polar(1, -150 + t), A.polar(1, 180 + t))
      for d, p, t in ((30, 2, -20), (100, 5, 0), (250, 8, 25))]
h = A.hums_report(1, [(j, None) for j in js])
assert h["use"] is True and abs(h["cAng"] - 30) < 0.1, h

# HUMS prediction for its own recommended weights (hums_w) is rescaled to the weights actually fitted
jw = synth(A.polar(2, 30), [[], [(2, "St")]], at, ah)
jw["runs"][0]["hums"] = (lambda z: (abs(z), (40 - math.degrees(cmath.phase(z))) % 360))(
    A.meas(jw["runs"][0]["ips"], jw["runs"][0]["deg"]) + ah * A.weight([(5, "Ti")]))
jw["runs"][0]["hums_w"] = [(5, "Ti")]
dV, dW, u, k = A.hums_steps(jw)[0]
assert abs(u - ah * dW) < 1e-9
print("analyze tests passed")
