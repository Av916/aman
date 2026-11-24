# Booking pricing

Phase 2 produces each available slot's rate using its venue-local start, day, effective range, and rule priority. The booking calculator reads these current inventory prices under the pitch lock. The quote itemizes individual slot prices and validates add-ons against the selected venue's active catalog.

| Add-on mode  | Formula                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| Per booking  | One configured price                                                         |
| Per hour     | Hourly paise multiplied by duration in minutes, rounded after dividing by 60 |
| Per quantity | Integer paise multiplied by quantity, up to 20                               |

The calculator uses integer arithmetic. The platform fee is `PLATFORM_FEE_PAISE`. The tax base is slots plus add-ons plus platform fee, with a single half-up rounding step using `TAX_RATE_BPS`. Both values are deployment configuration and must reflect the operator's approved business rules. Discount snapshots are currently zero.

Clients submit IDs, quantities, and the last quote fingerprint. They cannot set a payable amount. A changed quote returns `PRICE_CHANGED` and the UI requires a new review. The stored booking, item, and add-on snapshots remain fixed after the hold.
