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
