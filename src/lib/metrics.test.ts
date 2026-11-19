import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  callsNeeded,
  parseClock,
  parsePct,
  parseStoredBase,
  projectReferral,
  referralSlack,
} from "./metrics.ts";

describe("projectReferral", () => {
  const base = { prevPct: 16, monthCalls: 1000, cleanNeeded: 67 };

  it("reproduces the Power BI gap before any call today", () => {
    const start = projectReferral(base, []);
    assert.equal(start.ok, true);
    if (!start.ok) return;
    assert.equal(start.cleanStill, 67);
    assert.ok(Math.abs(start.impliedGoalPct - (160 / 1067) * 100) < 1e-9);
    assert.equal(start.livePct, 16);
  });

  it("drops the gap by one per clean call and hits the goal at 67", () => {
    const one = projectReferral(base, [{ derived: false }]);
    assert.equal(one.ok && one.cleanStill, 66);

    const done = projectReferral(
      base,
      Array.from({ length: 67 }, () => ({ derived: false })),
    );
    assert.equal(done.ok, true);
    if (!done.ok) return;
    assert.equal(done.cleanStill, 0);
    assert.equal(done.slack, 0);
    assert.ok(done.livePct <= done.impliedGoalPct + 1e-8);
  });

  it("raises the gap when a call is referred", () => {
    const referred = projectReferral(base, [{ derived: true }]);
    assert.equal(referred.ok, true);
    if (!referred.ok) return;
    const goal = 160 / 1067;
    const exact = 161 / goal - 1001;
    assert.equal(referred.cleanStill, Math.ceil(exact - 1e-8));
    assert.ok((referred.cleanStill ?? 0) > 67);
  });

  it("counts how many referrals still fit once under the goal", () => {
    const under = { prevPct: 20, monthCalls: 100, cleanNeeded: 10 };
    const cushion = projectReferral(
      under,
      Array.from({ length: 20 }, () => ({ derived: false })),
    );
    assert.equal(cushion.ok, true);
    if (!cushion.ok) return;
    assert.equal(cushion.cleanStill, 0);
    assert.equal(cushion.slack, 2);

    const stillIn = projectReferral(under, [
      ...Array.from({ length: 20 }, () => ({ derived: false })),
      { derived: true },
      { derived: true },
    ]);
    const pushedOut = projectReferral(under, [
      ...Array.from({ length: 20 }, () => ({ derived: false })),
      { derived: true },
      { derived: true },
      { derived: true },
    ]);
    assert.equal(stillIn.ok && stillIn.cleanStill, 0);
    assert.equal(pushedOut.ok && pushedOut.cleanStill !== null && pushedOut.cleanStill > 0, true);
  });

  it("treats a zero gap as already on the current rate", () => {
    const onLine = projectReferral({ prevPct: 15.41, monthCalls: 800, cleanNeeded: 0 }, []);
    assert.equal(onLine.ok, true);
    if (!onLine.ok) return;
    assert.equal(onLine.cleanStill, 0);
    assert.equal(onLine.slack, 0);
    assert.ok(Math.abs(onLine.impliedGoalPct - 15.41) < 1e-9);
  });
});

describe("parsing", () => {
  it("accepts comma percentages and clocks", () => {
    assert.equal(parsePct("15,41"), 15.41);
    assert.equal(parsePct("15.41"), 15.41);
    assert.equal(parsePct("100"), 100);
    assert.equal(parsePct("101"), null);
    assert.equal(parsePct(""), null);
    assert.equal(parseClock("05:12"), 312);
    assert.equal(parseClock("5:12"), 312);
    assert.equal(parseClock("05:60"), null);
    assert.equal(parseStoredBase({ prevDer: "15,41", monthCalls: "980", cleanNeeded: "32" })?.cleanNeeded, 32);
    assert.equal(parseStoredBase({ prevDer: "15,41", monthCalls: "", cleanNeeded: "32" }), null);
  });

  it("rounds the gap up and the slack down", () => {
    assert.equal(callsNeeded(160, 1000, 0.15), 67);
    assert.equal(referralSlack(150, 1000, 0.15), 0);
    assert.equal(referralSlack(140, 1000, 0.15), 11);
  });
});
