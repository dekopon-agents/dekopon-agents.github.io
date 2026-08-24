# Dekopon website writing guide

This repository is the public voice of Dekopon. Write for someone who wants to
run useful AI agents on hardware they own, not for someone who already knows
the internal type names.

The rules below are deliberately **falsifiable**. A reviewer should be able to
point at a line and say "that breaks rule 3." An earlier version of this file
said things like "sound like a person" and "use concrete verbs" — every model
already agrees with those, none of them constrain anything, and the site they
produced was symmetrical, competent, and completely anonymous.

**The through-line, if you remember nothing else: compress and de-nominalize.
Do not dramatize.** The failure mode this guide corrects is flat prose. The
failure mode it can *cause* is a model over-correcting into folksy
storytelling. Blunt is welcome; theatrical is not. When a tighter version of
an existing sentence competes with a more dramatic rewrite, the tighter one
wins.

## Voice

### 1. At most three two-beat fragment pairs exist on the entire site

`Verb the noun. Verb the other noun.` Three-beat chants count too. This was
the site's signature tic: ~30 instances, so none of them landed and the
rhythm became the personality.

```
Small enough for home. Explicit enough to inspect.
  → The gateway and broker share one 0600 socket.
Capable now. Honest about the boundary.
  → What works now, and what doesn’t.
Reuse compiled code. Reset the dangerous state.
  → Reuse the compiled code, reset the dangerous state.
```

`npm test` fails the build at four. The three slots are currently spent on:

1. `site.footerNote` — "Your agent can ask. It can't approve itself."
2. `home.journey.title` — "Alice may comment. Merge stays absent."
3. `almanac/permissions` — "Principal. Action. Resource. Context."

Want a fourth? Delete one of those first. A pair earns its slot only when
beat two **withdraws** something beat one implied, or names a literal schema.
A pair whose beats merely rhyme is filler.

### 2. A heading states a fact

Prefer a number or a literal name over a benefit verb. A heading with
neither needs a reason to exist.

```
Give the same harness very different skills.  → Five providers, five separate repos.
The broker YAML makes every limit visible.    → Every limit lives in one YAML file.
Take the next concrete step.                  → Where to go next
Use the shell training models already have.   → A shell with no operating system underneath.
```

### 3. A kicker earns its slot or is deleted

The small label above a heading must carry a fact the heading doesn't.
"Technical deep dives," "Why Dekopon exists," and "Now inspect the authority"
were deleted outright; the templates render nothing when `kicker` is `""`.
Survivors say something: `policies.cedar`, `bash({ script })`,
`5 threats · 5 limits`, `Raspberry Pi · arm64`.

### 4. No sentence whose subject is a nominalization

Abstract nouns must not do the acting.

```
Permission should survive the prompt.   → Permission lives outside the prompt.
The training transfers                  → Models already know this
Ordinary effect records preserve the attribution. → The audit record keeps the attribution.
Decision and outcome remain linked.     → The decision and the result stay linked.
```

### 5. Never announce your own honesty

Saying you are being honest is what you write instead of being honest.

```
Dekopon names the safeguard and its limit. It does not claim to make models
trustworthy, stop prompt injection, or turn a pre-production local deployment
into a hardened multi-tenant service.
  → Dekopon doesn’t detect prompt injection or make a model trustworthy.
    It shrinks what a successful injection can reach.
```

### 6. Admit the limit flatly, in second person where it stings

Volunteering the weak spot reads as more confident than hedging it. No
compliance register, no "remains out of scope," no "scope that separately."

```
A compromised host or malicious process inside the current Unix UID trust
domain remains out of scope.
  → If something hostile is already running as your user, you’ve lost.
    This doesn’t help you there.

A permitted remote endpoint could still reflect the credential.
  → Allowlist a host that echoes headers back and the token walks out.
    Pick your hosts.

The local audit checkpoint has no independent remote or signed anchor.
  → The audit chain is local and unsigned. Anyone with your disk can rewrite
    it, and nothing here un-posts a comment.
```

State it and stop. Don't open a negotiation ("if you need X, say so") and
don't soften an outcome into a hypothetical.

### 7. Enumerations cap at three on the persuasive pages

A long list used to make something sound thorough is the same tic as a
statistic used as justification. One vivid characterization beats the
inventory.

```
Models already know variables, functions, pipelines, structured filters,
conditionals, loops, exit codes, and defensive shell options.
  → Models already write bash fluently — pipes, loops, exit codes.
```

This is a rule about *function*, and a regex can't see function. So
`check-voice.mjs` fails the build only on the homepage, `/whats-new/`, and
`404` — the surfaces where a long list is almost always padding. Reference
pages get a printed count instead, because there a complete list often **is**
the spec (`UID 65532, no added capabilities, no privilege escalation,
read-only root filesystems, and RuntimeDefault seccomp` should stay whole).
Use judgement there; don't gut a specification to satisfy a number.

### 8. Contractions freely. No emoji, no lowercase affectation

Contract wherever speech would: "can't," "doesn't," "you've lost." Sentence
fragments are fine. Sentences opening with "And" or "So" are fine. What does
not belong on a page strangers land on: emoji, a shrugging `🙂`, or
deliberately lowercase sentences. Those are Slack, not the site.

*(This reverses an earlier rule in this file that said "use contractions
sparingly." That rule was wrong.)*

### 9. First person is rare, and only defends a judgment call

Institutional by default — Dekopon and its components are the actors. "I"
appears only where a human made a tradeoff that needs owning, and even then
sparingly. It was tried in the security intro and rejected: the third-person
version was tighter. If you can't name the specific judgement being
defended, don't reach for "I."

## What is already good — do not "fix" it

- **The receipts.** `1 pod · 2 daemon containers · 0 default Services ·
  0600 socket`. 25 crates. 19 GitHub capabilities. 2 HTTP calls. 27.5 MiB.
  These are the best thing on the site.
- **Real names.** `api.github.com`, Cedar, `gh.pull-request.comment`,
  `slack.example.u123`, RustPython, `dekopon-provider-sdk-testkit`. Never
  translate one of these into a category noun.
- **The Alice PR-commenter through-line.** One concrete story carried across
  the homepage, the Cedar guide, and the broker YAML.
- **The honest limit passages** in `guides/provider-sdk` and
  `almanac/providers`. They were already in the right register.
- **"The room is intentionally dark but not deceptive."** A metaphor that
  earns its place because it explains a real design decision. The ban is on
  decorative metaphor, not all metaphor.

## Order within a section

1. What does this let the reader do?
2. Why is that useful or safer?
3. How does Dekopon make it work?
4. What limits still apply?

An intro paragraph must add a fact the heading and the cards below don't
already carry. Compress it to one sentence rather than deleting it — the
section still needs something between the heading and the grid — but if you
can't find the fact, you're writing filler:

```
Each guide explains a complete mechanism before linking to the exact evolving
implementation contract.
  → Each one explains the mechanism before sending you to the code.

The practical goal is containment: narrow, attributable, reviewable, and
revocable authority around an untrusted model.
  → The goal is a small blast radius.
```

## Detail by page

- **Homepage:** outcomes first. Short paragraphs. No Rust type names or
  protocol field names unless a diagram needs them.
- **What's New:** name the feature, the benefit, one level of implementation
  detail. Release notes, not a design document.
- **How it works / guides:** technical detail is welcome and long lists are
  often correct, but every section opens with a plain-language claim.
- **Metadata, navigation, CTAs, alt text:** brief, literal, useful. Keep
  `og:image:alt` in step with the current tagline.

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

Use the precise internal term when it matters in a "How it works" guide, but
define it in plain language first.

## Accuracy and security guardrails

Natural writing must remain true. None of the voice rules above may be used
to justify weakening one of these.

- Never claim Dekopon is production-ready unless the pinned implementation and
  current project docs say so.
- Never use absolutes such as "impossible to leak," "unhackable," or
  "perfectly secure." Name the safeguard and its scope instead.
- The current release uses Cedar for authorization. Keep Cedar's decision
  separate from owner-authored execution constraints: policy decides who may
  act and cannot widen hosts, methods, storage scope, credentials, byte
  ceilings, or timeouts.
- Broker-owned destination-bound credentials and optional per-agent selection
  are current. Say where the value terminates and never imply the gateway,
  model, shell, or Wasm guest receives it.
- The gateway supplies a canonical subject attestation and agent name; it never
  supplies a trusted principal. The broker authenticates the peer, checks the
  attestor grant, and alone maps subject to principal.
- Keep **current**, **next**, and **not claimed** work visibly separate.
- Preserve important limits: one local Unix UID trust domain, no independent
  audit anchor, no multi-tenant transport, no automatic durable-memory replay,
  and no production-hardening claim.
- Version 0.11 adds the operator console, a broader sandboxed shell, the public
  provider testkit, and independent GitHub/SQL providers without moving Cedar or
  provider authority into the console, gateway, or model. Version 0.11.1 changes
  the container runtime base only.
- The latest application version lives only in `src/_data/release.json`. Derive
  headers, install commands, source links, and release CTAs from it rather than
  copying a version into page data. This is why the hero proof chips say "four
  arm64 executables" and not a byte count — `home.json` must not pin a version.
- Distinguish the current application from the independently versioned chart.
  As of 24 August 2026, published chart 0.2.0 still deploys application 0.10.0;
  chart 0.2.1 naming application 0.11.0 exists in source but is not published.
  A source version is not an install path, and a published chart is not proof
  of a live-cluster deployment.
- The current application publishes 25 public workspace crates to crates.io.
  Homebrew, attested release archives, and the multi-architecture image are
  current install paths; verify remote publication before changing that claim.
- Prefer scoped claims: "keeps credentials out of prompts and guest code" is
  better than "secrets cannot leak."
- Measurements need a date, units, and scope. The 200 KiB OpenObserve figure is
  an aggregate physical-allocation sample, not a per-prompt guarantee.

## Source of truth and checks

The canonical implementation lives in `../dekopon`. "How it works" copy is
pinned to the revision in `src/_data/almanac.json`; do not move that snapshot
without rechecking the tagged code and docs.

Public concept pages must explain their subject completely before linking away.
Repository Markdown is supplemental and should appear through a closing "Read
the latest in the Dekopon docs" bridge for exact evolving fields and limits, not
as the page's substitute for explanation.

Before publishing copy changes, run:

```console
npm test
npm audit --audit-level=high
```

`npm test` includes `scripts/check-voice.mjs`, which enforces rules 1, 3, 5,
and 7 and the banned-construction list. It cannot see rules 2, 4, 6, 8, or 9 —
those are on you.

This repository uses a direct-to-`main` publishing workflow. Do not open a pull
request for website changes unless the user explicitly asks for one. Validate
the change, commit it on `main`, and push `main` to deploy through
`.github/workflows/pages.yml`.

After pushing, verify both the workflow and the live page.
