# Dekopon website writing guide

This repository is the public voice of Dekopon. Write for someone who wants to run useful AI agents on hardware they own—not for someone who already knows the internal type names.

## Voice

- **Lead with the outcome.** Start with what people can run, control, see, or protect. Explain the mechanism only after the benefit is clear.
- **Sound like a person.** Prefer short, direct sentences and familiar words. Use “you” and “your” when it makes the benefit clearer.
- **Be confident, not grandiose.** Dekopon is capable, fast, small, and thoughtfully secured. It is also pre-production. Say both plainly.
- **Make small hardware feel powerful.** Raspberry Pi-class hardware, self-hosting, low overhead, and ownership are central to the story.
- **Use concrete verbs.** Agents run. Brokers check. Policies allow or deny. Sandboxes limit. Audit records prove. Traces explain.
- **Make lists scannable.** Introduce a release or feature with a short summary, then list the concrete benefits.

## Explain benefits before internals

Use this order:

1. What does this let the reader do?
2. Why is that useful or safer?
3. How does Dekopon make it work?
4. What limits still apply?

Good:

> Run the AI agents you know and love on secure, high-performance rails. Everything fits on a small computer like a Raspberry Pi.

Avoid:

> A capability-oriented control plane with a broker-mediated execution topology.

Good:

> Fine-grained capabilities keep every outside action on a short leash. The broker checks the permission, destination, method, and runtime limits before anything runs.

Avoid:

> Proposal-only clients bind exact authorization to constrained host I/O.

## Plain-language translations

| Internal wording | Public wording |
|---|---|
| capability-oriented control plane | secure rails for AI agents |
| proposal | request |
| proposal-only client | the agent can ask, but cannot approve its own action |
| authority boundary | permission boundary |
| exact policy | an exact allow/deny rule |
| constrained host I/O | permissioned I/O with hard limits |
| fresh bounded Wasmtime store | a fresh Wasm sandbox with memory and time limits |
| durable evidence linkage | an audit record tied to the result |
| OTLP exporter | sends standard OpenTelemetry data |
| implementation-grounded | based on the code that ships |

Use the precise internal term when it matters in the Tech Almanac, but define it in plain language first.

## Detail by page

- **Homepage:** outcomes first. Keep paragraphs short. Avoid Rust type names, protocol field names, and process topology unless a diagram needs them.
- **What’s New:** name the feature, the benefit, and one level of implementation detail. It should read like release notes, not a design document.
- **Tech Almanac:** technical detail is welcome, but every section must open with a plain-language claim. Define unfamiliar terms on first use and keep sentences focused on one idea.
- **Metadata, navigation, CTAs, and alt text:** brief, literal, and useful. Do not stuff them with keywords.

## Accuracy and security guardrails

Natural writing must remain true.

- Never claim Dekopon is production-ready unless the canonical project docs say so.
- Never use absolutes such as “impossible to leak,” “unhackable,” or “perfectly secure.” Name the safeguard and its scope instead.
- Do not claim Cedar powers permissioning unless Cedar is present in the pinned implementation and canonical docs. Dekopon v0.2.0 uses its own exact deny-by-default rules.
- Do not claim v0.2.0 injects provider secrets. Broker-owned credential resolution is later work in the v0.2.0 snapshot.
- Keep **current**, **next**, and **not claimed** work visibly separate.
- Preserve important limits: one local Unix UID trust domain, no independent audit anchor, no multi-tenant transport, and no production-hardening claim in v0.2.0.
- Prefer scoped claims: “keeps credentials out of prompts and guest code” is better than “secrets cannot leak.”
- Measurements need a date, units, and scope. The 200 KiB OpenObserve figure is an aggregate physical-allocation sample, not a per-prompt guarantee.

## Style mechanics

- Headings should usually be 3–8 words.
- Prefer sentences under 24 words. Split sentences that carry several independent claims.
- Use contractions sparingly and naturally.
- Use sentence case for headings and labels.
- Use “fine-grained,” not “fine-grain.”
- Use “Raspberry Pi,” “OpenTelemetry,” “OpenObserve,” “Wasm,” and “v0.2.0” consistently.
- Avoid stacked adjectives and noun chains such as “bounded broker-backed provider execution path.”
- Avoid throat-clearing: “It is important to note,” “In order to,” “This is the point where,” and similar phrases can usually be deleted.
- Avoid architecture metaphors like “seams,” “membranes,” and “typestate” in marketing copy. Use them only when the technical explanation needs them.

## Tone anchors

Aim for lines like:

- “Version 0.2.0 brings isolation, exact authorization, pluggable I/O, auditing, and telemetry.”
- “Stay in control with permissioned I/O and hard runtime limits.”
- “Your agent can ask. The broker decides.”
- “See every approved action and follow a run from prompt to provider.”
- “Get running in less than five minutes.”

## Source of truth and checks

The canonical implementation lives in `../dekopon`. Almanac copy is pinned to the revision in `src/_data/almanac.json`; do not move that snapshot without rechecking the tagged code and docs.

Before publishing copy changes, run:

```console
npm test
npm audit --audit-level=high
```

A push to `main` deploys the site through `.github/workflows/pages.yml`. Verify both the workflow and the live page after pushing.
