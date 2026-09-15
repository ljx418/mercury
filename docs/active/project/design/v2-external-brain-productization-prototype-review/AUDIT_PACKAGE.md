# V2-PX Prototype Audit Package

## Gate Status

```text
PX-0.1b local package: candidate for independent review.
PX-0.1b external package verification: pending.
PX-0.2 and PX-1+: No-Go.
```

The source directory is the authoritative editable prototype package. Uploading `index.html` alone is invalid because it omits icons, screenshots and QA provenance. For the repository-wide flat external-audit folder, `v2-px-prototype-self-contained.html` is the approved transport artifact: it embeds all ten assets, `qa-summary.json` and a source/asset hash manifest in one file.

## Required Files

```text
index.html
v2-px-prototype-self-contained.html
qa-summary.json
audit-package-manifest.json
third-party-notices.md
assets/lucide-1.24.0.min.js
assets/baseline-v1-launcher-docked.png
assets/baseline-v1-sidebar-expanded.png
assets/baseline-v1-sidebar-resized.png
assets/concept-external-brain.png
assets/target-sidepanel-save.png
assets/target-workspace-ask.png
assets/target-workspace-graph.png
assets/target-workspace-permissions.png
assets/target-workspace-sources.png
```

## Static Assertions A Reviewer Must Recheck

- `open_workspace` resolves to Source Library with `workspaceId` and no `sourceId`.
- `view_source` resolves to the currently saved or selected Source Detail with `workspaceId + sourceId`.
- `open_in_workspace` preserves a valid Knowledge route or falls back to Source Library.
- `history.pushState`, initial hash parsing, `popstate` and `hashchange` support direct-open, reload and Back demonstrations.
- `WORKSPACE_NOT_FOUND`, `SOURCE_NOT_FOUND`, `FORBIDDEN` and `INVALID_ROUTE` produce recoverable UI.
- Source selection updates the route, breadcrumb, sourceId and build timeline.
- Forget changes Library, Ask, Graph and Trace; a toast alone is not success. The review prototype persists a tombstone in `localStorage` so a forgotten existing source remains absent after full reload/direct-open; production must query Runtime and must not treat this local tombstone as deletion evidence.
- `source_current_page_001` is unavailable before `trace_ready`; after save, a review-only source registry restores the same stable source, operation and metadata across reload/reopen/Back; forgotten IDs still return `SOURCE_NOT_FOUND`.
- Graph source nodes carry `data-source-id`; Forget removes only the node matching the active sourceId.
- Runtime offline maps Adapter/data_service to `unchecked` and source build to `unknown`.
- Icon-only buttons have accessible names; dialog/drawer restore focus and constrain Tab; Escape closes overlays.
- The old 54/54 result is labelled superseded and cannot support current acceptance.
- Saving the current page and selecting `查看来源` keeps route, detail title, breadcrumb and `source_current_page_001` aligned.
- Saving the current page, fully reloading or reopening the detail URL, and navigating away/Back must restore the same `source_current_page_001`; this uses `localStorage` only to simulate the production Runtime registry during prototype review.
- After Forget, Browser Back, full reload and direct-open return `SOURCE_NOT_FOUND`; they must not reopen the forgotten source.
- A foreign hash returns `INVALID_ROUTE`; `open_in_workspace` then falls back to Source Library, while a valid Graph context remains Graph. The Ask textarea has an accessible name, and reset clears prototype tombstones before restoring the complete initial DOM.

## Evidence Boundary

The package is a review prototype, not a production Chrome-extension build. The self-contained artifact solves transport completeness under the 20-file audit limit but does not convert prototype behavior into production evidence. Real extension entry, Back/reload, keyboard behavior and viewport evidence remain PX-1/PX-5 work and cannot be inferred from this package.
