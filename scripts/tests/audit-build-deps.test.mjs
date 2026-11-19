import assert from "node:assert/strict";
import test from "node:test";
import { auditFailures, exceptionEnded, main, retire } from "../audit-build-deps.mjs";

const rule = { id: "GHSA-fc5q-39xc-vjpf", expires: "2026-12-19", reason: "test" };
const picomatch = { severity: "high", url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf", range: "*" };
const report = (extra = {}) => {
    const vulnerabilities = {
        picomatch: { severity: "high", via: [picomatch] },
        fdir: { severity: "high", via: ["picomatch"] },
        "@11ty/eleventy": { severity: "high", via: ["tinyglobby"] },
        tinyglobby: { severity: "high", via: ["fdir", "picomatch"] },
        minimatch: { severity: "moderate", via: [{ severity: "moderate", url: "https://github.com/advisories/GHSA-g3hv-75wg-m249", range: "*" }] },
        ...extra
    };
    const counts = {};
    for (const v of Object.values(vulnerabilities)) counts[v.severity] = (counts[v.severity] ?? 0) + 1;
    return { auditReportVersion: 2, metadata: { vulnerabilities: counts }, vulnerabilities };
};

test("the dated picomatch advisory and the packages flagged only through it pass before the expiry", () => {
    assert.deepEqual(auditFailures(report(), "2026-12-19", rule), []);
});

test("the exception stops passing after its expiry date", () => {
    assert.ok(auditFailures(report(), "2026-12-20", rule).length > 0);
});

test("with the exception file gone the same advisories fail", () => {
    assert.ok(auditFailures(report(), "2026-11-20", undefined).length > 0);
});

test("any other high advisory still fails while the exception is live", () => {
    const other = { severity: "high", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", range: "<2.0.0" };
    const failures = auditFailures(report({ other: { severity: "high", via: [other] } }), "2026-11-20", rule);
    assert.deepEqual(failures.map((f) => f.name), ["other"]);
});

test("a package reaching the excepted advisory and another advisory fails", () => {
    const other = { severity: "critical", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", range: "<2.0.0" };
    const failures = auditFailures(report({ fdir: { severity: "critical", via: ["picomatch", other] } }), "2026-11-20", rule);
    assert.ok(failures.some((f) => f.name === "fdir" && f.advisories.includes("GHSA-aaaa-bbbb-cccc")));
});

test("the exception ends once a patched release narrows the advisory range", () => {
    const fixed = { ...picomatch, range: "<4.0.8" };
    const narrowed = report({ picomatch: { severity: "high", via: [fixed] } });
    assert.ok(auditFailures(narrowed, "2026-11-20", rule).some((f) => f.name === "picomatch"));
    assert.equal(exceptionEnded(narrowed, rule), true);
    assert.equal(exceptionEnded(report(), rule), false);
});

test("an audit with no vulnerability data fails instead of passing", () => {
    const errors = [{ error: { code: "ENOAUDIT" } }, {}, { vulnerabilities: {} }, { ...report(), vulnerabilities: [] }, { ...report(), auditReportVersion: 3 }, { ...report(), vulnerabilities: { x: { severity: "high" } } }, { ...report(), vulnerabilities: { x: { severity: "bogus", via: [] } } }, { ...report(), vulnerabilities: { x: { severity: "high", via: [{ url: "u", range: "*" }] } } }, { ...report(), metadata: { vulnerabilities: { high: 1 } }, vulnerabilities: {} }, report({ fdir: { severity: "moderate", via: [{ severity: "high", url: "https://github.com/advisories/GHSA-x", range: "*" }] } }), report({ fdir: { severity: "high", via: ["picomatch", "ghost"] } })];
    for (const bad of errors) {
        const quiet = console.error;
        console.error = () => {};
        try { assert.equal(main(() => bad, "2026-11-20", rule), 1); } finally { console.error = quiet; }
    }
});

test("retire runs the fix and removes the exception only once it has ended", () => {
    const calls = [];
    const fixed = report({ picomatch: { severity: "high", via: [{ ...picomatch, range: "<4.0.8" }] } });
    assert.equal(retire(() => report(), () => calls.push("fix"), () => calls.push("remove"), rule), "exception still needed");
    assert.deepEqual(calls, []);
    assert.equal(retire(() => fixed, () => calls.push("fix"), () => calls.push("remove"), rule), `retired ${rule.id}`);
    assert.deepEqual(calls, ["fix", "remove"]);
});
