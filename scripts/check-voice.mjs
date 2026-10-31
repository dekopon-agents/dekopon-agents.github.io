import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Voice rules for this site. Prose guidance lives in AGENTS.md; this file
// enforces only the parts a regex can actually decide.

const PAIR_BUDGET = 3;

// Technical pages share one word budget (AGENTS.md, "Documentation hard rules"): every rendered
// page but the landing page, 404 and the "Guide moved" stubs, counted inside <main>, code
// included. A change over budget cuts as much as it adds. 7000 makes room for the owner-requested
// Official Providers page.
const WORD_BUDGET = 7000;
const UNBUDGETED = new Set(["index.html", "404.html"]);

// The enumeration cap is a rule about function, not form: a long list used to
// make something sound thorough is the tic, a long list that IS the spec is
// information. A regex can't tell those apart, so the cap only fails the build
// on the persuasive surfaces. Reference pages get a count to review by hand.
const PERSUASIVE = new Set(["index.html", "whats-new/index.html", "404.html"]);

const BANNED = [
    "constitution",
    "Guiding Principles",
    "non-goals",
    "Credentials are unleakable",
    "everything is stored safely",
    "One trace, complete",
    "nothing withheld",
    "Six hops, zero copies",
    "The model sees exactly one tool",
    "Your agent can ask. It can’t approve itself.",
    "It is important to note",
    "It should be noted",
    "In order to",
    "remains out of scope",
    "remain out of scope",
    "—and what it does not",
    "seamless",
    "best-in-class",
    "cutting-edge",
];

// Docs describe the pinned release only and carry no run receipts (AGENTS.md,
// "Documentation hard rules"). These shapes are unambiguous, so they fail.
const RUN_EVIDENCE = [
    [/actions\/runs\/\d+/i, "CI run link"],
    [/\b\d+\.\d+\.\d+ or (later|newer)\b/i, "version minimum"],
    [/\bHomebrew \d+\.\d+/i, "Homebrew version"],
];

// History words are sometimes current terms (a migration that has not shipped
// yet is Committed direction), so they are listed for review rather than failed.
const HISTORY = /\b(previously|migrat\w*|no longer|deprecat\w*|used to|dekopond)\b/gi;

const THROAT_CLEARING_KICKER = [
    /^(now|next|first|introducing)\b/i,
    /\bdeep dives?$/i,
    /\b(overview|essentials|explained)$/i,
    /^why\b.*\bexists?$/i,
];

// Two or more sentences, each short enough to be a fragment beat. Three-beat
// chants ("One pod. Two daemons. No broker network service.") are the same tic.
const isChant = (text) => {
    if (!/\.\s/.test(text)) return false;
    const beats = text.split(/(?<=[.?!])\s+/).filter(Boolean);
    return beats.length >= 2 && beats.every((b) => b.length >= 4 && b.length <= 60);
};

const outputDirectory = path.resolve("_site");
const failures = [];
const reviewable = [];

const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    }));
    return files.flat();
};

const strip = (html) => html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const withoutCode = (html) => html
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<code[\s\S]*?<\/code>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

const pairs = new Map();       // text -> first page it appeared on
const kickers = new Map();
const pageWords = new Map();

for (const file of (await walk(outputDirectory)).filter((f) => f.endsWith(".html"))) {
    const page = path.relative(outputDirectory, file);
    const raw = await readFile(file, "utf8");
    const html = withoutCode(raw);

    if (!UNBUDGETED.has(page) && !raw.includes("data-move-default")) {
        const main = raw.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
        const words = strip(main.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " "))
            .split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
        pageWords.set(page, words);
    }

    const headings = [
        ...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi),
        ...html.matchAll(/<p class="footer-note">([\s\S]*?)<\/p>/gi),
    ];
    for (const [, text] of headings) {
        const value = strip(text);
        if (isChant(value) && !pairs.has(value)) pairs.set(value, page);
    }

    for (const [, text] of raw.matchAll(/<span class="section-kicker[^"]*">([\s\S]*?)<\/span>/gi)) {
        const value = strip(text);
        if (value) kickers.set(value, page);
    }

    for (const [pattern, label] of RUN_EVIDENCE) {
        const match = raw.match(pattern) ?? strip(raw).match(pattern);
        if (match) failures.push(`${page}: ${label} "${match[0]}"`);
    }

    const history = [...new Set(strip(html).match(HISTORY) ?? [])];
    if (history.length > 0) reviewable.push(`${page}: history words ${history.map((w) => `"${w}"`).join(", ")}`);

    for (const phrase of BANNED) {
        if (strip(html).toLowerCase().includes(phrase.toLowerCase())) {
            failures.push(`${page}: banned construction "${phrase}"`);
        }
    }

    for (const [, text] of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
        for (const sentence of strip(text).split(/(?<=[.?!])\s+/)) {
            const items = sentence.split(",").length;
            if (items > 3 && !sentence.includes(":")) {
                const where = PERSUASIVE.has(page) ? failures : reviewable;
                where.push(`${page}: ${items}-item enumeration — "${sentence.slice(0, 96)}"`);
            }
        }
    }
}

// The two-beat fragment pair is this site's signature tic. Budget is on
// distinct strings, not occurrences: a pair in the footer is one pair.
if (pairs.size > PAIR_BUDGET) {
    failures.push(`${pairs.size} two-beat fragment pairs, budget is ${PAIR_BUDGET}:`);
    for (const [text, page] of pairs) failures.push(`    ${page}: "${text}"`);
}

const words = [...pageWords.values()].reduce((sum, count) => sum + count, 0);
if (words > WORD_BUDGET) {
    failures.push(`technical pages hold ${words} words, budget is ${WORD_BUDGET}:`);
    for (const [page, count] of [...pageWords].sort((a, b) => b[1] - a[1])) failures.push(`    ${page}: ${count}`);
}

for (const [text, page] of kickers) {
    if (THROAT_CLEARING_KICKER.some((r) => r.test(text))) {
        failures.push(`${page}: kicker announces the section instead of saying something — "${text}"`);
    }
}

const enumerations = reviewable.filter((r) => r.includes("-item enumeration")).length;
const historyPages = reviewable.filter((r) => r.includes("history words"));
if (enumerations > 0) {
    console.log(`Voice check: ${enumerations} long enumerations on reference pages (not gated).`);
}
for (const line of historyPages) console.log(`Voice check (review): ${line}`);

if (failures.length > 0) {
    console.error("Voice check failed:");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
}

console.log(`Voice check passed: ${pairs.size}/${PAIR_BUDGET} fragment pairs, ${kickers.size} kickers, ${words}/${WORD_BUDGET} technical-page words.`);
