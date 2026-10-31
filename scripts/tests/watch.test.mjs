import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("the pinned Eleventy toolchain rebuilds data, includes, new templates, and assets", { timeout: 45_000 }, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), "dekopon-watch-"));
    let output = "";
    let child;
    t.after(async () => {
        if (child && child.exitCode === null) {
            child.kill("SIGTERM");
            await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3_000, undefined, { ref: false })]);
            if (child.exitCode === null) child.kill("SIGKILL");
        }
        await rm(directory, { recursive: true, force: true });
    });
    await cp(path.join(root, "src"), path.join(directory, "src"), { recursive: true });
    await cp(path.join(root, "eleventy.config.js"), path.join(directory, "eleventy.config.js"));
    await cp(path.join(root, "providers.json"), path.join(directory, "providers.json"));
    await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
    const write = (file, value) => writeFile(path.join(directory, "src", file), value);
    await write("_data/watchProbe.json", '{"message":"initial data"}');
    await write("_includes/watch-probe.njk", "initial include");
    await write("watch-probe.njk", '{{ watchProbe.message }} {% include "watch-probe.njk" %}');
    child = spawn(process.execPath, [path.join(root, "node_modules/@11ty/eleventy/cmd.cjs"), "--watch"], { cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { output += chunk; });
    const until = async (condition, label) => {
        const start = Date.now();
        while (Date.now() - start < 10_000) {
            if (child.exitCode !== null) assert.fail(`watch exited ${child.exitCode}: ${output}`);
            if (await condition()) return;
            await delay(50);
        }
        assert.fail(`${label} did not complete: ${output}`);
    };
    const contains = (file, text) => async () => {
        try { return (await readFile(path.join(directory, "_site", file), "utf8")).includes(text); }
        catch { return false; }
    };
    await until(() => /Watching|Waiting/.test(output), "watch startup");
    await until(contains("watch-probe/index.html", "initial data initial include"), "initial build");
    await write("_data/watchProbe.json", '{"message":"updated data"}');
    await until(contains("watch-probe/index.html", "updated data initial include"), "data rebuild");
    await write("_includes/watch-probe.njk", "updated include");
    await until(contains("watch-probe/index.html", "updated data updated include"), "include rebuild");
    await mkdir(path.join(directory, "src", "new-watch-directory"));
    await write("new-watch-directory/new-page.njk", "new template");
    await until(contains("new-watch-directory/new-page/index.html", "new template"), "new template build");
    await write("assets/watch-probe.css", "/* asset created */");
    await until(contains("assets/watch-probe.css", "asset created"), "new asset copy");
    await write("assets/watch-probe.css", "/* asset changed */");
    await until(contains("assets/watch-probe.css", "asset changed"), "asset update");
});
