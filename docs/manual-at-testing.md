# Manual screen-reader testing — run sheet (desktop)

**Who this is for:** paid community co-designer testers running NVDA (Windows)
or VoiceOver (macOS). You do not need to be an engineer. You do not need to
know how the site is built. Use the site the way you normally use the web, and
tell us honestly what worked and what didn't.

> **This script does not replace paid disabled co-designer testing
> (CLAUDE.md §5) — it IS the structured script for those sessions.**
> Automated scanners catch roughly 40% of accessibility problems. This session
> is entirely about the other 60% — the parts only a person using assistive
> technology can judge. Your time is paid.

---

## What this session covers — and what it doesn't

**Covered here:** the whole site, with a desktop screen reader — NVDA with
Firefox or Chrome on Windows, or VoiceOver with Safari on a Mac. Test with
whichever you actually use day to day; that matters more than any pairing.

**Checked by machines, so not your job:** page titles, landmark structure,
heading counts, color contrast, and form-label wiring are asserted
automatically on every code change. You never need to inventory them. (If any
of them *announces* strangely anyway, absolutely say so — that's exactly the
kind of thing machines miss.)

**Tested separately (tracked, not forgotten):**

- Mobile VoiceOver (iPhone/iPad) — its own run sheet, coming with the mobile app work.
- Sighted keyboard-only use, including whether you can *see* where focus is.
- Low vision: screen magnification, browser zoom, and high-contrast modes.
- The sign-in screen itself — it belongs to a separate system. If you meet it
  and anything there confuses you, please say so; it's tracked separately.

## How the session works

Your facilitator sets everything up, gives you the site address, and writes
down results while you work — **you never fill in a form or edit this
document.** Just think aloud. The most useful thing you can say is: *what you
did, the exact words your screen reader said, and what you expected instead.*
"It said 'button' with no name" is gold. "It felt off" is also fine — say so,
and we'll dig in together.

**If something blocks you** — a step you can't finish because of a bug — say
so, and move on to the next step or Part. A blocking bug is the most valuable
find of the session. You haven't broken the run.

**About wording:** expected announcements are written as "you should hear
**something like** …". Every screen reader phrases things differently; the
exact words don't matter, only that the meaning is there and nothing important
is missing. The few places where the exact words DO matter are marked
**[exact wording matters]** — those are safety labels.

**Some checks are marked [sighted check].** Those need a sighted person (your
facilitator) to confirm what the screen looks like. Skipping them is not a gap
in *your* run.

**Pace:** this script is long. Breaks whenever you want — tell your
facilitator; the clock does not matter. You can stop at any point and you are
paid in full. Many testers split it over two sessions (a good split point is
after Part 7, Settings).

---

## Part 1 — Checks that carry through the whole session

1. **The skip link works.** Reload any page, then press `Tab` once. The first
   thing you reach should be a link, "Skip to main content." Press Enter —
   reading should continue at the page's main content, not back at the top
   menu.

2. **No keyboard traps.** Put the mouse away for the whole session. You should
   be able to reach every link, button, and form field with the keyboard, and
   never get stuck somewhere `Tab` or the arrow keys can't leave.

3. **The main menu makes sense.** In the header navigation you should find six
   clearly named links: Places, Providers, Suggest a listing, Help,
   Accessibility, Privacy. In the footer: a "Your data" link.

---

## Part 2 — Home page (`/`)

**Get there:** open the site's address.

1. Jump by headings. The one main heading should tell you what the site is —
   **something like** "accessible places and providers, validated by the
   community."

2. After the intro you should reach two links, "Browse places" and "Browse
   providers." They look like buttons on screen — announced as links with
   clear names is a pass.

3. The box that starts "How to read our labels" should read as normal text,
   in a sensible order, explaining self-reported vs. community-verified.

4. **In your own words** (tell your facilitator): what is this site for, and
   who is it for? Don't look anything up — answer from what you just heard.

---

## Part 3 — The two directory lists

**Run this part twice: once on Places, once on Providers** (both are in the
main menu).

On both lists:

1. Before the list, a link offers to add one ("+ Suggest a place" / "+ Suggest
   a provider").
2. The listings are announced as a **list**, and each listing is a level-3
   heading containing a link — so jumping by headings hops listing to listing.
3. Some listings carry tags read as plain text, **something like**
   "Disabled-owned (self-attested)" or "Disability-literate (self-attested)."
   Tags must be spoken, not just shown as a colored chip.

Differences you should expect (not bugs):

- **Places** starts with "Accessible places" and a sentence saying **how many
  places are listed** — you should not have to count.
- **Providers** starts with "Providers" and a short explanation that
  disability-literate and disabled-owned/-led are tracked separately. It does
  **not** announce a count today — a known gap we've already filed.
- An **empty list** should explain itself honestly (coverage starts thin in
  Buffalo / Erie County on purpose) and offer a way to contribute — never just
  silence. Your facilitator may show you one.

---

## Part 4 — Detail pages

**Run this part twice: once for a place, once for a provider.** Your
facilitator will point you to ones with photos.

### 4.1 Orientation

The first link **in the main content area** (after the site menu) is a way
back — "← All places" or "← All providers" — followed by the listing's name as
the main heading.

### 4.2 Provider pages only: ownership & competence

Under a heading about ownership, leadership & competence, you should hear that
these are **self-attested — no medical proof is ever required**, then three
plain statements: disability-literate, disabled-owned, disabled-led — each
"Yes (self-attested)" or the honest "Not attested."

### 4.3 The accessibility facts

Find the accessibility heading. Under it, a sentence says each item is
validated on its own, never rolled into a star rating. Then each fact reads as
a **complete thought**: its name (like "Step-free entrance"), then its trust
label **in words**, then what that label means, and — when it exists — a
"Last confirmed:" date.

**[exact wording matters]** The trust labels are a fixed, honest vocabulary:

- "Self-reported / awaiting verification"
- "1 community confirmation" / "N community confirmations"
- "Community-verified"
- "Sourced" (the only label allowed to say "high confidence")
- "Disputed — under re-review"

You must never have to guess trust from a color or symbol alone, and
self-reported facts must never be called verified.

You may also hear, on some facts — expected, not bugs:

- a staleness note ("Last confirmed a while ago — access facts change; needs
  re-confirmation"), and/or
- a note that more photos exist than are shown ("N more photos exist for this
  claim — showing the 4 most recent").

### 4.4 Evidence photos

Facts with photo evidence show a photo list that announces **which fact it
belongs to** ("Photo evidence for 'Step-free entrance', list"). For each photo:

- **The photo itself is a link** to the full-size image, so expect to hear
  "link" and then "image" together — that's correct. There's also a separate
  "Full size" text link to the same image.
- The image's description is read out: a real sentence a visitor wrote about
  what the photo shows. If nobody wrote one, you should hear the honest
  fallback, "Evidence photo (no description was provided)" — never a filename,
  never silence.
- **[exact wording matters]** The caption is "Photo from" plus a date — or
  **"Problem reported — photo from"** plus a date when the photo shows
  something wrong. That difference is safety information: you must be able to
  *hear* it, not just see red styling.

### 4.5 The rest of the page

1. Each fact ends with a link naming the specific fact — "Report your visit
   for '…'" — so in a links list you still know which fact it belongs to.
2. The closing note (accessibility facts change — ramps break…) reads as plain
   text.
3. **Broken address:** have your facilitator mangle the address. You should
   hear a clear "not found" heading and a link back to the list — not a blank
   page.

---

## Part 5 — Report your visit (`/contribute/confirm/…`)

**Get there:** on a detail page, activate any "Report your visit for '…'" link.

This form is the safety-critical heart of the site. Take your time here.

**One rule for this whole part: nothing you enter needs to be true about
you.** You are testing that the form works, not reporting a real visit. Your
facilitator gives you test answers.

### 5.1 Orientation

The page starts with a link back to the listing, then a "Report your visit"
heading, then a sentence naming the listing and the exact claim. You should
know **which place and which claim** from listening alone.

### 5.2 If a sign-in message appears

It should read as a normal message ("to report a visit, please sign in —
browsing stays account-free") with a working link. Your facilitator will tell
you whether you'll see one today.

### 5.3 The yes/no question

When you reach the first radio button you should hear the **question itself**
(like "Does the entrance have zero steps?") as the group's name, then "Yes —
my visit confirms this," announced as a required radio button. The second
option: "No — this was NOT true on my visit." Arrow keys move between the two.
After the options, a note explains that a single "no" freezes the claim.

### 5.4 The other fields

1. **Date of your visit** — an optional, labeled date field.
2. **Photo** — the label itself says whether a photo is required for this
   claim or optional. With the field you should hear that location and device
   data are removed from photos before storage.
3. **Photo description** — its label says it's required if you attach a photo,
   with an example hint explaining the description *is* part of the evidence.
4. **Notes** and **display name** — labeled, optional, and the display-name
   label says it's not your real name.

### 5.5 The access-experience checkboxes

A group whose name says **something like**: optional, which access experience
are you speaking from, never shown tied to you, used only to weight your
report. Inside, five checkboxes (wheelchair or mobility device / blind or low
vision / Deaf or hard of hearing / cognitive or learning access needs /
neurodivergent), each with a clear spoken label, each toggling with Space.

**Check any boxes you like — they do not need to describe you.** This is a
test database; we're checking the checkboxes work, not asking about you.

**Then tell your facilitator, in your own words:** how did this question group
make you feel? Is there anything you'd change about how it asks?

### 5.6 Error messages (do these on purpose)

For each error below there are two things to record. **Required:** after
submitting, the error message is at or very near the **top of the page**,
before the heading — easy to find, and it tells you what to fix. **Worth
noting (not a failure):** whether it was spoken *automatically*, without you
hunting — screen readers differ on this and we want the data.

1. Submit **without choosing yes or no.** You should be stopped — either by
   the browser on the field itself, or by a page message about choosing
   whether your visit confirmed the claim.
2. Choose Yes, attach any photo, leave the description **empty**, submit. The
   message should ask you to describe what your photo shows.
3. If this claim requires a photo: choose Yes with **no photo** and submit.
   The message should say a photo is required to confirm (and that you can
   dissent without one).

### 5.7 Success

Submit with your facilitator's test answers. The page should confirm your
visit was recorded and explain it counts once enough independent visits agree
(same two-tier rule: findable at the top is required; auto-spoken is worth
noting). Submit the same claim again **with the same answers, photo
included** — you should be told you've **already reported** it; each person
counts once. (If you drop the photo on the retry, the photo-required message
comes first — that's correct, not a bug.)

---

## Part 6 — Suggest a listing (`/contribute/submit/`)

**Get there:** "Suggest a listing" in the menu.

1. The heading tells you what you're adding ("Suggest a place"), and right
   after it a link offers the other kind: "Add a provider instead." Activate
   it — the heading now says "Suggest a provider," a **"Provider competence"
   group appears (currently a single checkbox)**, and the accessibility-features
   checklist switches to provider-specific items. Then switch back.
2. Early on, the page says new listings start as **"self-reported / awaiting
   verification"** — that honesty note comes before the form.
3. The **Name** field is announced as required.
4. Submit with the name **empty.** You should be stopped and put **on the name
   field**, told it must be filled in (browsers usually announce "invalid
   entry"; a page message saying to give it a name also passes — focus must
   land on the field either way).
5. The address, ownership, and accessibility-features groups each announce
   their purpose as you enter them, and every checkbox has a clear spoken
   label.
6. Submit a complete test listing (facilitator's go-ahead). You should land on
   the new listing's own page with a message near the top confirming it was
   added and starts as self-reported.

---

## Part 7 — Accessibility settings (`/settings/`)

**Get there:** "Accessibility" in the menu.

This page must not just *announce* well — every setting must actually take
effect and stick.

1. Before the form, a note says settings are stored **on this device only**,
   no account, no tracking.
2. The form has three named groups (text / colour & motion / pointer & touch)
   holding six controls: three labeled dropdowns (Text size, Line spacing,
   Font — the Font dropdown carries a hint explaining the choices) and three
   labeled checkboxes (High contrast, Reduce motion, Larger click and tap
   targets). All six work with the keyboard alone.
3. Two buttons: "Save settings" and "Reset to defaults."
4. **Does each setting actually work? Use this same pattern for every setting,
   one at a time:**
   - change it → Save → a message near the top confirms the save
   - **[sighted check]** the page visibly changed where the setting promises it
     (text size, contrast, font; reduce-motion is subtle on this site — the
     saved state is the check)
   - leave to the home page and come back → the control still announces your
     choice as current.

   Settings to run through the pattern: Text size ("Extra large"), High
   contrast, Reduce motion, Font (OpenDyslexic), Larger targets.
5. Finally, "Reset to defaults": a message confirms the reset and
   **[sighted check]** everything returns to normal.

---

## Part 8 — Your data (`/account/`)

**Get there:** the "Your data" link in the footer.

What you find depends on how the test site is set up — your facilitator will
tell you which state to expect. Note which one you saw.

1. The main heading is "Your data." The intro says browsing needs no account
   and, for most visitors, the site holds nothing at all.
2. **Before you've contributed** you'll hear one of: a sign-in message with a
   working link; a plain note that contributions aren't open; or an honest
   "we hold no data for this browser" note. Whichever appears must read as a
   normal message and make sense.
3. **After you've contributed** (you did, in Parts 5–6): under "What we hold
   about you," a short list reads your display name and your counts of visit
   reports and suggested listings — followed by the promise that that's the
   whole list and your specific disability or diagnosis is **never** held or
   asked for.
4. "Download my data (JSON)" is a button. Activating it downloads one file
   immediately — no form, no waiting.
5. A "Delete my data…" link leads to a separate confirmation page (next part).
   The text before it warns it cannot be undone — the warning comes **before**
   anything destructive is possible.
6. If a Sign out button is present, it's announced as a button with its
   explanation.

---

## Part 9 — Delete your data (`/account/delete/`)

**Do this part last — it really deletes the test account you built up in
Parts 5–6. That's expected; your facilitator resets everything afterward.**

This is the one destructive action on the site. The protection is a typed
word — not a pop-up — precisely so it works for everyone. Test that it really
protects.

1. Before any button, two plain sections read **what will be deleted** (your
   reports, photos, tags, display name, account) and **what stays** (listings
   you suggested, with your name detached), then a clear warning that this
   cannot be undone, with a pointer to downloading a copy first.
2. The confirmation field's label asks you to **type the word "delete"** and
   is announced as required, with the explanation of why typing is asked (so a
   stray click can never erase your data) and that capital letters are fine.
3. The button is named **"Permanently delete my data"** — no vague "OK."
4. A safe way out — "Cancel and keep my data" — is present and reachable.
5. **The guard actually guards.** Type the **wrong** word (like "yes") and
   submit. You should be stopped with a message that includes
   **[exact wording matters]** "nothing was deleted" — and you can prove it:
   go back to Your data, and your reports are still listed. Leaving the field
   empty should also stop you at the field.
6. **The real deletion.** Type **Delete** with a capital — that must work —
   and submit. You land back on Your data with a message near the top: your
   data has been deleted; listings you suggested stay, with your name
   detached.

---

## Part 10 — Help & plain words (`/about/help/`)

**Get there:** "Help" in the menu.

1. The glossary under "Words we use" reads as term-then-meaning pairs, in
   order, nothing skipped.
2. **The fold-out questions.** Each question is announced as something you can
   open — "summary," "disclosure triangle," or a button — with a
   collapsed/expanded state. Enter or Space opens it (announced expanded;
   reading onward gives the answer); pressing again closes it (the answer
   leaves the reading order). All six behave the same way.
3. Links inside opened answers work by keyboard.
4. **In your own words:** the page promises short sentences and no jargon.
   Which sentences, if any, did you have to hear twice?

---

## Part 11 — Two short reads

Open "Privacy" and then "Accessibility → the statement page" from the site
footer/menu (your facilitator can point you to the accessibility *statement*
if the menu word takes you to settings).

1. Each page reads top to bottom in a sensible order with one clear main
   heading.
2. **In your own words:** after your session today, did anything on these two
   pages feel untrue or overstated? (These pages make promises; you just spent
   two hours testing them.)

---

## Wrap-up

Three questions in your own words — these are as important as everything
above:

1. What was the most confusing or tiring moment of the session?
2. Was anything announced in a way that felt dishonest, patronizing, or
   unsafe?
3. Would you trust this site to tell you whether you can get into a building?
   Why or why not?

Thank you. Your report — including every failure — directly changes what
ships. Nothing in this script is a test of *you*; every failure is a bug in
*the site*.

---

<!-- For editors, not testers: the [exact wording matters] quotes come from
src/lib/labeling.ts (trust vocabulary), src/components/AttributeList.astro
(photo captions), and src/pages/account/delete.astro (the delete guard). If
you change those strings, change them here too. Everything else in this script
is deliberately meaning-level ("something like") so UI copy edits don't rot
it. Setup, scoring, and session logistics live in
docs/manual-at-testing-facilitator.md. -->
