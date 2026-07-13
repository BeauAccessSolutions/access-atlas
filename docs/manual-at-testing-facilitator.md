# Manual AT testing — facilitator guide

**Who this is for:** the person running a session of
[`manual-at-testing.md`](manual-at-testing.md). Testers never need this file —
the run sheet deliberately contains no commands, no environment knowledge, and
collects no data. All of that is your job, and it's all here.

---

## 1. Stand up the test environment

From the repo root (needs Docker for the database):

```
npm install
npm run db:start        # local Postgres + migrations + seed
npm run dev             # http://localhost:4321
```

### Pin the contribution mode to `provisional`

The contributor gate (`src/lib/contributor.ts`) has three modes, and **the run
sheet's Parts 5, 6, 8, and 9 only work end-to-end in one of them today**:

| Mode | How you get it | What works |
|---|---|---|
| `closed` | `KEYCLOAK_*` unset AND `ALLOW_PROVISIONAL_CONTRIBUTIONS` unset (the default) | Browsing only. Every submit returns "Contributions are not open yet" — Parts 5/6/9 fail as written. |
| `provisional` | `ALLOW_PROVISIONAL_CONTRIBUTIONS=true`, `KEYCLOAK_*` unset | **Use this.** Pseudonymous cookie contributor; the full run sheet works with no sign-in. |
| `keycloak` | All three `KEYCLOAK_*` vars set | Real sign-in via the platform IdP. Blocked on the IdP standup (CLAUDE.md §13) — not available for sessions yet. |

Copy `.env.example` to `.env` and set:

```
ALLOW_PROVISIONAL_CONTRIBUTIONS=true
```

Leave `KEYCLOAK_ISSUER` / `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_REDIRECT_URI`
unset. Restart `npm run dev` after changing `.env`.

In provisional mode the tester will NOT see a sign-in message (run sheet 5.2)
and `/account/` before contributing shows the "we hold no data for this
browser" note (run sheet 8.2) — tell the tester which state to expect when
those steps come up.

### Pre-flight checklist (before the tester arrives)

- [ ] `npm run db:reset` — fresh seeded state.
- [ ] Site loads at the address you'll give the tester; pick a **fresh browser
      profile** (no leftover `aa_settings` or provisional-contributor cookies
      from a previous session).
- [ ] **Create the photo evidence — the seed ships with none.** Using the
      confirm form yourself (provisional mode): submit one **Yes + photo +
      description** confirmation on a place claim and one on a provider claim
      (gives Part 4.4 its photos, and proves the upload path works before the
      tester arrives), and one **No + photo** dissent on a spare claim the
      session doesn't otherwise need (gives Part 4.4 its "Problem reported"
      caption and Part 4.3 a "Disputed — under re-review" label to hear).
      Note the listing addresses. The "+N more photos" note in 4.3 is N/A
      unless you upload 5+ photos to one claim — don't chase it.
- [ ] Note one claim that **requires a photo** to confirm (Part 5.6, error 3
      — most seeded facility claims do).
- [ ] Decide your test answers for Part 5.7 and 5.5 up front (any values —
      they must NOT be the tester's real information; that's a rule in the
      run sheet, not just here).
- [ ] Have this guide's scoring format (§4) ready — paper or a local file,
      never in the repo.

### Reset between testers (and after every session)

```
npm run db:reset
```

plus a fresh browser profile. This un-does everything a session created — test
contributions, the Part 9 deletion, any identity-tag rows — so every tester
starts from identical seeded state (that's what makes results comparable), and
no tester's session data accumulates anywhere. The reset **is** the data
hygiene: nothing a tester entered survives it.

---

## 2. Session logistics

- **Length:** the full script is realistically **two sessions of 60–75
  minutes**. The marked split point is after Part 7 (Settings). Don't try to
  do it in one sitting unless the tester asks to.
- **Breaks:** whenever the tester wants, no justification needed. Offer one at
  every Part boundary; energy-limited testers are in the target pool and an
  unbounded session quietly filters who can participate.
- **Stopping:** the tester can stop at any point and is **paid in full**. Say
  this out loud at the start; it's also in the run sheet.
- **Consent line (read at the start):** "I'll be writing down what you do and
  the exact words your screen reader says. My notes use your tester code, not
  your name. They're kept outside the project repository and deleted after we
  write up the findings. Nothing you enter into the test site needs to be true
  about you, and everything you enter is wiped when we reset. Is that OK — and
  is it OK if I record audio?" (Audio is optional; if declined, scribe only.)
- **Tester codes:** you assign them (T1, T2, …). You hold the only
  code-to-person mapping, outside the repo. A tester's name never appears on a
  scoring sheet or in a finding.
- **Payment** is handled per the co-designer program's terms — it is never
  contingent on completing the script or on "good" results.

---

## 3. Running the session

You scribe; the tester thinks aloud and never edits anything. Read each step
of the run sheet to the tester or let them read it with their screen reader —
their choice (ask at the start; both are fine).

- Capture the tester's **exact screen-reader phrasing** on anything
  surprising. "It said 'button' with no name" beats any paraphrase.
- Don't lead. The run sheet's judgment questions are open on purpose — read
  them verbatim and write down the answer verbatim.
- **Blocked rule** (also in the run sheet): a step a bug prevents is marked
  Blocked, noted, and skipped past. Don't debug live; don't burn the tester's
  time on your bug.
- Track "carries through the session" items (Part 1: skip link, traps, menu)
  yourself — note the page whenever one fails; don't make the tester
  re-inventory them per page.

---

## 4. Scoring

Score against the run sheet's numbering (Part.step, e.g. `5.6.2`). One line
per check:

```
<Part.step> — Pass | Fail | Blocked | N/A — <note>
```

- **Pass** — the expectation held.
- **Fail** — it didn't. Always add: what the tester did, what the screen
  reader actually said, and the answer to **"could you still complete the
  task?" (yes / with difficulty / no)** — that answer is the severity signal;
  don't ask testers to grade WCAG.
- **Blocked** — a different bug made the step unreachable. Name the blocking
  step.
- **N/A** — not applicable in this setup (e.g. no >4-photo claim seeded, no
  sign-in message in provisional mode).

### Results summary (fill in within a day, while it's fresh)

```
Session: <tester code> · <date> · <SR + browser + OS> · Parts covered: <…>
Mode: provisional · Reset done after: yes/no

1. Top three worst moments (tester's words, worst first):
2. Counts: <n> Fail (<n> task-stopping) · <n> Blocked · <n> N/A
3. Any session-stopping bug (what + where):
4. Wrap-up answers, verbatim (confusing/tiring · dishonest/patronizing/unsafe · would you trust it):
5. Anything the tester said that isn't captured by a checkbox:
```

File findings from the summary, not from raw notes; link the tester code, not
the person.

---

## 5. Expected oddities — don't file these as new bugs

- **Messages not auto-spoken on page load.** All banners (errors, saves,
  deletion confirmations) arrive in the initial HTML after a redirect.
  Live-region roles on load-time content are **not reliably announced**
  automatically — VoiceOver + Safari especially. That's why the run sheet
  requires "findable at the top" and only *records* auto-speaking. Log the
  data; it's an SR/browser characteristic unless the message can't be found
  at all (that IS a failure).
- **Providers list has no count sentence** (places has one). Known gap, filed
  once — don't re-file per session.
- **"Reduce motion" looks like nothing changed.** The site barely animates;
  the saved-and-persisted state is the entire check.
- **The photo description hint says descriptions are "read aloud."** Braille
  users read them instead — a small upstream copy improvement is tracked; not
  a session finding.
- **The Keycloak sign-in screen** (when that mode exists) is a separate
  system, tested in its own session. Note problems, file them separately.

---

## 6. Protocols this session does NOT cover (tracked follow-ups)

1. **Mobile VoiceOver run sheet** — needed regardless for the iOS TestFlight
   track (CLAUDE.md §13); the desktop steps do not translate gesture-for-key.
2. **Sighted keyboard-only / focus-visibility protocol** — the one failure
   class a screen-reader session cannot see (invisible focus indicators);
   distinct audience (motor/switch users).
3. **Low-vision protocol** — 400% zoom reflow, OS magnification, Windows
   forced-colors vs. the site's own high-contrast setting.
4. **Keycloak sign-in screen a11y session** — once the platform IdP is stood
   up.

When one of these lands, it gets its own run sheet; don't bolt its steps onto
the desktop script.
