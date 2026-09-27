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
for (const required of ['workbench-flow', '<table>', 'Illustrative script', 'controlled runtime', '/deploy/kubernetes/']) {
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

for (const relativeFile of ["deploy/index.html", "whats-new/index.html", "guides/provider-sdk/index.html"]) {
    const html = await readFile(path.join(outputDirectory, relativeFile), "utf8");
    if (!html.includes(release.tag)) {
        failures.push(`${relativeFile}: missing current release ${release.tag}`);
    }
}

// The provider guide is an orientation page, not an inline SDK or deployment manual.
const providerGuide = await readFile(path.join(outputDirectory, "guides/provider-sdk/index.html"), "utf8");
const guideMain = providerGuide.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
for (const id of ["provider-map", "interfaces", "start"]) {
    if (!guideMain.includes(`id="${id}"`)) failures.push(`provider guide: missing #${id}`);
}
for (const retired of ["article-rail", "almanac-article-number", 'id="coding-agent-prompt"', "export_provider!", "export_provider_with_bindings!", "resolve-command", "<details"]) {
    if (guideMain.includes(retired)) failures.push(`provider guide: retired tutorial structure/API ${retired}`);
}
for (const required of ["run_command()", "invoke()", "export_provider_with_cli!", "stream", "attaching does not send", "Not a policy test", "transformed reflection", "a_command_word_renders_its_help_page_and_proposes"]) {
    if (!guideMain.includes(required)) failures.push(`provider guide: missing contract/check ${required}`);
}
if (!guideMain.includes(`--branch ${release.tag}`) || !guideMain.includes(`${release.sourceUrl}/examples/providers/cli-probe`)) {
    failures.push("provider guide: example must use the current release and pinned source");
}
if ([...guideMain.matchAll(/<pre\b/g)].length !== 2) failures.push("provider guide: keep two command panels, not full source listings");
const guideWords = guideMain.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
if (guideWords > 1600) failures.push(`provider guide: ${guideWords} words exceeds the 1600-word orientation budget`);
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
    'how-it-works/index.html': ['dekopond', 'dekopon-brokerd', 'Unix socket', 'not a multi-tenant'],
    'guides/access/index.html': ['uid: 65533', 'principals:', 'subjects: [slack.t0123abcd.u0123abcd]', 'agent.prompt', 'gh.pull-request.comment', 'secret.use', 'intent', 'endpoint receives'],
    'guides/runtime/index.html': ['not complete Bash/POSIX', 'non-yielding jq', '127', '126', 'SCM_RIGHTS', 'Attach is not send', '64 KiB', '40 MiB', 'stored bytes'],
    'guides/traces/index.html': ['broker.decision', 'broker.execution', 'serviceName: dekopond', '4096', 'RUST_LOG', 'Both processes', 'Lose collection'],
    'deploy/kubernetes/index.html': ['UID 65533', 'UID 65532', '0660', '0710', '65534', 'gateway-config', 'prepare-files', 'CHOWN', 'FOWNER', 'seeded once', '270', '320Mi', 'gateway.enabled: true', 'helm upgrade --install'],
    'whats-new/index.html': ['scope: private-conversation', 'idle-ttl', 'progressNotes: true', 'liveness.statusText: true']
};
for (const [file, strings] of Object.entries(contracts)) {
    const html = await readFile(path.join(outputDirectory, file), 'utf8');
    for (const text of strings) if (!html.includes(text)) failures.push(`${file}: missing mechanism/limit ${text}`);
    for (const retired of ['breadth: transportWide', 'allowDevelopmentSubjects', 'dev.console.', 'The model never sees the bytes']) {
        if (html.includes(retired)) failures.push(`${file}: retired contract ${retired}`);
    }
    if (html.includes('article-rail') || html.includes('<details')) failures.push(`${file}: obsolete essay scaffolding`);
}
// Echo stringifies structured values; keep the PR object directly in the jq pipeline.
// This exact script is checked against the pinned interpreter with a mock PR result.
const prReadScript = "set -e\nset -o pipefail\ngh pr view 7 -R owner/repo | jq '{title, state}'";
const runtimeGuide = await readFile(path.join(outputDirectory, 'guides/runtime/index.html'), 'utf8');
for (const [file, html, label] of [
    ['index.html', homepage, 'Illustrative read-only GitHub workflow'],
    ['guides/runtime/index.html', runtimeGuide, 'Illustrative PR read script']
]) {
    const script = html.match(new RegExp(`<pre\\b[^>]*aria-label="${label}"[^>]*><code>([\\s\\S]*?)</code>`))?.[1];
    if (script !== prReadScript) failures.push(`${file}: PR read script must pipe the structured object directly to jq`);
}
const workflowSection = runtimeGuide.split('id="workflow"')[1]?.split('</section>')[0] ?? '';
if (!workflowSection.includes('<code>{"title":"Fix the build","state":"open"}</code>')) {
    failures.push('runtime guide: missing expected PR projection result');
}
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
for (const route of ['/how-it-works/', '/guides/access/', '/guides/runtime/', '/guides/traces/']) {
    if (!sitemap.includes(route)) failures.push(`sitemap missing ${route}`);
}
if (sitemap.includes('/almanac/')) failures.push('sitemap contains retired chapter URLs');

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
