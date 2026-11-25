# Phase completion

Verified completion = COMPLETE ÷ applicable requirements × 100. Explicit exclusions appear in the last column and are excluded from the total requirements column. Categories that rely on a hosted service remain applicable.

| Phase   | Total Requirements | Complete | Partial | Missing | Broken | Unverified | Blocked | Completion % | Not applicable |
| ------- | -----------------: | -------: | ------: | ------: | -----: | ---------: | ------: | -----------: | -------------: |
| Phase 1 |                 21 |       20 |       0 |       0 |      0 |          0 |       1 |       95.24% |              0 |
| Phase 2 |                 26 |       23 |       3 |       0 |      0 |          0 |       0 |       88.46% |              0 |
| Phase 3 |                 29 |       26 |       2 |       0 |      0 |          0 |       1 |       89.66% |              0 |
| Phase 4 |                 37 |       25 |       8 |       1 |      0 |          3 |       0 |       67.57% |              0 |
| Phase 5 |                 49 |       26 |      13 |       0 |      1 |          0 |       9 |       53.06% |              2 |
| Overall |                162 |      120 |      26 |       1 |      1 |          3 |      11 |       74.07% |              2 |

All five phases have open requirements. The overall figure weights each applicable requirement equally.

Shared criteria are counted once at their primary phase. Each row evaluates a distinct result, such as implementing an API or meeting its independently specified latency target. External end-to-end requirements are scored separately from the local application behavior they depend on. See the [feature matrix](FEATURE_MATRIX.md) for the evidence behind each status.
