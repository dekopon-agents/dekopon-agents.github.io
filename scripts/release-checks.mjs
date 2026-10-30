const repository = "dekopon-agents/dekopon";
const github = `https://api.github.com/repos/${repository}`;
const source = `https://raw.githubusercontent.com/${repository}`;
const registryRepository = "dekopon-agents/charts/dekopon";
const tapFormula = "https://raw.githubusercontent.com/dekopon-agents/homebrew-tap/main/Formula/dekopon.rb";
const semver = /^\d+\.\d+\.\d+$/;

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

// These are scalar fields in the project's Chart.yaml, not a general YAML parser.
export function chartMetadata(yaml) {
    return Object.fromEntries(["version", "appVersion"].map((field) => {
        const value = yaml.match(new RegExp(`^${field}:\\s*["']?([^\\s"'#]+)["']?\\s*(?:#.*)?$`, "m"))?.[1];
        return [field, value];
    }));
}

export async function checkRemoteRelease(release, sdk, { request = fetch, token = process.env.GITHUB_TOKEN } = {}) {
    const failures = [];
    const get = async (url, headers = {}, kind = "json") => {
        const response = await request(url, {
            headers: { "User-Agent": "dekopon-site-release-check", ...headers },
            signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
        return response[kind]();
    };
    const api = (path) => get(`${github}/${path}`, {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
    const raw = (path) => get(`${source}/${release.revision}/${path}`, {}, "text");
    const run = async (name, check) => {
        try { await check(); } catch (error) { failures.push(`${name}: ${error.message}`); }
    };
    const expect = (condition, message) => { if (!condition) failures.push(message); };
    await Promise.all([
        run("GitHub release", async () => {
            const latest = await api("releases/latest");
            expect(latest.tag_name === release.tag, `site pins ${release.tag}, but GitHub latest is ${latest.tag_name}`);
            expect(latest.published_at?.slice(0, 10) === release.dateIso, `site date ${release.dateIso} does not match GitHub publication ${latest.published_at}`);
        }),
        run("Git tag", async () => {
            let { object } = await api(`git/ref/tags/${encodeURIComponent(release.tag)}`);
            for (let depth = 0; object?.type === "tag" && depth < 5; depth += 1) {
                ({ object } = await api(`git/tags/${object.sha}`));
            }
            expect(object?.type === "commit" && object.sha === release.revision, `tag ${release.tag} does not resolve to pinned commit ${release.revision}`);
        }),
        run("Source chart", async () => {
            const chart = chartMetadata(await raw("charts/dekopon/Chart.yaml"));
            expect(chart.version === release.chart.sourceVersion, `source chart version ${chart.version} differs from ${release.chart.sourceVersion}`);
            expect(chart.appVersion === release.chart.sourceAppVersion, `source chart appVersion ${chart.appVersion} differs from ${release.chart.sourceAppVersion}`);
        }),
        run("Published OCI chart", async () => {
            const auth = await get(`https://ghcr.io/token?service=ghcr.io&scope=repository:${registryRepository}:pull`);
            if (!auth.token) throw new Error("registry did not return an anonymous pull token");
            const headers = { Authorization: `Bearer ${auth.token}`, Accept: "application/vnd.oci.image.manifest.v1+json" };
            const manifest = await get(`https://ghcr.io/v2/${registryRepository}/manifests/${release.chart.publishedVersion}`, headers);
            if (manifest.config?.mediaType !== "application/vnd.cncf.helm.config.v1+json") throw new Error("published artifact is not a Helm chart");
            if (!/^sha256:[a-f0-9]{64}$/.test(manifest.config.digest)) throw new Error("chart config has no SHA-256 digest");
            const chart = await get(`https://ghcr.io/v2/${registryRepository}/blobs/${manifest.config.digest}`, headers);
            expect(chart.name === "dekopon", "published chart name must be dekopon");
            expect(chart.version === release.chart.publishedVersion, `published chart version ${chart.version} differs from ${release.chart.publishedVersion}`);
            expect(chart.appVersion === release.chart.publishedAppVersion, `published chart appVersion ${chart.appVersion} differs from ${release.chart.publishedAppVersion}`);
        }),
        run("Homebrew tap", async () => {
            const archive = `https://github.com/${repository}/releases/download/${release.tag}/dekopon-${release.version}-aarch64-apple-darwin.tar.gz`;
            expect((await get(tapFormula, {}, "text")).includes(`url "${archive}"`), `Homebrew tap formula does not install ${archive}`);
        }),
        run("SDK toolchain", async () => {
            const [rust, tools] = await Promise.all([raw("rust-toolchain.toml"), raw("ci/toolchain.env")]);
            const rustVersion = rust.match(/^channel\s*=\s*"([^"]+)"/m)?.[1];
            const wasmToolsVersion = tools.match(/^WASM_TOOLS_VERSION=([^\s]+)$/m)?.[1];
            expect(sdk.versions.rust === rustVersion, `SDK Rust pin ${sdk.versions.rust} differs from ${rustVersion}`);
            expect(sdk.versions.wasmTools === wasmToolsVersion, `SDK wasm-tools pin ${sdk.versions.wasmTools} differs from ${wasmToolsVersion}`);
            await Promise.all(Object.entries({
                provider: "crates/dekopon-provider-sdk/wit/provider.wit",
                stdio: "wit/stdio/stdio.wit",
                http: "wit/http/http.wit"
            }).map(async ([name, path]) => {
                const wit = await raw(path);
                const pin = sdk.interfaces?.[name];
                const match = pin?.match(/^(dekopon:[\w-]+)\/([\w-]+)@(\d+\.\d+\.\d+)$/);
                const packageName = wit.match(/^package\s+([^;]+);/m)?.[1];
                expect(Boolean(match) && packageName === `${match[1]}@${match[3]}` && (wit.includes(`interface ${match[2]} {`) || wit.includes(`world ${match[2]} {`)), `SDK ${name} interface ${pin} differs from pinned WIT ${packageName}`);
            }));
        })
    ]);
    return failures;
}
