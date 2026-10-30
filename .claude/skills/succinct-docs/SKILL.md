---
name: succinct-docs
description: Write or rewrite pages on the Dekopon website (src/**/*.njk, the guides, deploy pages and what's new) as brief, authoritative text for skilled engineers and coding agents. Scores a page against a rubric taken from NASA TM-105419 before and after editing, and keeps every contract. Use when writing a new page, rewriting or shortening one, or reviewing a copy change. The landing page keeps its playful voice.
---

# Succinct docs (website)

Readers are skilled engineers and coding agents choosing and installing Dekopon. Give them the
shortest page that gets them running correctly. Fewer words is a goal; a lost contract is a defect.

The hard rules are in [AGENTS.md#documentation-hard-rules](../../../AGENTS.md#documentation-hard-rules);
the voice rules 1–9 in the same file still apply. This skill is how to meet them. The core
repository keeps its own copy of this skill, tuned to its docs.

## Scope

- **Reference voice:** `src/deploy/*`, `src/guides/*`, `src/inference.njk`,
  `src/how-it-works.njk`, `src/whats-new.njk`.
- **Exempt:** the landing page (`src/index.njk`, `src/_includes/sections/*`, `src/_data/home.json`)
  stays conversational, witty, playful and fun. Score it only for accuracy, voice rules 1–9 and
  the hard rules.
- **Leave alone:** the "Guide moved" stubs; `check-site` guards their routes and fragments.

## Website rules

- **Pinned release only.** No history, "previously", migration notes or Dekopon version minimums. Versions
  come from `src/_data/release.json`, never typed into prose.
- **No run evidence.** No CI run links, OS or Homebrew patch versions, observed call counts or
  "we tested".
- **Code proves what exists.** Verify every claim you change against the dekopon source at
  `release.sourceUrl` or a released binary, and record what you checked.
- **Stop for the owner** when the page and the pinned code disagree, or a cut would change a
  contract.

## Rubric

The source is Carol A. Vidoli, *Technical Report Writing*, NASA TM-105419, NASA Lewis Research
Center, 1992 (<https://ntrs.nasa.gov/citations/19930013813>). Score each criterion 1–5, where 5
means no violation is left (maximum 50). Score before and after editing, and cite one line for
every score below 5.

1. **Purpose first.** The intro says what the reader ends with, then the step order or table of
   contents; on `/deploy/` the two install buttons come first, directly under the `<h1>`. The body
   follows that plan. ("State your purpose or objective clearly and follow it with a concise
   description of the method you will use")
2. **Get to the point.** Every sentence is a step or a contract. Asides go, or become a link. Keep
   one sentence of reason where a restriction looks arbitrary. ("Technical reports are not mystery
   novels")
3. **Concise, not condensed.** Cut narration, but never below the floor. ("brief but
   comprehensible")
4. **Clear.** Every command, path, owner, mode, key and expected result is exact.
5. **One fact, one place.** A fact appears once per page. Contracts live in the core docs; link
   the owning heading. ("never in more than one way")
6. **Natural words.** Short familiar words; the plain-language translations in AGENTS.md apply.
   ("Write to express, not to impress.")
7. **Major ideas first.** Each section opens with its action or rule; detail follows in bullets.
8. **No rough-draft faults.** No noun stacks, no nominalized subjects (voice rule 4), parallel
   lists, no unnecessary words.
9. **Headings.** A heading states a fact (voice rule 2); equal-weight headings share a form unless
   that makes one unclear; tables of contents may stay imperative.
10. **Objective.** Admit limits flatly (voice rule 6); never announce honesty (rule 5); no selling.

## Floor: never cut

- Security and configuration contracts: owners, modes, where credentials live and never go,
  authority limits, spending limits.
- Every `<pre>` block, byte-identical, including its HTML escaping.
- Every id that the table of contents, another page or `scripts/fixtures/legacy-fragments.json`
  links to; `check-site` fails on a missing fragment.
- Strings and structures `check-site` asserts (hero steps and labels, required page strings, the
  provider guide's word budget and two `<pre>` blocks).

## Procedure

1. **Map the page:** headings, ids, inbound links, and the core docs it summarizes.
2. **Score it.**
3. **Rewrite:** purpose and plan first; each step one purpose line plus the actions; restated
   contracts become links to the owning core heading.
4. **Check every changed claim** against the pinned source and the failure modes below.
5. **Run `npm test`.** For layout changes, take 390 px and 1440 px screenshots of the built page
   and look for regressions.
6. **Score again**, then report scores and words before and after, removed facts and where they
   live, ids changed, gate output, and `Choices I made`.
7. **Review.** A reviewer who did not write the change re-checks claims against the sources and
   tags each finding `blocking` or `follow-up`. Fix blocking findings before publishing.

## Failure modes seen in rewrites

- **A softer word becomes a stronger one.** "limit" became "cap" for a budget that can overshoot.
- **A step loses its instruction.** "Enter these lines" became "Fill in the quoted values" for a
  file that starts empty.
- **Headings forced into one form** stop matching the table of contents or read awkwardly.
- **History creeps back.** Another session added a shell-to-env-file migration section and a
  version minimum a day after a pass removed history; `check-voice` now fails on version minimums
  and run links.
