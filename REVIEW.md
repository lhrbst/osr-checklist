# Reviewing an extraction pull request

Every OSR edition reaches the site through a pull request opened by the **Extract OSR edition** workflow. The content is
written by an LLM. **Merging the pull request publishes it**, so this review is the only safety check.

## 1. Clear the "Needs attention" list first

The PR description starts with everything the pipeline could not verify:

- **rule … on card but not found in extract text**: the card line cites a rule that the category's PDF doesn't contain.
  Usually the model misread a rule number or the category.
- **rule … in extract but on no card line**: a Section 4/5 rule exists in the PDF but no item covers it. Often this is
  fine (not every rule has a card line). Check whether a card line was missed.
- **no page found … link points to page 1**: fix `pages` by hand.
- **explanation missing**: replace the placeholder text in both languages.
- **drawing rejected**: the item uses the placeholder drawing. Add `src/content/drawings/<id>.svg` and set `drawing`.
- **model unsure**: check that line against the PDFs.
- **build validation**: the site would not build; fix the item named.

Tick each box in the PR description once it's resolved. **Don't merge while any box is unticked.**

## 2. Check every item

For each file in `src/content/items/<edition>/`, open the official PDF for each category under `applies`:

- [ ] **Categories**: the item applies to exactly the categories whose Appendix F inspection card lists it.
- [ ] **Pages**: the link opens the page where the rule's full text is.
- [ ] **Explanation (EN)**: faithful to that category's rule, with its concrete numbers (quantities, sizes,
      ratings). Nothing invented, no regulation text copied.
- [ ] **Explanation (DE)**: same content, in natural German sailing terms. The name has the English term in brackets.
- [ ] **Section and order**: the item sits under the same heading and in the same order as on that category's card.
- [ ] **Drawing**: recognisable, with no text in it.

## 3. Fixing things

Commit fixes directly to the PR branch (`extract/<edition>`), in the GitHub editor or locally. CI re-runs on every push.
Merge only when CI is green and every attention box is ticked.
