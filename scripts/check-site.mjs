import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.resolve("_site");
const failures = [];
const release = JSON.parse(await readFile(path.resolve("src", "_data", "release.json"), "utf8"));

const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    }));
    return files.flat();
};

const exists = async (target) => {
    try {
        await access(target);
        return true;
    } catch {
        return false;
    }
};

const files = await walk(outputDirectory);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const pageIds = new Map();
const registryMetadataFile = path.join(outputDirectory, ".well-known", "wasm-pkg", "registry.json");
const expectedRegistryMetadata = {
    preferredProtocol: "oci",
    oci: {
        registry: "ghcr.io",
        namespacePrefix: "dekopon-agents/"
    }
};

if (!(await exists(registryMetadataFile))) {
    failures.push("missing .well-known/wasm-pkg/registry.json");
} else {
    try {
        const metadata = JSON.parse(await readFile(registryMetadataFile, "utf8"));
        if (JSON.stringify(metadata) !== JSON.stringify(expectedRegistryMetadata)) {
            failures.push(".well-known/wasm-pkg/registry.json: unexpected registry mapping");
        }
    } catch (error) {
        failures.push(`.well-known/wasm-pkg/registry.json: invalid JSON (${error.message})`);
    }
}

for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const relativeFile = path.relative(outputDirectory, file);

    if (!html.includes(release.tag)) {
        failures.push(`${relativeFile}: header does not render current release ${release.tag}`);
    }

    if (html.includes("{{") || html.includes("{%")) {
        failures.push(`${relativeFile}: contains an unrendered template expression`);
    }

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
        failures.push(`${relativeFile}: duplicate id(s): ${[...new Set(duplicates)].join(", ")}`);
    }
    pageIds.set(file, new Set(ids));
}

const homepage = await readFile(path.join(outputDirectory, "index.html"), "utf8");
for (const id of ["protocols", "providers"]) {
    if (!homepage.includes(`id="${id}"`)) failures.push(`homepage missing #${id}`);
}
const protocolSection = homepage.split('id="protocols"')[1]?.split('</section>')[0] ?? '';
for (const name of ['Slack', 'Discord', 'WhatsApp', 'Telegram']) {
    if (!protocolSection.includes(`<th scope="row">${name}</th>`)) failures.push(`missing transport ${name}`);
}
const providerSection = homepage.split('id="providers"')[1]?.split('</section>')[0] ?? '';
for (const name of ['gh', 'ripgrep', 'python', 'curl', 'turso', 'gpt-image']) {
    if (!providerSection.includes(`>${name}</a>`)) failures.push(`provider comparison missing ${name}`);
}
for (const required of ['workbench-flow', '<table>', 'Illustrative script', 'controlled runtime', '/deploy/kubernetes/', 'href="/providers/official/"']) {
    if (!homepage.includes(required)) failures.push(`homepage missing ${required}`);
}
if (homepage.includes('provider-ecosystem-card')) failures.push('homepage retains provider card catalog');

// Check the rendered hero, including containment rather than just page-wide words.
const heroDiagram = homepage.match(/<figure\b[^>]*aria-labelledby="hero-diagram-caption"[^>]*>([\s\S]*?)<\/figure>/)?.[1] ?? "";
const heroBoundaries = new Map();
const divStack = [];
for (const tag of heroDiagram.matchAll(/<div\b[^>]*>|<\/div>/g)) {
    if (tag[0] !== "</div>") {
        divStack.push({ start: tag.index, name: tag[0].match(/data-hero-boundary="([^"]+)"/)?.[1] });
    } else {
        const opening = divStack.pop();
        if (opening?.name) heroBoundaries.set(opening.name, heroDiagram.slice(opening.start, tag.index + tag[0].length));
    }
}
const expectedHeroBoundaries = {
    gateway: ["Slack agent session", "Comment on PR #456"],
    model: ["AI provider", "Model"],
    broker: ["Broker"],
    policy: ["Caller mapping", "Pre-configured Cedar policy"],
    wasm: ["GitHub provider", "fresh invocation", "Builds request, never sees GitHub PAT"],
    http: ["Broker-native HTTP", "Destination / method / limits checks"],
    credential: ["Broker-held", "GitHub PAT"],
    github: ["api.github.com", "GET + POST"]
};
for (const [boundary, labels] of Object.entries(expectedHeroBoundaries)) {
    for (const label of labels) {
        if (!heroBoundaries.get(boundary)?.includes(label)) {
            failures.push(`index.html: hero ${boundary} is missing "${label}"`);
        }
    }
}
for (const child of ["policy", "wasm", "http", "credential"]) {
    if (!heroBoundaries.get("broker")?.includes(`data-hero-boundary="${child}"`)) {
        failures.push(`index.html: hero ${child} must be inside the broker`);
    }
}
for (const [parent, children] of [
    ["broker", ["gateway", "model", "github"]],
    ["gateway", ["model", "credential"]],
    ["wasm", ["policy", "http", "credential"]]
]) {
    for (const child of children) {
        if (heroBoundaries.get(parent)?.includes(`data-hero-boundary="${child}"`)) {
            failures.push(`index.html: hero ${child} must be outside ${parent}`);
        }
    }
}
const heroSteps = [...heroDiagram.matchAll(/data-hero-step="(\d+)"/g)].map((match) => match[1]);
if (heroSteps.join(",") !== "1,2,3,4,5,6") {
    failures.push("index.html: hero must show six ordered transitions");
}
for (const [index, label] of ["Prompt + script tool", "Requested bash command", "Request / result", "Authorize capability", "Request HTTP", "Inject credential + send"].entries()) {
    const step = heroDiagram.split(`data-hero-step="${index + 1}"`)[1]?.split("</div>")[0] ?? "";
    if (!step.includes(`>${index + 1}</b>`) || !step.includes(label)) {
        failures.push(`index.html: hero transition ${index + 1} needs its visible number and label`);
    }
}
if (!heroDiagram.includes("Unix socket")) failures.push("index.html: hero must name the Unix socket");

for (const relativeFile of ["deploy/index.html", "whats-new/index.html", "providers/index.html", "providers/ship/index.html", "providers/official/index.html"]) {
    const html = await readFile(path.join(outputDirectory, relativeFile), "utf8");
    if (!html.includes(release.tag)) {
        failures.push(`${relativeFile}: missing current release ${release.tag}`);
    }
}

// The provider guide is an orientation page, not an inline SDK or deployment manual.
const providerGuide = await readFile(path.join(outputDirectory, "providers/index.html"), "utf8");
const guideMain = providerGuide.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
for (const id of ["provider-map", "interfaces", "start"]) {
    if (!guideMain.includes(`id="${id}"`)) failures.push(`provider guide: missing #${id}`);
}
for (const retired of ["article-rail", "almanac-article-number", 'id="coding-agent-prompt"', "<details"]) {
    if (guideMain.includes(retired)) failures.push(`provider guide: retired tutorial structure/API ${retired}`);
}
// Historical API names may explain a migration; runnable examples must stay current.
const guideExamples = [...guideMain.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)].map((match) => match[1]).join("\n");
for (const retired of ["export_provider!", "export_provider_with_bindings!", "export_provider_with_cli!", "resolve-command"]) {
    if (guideExamples.includes(retired)) failures.push(`provider guide: runnable example uses retired API ${retired}`);
}
for (const required of ["run_command()", "invoke()", "export!(CliProbe)", "stream", "attaching does not send", "Not a policy test", "transformed reflection", "conformance_accepts_checked_cli_probe", "real_component_captures_piped_bytes_and_status", "closed_real_stdout_reader_terminates_producer_early", "141"]) {
    if (!guideMain.includes(required)) failures.push(`provider guide: missing contract/check ${required}`);
}
if (!guideMain.includes(`--branch ${release.tag}`) || !guideMain.includes(`${release.sourceUrl}/examples/providers/cli-probe`)) {
    failures.push("provider guide: example must use the current release and pinned source");
}
if ([...guideMain.matchAll(/<pre\b/g)].length !== 2) failures.push("provider guide: keep two command panels, not full source listings");
const guideWords = guideMain.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
if (guideWords > 1100) failures.push(`provider guide: ${guideWords} words exceeds the 1100-word orientation budget`);
// Shipping keeps the GHCR setup, digest pinning and the three trust tiers.
const shipMain = (await readFile(path.join(outputDirectory, "providers/ship/index.html"), "utf8")).match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
for (const required of ["packages: write", "GITHUB_TOKEN", "Change visibility", "provider-set/v1alpha1", "@sha256:", "gh attestation verify", "wasm-tools component wit", "build.sh", "not a planted one"]) {
    if (!shipMain.includes(required)) failures.push(`ship guide: missing contract/step ${required}`);
}
for (const id of ["actions", "ghcr", "release", "install", "trust"]) {
    if (!shipMain.includes(`id="${id}"`)) failures.push(`ship guide: missing #${id}`);
}
const shipWords = shipMain.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
if (shipWords > 1150) failures.push(`ship guide: ${shipWords} words exceeds the 1150-word budget`);
// The provider tabs are two linked pages. The link to the page you are on is aria-current="page";
// /providers/ship/ belongs to Build Your Own, so that link marks the section with "true".
for (const [relativeFile, current] of [
    ["providers/index.html", { "/providers/": "page" }],
    ["providers/ship/index.html", { "/providers/": "true" }],
    ["providers/official/index.html", { "/providers/official/": "page" }]
]) {
    const html = await readFile(path.join(outputDirectory, relativeFile), "utf8");
    const navs = [...html.matchAll(/<nav class="provider-tabs" aria-label="Providers">([\s\S]*?)<\/nav>/g)];
    if (navs.length !== 1) {
        failures.push(`${relativeFile}: needs one provider tab nav, found ${navs.length}`);
        continue;
    }
    const tabs = [...navs[0][1].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
        .map(([tag, href, label]) => ({ href, label, state: tag.match(/aria-current="([^"]+)"/)?.[1] }));
    const expected = [["/providers/", "Build Your Own"], ["/providers/official/", "Official Providers"]];
    if (tabs.map(({ href, label }) => `${href} ${label}`).join("|") !== expected.map((tab) => tab.join(" ")).join("|")) {
        failures.push(`${relativeFile}: provider tabs must link Build Your Own and Official Providers, in that order`);
    }
    for (const { href, state } of tabs) {
        if (state !== current[href]) failures.push(`${relativeFile}: tab ${href} has aria-current=${state ?? "none"}, expected ${current[href] ?? "none"}`);
    }
}
// The official list renders one row per data entry, each linking its repository and release.
const officialProviders = JSON.parse(await readFile(path.resolve("src", "_data", "officialProviders.json"), "utf8"));
const officialMain = (await readFile(path.join(outputDirectory, "providers/official/index.html"), "utf8")).match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
const officialRows = [...officialMain.matchAll(/<tr data-provider="([^"]+)">([\s\S]*?)<\/tr>/g)];
if (officialRows.length !== officialProviders.providers.length) {
    failures.push(`official providers: ${officialRows.length} rows for ${officialProviders.providers.length} data entries`);
}
for (const provider of officialProviders.providers) {
    const repoUrl = `https://github.com/dekopon-agents/${provider.repo}`;
    const row = officialRows.find(([, name]) => `dekopon-provider-${name}` === provider.repo)?.[2] ?? "";
    if (!row.includes(`href="${repoUrl}#readme"`)) failures.push(`official providers: ${provider.repo} needs a repository link`);
    if (!row.includes(`href="${repoUrl}/releases/tag/${provider.release}"`)) failures.push(`official providers: ${provider.repo} needs its ${provider.release} release link`);
    for (const word of provider.command) {
        if (!row.includes(`<code>${word}</code>`)) failures.push(`official providers: ${provider.repo} row is missing command ${word}`);
    }
}
if (!officialMain.includes(`Snapshot: ${officialProviders.snapshotDate}`)) failures.push("official providers: missing snapshot date");
if (!officialMain.includes('href="/providers/ship/#install"')) failures.push("official providers: must link install by digest");
const guideBoundaries = new Map();
const guideStack = [];
for (const tag of guideMain.matchAll(/<div\b[^>]*>|<\/div>/g)) {
    if (tag[0] !== "</div>") {
        guideStack.push({ start: tag.index, name: tag[0].match(/data-sdk-boundary="([^"]+)"/)?.[1] });
    } else {
        const opening = guideStack.pop();
        if (opening?.name) guideBoundaries.set(opening.name, guideMain.slice(opening.start, tag.index + tag[0].length));
    }
}
for (const child of ["guest", "policy", "host", "credential"]) {
    if (!guideBoundaries.get("broker")?.includes(`data-sdk-boundary="${child}"`)) failures.push(`provider guide: ${child} must be inside broker`);
}
for (const child of ["policy", "host", "credential"]) {
    if (guideBoundaries.get("guest")?.includes(`data-sdk-boundary="${child}"`)) failures.push(`provider guide: ${child} must stay outside guest`);
}

// Consolidated pages keep distinct mechanisms instead of six overlapping chapters.
const contracts = {
    'how-it-works/index.html': ['dekopon-gatewayd', 'dekopon-brokerd', 'Unix socket', 'agent.prompt', 'endpoint you authorize receives', 'not intent', 'never grants authority', 'identifies the jail, not the VM', 'no multi-tenant transport', 'design.md#constitution', 'authorization.md', 'memory.md#the-ladder', 'design.md#keyless-model-access-for-outside-vms'],
    'deploy/kubernetes/index.html': ['UID 65533', 'UID 65532', 'broker.configDirectory.peers', 'dekopon-gatewayd', 'CHOWN', 'FOWNER', 'seeded once', 'gateway.enabled: true', 'helm upgrade --install'],
    'whats-new/index.html': ['dekopon-gatewayd', 'dekopon-brokerd', 'auth chatgpt']
};
for (const [file, strings] of Object.entries(contracts)) {
    const html = await readFile(path.join(outputDirectory, file), 'utf8');
    for (const text of strings) if (!html.includes(text)) failures.push(`${file}: missing mechanism/limit ${text}`);
    for (const retired of ['breadth: transportWide', 'allowDevelopmentSubjects', 'dev.console.', 'The model never sees the bytes']) {
        if (html.includes(retired)) failures.push(`${file}: retired contract ${retired}`);
    }
    if (html.includes('article-rail') || html.includes('<details')) failures.push(`${file}: obsolete essay scaffolding`);
}
// Providers write JSON bytes; jq consumes the pipeline and emits the projection.
const prReadScript = "set -e\nset -o pipefail\ngh pr view 7 -R owner/repo --json title,state | jq '{title, state}'";
const homeScript = homepage.match(/<pre\b[^>]*aria-label="Illustrative read-only GitHub workflow"[^>]*><code>([\s\S]*?)<\/code>/)?.[1];
if (homeScript !== prReadScript) failures.push('index.html: PR read script must pipe the structured object directly to jq');

// The how-it-works hero is a sequence: nine numbered hops, each in order, the credential added
// by the broker on the hop to GitHub and never earlier.
const howItWorks = await readFile(path.join(outputDirectory, 'how-it-works/index.html'), 'utf8');
const sequence = howItWorks.match(/<ol class="seq-steps">([\s\S]*?)<\/ol>/)?.[1] ?? '';
const hops = [...sequence.matchAll(/<li class="([^"]+)">([\s\S]*?)<\/li>/g)].map(([, kind, body]) => ({ kind, body }));
if (hops.map(({ body }) => body.match(/class="seq-n">(\d+)</)?.[1]).join(',') !== '1,2,3,4,5,6,7,8,9') {
    failures.push('how-it-works: the sequence must show nine numbered hops in order');
}
for (const [index, kind, label] of [
    [2, 'seq-msg seq-23', 'Attests the sender'],
    [3, 'seq-note seq-on-3', 'Cedar decides'],
    [4, 'seq-note seq-on-3 seq-wasm', 'A Wasm provider builds the request'],
    [5, 'seq-msg seq-34 seq-secret', 'Injects the credential bound to'],
    [7, 'seq-msg seq-23 seq-back', 'Returns as the command’s output']
]) {
    if (hops[index]?.kind !== kind || !hops[index]?.body.includes(label)) failures.push(`how-it-works: hop ${index + 1} must be "${label}" (${kind})`);
}
if (!hops[5]?.body.includes('GET /repos/{owner}/{repo}/pulls/123')) failures.push('how-it-works: hop 6 must name the GitHub request');
if (hops.slice(0, 5).some(({ kind }) => kind.includes('seq-secret'))) failures.push('how-it-works: no hop before GitHub may carry the credential');
const whatsNew = await readFile(path.join(outputDirectory, 'whats-new/index.html'), 'utf8');
const installSection = whatsNew.match(/<section\b[^>]*id="install"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
if (!installSection.includes('id="get-latest"') || !installSection.includes('href="/deploy/"')) {
    failures.push('whats-new: legacy #get-latest must belong to the installation section with install options');
}

const moves = JSON.parse(await readFile('src/_data/routeMoves.json', 'utf8'));
const legacy = JSON.parse(await readFile('scripts/fixtures/legacy-fragments.json', 'utf8'));
for (const [route, ids] of Object.entries(legacy)) {
    if (!moves[route]) failures.push(`lost legacy route ${route}`);
    for (const id of ids) if (!moves[route]?.fragments[id]) failures.push(`lost legacy fragment ${route}#${id}`);
}
for (const [old, move] of Object.entries(moves)) {
    const html = await readFile(path.join(outputDirectory, old, 'index.html'), 'utf8');
    if (!html.includes(`href="https://dekopon-agents.github.io${move.target.split('#')[0]}"`)) failures.push(`${old}: wrong canonical`);
    if (!html.includes(`data-move-default href="${move.target}"`)) failures.push(`${old}: missing fallback`);
    for (const [id, target] of Object.entries(move.fragments)) {
        if (!html.includes(`id="${id}" data-move-fragment href="${target}"`)) failures.push(`${old}#${id}: missing section mapping`);
    }
}
const sitemap = await readFile(path.join(outputDirectory, 'sitemap.xml'), 'utf8');
for (const route of ['/how-it-works/', '/providers/official/']) {
    if (!sitemap.includes(`${route}</loc>`)) failures.push(`sitemap missing ${route}`);
}
for (const retired of ['/almanac/', '/guides/access/', '/guides/runtime/', '/inference/', '/guides/traces/', '/guides/provider-sdk/']) {
    if (sitemap.includes(retired)) failures.push(`sitemap contains moved route ${retired}`);
}

for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const relativeFile = path.relative(outputDirectory, file);
    const references = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

    for (const reference of references) {
        if (/^(?:https?:|mailto:|tel:|data:|javascript:)/.test(reference)) continue;

        const [rawPath, fragment] = reference.split("#", 2);
        let target;

        if (!rawPath) {
            target = file;
        } else if (rawPath.startsWith("/")) {
            target = path.join(outputDirectory, decodeURIComponent(rawPath));
        } else {
            target = path.resolve(path.dirname(file), decodeURIComponent(rawPath));
        }

        if (target.endsWith(path.sep) || path.extname(target) === "") {
            target = path.join(target, "index.html");
        }

        if (!(await exists(target))) {
            failures.push(`${relativeFile}: missing local target ${reference}`);
            continue;
        }

        if (fragment && target.endsWith(".html")) {
            if (!pageIds.has(target)) {
                const targetHtml = await readFile(target, "utf8");
                pageIds.set(target, new Set([...targetHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
            }
            if (!pageIds.get(target).has(decodeURIComponent(fragment))) {
                failures.push(`${relativeFile}: missing fragment #${fragment} in ${path.relative(outputDirectory, target)}`);
            }
        }
    }
}

if (failures.length > 0) {
    console.error(`Site checks failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Checked ${htmlFiles.length} HTML pages and ${files.length} generated files.`);
}
