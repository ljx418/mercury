# Stage A UX-05: mindmap keyboard navigation

Date: 2026-10-12. Scope: the accessible tree in
`ComprehensionViews.tsx`; no React Flow data, graph layout, evidence ID,
provider, Runtime API, or visual output contract changes.

## PRD scenario

A keyboard user enters the mindmap's accessible tree once with Tab, moves
among visible nodes with Up/Down/Home/End, expands/collapses a chapter with
Right/Left, and can Tab to the focused node's seek action. On collapse,
hidden children disappear from navigation. The focused tree item is the only
tree item in the Tab sequence. Focus and `aria-expanded` remain truthful.
The visual graph continues to be available to pointer users, but it does
not substitute for the keyboard tree.

## Design and preimplementation audit

Use roving `tabIndex` keyed by node ID and a single visible tree-item list.
Root, chapters and points retain stable IDs; selecting a node makes it the
roving item. When a chapter collapses while one of its descendants is active,
move focus back to the chapter. Let native Tab reach the focused item's
seek button; do not trap focus inside the tree. The tree's current nested
buttons remain real actions, and arrow handling applies only when focus is
on a tree item, not on its seek button.

UX-05 is code-grounded: every tree item currently has `tabIndex={0}` and
the current keydown handler catches keys from nested buttons. Fatal 0,
Major 1 until fixed. Accept only after focused keyboard tests and real
Chrome Tab/arrow/seek evidence. No Stage B-D implementation is implied.

| ID | User action and required result |
|---|---|
| MK-01 | Tab from preceding control enters exactly one tree item; next Tab reaches a meaningful action or exits, not every node. |
| MK-02 | Up/Down/Home/End move through currently visible nodes and update the roving Tab stop. |
| MK-03 | Right expands, Left collapses; collapsed children are absent from arrow order and `aria-expanded` matches. |
| MK-04 | Collapse the parent of the focused child; focus moves to that parent and no hidden item remains the Tab stop. |
| MK-05 | Nested seek button retains native Enter/Space and its keypress is not stolen by tree arrow handling. |
| MK-06 | Real Chrome on a published video: keyboard route, four viewport Axe serious/critical zero, no horizontal overflow. |

This is an interaction repair only. It cannot certify mindmap concept
quality, full-video evidence or final V3 acceptance.

## Implementation candidate and PRD check

Roving Tab order is keyed to the current projection's node IDs. Arrow and
Home/End handling ignores nested action buttons; collapsing a parent while
its child is focused moves focus back to the parent. Focused test and all
product module tests passed (32/32), as did typecheck/build. Real Chrome
`first-use-runs/20261012T104527849Z-first-use-result.json` exercised one
published video: one roving Tab stop, ArrowDown/Left/Right, chapter seek
button Enter resulting in a seek outcome or visible alert, and 4/4 mindmap
viewport/Axe/pixel checks. This is one-video interaction evidence only;
concept graph quality remains Stage C, not closed here. Independent review
is still required before this item is a Stage A exit PASS.

## Independent post-fix verdict

The first read-only reviewer found one Major: child focus followed by focus
on the chapter toggle could remove the child while leaving it as the roving
Tab stop. The implementation now resets the roving ID by node ownership,
independently of current DOM focus. A focused test reproduces child focus,
toggle focus and click; it asserts the chapter is the sole visible roving
treeitem. A second read-only reviewer found no remaining Major for this
bounded UX-05 path and gave **bounded GO**. The final-build Chrome run is
`first-use-runs/20261012T105056093Z-first-use-result.json` (SHA-256
`2dab616208156c954e2d2b644fa6c697fc104c43607577bb1e70e008bbcb6c53`).
It proves general keyboard navigation/seek action, not this exact collapse
path in Chrome. The bounded GO does not upgrade full Stage A.
