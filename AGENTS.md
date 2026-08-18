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

Use the precise internal term when it matters in a “How it works” guide, but define it in plain language first.

## Detail by page

- **Homepage:** outcomes first. Keep paragraphs short. Avoid Rust type names, protocol field names, and process topology unless a diagram needs them.
- **What’s New:** name the feature, the benefit, and one level of implementation detail. It should read like release notes, not a design document.
- **How it works:** technical detail is welcome, but every section must open with a plain-language claim. Define unfamiliar terms on first use and keep sentences focused on one idea.
- **Metadata, navigation, CTAs, and alt text:** brief, literal, and useful. Do not stuff them with keywords.

## Accuracy and security guardrails

Natural writing must remain true.

- Never claim Dekopon is production-ready unless the pinned implementation and current project docs say so.
- Never use absolutes such as “impossible to leak,” “unhackable,” or “perfectly secure.” Name the safeguard and its scope instead.
- Dekopon v0.4.0 uses Cedar for authorization. Keep Cedar’s decision separate from owner-authored execution constraints: policy decides who may act and cannot widen hosts, methods, credentials, byte ceilings, or timeouts.
- Broker-owned destination-bound credentials and optional per-agent selection are current. Say where the value terminates and never imply the gateway, model, shell, or Wasm guest receives it.
- The gateway supplies a canonical subject attestation and agent name; it never supplies a trusted principal. The broker authenticates the peer, checks the attestor grant, and alone maps subject to principal.
- Keep **current**, **next**, and **not claimed** work visibly separate.
- Preserve important limits: one local Unix UID trust domain, no independent audit anchor, no multi-tenant transport, and no production-hardening claim in v0.4.0.
- Version 0.4.0 adds distribution rather than authority. Distinguish the application release from independently tagged chart publication, and verify publication or deployment status before claiming either occurred.
- Version 0.4.0 is not on crates.io. Lead install copy with Homebrew, release archives, or the container image unless publication status changes and is verified.
- Prefer scoped claims: “keeps credentials out of prompts and guest code” is better than “secrets cannot leak.”
- Measurements need a date, units, and scope. The 200 KiB OpenObserve figure is an aggregate physical-allocation sample, not a per-prompt guarantee.

## Style mechanics

- Headings should usually be 3–8 words.
- Prefer sentences under 24 words. Split sentences that carry several independent claims.
- Use contractions sparingly and naturally.
- Use sentence case for headings and labels.
- Use “fine-grained,” not “fine-grain.”
- Use “Raspberry Pi,” “OpenTelemetry,” “OpenObserve,” “Wasm,” “Cedar,” and “v0.4.0” consistently.
- Avoid stacked adjectives and noun chains such as “bounded broker-backed provider execution path.”
- Avoid throat-clearing: “It is important to note,” “In order to,” “This is the point where,” and similar phrases can usually be deleted.
- Avoid architecture metaphors like “seams,” “membranes,” and “typestate” in marketing copy. Use them only when the technical explanation needs them.

## Tone anchors

Aim for lines like:

- “The gateway can vouch. The broker decides what that identity may do.”
- “Cedar permits. Constraint sets keep every action inside hard limits.”
- “Your agent can ask. The broker decides.”
- “One familiar tool gives the model room to explore without an operating-system shell.”
- “Follow one chat message from model turn to authorized HTTP request.”

## Source of truth and checks

The canonical implementation lives in `../dekopon`. “How it works” copy is pinned to the revision in `src/_data/almanac.json`; do not move that snapshot without rechecking the tagged code and docs.

Public concept pages must explain their subject completely before linking away. Repository Markdown is supplemental and should appear through a closing “Read the latest in the Dekopon docs” bridge for exact evolving fields and limits—not as the page’s substitute for explanation.

Before publishing copy changes, run:

```console
npm test
npm audit --audit-level=high
```

A push to `main` deploys the site through `.github/workflows/pages.yml`. Verify both the workflow and the live page after pushing.
