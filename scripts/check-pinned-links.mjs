import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { releaseSources, repository } from "./release-sources.mjs";

const release = JSON.parse(await readFile(new URL("../src/_data/release.json", import.meta.url), "utf8"));
const site = new URL("../_site/", import.meta.url).pathname;
const prefix = `https://github.com/${repository}/tree/${release.revision}/`;
const files = (await readdir(site, { recursive: true })).filter((file) => file.endsWith(".html"));
const paths = new Set();
for (const file of files) {
    const html = await readFile(path.join(site, file), "utf8");
    for (const [, target] of html.matchAll(new RegExp(`href="${prefix.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^"#?]+)`, "g"))) {
        paths.add(target.replace(/\/$/, ""));
    }
}
const sources = releaseSources();
const missing = (await Promise.all([...paths].map(async (target) => (await sources.pathExists(release.revision, target)) ? null : target))).filter(Boolean);
if (missing.length > 0) {
    console.error(`Pinned source links missing at ${release.tag} (${missing.length}):`);
    missing.forEach((target) => console.error(`  - ${target}`));
    process.exitCode = 1;
} else {
    console.log(`${paths.size} pinned source paths exist at ${release.tag}.`);
}
