import { readFile } from "node:fs/promises";
import process from "node:process";
import { checkRelease, checkRemoteRelease } from "./release-checks.mjs";

const data = async (name) => JSON.parse(await readFile(new URL(`../src/_data/${name}.json`, import.meta.url), "utf8"));
const release = await data("release");
const sdk = await data("providerSdk");
const failures = checkRelease(release);

// Evergreen marketing data derives release details instead of copying a tag.
// Historical migration explanations in article templates remain valid content.
for (const name of ["site", "home"]) {
    if (/v\d+\.\d+\.\d+/.test(JSON.stringify(await data(name)))) {
        failures.push(`src/_data/${name}.json: evergreen data contains a copied release tag`);
    }
}

const remote = process.argv.includes("--remote");
if (remote && failures.length === 0) failures.push(...await checkRemoteRelease(release, sdk));
if (failures.length > 0) {
    console.error(`Release checks failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Release metadata is internally consistent at ${release.tag}${remote ? "; release, commit, source chart, published OCI chart, Homebrew tap, and SDK toolchain verified remotely" : ""}.`);
}
