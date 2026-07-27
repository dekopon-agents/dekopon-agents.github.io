import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.resolve("_site");
const failures = [];

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

for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const relativeFile = path.relative(outputDirectory, file);

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
