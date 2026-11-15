export const repository = "dekopon-agents/dekopon";
const github = `https://api.github.com/repos/${repository}`;
const source = `https://raw.githubusercontent.com/${repository}`;
const chartRepository = "dekopon-agents/charts/dekopon";
const tapFormula = "https://raw.githubusercontent.com/dekopon-agents/homebrew-tap/main/Formula/dekopon.rb";
export const semver = /^\d+\.\d+\.\d+$/;
export const witPaths = {
    provider: "crates/dekopon-provider-sdk/wit/provider.wit",
    stdio: "wit/stdio/stdio.wit",
    http: "wit/http/http.wit"
};
const imageIndexTypes = [
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json"
].join(", ");

export const compareSemver = (a, b) => {
    const [x, y] = [a, b].map((version) => version.split(".").map(Number));
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

// These are scalar fields in the project's Chart.yaml, not a general YAML parser.
export function chartMetadata(yaml) {
    return Object.fromEntries(["version", "appVersion"].map((field) => {
        const value = yaml.match(new RegExp(`^${field}:\\s*["']?([^\\s"'#]+)["']?\\s*(?:#.*)?$`, "m"))?.[1];
        return [field, value];
    }));
}

export const witPackage = (wit) => wit.match(/^package\s+([^;]+);/m)?.[1];

export function releaseSources({ request = fetch, token = process.env.GITHUB_TOKEN } = {}) {
    const fetchOk = async (url, headers = {}) => {
        const response = await request(url, {
            headers: { "User-Agent": "dekopon-site-release-check", ...headers },
            signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
        return response;
    };
    const get = async (url, headers = {}, kind = "json") => (await fetchOk(url, headers))[kind]();
    const apiHeaders = { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const api = (path) => get(`${github}/${path}`, apiHeaders);
    const raw = (revision, path) => get(`${source}/${revision}/${path}`, {}, "text");
    const registryToken = async (name) => {
        const auth = await get(`https://ghcr.io/token?service=ghcr.io&scope=repository:${name}:pull`);
        if (!auth.token) throw new Error("registry did not return an anonymous pull token");
        return auth.token;
    };

    return {
        latestRelease: () => api("releases/latest"),
        release: (tag) => api(`releases/tags/${encodeURIComponent(tag)}`),
        async tagCommit(tag) {
            let { object } = await api(`git/ref/tags/${encodeURIComponent(tag)}`);
            for (let depth = 0; object?.type === "tag" && depth < 5; depth += 1) {
                ({ object } = await api(`git/tags/${object.sha}`));
            }
            return object?.type === "commit" ? object.sha : undefined;
        },
        sourceChart: async (revision) => chartMetadata(await raw(revision, "charts/dekopon/Chart.yaml")),
        async publishedChart(version) {
            const headers = { Authorization: `Bearer ${await registryToken(chartRepository)}`, Accept: "application/vnd.oci.image.manifest.v1+json" };
            const manifest = await get(`https://ghcr.io/v2/${chartRepository}/manifests/${version}`, headers);
            if (manifest.config?.mediaType !== "application/vnd.cncf.helm.config.v1+json") throw new Error("published artifact is not a Helm chart");
            if (!/^sha256:[a-f0-9]{64}$/.test(manifest.config.digest)) throw new Error("chart config has no SHA-256 digest");
            return get(`https://ghcr.io/v2/${chartRepository}/blobs/${manifest.config.digest}`, headers);
        },
        async latestPublishedChartVersion(atMost) {
            const headers = { Authorization: `Bearer ${await registryToken(chartRepository)}` };
            const tags = [];
            for (let url = `https://ghcr.io/v2/${chartRepository}/tags/list?n=1000`; url;) {
                const response = await fetchOk(url, headers);
                tags.push(...((await response.json()).tags ?? []));
                const next = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
                url = next ? new URL(next, "https://ghcr.io").href : undefined;
            }
            const versions = tags.filter((tag) => semver.test(tag) && compareSemver(tag, atMost) <= 0).sort(compareSemver);
            if (versions.length === 0) throw new Error(`registry lists no published chart at or below ${atMost}`);
            return versions.at(-1);
        },
        async imageDigest(tag) {
            const headers = { Authorization: `Bearer ${await registryToken(repository)}`, Accept: imageIndexTypes };
            const digest = (await fetchOk(`https://ghcr.io/v2/${repository}/manifests/${tag}`, headers)).headers.get("docker-content-digest");
            if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? "")) throw new Error(`image ${tag} has no SHA-256 manifest digest`);
            return digest;
        },
        tapFormula: () => get(tapFormula, {}, "text"),
        async toolchain(revision) {
            const [rust, tools] = await Promise.all([raw(revision, "rust-toolchain.toml"), raw(revision, "ci/toolchain.env")]);
            return {
                rust: rust.match(/^channel\s*=\s*"([^"]+)"/m)?.[1],
                wasmTools: tools.match(/^WASM_TOOLS_VERSION=([^\s]+)$/m)?.[1]
            };
        },
        wit: (revision, name) => raw(revision, witPaths[name]),
        async pathExists(revision, path) {
            const response = await request(`${github}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${revision}`, {
                headers: { "User-Agent": "dekopon-site-release-check", ...apiHeaders },
                signal: AbortSignal.timeout(30_000)
            });
            if (response.status === 404) return false;
            if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`);
            return true;
        }
    };
}
