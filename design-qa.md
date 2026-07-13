# Design QA

## Scope

- Source concept: generated design concept from the product-design phase
- Implemented route: `/`
- Primary viewport: `1487 x 1058`
- State: default course discovery view

## Evidence

- Desktop render: `tmp/design-qa/implementation-desktop-final.png`
- Normalized desktop render: `tmp/design-qa/implementation-desktop-normalized.png`
- Full comparison: `tmp/design-qa/comparison-full.png`
- Focused comparisons: `tmp/design-qa/comparison-top.png`, `tmp/design-qa/comparison-bottom.png`

## Comparison findings

1. The warm ivory, navy, and saffron visual system follows the selected concept.
2. Header, hero, search, three-axis filters, beginner banner, and four-row course list keep the same hierarchy.
3. The first implementation showed three course rows; the default state was corrected to show four while retaining the beginner recommendation treatment.
4. The hero still-life was regenerated and repositioned to better match the source composition.
5. Course imagery and instructor portraits are original generated assets; provider marks use code-native brand icons.

## Copy diff

- Brand and principal above-the-fold Thai copy match the selected concept.
- Supporting course metadata was expanded where needed so the controls and saved-course behavior have realistic data.

## Intentional deviations

- The brand mark is a code-native outlined book symbol rather than a pixel copy of the concept mark.
- Controls are functional HTML elements with accessible labels and responsive layout behavior.

## Remaining validation

- P0: none found.
- P1: none found in the captured desktop state.
- P2: mobile browser capture at `390 x 844` could not be completed because the in-app browser rejected further localhost actions under its URL security policy.
- P2: final click-through checks for search, filters, bookmarks, and the no-dev-indicator production render could not be captured after that policy block.
- P3: the logo symbol has a small silhouette difference from the source concept.

## Final result

final result: blocked

Desktop fidelity evidence is complete, but the required mobile and final interaction browser checks remain unavailable due to the browser URL policy block.
