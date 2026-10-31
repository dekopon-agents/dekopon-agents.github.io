---
name: succinct-docs
description: Write or edit pages on the Dekopon website (src/**/*.njk, the guides, deploy and provider pages, what's new) so the text that survives the cut is clear. First apply AGENTS.md "Documentation hard rules" to decide whether text should exist, then these clarity rules from NASA TM-105419 to decide how it reads. Use for any copy change, and when reviewing one. The landing page keeps its playful voice.
---

# Succinct docs (website)

Two passes, in this order:

1. **Cut.** [AGENTS.md#documentation-hard-rules](../../../AGENTS.md#documentation-hard-rules)
   decides whether text exists. Never polish a sentence that pass would delete.
2. **Clarity.** What survives follows the rules below, from Carol A. Vidoli, *Technical Report
   Writing*, NASA TM-105419, 1992 (<https://ntrs.nasa.gov/citations/19930013813>), together with
   the voice rules 1–9 in AGENTS.md. The landing page (`src/index.njk`, `src/_includes/sections/*`,
   `src/_data/home.json`) stays conversational, witty and playful; hold it to accuracy and the
   voice rules only.

## Clarity rules

1. **Purpose first.** The intro says what the reader ends with; on `/deploy/` the two install
   buttons come first. ("State your purpose or objective clearly and follow it with a concise
   description of the method you will use")
2. **Get to the point.** Every sentence is a step, a reason or a limit. ("Technical reports are not
   mystery novels")
3. **Concise, not condensed.** Cut words, never a contract the reader needs. ("brief but
   comprehensible")
4. **Exact.** Every command, path, owner, mode, key and expected result is exact.
5. **One fact, one place.** Link the core heading that owns a contract. ("never in more than one
   way")
6. **Natural words.** Short familiar words; the plain-language translations in AGENTS.md apply.
   ("Write to express, not to impress.")
7. **Major ideas first.** Each section opens with its action or rule.
8. **No rough-draft faults.** No noun stacks, no nominalized subject (voice rule 4), parallel lists.
9. **Headings.** A heading states a fact (voice rule 2); equal-weight headings share a form.
10. **Objective.** Admit limits flatly (voice rule 6); never announce honesty (rule 5); no selling.

## Never lose in a clarity edit

- A security or configuration contract the cut kept.
- A `<pre>` block: it stays byte-identical, escaping included.
- An id that the table of contents, another page or `scripts/fixtures/legacy-fragments.json` links
  to, and any string `check-site` asserts.

## Failure modes seen in review

- **A qualified claim becomes universal**, or **"only" sneaks in.**
- **A softer word becomes a stronger one:** "limit" became "cap" for a budget that can overshoot.
- **An instruction becomes a universal claim:** "supply credentials only to their owning process"
  became "neither receives the other's", which shared Slack tokens contradict.
- **A guessed name ships:** command words come from the provider's source, not its repo name.

## Review

Run `npm test`. For layout changes, take 390 px and 1440 px screenshots. A reviewer who did not
write the change checks claims against the sources and tags each finding `blocking` or `follow-up`.
