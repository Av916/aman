# Missing features

## P1 · Owner payout reconciliation dashboard

**MISSING.** SRS FR-21 calls for tracking owner payout and settlement. The implementation reports gross booking value, verified captures, offline collections, refunds and net collected. It has no provider settlement ingestion, payout state, variance review or owner-facing bank reconciliation. The browser and ledger tests verify reservations and collections without a settlement feed. The approved merchant arrangement needed to implement real settlement is a separate external requirement. [Ledger scope](../FINANCIAL_LEDGER.md#L14) · [Analytics](../../src/modules/finance/analytics.ts#L21) · [Browser evidence](../../tests/e2e/phase-four.spec.ts#L282) · [Original SRS](../../../../Downloads/TurfSlot_SRS_and_System_Design%20%281%29.docx)

## F06 · QR-based attendance

**PARTIAL.** The customer gets an expiring token and reception can enter it. The integration suite verified token validity and single use. QR rendering and camera scanning are absent. The Phase 4 brief allows a verification token, while the separate SRS and requested audit criterion ask for QR-based check-in. Retain the current manual fallback if QR is added. [Customer token UI](../../src/components/operations/customer-booking.tsx#L97) · [Token verification](../../src/modules/operations/bookings.ts#L363) · [Integration test](../../tests/integration/bookings.test.ts#L753)

The [feature matrix](FEATURE_MATRIX.md) lists additional partially implemented surfaces and features awaiting verification or external prerequisites.
