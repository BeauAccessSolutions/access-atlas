## Summary
<!-- what changed and why -->

## Design & accessibility checklist
<!-- BAS UX/a11y standard — canonical: bas-platform/docs/design-principles.md; app-specific: docs/ux/directory-ux.md -->
- [ ] Navigation works with zero client JS; browser-back preserves place
- [ ] "You are here" clear when browsing the directory
- [ ] Inputs: right keyboard, autofill tokens, paste allowed, 16px+ font, validate on submit
- [ ] Every server action has loading / empty / error / success states
- [ ] Touch targets ≥ 44/48px hit area
- [ ] Any animation < 300ms AND has a prefers-reduced-motion path
- [ ] Contrast ≥ 4.5:1 text / 3:1 large & UI — verified in BOTH light and dark
- [ ] Visible focus everywhere; no cognitive auth puzzle (SC 3.3.8)
- [ ] Search empty-results coach (explain + suggest broader query); errors blame-free + recoverable
- [ ] Browsing stays account-free; login appears ONLY at the contribution boundary (pseudonymous)

## Testing
<!-- how you verified -->
