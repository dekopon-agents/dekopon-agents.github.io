import assert from "node:assert/strict";
import test from "node:test";
import { checkRelease, checkRemoteRelease, chartMetadata } from "../release-checks.mjs";

const revision = "a".repeat(40);
const release = {
    version: "1.2.3", tag: "v1.2.3", revision, shortRevision: revision.slice(0, 7),
    url: "https://github.com/dekopon-agents/dekopon/releases/tag/v1.2.3",
    sourceUrl: `https://github.com/dekopon-agents/dekopon/tree/${revision}`,
    imageReference: "ghcr.io/dekopon-agents/dekopon:v1.2.3",
    installCommand: "docker pull ghcr.io/dekopon-agents/dekopon:v1.2.3",
    dateIso: "2026-09-28", date: "28 September 2026", dateShort: "28 Sep 2026",
    chart: { sourceVersion: "0.5.0", sourceAppVersion: "1.2.3", publishedVersion: "0.4.0", publishedAppVersion: "1.2.2" }
};
const sdk = { versions: { rust: "1.98.1", wasmTools: "1.259.0" }, interfaces: { provider: "dekopon:provider/provider-cli@0.4.0", stdio: "dekopon:stdio/streams@0.1.0", http: "dekopon:http/client@1.1.0" } };
const digest = `sha256:${"b".repeat(64)}`;
const formula = (tag, version) => `class Dekopon < Formula\n  on_macos do\n    on_arm do\n      url "https://github.com/dekopon-agents/dekopon/releases/download/${tag}/dekopon-${version}-aarch64-apple-darwin.tar.gz"\n    end\n  end\nend\n`;
const fixture = (changes = {}) => async (url) => {
    const responses = {
        "releases/latest": { tag_name: release.tag, published_at: "2026-09-28T10:30:00Z" },
        "git/ref/tags/v1.2.3": { object: { type: "tag", sha: "c".repeat(40) } },
        [`git/tags/${"c".repeat(40)}`]: { object: { type: "commit", sha: revision } },
        "charts/dekopon/Chart.yaml": 'version: 0.5.0\nappVersion: "1.2.3"\n',
        "token?": { token: "mock-public-pull-token" },
        "manifests/0.4.0": { config: { mediaType: "application/vnd.cncf.helm.config.v1+json", digest } },
        [`blobs/${digest}`]: { name: "dekopon", version: "0.4.0", appVersion: "1.2.2" },
        "rust-toolchain.toml": '[toolchain]\nchannel = "1.98.1"\n',
        "ci/toolchain.env": "WASM_TOOLS_VERSION=1.259.0\n",
        "crates/dekopon-provider-sdk/wit/provider.wit": "package dekopon:provider@0.4.0;\nworld provider-cli {\n}",
        "wit/stdio/stdio.wit": "package dekopon:stdio@0.1.0;\ninterface streams {\n}",
        "wit/http/http.wit": "package dekopon:http@1.1.0;\ninterface client {\n}",
        "Formula/dekopon.rb": formula("v1.2.3", "1.2.3"),
        ...changes
    };
    const key = Object.keys(responses).find((path) => url.includes(path));
    assert.ok(key, `unhandled fixture URL: ${url}`);
    const value = responses[key];
    return new Response(typeof value === "string" ? value : JSON.stringify(value), { status: value === null ? 404 : 200 });
};

test("release pins are consistent even when published chart lags the source chart", () => assert.deepEqual(checkRelease(release), []));
test("release metadata rejects wrong hosts, revisions, dates, and chart pins", () => {
    for (const change of [{ revision: "short" }, { url: "https://example.com/releases/tag/v1.2.3" }, { dateIso: "2026-02-30" }, { date: "yesterday" }, { chart: {} }]) {
        assert.ok(checkRelease({ ...release, ...change }).length > 0, JSON.stringify(change));
    }
});
test("chart fields handle quotes and comments without confusing apiVersion", () => assert.deepEqual(chartMetadata('apiVersion: v2\nversion: 0.5.0 # chart\nappVersion: "1.2.3"\n'), { version: "0.5.0", appVersion: "1.2.3" }));
test("remote checks verify annotated release tags, source chart, OCI metadata, Homebrew tap, and SDK pins", async () => assert.deepEqual(await checkRemoteRelease(release, sdk, { request: fixture(), token: undefined }), []));
test("remote checks support lightweight tags", async () => assert.deepEqual(await checkRemoteRelease(release, sdk, { request: fixture({ "git/ref/tags/v1.2.3": { object: { type: "commit", sha: revision } } }) }), []));
test("remote checks report a stale release, commit, chart, and toolchain", async () => {
    const failures = await checkRemoteRelease(release, sdk, { request: fixture({
        "releases/latest": { tag_name: "v2.0.0", published_at: "2026-10-01T10:30:00Z" },
        [`git/tags/${"c".repeat(40)}`]: { object: { type: "commit", sha: "d".repeat(40) } },
        "charts/dekopon/Chart.yaml": "version: 0.6.0\nappVersion: 1.2.4\n",
        [`blobs/${digest}`]: { name: "dekopon", version: "0.4.0", appVersion: "1.2.1" },
        "ci/toolchain.env": "WASM_TOOLS_VERSION=1.260.0\n"
    }) });
    assert.equal(failures.length, 7);
});
test("remote checks report a Homebrew tap that still installs the previous release", async () => {
    const failures = await checkRemoteRelease(release, sdk, { request: fixture({ "Formula/dekopon.rb": formula("v1.2.2", "1.2.2") }) });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /Homebrew tap formula does not install .*\/v1\.2\.3\/dekopon-1\.2\.3-aarch64-apple-darwin\.tar\.gz/);
});
test("remote network failures fail closed with the failing source identified", async () => {
    const failures = await checkRemoteRelease(release, sdk, { request: fixture({ "charts/dekopon/Chart.yaml": null }) });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /Source chart:.*404/);
});

test("remote checks reject incompatible interface pins", async () => {
    const failures = await checkRemoteRelease(release, { ...sdk, interfaces: { ...sdk.interfaces, provider: "dekopon:provider/provider-cli@0.3.0" } }, { request: fixture() });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /SDK provider interface/);
});
