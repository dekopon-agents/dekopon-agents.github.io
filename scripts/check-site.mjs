import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.resolve("_site");
const failures = [];
const release = JSON.parse(await readFile(path.resolve("src", "_data", "release.json"), "utf8"));
const architecture = JSON.parse(await readFile(path.resolve("src", "_data", "architecture.json"), "utf8"));

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
for (const id of ["why", "one-request", "security", "providers"]) {
    if (!homepage.includes(`id="${id}"`)) {
        failures.push(`index.html: missing orientation section #${id}`);
    }
}
if (!homepage.includes(release.installCommand)) {
    failures.push(`index.html: missing current install command for ${release.tag}`);
}

for (const relativeFile of ["architecture/index.html", "deploy/index.html", "whats-new/index.html", "guides/provider-sdk/index.html"]) {
    const html = await readFile(path.join(outputDirectory, relativeFile), "utf8");
    if (!html.includes(release.tag)) {
        failures.push(`${relativeFile}: missing current release ${release.tag}`);
    }
}

const architecturePage = await readFile(path.join(outputDirectory, "architecture", "index.html"), "utf8");
for (const id of ["runtime-map", "comparison", "limits", "sources"]) {
    if (!architecturePage.includes(`id="${id}"`)) {
        failures.push(`architecture/index.html: missing section #${id}`);
    }
}

const comparisonKeys = architecture.criteria.map((criterion) => criterion.key);
if (new Set(comparisonKeys).size !== comparisonKeys.length) {
    failures.push("architecture.json: duplicate comparison criterion keys");
}
const comparisonStates = new Set(["yes", "partial", "no", "unknown"]);
for (const runtime of architecture.runtimes) {
    const markKeys = Object.keys(runtime.marks);
    const missing = comparisonKeys.filter((key) => !markKeys.includes(key));
    const extra = markKeys.filter((key) => !comparisonKeys.includes(key));
    if (missing.length > 0 || extra.length > 0) {
        failures.push(`architecture.json: ${runtime.name} marks mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
    }
    for (const [key, mark] of Object.entries(runtime.marks)) {
        if (!comparisonStates.has(mark.state) || typeof mark.note !== "string" || mark.note.length === 0) {
            failures.push(`architecture.json: ${runtime.name}.${key} needs a valid state and note`);
        }
    }
}
const comparisonRuntimeKeys = architecture.runtimes.map((runtime) => runtime.key).sort();
const comparisonSourceKeys = architecture.sources.map((source) => source.key).sort();
if (JSON.stringify(comparisonRuntimeKeys) !== JSON.stringify(comparisonSourceKeys)) {
    failures.push("architecture.json: runtime and source keys differ");
}
if (!comparisonKeys.includes("existingTools")) {
    failures.push("architecture.json: missing existing-tool reuse criterion");
}
const dekoponRuntime = architecture.runtimes.find((runtime) => runtime.key === "dekopon");
if (dekoponRuntime?.marks.existingTools?.state !== "no") {
    failures.push("architecture.json: Dekopon must remain explicit about lacking drop-in existing-tool reuse");
}
if (!architecture.runtimes.some((runtime) => runtime.key === "agentcore")) {
    failures.push("architecture.json: missing the separate Amazon Bedrock AgentCore row");
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
