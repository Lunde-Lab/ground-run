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
print("analyze tests passed")
