# dekopon-agents.github.io

The static public site for [Dekopon](https://github.com/dekopon-agents/dekopon), published at [dekopon-agents.github.io](https://dekopon-agents.github.io/).

## Stack

The site is compiled with [Eleventy](https://www.11ty.dev/) and Nunjucks. It ships plain HTML, CSS, JavaScript, SVG, and PNG assets. There is no client-side framework or hosted runtime.

## Site structure

The homepage is deliberately short. Detailed explanations live in independent static pages generated through shared layouts, navigation macros, and data files.

| Area | Edit |
|---|---|
| Writing voice, terminology, and accuracy limits | `AGENTS.md` |
| Current release tag, source revision, image, measurements, and chart publication state | `src/_data/release.json` |
| Site metadata, global navigation, and footer | `src/_data/site.json` |
| Homepage copy | `src/_data/home.json` |
| Release changes and migration notes | `src/whats-new.njk` |
| Guide navigation | `src/_data/almanac.json` |
| System overview and technical guides | `src/how-it-works.njk`, `src/guides/*.njk` |
| Model selection, budgets, and local inference | `src/inference.njk` |
| SDK toolchain and interface pins | `src/_data/providerSdk.json` |
| Legacy routes and fragments | `src/_data/routeMoves.json`, `src/almanac/*.njk`, `scripts/fixtures/legacy-fragments.json` |
| Deployment navigation | `src/_data/deploy.json` |
| Deployment guides | `src/deploy/*.njk` |
| Shared page chrome | `src/_includes/layouts/base.njk` |
| Shared concept and deployment macros | `src/_includes/components/` |
| Homepage sections | `src/_includes/sections/` |
| Shared visual design | `src/assets/styles.css` |
| Article visual design | `src/assets/field-guide.css` and `src/assets/provider-guide.css` |
| Release, diagram, and multipage additions | `src/assets/release.css` |
| Browser interaction | `src/assets/site.js` |

Public concept pages must stand on their own. Repository Markdown is supplemental: each guide ends with **Read the latest in the Dekopon docs** for exact evolving fields and implementation limits, rather than sending a reader away to understand the core idea.

The concept pages cover the implementation snapshot recorded in `src/_data/release.json`. Update it only after rechecking the tagged code, publication receipts, and linked source targets. Keep historical migration notes clearly labeled and preserve the distinction between current and unshipped work. `almanac.json` contains navigation only; the old `/almanac/` URLs redirect to mapped sections in the current guides.

## Local development

Node.js 24.8 or newer is required.

```console
npm ci
npm run serve
```

Run the same checks used in CI with:

```console
npm test
npm audit --audit-level=high
npm run check:release -- --remote
```

`npm test` runs release-check regression tests and an isolated Eleventy watch test, then checks release-data consistency, performs a clean production build, validates generated HTML and browser JavaScript syntax, verifies local files and legacy fragment links, and enforces the site’s content and voice rules. The watch test covers data and include edits, new templates, and asset creation and updates.

The remote release check verifies GitHub’s latest application release and publication date, the tag’s resolved commit, chart metadata at that commit, the published GHCR Helm chart’s version and appVersion, and the SDK’s Rust, wasm-tools, and WIT pins. It allows a published chart to lag the source chart when their separately recorded versions are accurate. CI runs this check on each build and daily; network or registry failures stop publication rather than silently accepting stale claims.

### Build dependency policy

Eleventy is pinned to `4.0.0-alpha.10`, an upstream prerelease, because the stable 3.1.6 dependency tree still includes vulnerable `braces` through Chokidar 3. This version uses Chokidar 5 and the maintained `@11ty/nunjucks` fork. The exact lockfile, generated-HTML checks, and watch regression test guard the upgrade. No audit exceptions or forced downgrades are used. Reassess the prerelease pin when a fixed stable release is available; run the full checks and audit after any dependency update.

## Generated output

Eleventy reads `src/` and writes `_site/`. `_site/` is generated output and is not committed. Assets under `src/assets/` and static files under `src/static/` are copied through unchanged.

The site also serves `/.well-known/wasm-pkg/registry.json`, allowing `wkg` to map Dekopon WIT package names to the `ghcr.io/dekopon-agents/` OCI namespace.

## Brand assets

The surfing Dekopon mascot is stored as a transparent 1024 px WebP plus 64, 128, 256, and 512 px derivatives. Header and footer markup use responsive sources. `social-card.svg` is the editable sharing image and `social-card.png` is its flattened 1200×630 counterpart used by page metadata.

After changing the SVG, render it through a browser at exactly 1200×630 and replace `social-card.png`. The SVG references the mascot as a sibling asset, so generic image converters that do not resolve external SVG images produce a broken card.

## Deployment

`.github/workflows/pages.yml` builds every push and pull request. A successful build on `main` uploads `_site/` and deploys it through GitHub Pages. Direct-to-`main` publishing is the repository workflow; make a pull request only when explicitly requested. After an authorized push, verify the exact commit’s workflow and the live pages before reporting deployment complete.

## License

The site is available under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
