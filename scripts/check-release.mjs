import { readFile } from "node:fs/promises";
import process from "node:process";

const releasePath = new URL("../src/_data/release.json", import.meta.url);
const release = JSON.parse(await readFile(releasePath, "utf8"));
const failures = [];
const expectedTag = `v${release.version}`;

if (!/^\d+\.\d+\.\d+$/.test(release.version)) {
    failures.push(`version is not semantic: ${release.version}`);
}
if (release.tag !== expectedTag) {
    failures.push(`tag ${release.tag} does not match version ${release.version}`);
}
if (!release.url.endsWith(`/releases/tag/${release.tag}`)) {
    failures.push(`release URL does not end in ${release.tag}`);
}
if (!release.sourceUrl.endsWith(`/tree/${release.revision}`)) {
    failures.push("source URL does not end in the pinned revision");
}
if (release.shortRevision !== release.revision.slice(0, 7)) {
    failures.push("shortRevision is not the first seven characters of revision");
}
if (!release.imageReference.endsWith(`:${release.tag}`)) {
    failures.push(`image reference does not use ${release.tag}`);
}
if (release.installCommand !== `docker pull ${release.imageReference}`) {
    failures.push("installCommand does not pull imageReference");
}

const evergreenFiles = [
    new URL("../src/_data/site.json", import.meta.url),
    new URL("../src/_data/home.json", import.meta.url)
];
for (const file of evergreenFiles) {
    const source = await readFile(file, "utf8");
    if (/v\d+\.\d+\.\d+/.test(source)) {
        failures.push(`${file.pathname}: evergreen data contains a copied release tag`);
    }
}

if (process.argv.includes("--remote")) {
    const response = await fetch("https://api.github.com/repos/dekopon-agents/dekopon/releases/latest", {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "dekopon-site-release-check",
            ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
        }
    });
    if (!response.ok) {
        failures.push(`GitHub latest-release request failed: ${response.status} ${response.statusText}`);
    } else {
        const latest = await response.json();
        if (latest.tag_name !== release.tag) {
            failures.push(`site pins ${release.tag}, but GitHub latest is ${latest.tag_name}`);
        }
        if (latest.published_at?.slice(0, 10) !== release.dateIso) {
            failures.push(`site date ${release.dateIso} does not match GitHub publication ${latest.published_at}`);
        }
    }
}

if (failures.length > 0) {
    console.error(`Release checks failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Release metadata is internally consistent at ${release.tag}${process.argv.includes("--remote") ? " and matches GitHub" : ""}.`);
}
