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
| Current release copy | `src/_data/whatsNew.json` and `src/whats-new.njk` |
| “How it works” chapter metadata and release snapshot | `src/_data/almanac.json` |
| Concept articles | `src/almanac/*.njk` |
| Deployment navigation | `src/_data/deploy.json` |
| Deployment guides | `src/deploy/*.njk` |
| Shared page chrome | `src/_includes/layouts/base.njk` |
| Shared concept and deployment macros | `src/_includes/components/` |
| Homepage sections | `src/_includes/sections/` |
| Shared visual design | `src/assets/styles.css` |
| Article visual design | `src/assets/almanac.css` |
| Release, diagram, and multipage additions | `src/assets/release.css` |
| Browser interaction | `src/assets/site.js` |

Public concept pages must stand on their own. Repository Markdown is supplemental: each guide ends with **Read the latest in the Dekopon docs** for exact evolving fields and implementation limits, rather than sending a reader away to understand the core idea.

The concept pages cover the implementation snapshot recorded in `src/_data/almanac.json`. Update that revision only after rechecking the tagged code, current status, and linked latest-documentation target. Preserve the distinction between **Current**, **Committed direction**, and unshipped work.

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
```

`npm test` checks release-data consistency, performs a clean production build, validates generated HTML, checks browser JavaScript syntax, and verifies local files and fragment links. CI also compares `src/_data/release.json` with GitHub’s latest published release on every run and on a daily schedule.

## Generated output

Eleventy reads `src/` and writes `_site/`. `_site/` is generated output and is not committed. Assets under `src/assets/` and static files under `src/static/` are copied through unchanged.

The site also serves `/.well-known/wasm-pkg/registry.json`, allowing `wkg` to map Dekopon WIT package names to the `ghcr.io/dekopon-agents/` OCI namespace.

## Brand assets

The surfing Dekopon mascot is stored as a transparent 1024 px WebP plus 64, 128, 256, and 512 px derivatives. Header and footer markup use responsive sources. `social-card.svg` is the editable sharing image and `social-card.png` is its flattened 1200×630 counterpart used by page metadata.

After changing the SVG, render it through a browser at exactly 1200×630 and replace `social-card.png`. The SVG references the mascot as a sibling asset, so generic image converters that do not resolve external SVG images produce a broken card.

## Deployment

`.github/workflows/pages.yml` builds every push and pull request. A successful build on `main` uploads `_site/` and deploys it through GitHub Pages.

## License

The site is available under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
