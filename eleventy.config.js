const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const yamlHighlight = (source) => String(source).split("\n").map((line) => {
    const listItem = line.match(/^(\s*)-\s+(.+)$/);
    if (listItem) {
        return `${listItem[1]}- <span class="code-accent">${escapeHtml(listItem[2])}</span>`;
    }

    const field = line.match(/^(\s*)([^:]+:)(\s*)(.*)$/);
    if (!field) return escapeHtml(line);

    const value = field[4];
    let valueClass = "code-value";
    if (field[2] === "description:") valueClass = "code-string";
    if (field[2] === "status:") valueClass = "code-ready";

    return `${field[1]}<span class="code-key">${escapeHtml(field[2])}</span>${field[3]}<span class="${valueClass}">${escapeHtml(value)}</span>`;
}).join("\n");

const terminalHighlight = (source) => String(source).split("\n").map((line) => {
    if (line.startsWith("$ ")) {
        return `<span class="terminal-prompt">$</span>${escapeHtml(line.slice(1))}`;
    }
    if (line.startsWith("NAME")) {
        return `<span class="terminal-dim">${escapeHtml(line)}</span>`;
    }
    if (line.startsWith("✓")) {
        return `<span class="terminal-green">${escapeHtml(line)}</span>`;
    }

    return escapeHtml(line)
        .replace("Ready", '<span class="terminal-green">Ready</span>')
        .replace("Disabled", '<span class="terminal-orange">Disabled</span>');
}).join("\n");

export default function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
    eleventyConfig.addPassthroughCopy({ "src/static": "." });
    eleventyConfig.addFilter("yamlHighlight", yamlHighlight);
    eleventyConfig.addFilter("terminalHighlight", terminalHighlight);

    return {
        dir: {
            input: "src",
            includes: "_includes",
            data: "_data",
            output: "_site"
        },
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk",
        templateFormats: ["njk", "md", "html"]
    };
}
