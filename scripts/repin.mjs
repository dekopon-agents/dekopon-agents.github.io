import { appendFile, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { compareSemver, releaseSources, repository, witPackage, witPaths } from "./release-sources.mjs";

const dataFile = (name) => new URL(`../src/_data/${name}.json`, import.meta.url);

export async function derivePin(tag, current, sources) {
    const published = await sources.release(tag);
    if (published.draft || published.prerelease) throw new Error(`${tag} is a draft or prerelease`);
    const version = tag.replace(/^v/, "");
    if (compareSemver(version, current.release.version) < 0) {
        throw new Error(`refusing to move the pin backwards from ${current.release.tag} to ${tag}`);
    }
    const revision = await sources.tagCommit(tag);
    if (!revision) throw new Error(`tag ${tag} does not resolve to a commit`);
    const [sourceChart, imageDigest, toolchain] = await Promise.all([
        sources.sourceChart(revision),
        sources.imageDigest(tag),
        sources.toolchain(revision)
    ]);
    // A release that left the chart alone keeps the chart published before it.
    const chartVersion = await sources.latestPublishedChartVersion(sourceChart.version);
    const publishedChart = await sources.publishedChart(chartVersion);
    const interfaces = Object.fromEntries(await Promise.all(Object.keys(witPaths).map(async (name) => {
        const wit = await sources.wit(revision, name);
        const item = current.sdk.interfaces?.[name]?.match(/\/([\w-]+)@/)?.[1];
        if (!item || !(wit.includes(`interface ${item} {`) || wit.includes(`world ${item} {`))) {
            throw new Error(`${witPaths[name]} at ${tag} no longer defines ${item}`);
        }
        return [name, `${witPackage(wit).replace(/@.*/, "")}/${item}@${witPackage(wit).split("@")[1]}`];
    })));
    const dateIso = published.published_at.slice(0, 10);
    const date = new Date(`${dateIso}T00:00:00Z`);
    const format = (month) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month, year: "numeric", timeZone: "UTC" }).format(date);
    const imageReference = `ghcr.io/${repository}:${tag}`;
    const release = {
        version,
        tag,
        date: format("long"),
        dateShort: format("short").replace("Sept", "Sep"),
        dateIso,
        revision,
        shortRevision: revision.slice(0, 7),
        url: `https://github.com/${repository}/releases/tag/${tag}`,
        sourceUrl: `https://github.com/${repository}/tree/${revision}`,
        imageReference,
        installCommand: `docker pull ${imageReference}`,
        chart: {
            publishedVersion: publishedChart.version,
            publishedAppVersion: publishedChart.appVersion,
            sourceVersion: sourceChart.version,
            sourceAppVersion: sourceChart.appVersion
        },
        imageDigest
    };
    return { release, sdk: { versions: { rust: toolchain.rust, wasmTools: toolchain.wasmTools }, interfaces } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const flag = process.argv.indexOf("--tag");
    const sources = releaseSources();
    const tag = flag > 0 ? process.argv[flag + 1] : (await sources.latestRelease()).tag_name;
    const current = {
        release: JSON.parse(await readFile(dataFile("release"), "utf8")),
        sdk: JSON.parse(await readFile(dataFile("providerSdk"), "utf8"))
    };
    const next = await derivePin(tag, current, sources);
    const changed = JSON.stringify(next) !== JSON.stringify(current);
    if (changed) {
        await writeFile(dataFile("release"), `${JSON.stringify(next.release, null, 2)}\n`);
        await writeFile(dataFile("providerSdk"), `${JSON.stringify(next.sdk, null, 2)}\n`);
    }
    console.log(changed ? `pinned ${current.release.tag} -> ${tag}` : `already pinned ${tag}`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\ntag=${tag}\n`);
}
