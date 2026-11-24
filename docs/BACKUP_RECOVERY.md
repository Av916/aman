# Backups and disaster recovery

Enable a managed point-in-time restore window and scheduled encrypted logical backups in separately permissioned storage. Retain Cloudinary assets or versions during recovery. Proposed retention is 30 days, subject to governing policy and legal approval. Restrict and audit access to the backup key and restore credentials.

Target RPO is 15 minutes and RTO is four hours. Verify both against the selected hosted plan. The local logical restore drill tests portable backup contents and cannot measure hosted time or point-in-time history.

1. Pause writes or route traffic away from the affected database. Preserve logs and provider event identifiers.
2. Restore to an isolated branch or database while preserving the original.
3. Check migration status and run the read-only database audit. Compare ledger totals and booking, payment, refund, and outbox records.
4. Reconcile provider events between the restore timestamp and planned switch. Verify ambiguous refunds before restarting the worker.
5. Switch application and job connections after incident approval and verify readiness, bookings, refunds, delivery backlog and media references.

Run the db:restore:drill command with a quiescent loopback test database and a distinct empty loopback restore database. The restore target must end in _restore.

The local drill restored the isolated PostgreSQL fixture in 514 ms. Venue, booking, payment, refund, ledger, outbox and migration-history counts matched the source. All 12 migrations were current, Prisma found no schema drift, and the 12 integrity checks returned zero findings. Hosted recovery objectives and object storage restore remain open.
