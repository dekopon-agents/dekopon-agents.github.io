import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const exceptionFile = fileURLToPath(new URL("./audit-exception.json", import.meta.url));
const failing = new Set(["high", "critical"]);

const advisoryId = (via) => (via.url ?? "").split("/").pop();

function checked(report) {
    if (report.error || typeof report.vulnerabilities !== "object" || report.vulnerabilities === null || !report.metadata?.vulnerabilities) {
        throw new Error(`npm audit returned no vulnerability data: ${JSON.stringify(report.error ?? "missing vulnerabilities or metadata")}`);
    }
    return report.vulnerabilities;
}

const roots = (vulns, name, seen = new Set()) => {
    if (seen.has(name)) return [];
    seen.add(name);
    return (vulns[name]?.via ?? []).flatMap((via) => typeof via === "string" ? roots(vulns, via, seen) : [via]);
};

export function auditFailures(report, today, rule) {
    const vulns = checked(report);
    const live = rule !== undefined && today <= rule.expires;
    const failures = [];
    for (const [name, vuln] of Object.entries(vulns)) {
        if (!failing.has(vuln.severity)) continue;
        const all = roots(vulns, name);
        const open = all.filter((via) => failing.has(via.severity) && !(live && advisoryId(via) === rule.id && via.range === "*"));
        if (open.length > 0 || all.length === 0) failures.push({ name, severity: vuln.severity, advisories: open.map(advisoryId) });
    }
    return failures;
}

export function exceptionEnded(report, rule) {
    const vulns = checked(report);
    const seen = Object.keys(vulns).flatMap((name) => roots(vulns, name)).filter((via) => advisoryId(via) === rule.id);
    return seen.length === 0 || seen.every((via) => via.range !== "*");
}

const readRule = () => existsSync(exceptionFile) ? JSON.parse(readFileSync(exceptionFile, "utf8")) : undefined;

export function main(run = runAudit, today = new Date().toISOString().slice(0, 10), rule = readRule()) {
    let failures;
    try {
        failures = auditFailures(run(), today, rule);
    } catch (error) {
        console.error(`audit could not run: ${error.message}`);
        return 1;
    }
    if (failures.length === 0) {
        console.log(rule ? `audit ok (exception ${rule.id} until ${rule.expires}: ${rule.reason})` : "audit ok");
        return 0;
    }
    for (const f of failures) console.error(`${f.severity}: ${f.name} ${f.advisories.join(" ")}`.trim());
    console.error(`failing: ${failures.length} package(s).${rule ? ` Only ${rule.id} is excepted, until ${rule.expires}, and only while its range is *.` : ""}`);
    return 1;
}

export function retire(run = runAudit, fix = () => execFileSync("npm", ["audit", "fix"], { stdio: "inherit" }), remove = () => rmSync(exceptionFile), rule = readRule()) {
    if (!rule) return "no exception";
    if (!exceptionEnded(run(), rule)) return "exception still needed";
    fix();
    remove();
    return `retired ${rule.id}`;
}

function runAudit() {
    try {
        return JSON.parse(execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
    } catch (error) {
        if (error.stdout) return JSON.parse(error.stdout);
        throw error;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.argv.includes("--retire")) console.log(retire());
    else process.exit(main());
}
