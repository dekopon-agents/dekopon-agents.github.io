import assert from "node:assert/strict";
import test from "node:test";
import { auditFailures } from "../audit-build-deps.mjs";

const picomatch = { severity: "high", url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf", range: "*" };
const report = (extra = {}) => ({
    vulnerabilities: {
        picomatch: { severity: "high", via: [picomatch] },
        fdir: { severity: "high", via: ["picomatch"] },
        "@11ty/eleventy": { severity: "high", via: ["tinyglobby"] },
        tinyglobby: { severity: "high", via: ["fdir", "picomatch"] },
        minimatch: { severity: "moderate", via: [{ severity: "moderate", url: "https://github.com/advisories/GHSA-g3hv-75wg-m249", range: "*" }] },
        ...extra
    }
});

test("the dated picomatch advisory and the packages flagged only through it pass before the expiry", () => {
    assert.deepEqual(auditFailures(report(), "2026-12-19"), []);
});

test("the exception stops passing after its expiry date", () => {
    assert.ok(auditFailures(report(), "2026-12-20").length > 0);
});

test("any other high advisory still fails while the exception is live", () => {
    const other = { severity: "high", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", range: "<2.0.0" };
    const failures = auditFailures(report({ other: { severity: "high", via: [other] } }), "2026-11-20");
    assert.deepEqual(failures.map((f) => f.name), ["other"]);
});

test("a package reaching the excepted advisory and another advisory fails", () => {
    const other = { severity: "critical", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", range: "<2.0.0" };
    const failures = auditFailures(report({ fdir: { severity: "high", via: ["picomatch", other] } }), "2026-11-20");
    assert.ok(failures.some((f) => f.name === "fdir" && f.advisories.includes("GHSA-aaaa-bbbb-cccc")));
});

test("the exception ends once a patched release narrows the advisory range", () => {
    const fixed = { ...picomatch, range: "<4.0.8" };
    const failures = auditFailures(report({ picomatch: { severity: "high", via: [fixed] } }), "2026-11-20");
    assert.ok(failures.some((f) => f.name === "picomatch"));
});
