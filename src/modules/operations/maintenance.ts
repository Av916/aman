import { AppError } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";
import { transaction } from "@/modules/bookings/booking.repository";
import {
  lockVenue,
  lockPitch,
  venueAudit,
} from "@/modules/venues/venue.repository";
import {
  requireVenueWrite,
  venueScope,
  type Actor,
} from "@/modules/permissions/operations";
import { refreshPitch } from "@/modules/availability/service";

export async function changeSlotBlock(
  actor: Actor,
  id: string,
  input: { block: boolean; reason: string },
) {
  const target = await getPrisma().slot.findFirst({
    where: { id, pitch: { venue: venueScope(actor, "maintenance") } },
    select: { pitchId: true, pitch: { select: { venueId: true } } },
  });
  if (!target) throw new AppError(404, "SLOT_NOT_FOUND", "Slot not found.");
  return transaction(async (tx) => {
    const venue = await lockVenue(tx, target.pitch.venueId);
    const pitch = await lockPitch(tx, target.pitchId);
    await requireVenueWrite(tx, actor, venue.id, "maintenance");
    const slot = await tx.slot.findUniqueOrThrow({ where: { id } });
    const now = new Date();
    if (
      slot.startAt <= now ||
      slot.activeBookingId ||
      slot.status !== (input.block ? "AVAILABLE" : "BLOCKED")
    )
      throw new AppError(
        409,
        "SLOT_CHANGED",
        "This slot can no longer be changed.",
      );
    if (!input.block && !slot.blockReason)
      throw new AppError(
        409,
        "SCHEDULE_BLOCK",
        "Change this maintenance block in the venue schedule.",
      );
    await tx.slot.update({
      where: { id },
      data: input.block
        ? { status: "BLOCKED", blockReason: input.reason }
        : { status: "AVAILABLE", blockReason: null },
    });
    if (!input.block) await refreshPitch(tx, pitch, venue);
    await venueAudit(
      tx,
      actor.id,
      venue.id,
      input.block ? "SLOT_MAINTENANCE_BLOCKED" : "SLOT_MAINTENANCE_RELEASED",
      { slotId: id, reason: input.reason },
    );
  });
}
