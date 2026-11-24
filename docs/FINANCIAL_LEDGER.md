# Financial ledger

The ledger records positive integer paise and UTC occurrence times. Each event has a unique, deterministic source reference. PostgreSQL rejects row updates and deletes. Capture and refund migrations backfill confirmed historical amounts using the original provider timestamps.

| Kind              | Meaning                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `PAYMENT_CAPTURE` | Provider-verified captured money, including captures later returned.                 |
| `OFFLINE_PAYMENT` | Cash, UPI, card, or transfer reported by an authorized operator.                     |
| `REFUND`          | Provider-confirmed refund or offline refund with an operator settlement reference.   |
| `PLATFORM_FEE`    | Fee component of the initially accepted payment, included in the collected amount.   |
| `TAX`             | Tax component of the initially accepted payment, included in the collected amount.   |
| `ADJUSTMENT`      | Reserved for documented ledger corrections. Operational refunds use a refund record. |

Gross booking value comes from booking snapshots. Net collected equals verified online captures plus recorded offline payments minus processed refunds. Fee and tax rows characterize the captured amount and are excluded from collection sums. Pending refunds are obligations outside net collected until processed. Transfers to replacement bookings preserve the original charge references. Bank settlement requires settlement data from the provider.
