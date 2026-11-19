import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const exception = {
    id: "GHSA-fc5q-39xc-vjpf",
    expires: "2026-12-19",
    reason: "picomatch ReDoS, no patched release exists (affected range is *). Build-only dev dependency: it matches only this site's own globs, and nothing it does ships to visitors."
};
const failing = new Set(["high", "critical"]);

const advisoryId = (via) => (via.url ?? "").split("/").pop();

export function auditFailures(report, today, rule = exception) {
    const vulns = report.vulnerabilities ?? {};
    const live = today <= rule.expires;
    const roots = (name, seen = new Set()) => {
        if (seen.has(name)) return [];
        seen.add(name);
        return (vulns[name]?.via ?? []).flatMap((via) => typeof via === "string" ? roots(via, seen) : [via]);
    };
    const failures = [];
    for (const [name, vuln] of Object.entries(vulns)) {
        if (!failing.has(vuln.severity)) continue;
        const open = roots(name).filter((via) => failing.has(via.severity) && !(live && advisoryId(via) === rule.id && via.range === "*"));
        if (open.length > 0 || roots(name).length === 0) failures.push({ name, severity: vuln.severity, advisories: open.map(advisoryId) });
    }
    return failures;
}

export function main(run = () => runAudit(), today = new Date().toISOString().slice(0, 10)) {
    const failures = auditFailures(run(), today);
    if (failures.length === 0) {
        console.log(`audit ok (exception ${exception.id} until ${exception.expires}: ${exception.reason})`);
        return 0;
    }
    for (const f of failures) console.error(`${f.severity}: ${f.name} ${f.advisories.join(" ")}`.trim());
    console.error(`failing: ${failures.length} package(s). Only ${exception.id} is excepted, until ${exception.expires}, and only while its range is *.`);
    return 1;
}

function runAudit() {
    try {
        return JSON.parse(execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
    } catch (error) {
        if (error.stdout) return JSON.parse(error.stdout);
        throw error;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
