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
for (const id of ["constitution", "protocols", "providers"]) {
    if (!homepage.includes(`id="${id}"`)) {
        failures.push(`index.html: missing orientation section #${id}`);
    }
}
for (const goal of ["Credentials are unleakable", "One trace, complete", "Extensible through Wasm providers"]) {
    if (!homepage.includes(goal)) {
        failures.push(`index.html: missing constitution goal "${goal}"`);
    }
}

for (const removed of ['id="one-request"', 'id="security"', 'pre-production', 'Five providers, five separate repos.']) {
    if (homepage.includes(removed)) failures.push(`index.html: retired homepage content remains: ${removed}`);
}
const protocolSection = homepage.split('id="protocols"')[1]?.split('</section>')[0] ?? '';
for (const name of ['Slack', 'Discord', 'WhatsApp', 'Telegram']) {
    if (!protocolSection.includes(`<h3>${name}</h3>`)) failures.push(`index.html: missing chat protocol ${name}`);
}
const providerSection = homepage.split('id="providers"')[1]?.split('</section>')[0] ?? '';
const toolLabels = [...providerSection.matchAll(/<div><span>([^<]+)<\/span>/g)].map(match => match[1]);
if (toolLabels.join('|') !== 'bash|gh|ripgrep|python|curl|gpt-image|SQL · Turso') {
    failures.push('index.html: expected maturity-ordered tool lineup');
}

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
for (const [index, label] of ["Prompt + bash tool", "Requested bash command", "Propose action", "Authorize capability", "Request HTTP", "Inject credential + send"].entries()) {
    const step = heroDiagram.split(`data-hero-step="${index + 1}"`)[1]?.split("</div>")[0] ?? "";
    if (!step.includes(`>${index + 1}</b>`) || !step.includes(label)) {
        failures.push(`index.html: hero transition ${index + 1} needs its visible number and label`);
    }
}
if (!heroDiagram.includes("Unix socket")) failures.push("index.html: hero must name the Unix socket");

const whatsNew = await readFile(path.join(outputDirectory, "whats-new", "index.html"), "utf8");
if (!whatsNew.includes(release.installCommand)) {
    failures.push(`whats-new/index.html: missing current install command for ${release.tag}`);
}

for (const relativeFile of ["deploy/index.html", "whats-new/index.html", "guides/provider-sdk/index.html"]) {
    const html = await readFile(path.join(outputDirectory, relativeFile), "utf8");
    if (!html.includes(release.tag)) {
        failures.push(`${relativeFile}: missing current release ${release.tag}`);
    }
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
