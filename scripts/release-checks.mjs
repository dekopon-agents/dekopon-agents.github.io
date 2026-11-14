import { chartMetadata, releaseSources, repository, semver, witPaths } from "./release-sources.mjs";

export { chartMetadata };

export function checkRelease(release) {
    const failures = [];
    const expect = (condition, message) => { if (!condition) failures.push(message); };
    expect(semver.test(release.version), `version is not semantic: ${release.version}`);
    expect(release.tag === `v${release.version}`, "tag does not match version");
    expect(/^[a-f0-9]{40}$/.test(release.revision), "revision must be a full commit SHA");
    expect(release.shortRevision === release.revision?.slice(0, 7), "shortRevision must use the first seven characters of revision");
    expect(release.url === `https://github.com/${repository}/releases/tag/${release.tag}`, "release URL must identify the pinned Dekopon release");
    expect(release.sourceUrl === `https://github.com/${repository}/tree/${release.revision}`, "source URL must identify the pinned Dekopon commit");
    expect(release.imageReference === `ghcr.io/${repository}:${release.tag}`, "image reference must identify the pinned Dekopon image");
    if (release.imageDigest !== undefined) expect(/^sha256:[a-f0-9]{64}$/.test(release.imageDigest), "imageDigest must be a SHA-256 digest");
    expect(release.installCommand === `docker pull ${release.imageReference}`, "installCommand does not pull imageReference");
    const date = new Date(`${release.dateIso}T00:00:00Z`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(release.dateIso) && !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === release.dateIso;
    expect(validDate, "dateIso must be a real ISO calendar date");
    if (validDate) {
        const format = (month) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month, year: "numeric", timeZone: "UTC" }).format(date);
        expect(release.date === format("long"), "date does not match dateIso");
        expect(release.dateShort === format("short").replace("Sept", "Sep"), "dateShort does not match dateIso");
    }
    for (const field of ["sourceVersion", "sourceAppVersion", "publishedVersion", "publishedAppVersion"]) {
        expect(semver.test(release.chart?.[field]), `chart.${field} must be a semantic version`);
    }
    expect(release.chart?.sourceAppVersion === release.version, "chart.sourceAppVersion must match the application snapshot");
    return failures;
}

export async function checkRemoteRelease(release, sdk, { request = fetch, token = process.env.GITHUB_TOKEN } = {}) {
    const sources = releaseSources({ request, token });
    const failures = [];
    const run = async (name, check) => {
        try { await check(); } catch (error) { failures.push(`${name}: ${error.message}`); }
    };
    const expect = (condition, message) => { if (!condition) failures.push(message); };
    await Promise.all([
        run("GitHub release", async () => {
            const latest = await sources.latestRelease();
            expect(latest.tag_name === release.tag, `site pins ${release.tag}, but GitHub latest is ${latest.tag_name}`);
            expect(latest.published_at?.slice(0, 10) === release.dateIso, `site date ${release.dateIso} does not match GitHub publication ${latest.published_at}`);
        }),
        run("Git tag", async () => {
            const commit = await sources.tagCommit(release.tag);
            expect(commit === release.revision, `tag ${release.tag} does not resolve to pinned commit ${release.revision}`);
        }),
        run("Source chart", async () => {
            const chart = await sources.sourceChart(release.revision);
            expect(chart.version === release.chart.sourceVersion, `source chart version ${chart.version} differs from ${release.chart.sourceVersion}`);
            expect(chart.appVersion === release.chart.sourceAppVersion, `source chart appVersion ${chart.appVersion} differs from ${release.chart.sourceAppVersion}`);
        }),
        run("Published OCI chart", async () => {
            const chart = await sources.publishedChart(release.chart.publishedVersion);
            expect(chart.name === "dekopon", "published chart name must be dekopon");
            expect(chart.version === release.chart.publishedVersion, `published chart version ${chart.version} differs from ${release.chart.publishedVersion}`);
            expect(chart.appVersion === release.chart.publishedAppVersion, `published chart appVersion ${chart.appVersion} differs from ${release.chart.publishedAppVersion}`);
        }),
        ...(release.imageDigest === undefined ? [] : [run("Container image", async () => {
            const digest = await sources.imageDigest(release.tag);
            expect(digest === release.imageDigest, `image ${release.tag} is ${digest}, not pinned ${release.imageDigest}`);
        })]),
        run("Homebrew tap", async () => {
            const archive = `https://github.com/${repository}/releases/download/${release.tag}/dekopon-${release.version}-aarch64-apple-darwin.tar.gz`;
            expect((await sources.tapFormula()).includes(`url "${archive}"`), `Homebrew tap formula does not install ${archive}`);
        }),
        run("SDK toolchain", async () => {
            const toolchain = await sources.toolchain(release.revision);
            expect(sdk.versions.rust === toolchain.rust, `SDK Rust pin ${sdk.versions.rust} differs from ${toolchain.rust}`);
            expect(sdk.versions.wasmTools === toolchain.wasmTools, `SDK wasm-tools pin ${sdk.versions.wasmTools} differs from ${toolchain.wasmTools}`);
            await Promise.all(Object.keys(witPaths).map(async (name) => {
                const wit = await sources.wit(release.revision, name);
                const pin = sdk.interfaces?.[name];
                const match = pin?.match(/^(dekopon:[\w-]+)\/([\w-]+)@(\d+\.\d+\.\d+)$/);
                const packageName = wit.match(/^package\s+([^;]+);/m)?.[1];
                expect(Boolean(match) && packageName === `${match[1]}@${match[3]}` && (wit.includes(`interface ${match[2]} {`) || wit.includes(`world ${match[2]} {`)), `SDK ${name} interface ${pin} differs from pinned WIT ${packageName}`);
            }));
        })
    ]);
    return failures;
}
