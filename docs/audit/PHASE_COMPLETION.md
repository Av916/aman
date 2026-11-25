# Phase completion

Verified completion = COMPLETE ÷ applicable requirements × 100. Explicit exclusions appear in the last column and are excluded from the total requirements column. Categories that rely on a hosted service remain applicable.

| Phase   | Total Requirements | Complete | Partial | Missing | Broken | Unverified | Blocked | Completion % | Not applicable |
| ------- | -----------------: | -------: | ------: | ------: | -----: | ---------: | ------: | -----------: | -------------: |
| Phase 1 |                 21 |       18 |       0 |       0 |      0 |          2 |       1 |       85.71% |              0 |
| Phase 2 |                 26 |       22 |       3 |       0 |      0 |          1 |       0 |       84.62% |              0 |
| Phase 3 |                 29 |       25 |       2 |       0 |      1 |          0 |       1 |       86.21% |              0 |
| Phase 4 |                 37 |       23 |       8 |       1 |      0 |          5 |       0 |       62.16% |              0 |
| Phase 5 |                 50 |       27 |      13 |       0 |      1 |          0 |       9 |       54.00% |              1 |
| Overall |                163 |      115 |      26 |       1 |      2 |          8 |      11 |       70.55% |              1 |

All five phases have open requirements. The overall figure weights each applicable requirement equally.

Shared criteria are counted once at their primary phase. Each row evaluates a distinct result, such as implementing an API or meeting its independently specified latency target. External end-to-end requirements are scored separately from the local application behavior they depend on. See the [feature matrix](FEATURE_MATRIX.md) for the evidence behind each status.
