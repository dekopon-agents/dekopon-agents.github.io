# dekopon-agents.github.io

The static landing page for [Dekopon](https://github.com/dekopon-agents/dekopon), published at [dekopon-agents.github.io](https://dekopon-agents.github.io/).

## Stack

The site is compiled with [Eleventy](https://www.11ty.dev/) and ships plain HTML, CSS, JavaScript, SVG, and PNG assets. There is no client-side framework or hosted runtime.

## Content and presentation stay separate

| Change | Edit |
|---|---|
| Homepage copy, labels, milestones, or links | `src/_data/home.json` |
| Site metadata, navigation, or footer links | `src/_data/site.json` |
| Section structure | `src/_includes/sections/` |
| Shared page chrome | `src/_includes/layouts/base.njk` |
| Visual design and responsive layout | `src/assets/styles.css` |
| Progressive interaction | `src/assets/site.js` |

Keep product copy in the data files rather than embedding it in layout templates. This lets content reviews avoid unrelated design diffs, and design reviews avoid rewriting source copy.

The content reflects the canonical design documents in the [Dekopon repository](https://github.com/dekopon-agents/dekopon/tree/main/docs). It must preserve their distinction between **Current**, **Committed direction**, and unshipped work.

## Local development

Node.js 24.8 or newer is required.

```console
npm ci
npm run serve
```

Eleventy serves the generated site with live reload. Run the same checks used in CI with:

```console
npm test
npm audit --audit-level=high
```

`npm test` performs a clean production build, validates generated HTML, checks browser JavaScript syntax, and verifies local files and fragment links.

## Deployment

`.github/workflows/pages.yml` builds every push and pull request. A successful build on `main` uploads `_site/` and deploys it through GitHub Pages immediately. `_site/` is generated output and is not committed.

The site also serves `/.well-known/wasm-pkg/registry.json`. This lets `wkg` map Dekopon WIT package names to the `ghcr.io/dekopon-agents/` OCI namespace; package contents and publication remain owned by the main Dekopon repository.

## License

The site is available under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
