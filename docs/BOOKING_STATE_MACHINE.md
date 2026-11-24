# Booking and slot states

```mermaid
stateDiagram-v2
  [*] --> PENDING_PAYMENT
  PENDING_PAYMENT --> CONFIRMED: Trusted capture and valid hold
  PENDING_PAYMENT --> EXPIRED: Hold deadline passes
  PENDING_PAYMENT --> CANCELLED: Customer releases unpaid hold
  CONFIRMED --> COMPLETED: Reserved period ends
```

```mermaid
stateDiagram-v2
  [*] --> AVAILABLE
  AVAILABLE --> BLOCKED: Owner blocks for maintenance
  BLOCKED --> AVAILABLE: Owner removes block
  AVAILABLE --> HELD: Atomic customer reservation
  HELD --> AVAILABLE: Hold is expired or released
  HELD --> BOOKED: Captured payment is accepted
```

Payment attempts have separate states. A payment may be captured even if its booking is expired or another capture already confirmed the booking. Such a capture remains recorded and enters compensation. An expired booking stays expired. Duplicate observations of an accepted capture return the existing state.

## Operations

```mermaid
stateDiagram-v2
  [*] --> PENDING_PAYMENT
  PENDING_PAYMENT --> CONFIRMED
  PENDING_PAYMENT --> EXPIRED
  PENDING_PAYMENT --> CANCELLED
  CONFIRMED --> CANCELLED
  CONFIRMED --> RESCHEDULED
  CONFIRMED --> CHECKED_IN
  CONFIRMED --> NO_SHOW
  CHECKED_IN --> COMPLETED
```

An offline reservation moves through pending and confirmed inside its inventory transaction, possibly with a remaining balance. Customer cancellation is available before start. Check-in is allowed from the configured early window through the booking end. Completion requires attendance, and no-show requires the booking to end. The scheduled worker can complete elapsed checked-in sessions. Payment status remains independent from attendance.
