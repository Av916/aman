# Incident response

| Incident                       | Immediate action and verification                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Database outage                | Check readiness, database health and pool saturation. Resume after an isolated read and booking transaction succeed.   |
| Failed migration               | Stop release promotion and preserve diagnostics. Apply a reviewed forward fix or restore an isolated branch.           |
| Deletion or corruption         | Preserve the original database and identify the recovery boundary. Audit the restored branch and reconcile payments.   |
| Payment provider outage        | Preserve booking and order intents. Run reconciliation when the provider returns and verify compensation.              |
| Cloudinary outage              | Pause uploads if needed. Verify existing images and an authorized upload after recovery.                               |
| Application deployment failure | Route traffic to the prior compatible artifact. Check health, authentication, booking and workers.                     |
| Credential compromise          | Rotate the credential, revoke it at the provider, and review access and audit events.                                  |
| Scheduler outage               | Check secrets, lease age, expired work and delivery errors. Re-run eligible bounded tasks and verify backlog recovery. |

Use request, order and job references to correlate events. Keep customer and provider payloads in restricted systems.
