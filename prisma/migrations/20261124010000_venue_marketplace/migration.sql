-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PitchType" AS ENUM ('BOX_CRICKET', 'NET_PRACTICE', 'FULL_GROUND', 'INDOOR_CRICKET', 'OUTDOOR_CRICKET');

-- CreateEnum
CREATE TYPE "SurfaceType" AS ENUM ('ARTIFICIAL_TURF', 'NATURAL_GRASS', 'CEMENT', 'MATTING', 'OTHER');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('WEEKDAY', 'WEEKEND', 'PEAK_HOUR', 'OFF_PEAK', 'HOLIDAY', 'SPECIAL_EVENT');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BLOCKED', 'HELD', 'BOOKED');

-- CreateTable
CREATE TABLE "Venue" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "locality" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'India',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pitch" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pitchType" "PitchType" NOT NULL,
    "surfaceType" "SurfaceType" NOT NULL,
    "isIndoor" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL,
    "lengthInMeters" INTEGER NOT NULL,
    "widthInMeters" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "minimumBookingMinutes" INTEGER NOT NULL DEFAULT 60,
    "maximumBookingMinutes" INTEGER NOT NULL DEFAULT 180,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueImage" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCleanup" (
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaCleanup_pkey" PRIMARY KEY ("storageKey")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueAmenity" (
    "venueId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "VenueAmenity_pkey" PRIMARY KEY ("venueId","amenityId")
);

-- CreateTable
CREATE TABLE "OperatingHours" (
    "id" UUID NOT NULL,
    "pitchId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openingTime" INTEGER,
    "closingTime" INTEGER,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperatingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" UUID NOT NULL,
    "pitchId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "openingTime" INTEGER,
    "closingTime" INTEGER,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" UUID NOT NULL,
    "pitchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" "PricingRuleType" NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" INTEGER,
    "endTime" INTEGER,
    "pricePerHour" INTEGER NOT NULL,
    "effectiveFrom" DATE,
    "effectiveUntil" DATE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" UUID NOT NULL,
    "pitchId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "price" INTEGER NOT NULL,
    "hourlyPrice" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "holdExpiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_ownerId_status_createdAt_idx" ON "Venue"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Venue_status_city_publishedAt_idx" ON "Venue"("status", "city", "publishedAt");

-- CreateIndex
CREATE INDEX "Pitch_venueId_isActive_pitchType_idx" ON "Pitch"("venueId", "isActive", "pitchType");

-- CreateIndex
CREATE UNIQUE INDEX "Pitch_venueId_name_key" ON "Pitch"("venueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VenueImage_storageKey_key" ON "VenueImage"("storageKey");

-- CreateIndex
CREATE INDEX "VenueImage_venueId_sortOrder_idx" ON "VenueImage"("venueId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_slug_key" ON "Amenity"("slug");

-- CreateIndex
CREATE INDEX "VenueAmenity_amenityId_venueId_idx" ON "VenueAmenity"("amenityId", "venueId");

-- CreateIndex
CREATE INDEX "OperatingHours_pitchId_dayOfWeek_idx" ON "OperatingHours"("pitchId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingHours_pitchId_dayOfWeek_openingTime_key" ON "OperatingHours"("pitchId", "dayOfWeek", "openingTime");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_pitchId_date_key" ON "ScheduleException"("pitchId", "date");

-- CreateIndex
CREATE INDEX "PricingRule_pitchId_isActive_idx" ON "PricingRule"("pitchId", "isActive");

-- CreateIndex
CREATE INDEX "Slot_pitchId_status_startAt_idx" ON "Slot"("pitchId", "status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_pitchId_startAt_key" ON "Slot"("pitchId", "startAt");

-- CreateIndex
CREATE INDEX "Favorite_venueId_idx" ON "Favorite"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_venueId_key" ON "Favorite"("userId", "venueId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueImage" ADD CONSTRAINT "VenueImage_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAmenity" ADD CONSTRAINT "VenueAmenity_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAmenity" ADD CONSTRAINT "VenueAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingHours" ADD CONSTRAINT "OperatingHours_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure consistent venue visibility and prevent double allocation at the database boundary.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Venue"
  ADD CONSTRAINT "Venue_coordinates_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL
        AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT "Venue_publication_check" CHECK (
    "publishedAt" IS NULL OR ("status" = 'APPROVED' AND "deletedAt" IS NULL)
  );
ALTER TABLE "Pitch"
  ADD CONSTRAINT "Pitch_duration_check" CHECK (
    "slotDurationMinutes" IN (30,60)
    AND "minimumBookingMinutes" >= "slotDurationMinutes"
    AND "maximumBookingMinutes" >= "minimumBookingMinutes"
    AND "minimumBookingMinutes" % "slotDurationMinutes" = 0
    AND "maximumBookingMinutes" % "slotDurationMinutes" = 0
  ),
  ADD CONSTRAINT "Pitch_values_check" CHECK (
    "basePrice" >= 0 AND "capacity" > 0 AND "lengthInMeters" > 0 AND "widthInMeters" > 0
  );
CREATE UNIQUE INDEX "VenueImage_one_cover" ON "VenueImage" ("venueId") WHERE "isCover";

ALTER TABLE "Slot"
  ADD CONSTRAINT "Slot_time_and_price_check" CHECK ("startAt" < "endAt" AND "price" >= 0 AND "hourlyPrice" >= 0),
  ADD CONSTRAINT "Slot_nonoverlap" EXCLUDE USING gist (
    "pitchId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&
  );

CREATE INDEX "Venue_discovery_text" ON "Venue" USING gin (
  to_tsvector('simple', "name" || ' ' || "city" || ' ' || "locality" || ' ' || "address")
) WHERE "status" = 'APPROVED' AND "publishedAt" IS NOT NULL AND "deletedAt" IS NULL;

INSERT INTO "Amenity" (id, name, slug, icon) VALUES
  (gen_random_uuid(), 'Floodlights', 'floodlights', 'lightbulb'),
  (gen_random_uuid(), 'Parking', 'parking', 'car'),
  (gen_random_uuid(), 'Washrooms', 'washrooms', 'door-open'),
  (gen_random_uuid(), 'Changing rooms', 'changing-rooms', 'shirt'),
  (gen_random_uuid(), 'Drinking water', 'drinking-water', 'droplet'),
  (gen_random_uuid(), 'Cricket equipment', 'cricket-equipment', 'goal'),
  (gen_random_uuid(), 'Seating area', 'seating-area', 'armchair'),
  (gen_random_uuid(), 'First aid', 'first-aid', 'heart-pulse'),
  (gen_random_uuid(), 'CCTV', 'cctv', 'cctv'),
  (gen_random_uuid(), 'Food and beverages', 'food-and-beverages', 'coffee'),
  (gen_random_uuid(), 'Locker facilities', 'locker-facilities', 'lock'),
  (gen_random_uuid(), 'Covered playing area', 'covered-playing-area', 'umbrella')
ON CONFLICT ("slug") DO NOTHING;
