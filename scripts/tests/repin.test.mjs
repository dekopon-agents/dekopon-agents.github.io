import assert from "node:assert/strict";
import test from "node:test";
import { derivePin } from "../repin.mjs";
import { checkRemoteRelease } from "../release-checks.mjs";
import { releaseSources } from "../release-sources.mjs";

const revision = "a".repeat(40);
const imageDigest = `sha256:${"e".repeat(64)}`;
const chartDigest = `sha256:${"b".repeat(64)}`;
const current = {
    release: { version: "1.2.2", tag: "v1.2.2" },
    sdk: { versions: { rust: "1.98.0", wasmTools: "1.259.0" }, interfaces: { provider: "dekopon:provider/provider-cli@0.3.0", stdio: "dekopon:stdio/streams@0.1.0", http: "dekopon:http/client@1.1.0" } }
};
const fixture = (changes = {}) => async (url) => {
    const responses = {
        "releases/tags/v1.2.3": { tag_name: "v1.2.3", published_at: "2026-09-28T23:30:00Z", draft: false, prerelease: false },
        "git/ref/tags/v1.2.3": { object: { type: "commit", sha: revision } },
        "charts/dekopon/Chart.yaml": 'version: 0.5.0\nappVersion: "1.2.3"\n',
        "token?": { token: "mock-public-pull-token" },
        "tags/list": { tags: ["0.3.0", "0.4.0", "0.6.0", "latest"] },
        "charts/dekopon/manifests/0.4.0": { config: { mediaType: "application/vnd.cncf.helm.config.v1+json", digest: chartDigest } },
        [`blobs/${chartDigest}`]: { name: "dekopon", version: "0.4.0", appVersion: "1.2.2" },
        "dekopon/manifests/v1.2.3": { body: {}, headers: { "docker-content-digest": imageDigest } },
        "rust-toolchain.toml": '[toolchain]\nchannel = "1.98.1"\n',
        "ci/toolchain.env": "WASM_TOOLS_VERSION=1.260.0\n",
        "crates/dekopon-provider-sdk/wit/provider.wit": "package dekopon:provider@0.4.0;\nworld provider-cli {\n}",
        "wit/stdio/stdio.wit": "package dekopon:stdio@0.1.0;\ninterface streams {\n}",
        "wit/http/http.wit": "package dekopon:http@1.1.0;\ninterface client {\n}",
        "contents/docs/gone.md": null,
        "contents/": {},
        ...changes
    };
    const key = Object.keys(responses).find((path) => url.includes(path));
    assert.ok(key, `unhandled fixture URL: ${url}`);
    const value = responses[key];
    if (value === null) return new Response("", { status: 404 });
    if (value.headers) return new Response(JSON.stringify(value.body), { status: 200, headers: value.headers });
    return new Response(typeof value === "string" ? value : JSON.stringify(value), { status: 200 });
};
const sources = (changes) => releaseSources({ request: fixture(changes), token: undefined });

test("a pin derives every field from the release and its publications", async () => {
    const { release, sdk } = await derivePin("v1.2.3", current, sources());
    assert.deepEqual(release, {
        version: "1.2.3", tag: "v1.2.3", date: "28 September 2026", dateShort: "28 Sep 2026", dateIso: "2026-09-28",
        revision, shortRevision: "aaaaaaa",
        url: "https://github.com/dekopon-agents/dekopon/releases/tag/v1.2.3",
        sourceUrl: `https://github.com/dekopon-agents/dekopon/tree/${revision}`,
        imageReference: "ghcr.io/dekopon-agents/dekopon:v1.2.3",
        installCommand: "docker pull ghcr.io/dekopon-agents/dekopon:v1.2.3",
        chart: { publishedVersion: "0.4.0", publishedAppVersion: "1.2.2", sourceVersion: "0.5.0", sourceAppVersion: "1.2.3" },
        imageDigest
    });
    assert.deepEqual(sdk, { versions: { rust: "1.98.1", wasmTools: "1.260.0" }, interfaces: { provider: "dekopon:provider/provider-cli@0.4.0", stdio: "dekopon:stdio/streams@0.1.0", http: "dekopon:http/client@1.1.0" } });
});
test("an unchanged chart keeps the chart published before the release, never a later one", async () => {
    const { release } = await derivePin("v1.2.3", current, sources());
    assert.equal(release.chart.publishedVersion, "0.4.0");
});
test("a pin never moves backwards", async () => {
    await assert.rejects(derivePin("v1.2.3", { ...current, release: { version: "1.3.0", tag: "v1.3.0" } }, sources()), /backwards/);
});
test("a prerelease is never pinned", async () => {
    await assert.rejects(derivePin("v1.2.3", current, sources({ "releases/tags/v1.2.3": { tag_name: "v1.2.3", published_at: "2026-09-28T23:30:00Z", prerelease: true } })), /prerelease/);
});
test("a renamed SDK interface stops the pin", async () => {
    await assert.rejects(derivePin("v1.2.3", current, sources({ "wit/http/http.wit": "package dekopon:http@2.0.0;\ninterface fetcher {\n}" })), /no longer defines client/);
});
test("a missing pinned source path is reported", async () => {
    assert.equal(await sources().pathExists(revision, "docs/gone.md"), false);
    assert.equal(await sources().pathExists(revision, "docs/deploy.md"), true);
});
test("the remote check rejects an image digest that differs from the registry", async () => {
    const { release, sdk } = await derivePin("v1.2.3", current, sources());
    const request = fixture({
        "releases/latest": { tag_name: "v1.2.3", published_at: "2026-09-28T23:30:00Z" },
        "dekopon/manifests/v1.2.3": { body: {}, headers: { "docker-content-digest": `sha256:${"f".repeat(64)}` } },
        "Formula/dekopon.rb": 'url "https://github.com/dekopon-agents/dekopon/releases/download/v1.2.3/dekopon-1.2.3-aarch64-apple-darwin.tar.gz"'
    });
    const failures = await checkRemoteRelease(release, sdk, { request, token: undefined });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /image v1\.2\.3 is sha256:f+, not pinned sha256:e+/);
});
