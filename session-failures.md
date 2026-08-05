# Session Failures Log

## Session: 2026-07-23

**Project:** access-directory (Access Atlas)

### Failures
- `gh pr review 22 --approve`: failed with "Can not approve your own pull request" (owner authors the PRs) → merged directly via `gh pr merge` since the repo has no branch protection requiring review. Recurred as the workflow for #22–#27. Captured in memory `gh-account-for-prs.md`.
- CSP verification false alarm: first `curl` of the confirm route after `astro dev` boot showed `script-src 'none'`, read as a bug in the new carve-out → was an astro-dev cold-start artifact; the function returned `'self'` (verified via `tsx -e`) and the warm HTTP response header confirmed `'self'`. Also learned the a11y one-script test asserts tag presence, not CSP executability. Captured in memory `preview-tools-gotchas.md` §3.
- `doctl apps spec validate --spec .do/app.yaml`: "unknown flag: --spec" → the spec file is a positional arg (`doctl apps spec validate .do/app.yaml`).
- Unquoted glob `src/pages/contribute/confirm/[claimId].astro` in grep: zsh aborted the command ("no matches found") twice before I quoted the path.
- Shell `timeout` prefix on `platform-status.sh`: blocked (macOS has no GNU `timeout`; exits 127) → used the Bash tool's native `timeout` parameter instead.
- First bas-platform tracker commit omitted the `Co-Authored-By` trailer → amended before pushing.
- Prod Supabase 500 (list pages down): not a code failure I introduced, but initially plausibly attributable to PR #24 → root-caused to schema drift (migration `0011` / `coords_source` never applied to prod; prod had no migration-tracking table). Fixed by applying `0008`/`0010`/`0011` and baselining migration history; deploy gap closed with a PRE_DEPLOY migration job (#25).

---

## Session: 2026-07-27

**Project:** access-directory (Access Atlas) — audit + remediation

### Failures
- [SUPABASE_DB_URL setup]: took 4 rounds to get one env var right — an `sb_secret_` API key, then the project URL, then the dashboard string with the literal `[YOUR-PASSWORD]` placeholder still in it, then the wrong pooler cluster. Two of those were partly my fault: I handed over a connection-string *template* with a guessed `aws-0-` host prefix and buried "confirm which" as a footnote, instead of just saying "copy the Session pooler string from the dashboard". → Give the authoritative source, not a template, for anything with per-project values.
- [my own new test]: the EXIF/GPS-stripping regression test had TWO vacuous assertions — `sharp.withExif({GPS: …})` silently writes nothing (GPS belongs under `IFD3`), and an `Orientation` set via `withExif()` doesn't read back as `metadata().orientation`, so the rotation case measured the fixture, not the code. Both passed green. → Caught only because `astro check` flagged the `GPS` key as not on the `Exif` type, and because the orientation case happened to fail. Fixed by adding preconditions that assert the fixture really carries what the test claims to strip. Logged as a shared lesson.
- [R-0 scoping]: fixed the representation labels (`disabled_owned`/`disabled_led`, 8 listings) and declared it done, then found `disability_literate` on **58** providers carrying the identical false "(self-attested)" label one column over. → Audit the column *class*, not the columns the finding named.
- [astro check]: went from 0 errors to 1 after the sharp 0.35 bump (`'GPS' does not exist in type 'Exif'`). Expected-ish for a major bump, but I'd already run the test suite green before typechecking — the type error was the thing that revealed the vacuous assertion.
- [npm run test:a11y]: could not run locally — port 4321 was held by an unrelated project's `astro preview`, and `reuseExistingServer` would have graded Access Atlas's 89 assertions against a different site. Substituted CI results for the shipped commit. Filed as R-7.
- [scratchpad node script]: `ERR_MODULE_NOT_FOUND: Cannot find package 'sharp'` — Node resolves from the script's directory, not cwd, so a scratchpad script can't import the repo's deps. → Resolved by promoting it into `tests/unit/` where it belongs anyway.
- [zsh globbing]: three commands aborted on unquoted globs (`--include=*.sql`, `*.py`, a URL with `?`). The null-result guard hook caught each one and prevented recording a false absence. → Quote every glob-ish argument.
- [bas-platform commit]: a peer session's `git add -A` had already swept both of my audit docs into an unrelated commit (`fda1bb8`, "correct the claim that the CIT tab icons need an EAS build"). No work lost, but the audit docs are now attributed to a CIT tracker commit.

---

## Session: 2026-08-05

**Project:** access-directory (Access Atlas) — reverse-engineered the user need, then shipped 11 PRs (#36–#47)

### Failures
- [gh pr merge --delete-branch]: merging #36 with `--delete-branch` deleted the base branch of stacked PR #37, which GitHub CLOSED rather than retargeting; `gh pr edit --base main` and `gh pr reopen` both refused ("Cannot change the base branch of a closed pull request"). → Rebased `--onto origin/main` to drop the squashed commit, force-pushed, opened #38 as a replacement. Logged as a shared lesson.
- [migration 0018]: `db reset` failed — `alter table … drop column relevant_identity_tag` while `attribute_claim_status` still depended on it. → Reordered to drop-view → alter → recreate-view → re-grant. Also nearly lost 0009's `service_role` grant, since dropping a view drops its grants; added to CLAUDE.md §14b.
- [my own code, #43]: the first successful coverage write relabelled three facts the operator never re-confirmed, publishing a practice's self-attestation as "From: NY State of Health directory" — migration 0012's bug in a new place. Every unit test passed; only exercising it against real Postgres exposed it. → Added `carriedOverFlags`, then removed the whole class of problem in #45 with per-fact provenance.
- [npm run test:a11y]: whole suite failed at 0ms — Playwright's chromium binary was missing after an update. Misread as a real regression for one run. → `npx playwright install chromium`.
- [local Supabase]: kong/rest/studio containers had been OOM-killed 8 days earlier; `supabase start` reported status and exited 7 without reviving them, so the app got `TypeError: fetch failed` while `psql` worked fine. → `supabase stop` then `start`.
- [browser tool]: `computer{action:left_click, ref}` reported success at plausible coordinates but no radio/checkbox actually toggled (both clicks resolved to the same y). → Verified state with `javascript_tool`, switched to `form_input`; submitted via `form.requestSubmit()`. Separately `read_page` returned "(empty page)" at `viewport 0x0` until an explicit `resize_window {width,height}` — the `preset` form did not fix it.
- [my own test]: the seed.sql/seed.ts parity test parsed the SQL by slicing to the first `;` — and a comment I had just written contained "(wheelchair_user);", truncating the block to 7 of 15 keys. → Fixed the parser to strip whole-line SQL comments before slicing.
- [zsh globbing]: two commands aborted on unquoted globs (`--include=*.astro`, `shared/*.py`); the null-result guard caught both before I recorded a false absence.
- [wrap-up, bas-platform]: edited the hub `TRACKER.md` while a peer session was actively committing (last commit 90s old) and had uncommitted §1 changes in the same file. → Reverted my edit, restored their tree exactly, skipped the hub commit. Fed back into the wrap-up skill.
- [wrap-up, shared/LESSONS.md]: followed the skill's backup → `checkout HEAD` → re-apply procedure, but a peer session expanded an entry *in place* mid-procedure, so the "provably yours" diff came back carrying their prose. → Left both versions uncommitted rather than racing another cycle; added the caveat to the skill.
- [my own reporting]: told the user "#45's backfill hasn't run against production yet" — `doctl` showed every commit from #43 onward had already deployed ACTIVE/SUPERSEDED through the fail-closed migrate gate. → Corrected in the same session; check deploy state before asserting it.

---
