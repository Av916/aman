-- PitchMate baseline for an empty PostgreSQL schema.
-- Includes the PostgreSQL invariants and reference data from the original migrations.
BEGIN;

-- Init
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" TIMESTAMPTZ(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessPhone" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE INDEX "VerificationToken_expires_idx" ON "VerificationToken"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_usedAt_idx" ON "PasswordResetToken"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerProfile_userId_key" ON "OwnerProfile"("userId");

-- CreateIndex
CREATE INDEX "OwnerProfile_verificationStatus_idx" ON "OwnerProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_identifier_fkey" FOREIGN KEY ("identifier") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Venue marketplace
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

-- Booking engine
-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'CHECKED_IN', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AddonPricingType" AS ENUM ('PER_BOOKING', 'PER_HOUR', 'PER_QUANTITY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMED', 'PAYMENT_FAILED', 'RESERVATION_EXPIRED', 'REFUND_INITIATED', 'REFUND_PROCESSED', 'BOOKING_CANCELLED', 'CHECKED_IN', 'BOOKING_REMINDER', 'REFUND_FAILED', 'RESCHEDULED', 'REVIEW_RESPONSE');

-- CreateEnum
CREATE TYPE "OutboxType" AS ENUM ('BOOKING_EMAIL', 'BOOKING_RECEIPT', 'COMPENSATING_REFUND', 'OPERATIONAL_EMAIL');

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "activeBookingId" UUID;

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "pitchId" UUID NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "pitchName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "subtotal" INTEGER NOT NULL,
    "addonTotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "platformFee" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "playerCount" INTEGER NOT NULL,
    "customerNotes" TEXT,
    "termsAcceptedAt" TIMESTAMPTZ(3),
    "holdExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "confirmedPaymentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "slotId" UUID,
    "originalSlotId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerReceipt" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "nextCheckAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "providerPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paymentMethod" TEXT,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processingStatus" "WorkStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "providerRefundId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addon" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "pricingType" "AddonPricingType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddon" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "addonId" UUID NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "pricingType" "AddonPricingType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventType" "OutboxType" NOT NULL,
    "aggregateId" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resourceId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingReceipt" (
    "bookingId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingReceipt_pkey" PRIMARY KEY ("bookingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_confirmedPaymentId_key" ON "Booking"("confirmedPaymentId");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_startAt_idx" ON "Booking"("customerId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Booking_venueId_startAt_idx" ON "Booking"("venueId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_pitchId_startAt_idx" ON "Booking"("pitchId", "startAt");

-- CreateIndex
CREATE INDEX "BookingItem_slotId_idx" ON "BookingItem"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingItem_bookingId_originalSlotId_key" ON "BookingItem"("bookingId", "originalSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_bookingId_key" ON "PaymentOrder"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_providerOrderId_key" ON "PaymentOrder"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_providerReceipt_key" ON "PaymentOrder"("providerReceipt");

-- CreateIndex
CREATE INDEX "PaymentOrder_nextCheckAt_idx" ON "PaymentOrder"("nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_createdAt_idx" ON "Payment"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_processingStatus_nextAttemptAt_idx" ON "PaymentWebhookEvent"("processingStatus", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_bookingId_idx" ON "Refund"("bookingId");

-- CreateIndex
CREATE INDEX "Refund_status_updatedAt_idx" ON "Refund"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Addon_venueId_isActive_idx" ON "Addon"("venueId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Addon_venueId_name_key" ON "Addon"("venueId", "name");

-- CreateIndex
CREATE INDEX "BookingAddon_addonId_idx" ON "BookingAddon"("addonId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAddon_bookingId_addonId_key" ON "BookingAddon"("bookingId", "addonId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_bookingId_idx" ON "Notification"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_userId_operation_idempotencyKey_key" ON "IdempotencyRecord"("userId", "operation", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingReceipt_reference_key" ON "BookingReceipt"("reference");

-- CreateIndex
CREATE INDEX "Slot_activeBookingId_idx" ON "Slot"("activeBookingId");

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_activeBookingId_fkey" FOREIGN KEY ("activeBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmedPaymentId_fkey" FOREIGN KEY ("confirmedPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReceipt" ADD CONSTRAINT "BookingReceipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Old Phase 2 deployments may contain manually marked inventory. Preserve it
-- while enforcing linkage on new writes. Operators can validate after review.
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_booking_ownership_check" CHECK (
  ("status" IN ('AVAILABLE','BLOCKED') AND "activeBookingId" IS NULL AND "holdExpiresAt" IS NULL) OR
  ("status" = 'HELD' AND "activeBookingId" IS NOT NULL AND "holdExpiresAt" IS NOT NULL) OR
  ("status" = 'BOOKED' AND "activeBookingId" IS NOT NULL AND "holdExpiresAt" IS NULL)
) NOT VALID;

CREATE UNIQUE INDEX "Booking_id_pitchId_inventory_key" ON "Booking" ("id","pitchId");
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_active_booking_pitch_fkey"
  FOREIGN KEY ("activeBookingId","pitchId") REFERENCES "Booking" ("id","pitchId");

CREATE UNIQUE INDEX "Payment_id_bookingId_acceptance_key" ON "Payment" ("id","bookingId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_accepted_payment_same_booking_fkey"
  FOREIGN KEY ("confirmedPaymentId","id") REFERENCES "Payment" ("id","bookingId");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_price_and_period_check" CHECK (
  "startAt" < "endAt" AND "durationMinutes" > 0 AND "playerCount" > 0 AND
  "subtotal" >= 0 AND "addonTotal" >= 0 AND "discountAmount" >= 0 AND
  "platformFee" >= 0 AND "taxAmount" >= 0 AND "totalAmount" >= 100 AND
  "totalAmount"::bigint = "subtotal"::bigint + "addonTotal" - "discountAmount" + "platformFee" + "taxAmount"
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmed_payment_check" CHECK (
  ("status" IN ('CONFIRMED','COMPLETED')) = ("confirmedPaymentId" IS NOT NULL AND "confirmedAt" IS NOT NULL)
);
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_price_and_period_check"
  CHECK ("unitPrice" >= 0 AND "durationMinutes" > 0 AND "startAt" < "endAt");
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_price_check" CHECK ("price" >= 0);
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_price_check"
  CHECK ("unitPrice" >= 0 AND "totalPrice" >= 0 AND "quantity" > 0);
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_amount_check" CHECK ("amount" >= 100);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_check" CHECK ("amount" > 0);

-- Align booking foreign keys
-- Use the pitch- and booking-scoped references as the canonical foreign keys.
-- Both stronger references already exist from the preceding migration.
ALTER TABLE "Slot" DROP CONSTRAINT "Slot_activeBookingId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_confirmedPaymentId_fkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Slot" WHERE ("status" IN ('HELD','BOOKED') AND "activeBookingId" IS NULL)
      OR ("status" IN ('AVAILABLE','BLOCKED') AND "holdExpiresAt" IS NOT NULL)
  ) THEN
    ALTER TABLE "Slot" VALIDATE CONSTRAINT "Slot_booking_ownership_check";
  END IF;
END $$;

-- Operations
-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE', 'OWNER_MANUAL', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'GROUND_STAFF');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CancellationType" AS ENUM ('CUSTOMER_REQUEST', 'OWNER_REQUEST', 'ADMIN_REQUEST', 'WEATHER', 'MAINTENANCE', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT_CAPTURE', 'OFFLINE_PAYMENT', 'REFUND', 'PLATFORM_FEE', 'TAX', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('AWAITING_PAYMENT', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'PENDING_MODERATION', 'HIDDEN', 'REJECTED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

-- DropIndex
DROP INDEX "Refund_paymentId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookingSource" "BookingSource" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "cancellationPolicySnapshot" JSONB,
ADD COLUMN     "checkedInAt" TIMESTAMPTZ(3),
ADD COLUMN     "checkedInById" UUID,
ADD COLUMN     "completedAt" TIMESTAMPTZ(3),
ADD COLUMN     "createdById" UUID,
ADD COLUMN     "guestCustomerId" UUID,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "noShowAt" TIMESTAMPTZ(3),
ADD COLUMN     "rescheduledFromId" UUID,
ADD COLUMN     "settlementDue" INTEGER,
ALTER COLUMN "customerId" DROP NOT NULL,
ALTER COLUMN "customerEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "sourceKey" TEXT;

-- CreateTable
CREATE TABLE "GuestCustomer" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GuestCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffVenueAssignment" (
    "id" UUID NOT NULL,
    "staffMemberId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffVenueAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "venueIds" UUID[],
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicyRule" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "minimumHoursBeforeBooking" INTEGER NOT NULL,
    "refundPercentage" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationPolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "cancellationType" "CancellationType" NOT NULL,
    "refundAmount" INTEGER NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL,
    "processedById" UUID,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInToken" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "usedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "paymentId" UUID,
    "refundId" UUID,
    "transactionType" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescheduleRequest" (
    "id" UUID NOT NULL,
    "originalBookingId" UUID NOT NULL,
    "replacementBookingId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "replacementAmount" INTEGER NOT NULL,
    "priceDifference" INTEGER NOT NULL,
    "status" "RescheduleStatus" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "pitchId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "ownerResponse" TEXT,
    "ownerRespondedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "venueId" UUID,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maximumDiscount" INTEGER,
    "minimumBookingAmount" INTEGER NOT NULL,
    "usageLimit" INTEGER,
    "usageLimitPerCustomer" INTEGER,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestCustomer_venueId_phone_idx" ON "GuestCustomer"("venueId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCustomer_id_venueId_key" ON "GuestCustomer"("id", "venueId");

-- CreateIndex
CREATE INDEX "StaffMember_userId_status_idx" ON "StaffMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_ownerId_userId_key" ON "StaffMember"("ownerId", "userId");

-- CreateIndex
CREATE INDEX "StaffVenueAssignment_venueId_idx" ON "StaffVenueAssignment"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffVenueAssignment_staffMemberId_venueId_key" ON "StaffVenueAssignment"("staffMemberId", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffInvitation_ownerId_createdAt_idx" ON "StaffInvitation"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_venueId_version_key" ON "CancellationPolicy"("venueId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicyRule_policyId_minimumHoursBeforeBooking_key" ON "CancellationPolicyRule"("policyId", "minimumHoursBeforeBooking");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationRequest_bookingId_key" ON "CancellationRequest"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInToken_tokenHash_key" ON "CheckInToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CheckInToken_bookingId_expiresAt_idx" ON "CheckInToken"("bookingId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_reference_key" ON "FinancialTransaction"("reference");

-- CreateIndex
CREATE INDEX "FinancialTransaction_venueId_occurredAt_idx" ON "FinancialTransaction"("venueId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialTransaction_bookingId_idx" ON "FinancialTransaction"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "RescheduleRequest_originalBookingId_key" ON "RescheduleRequest"("originalBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "RescheduleRequest_replacementBookingId_key" ON "RescheduleRequest"("replacementBookingId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_bookingId_paymentId_key" ON "PaymentAllocation"("bookingId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_venueId_status_createdAt_idx" ON "Review"("venueId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_reviewId_userId_key" ON "ReviewReport"("reviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_venueId_isActive_idx" ON "Coupon"("venueId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_bookingId_key" ON "CouponRedemption"("bookingId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_expiresAt_idx" ON "CouponRedemption"("couponId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_customerId_status_idx" ON "CouponRedemption"("couponId", "customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_sourceKey_key" ON "Refund"("sourceKey");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestCustomerId_venueId_fkey" FOREIGN KEY ("guestCustomerId", "venueId") REFERENCES "GuestCustomer"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCustomer" ADD CONSTRAINT "GuestCustomer_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffVenueAssignment" ADD CONSTRAINT "StaffVenueAssignment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffVenueAssignment" ADD CONSTRAINT "StaffVenueAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicyRule" ADD CONSTRAINT "CancellationPolicyRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CancellationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInToken" ADD CONSTRAINT "CheckInToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_originalBookingId_fkey" FOREIGN KEY ("originalBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_replacementBookingId_fkey" FOREIGN KEY ("replacementBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Operations invariants
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_confirmed_payment_check";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customer_identity_check"
  CHECK (num_nonnulls("customerId", "guestCustomerId") = 1 AND
    ("bookingSource" <> 'ONLINE' OR "customerId" IS NOT NULL));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmation_check"
  CHECK (("status" NOT IN ('CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','RESCHEDULED') OR "confirmedAt" IS NOT NULL)
    AND ("confirmedPaymentId" IS NULL OR "confirmedAt" IS NOT NULL)
    AND ("settlementDue" IS NULL OR ("settlementDue" >= 0 AND "settlementDue" <= "totalAmount")));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_provider_order_check"
  CHECK (("provider" = 'RAZORPAY') = ("orderId" IS NOT NULL));
ALTER TABLE "CancellationRequest" ADD CHECK ("refundAmount" >= 0);
ALTER TABLE "CancellationPolicyRule" ADD CHECK ("refundPercentage" BETWEEN 0 AND 100 AND "minimumHoursBeforeBooking" >= 0);
CREATE UNIQUE INDEX "CancellationPolicy_active_venue_key" ON "CancellationPolicy" ("venueId") WHERE "isActive";
ALTER TABLE "Review" ADD CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Coupon" ADD CHECK ("discountValue" > 0 AND "minimumBookingAmount" >= 0 AND "startsAt" < "expiresAt"
  AND ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100)
  AND ("maximumDiscount" IS NULL OR "maximumDiscount" > 0)
  AND ("usageLimit" IS NULL OR "usageLimit" > 0)
  AND ("usageLimitPerCustomer" IS NULL OR "usageLimitPerCustomer" > 0));
ALTER TABLE "CouponRedemption" ADD CHECK ("discountAmount" > 0);
ALTER TABLE "FinancialTransaction" ADD CHECK ("amount" > 0);
ALTER TABLE "PaymentAllocation" ADD CHECK ("amount" > 0);
UPDATE "Refund" SET "sourceKey" = 'compensation:' || "paymentId"::text WHERE "sourceKey" IS NULL;

INSERT INTO "FinancialTransaction" (id, "venueId", "bookingId", "paymentId", "transactionType", amount, currency, reference, "occurredAt")
SELECT gen_random_uuid(), b."venueId", b.id, p.id, 'PAYMENT_CAPTURE', p.amount, p.currency, 'capture:' || p.id, p."paidAt"
FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" WHERE p."paidAt" IS NOT NULL
ON CONFLICT (reference) DO NOTHING;
INSERT INTO "FinancialTransaction" (id, "venueId", "bookingId", "paymentId", "refundId", "transactionType", amount, currency, reference, "occurredAt")
SELECT gen_random_uuid(), b."venueId", b.id, r."paymentId", r.id, 'REFUND', r.amount, p.currency, 'refund:' || r.id, r."processedAt"
FROM "Refund" r JOIN "Booking" b ON b.id = r."bookingId" JOIN "Payment" p ON p.id = r."paymentId"
WHERE r.status = 'PROCESSED' AND r."processedAt" IS NOT NULL
ON CONFLICT (reference) DO NOTHING;
INSERT INTO "FinancialTransaction" (id, "venueId", "bookingId", "paymentId", "transactionType", amount, currency, reference, "occurredAt")
SELECT gen_random_uuid(), "venueId", id, "confirmedPaymentId", charge.kind::"TransactionType", charge.amount, currency,
       charge.prefix || id, "confirmedAt"
FROM "Booking" CROSS JOIN LATERAL (VALUES ('PLATFORM_FEE', "platformFee", 'fee:'), ('TAX', "taxAmount", 'tax:')) AS charge(kind, amount, prefix)
WHERE "confirmedPaymentId" IS NOT NULL AND charge.amount > 0
ON CONFLICT (reference) DO NOTHING;

CREATE FUNCTION pitchmate_refund_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE captured integer;
BEGIN
  SELECT amount INTO captured FROM "Payment" WHERE id = NEW."paymentId" AND "paidAt" IS NOT NULL FOR NO KEY UPDATE;
  IF captured IS NULL OR NEW.amount + COALESCE((SELECT SUM(amount) FROM "Refund"
    WHERE "paymentId" = NEW."paymentId" AND id <> NEW.id), 0) > captured THEN
    RAISE EXCEPTION 'Refund exceeds captured payment balance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Refund_balance_guard" BEFORE INSERT OR UPDATE OF amount, "paymentId" ON "Refund"
FOR EACH ROW EXECUTE FUNCTION pitchmate_refund_balance();

CREATE FUNCTION pitchmate_keep_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "FinancialTransaction_immutable" BEFORE UPDATE OR DELETE ON "FinancialTransaction"
FOR EACH ROW EXECUTE FUNCTION pitchmate_keep_ledger();

-- Calendar blocks
ALTER TABLE "Slot" ADD COLUMN "blockReason" TEXT;
ALTER TABLE "Slot" ADD CHECK ("blockReason" IS NULL OR status = 'BLOCKED') NOT VALID;

-- Platform settings
CREATE TABLE "PlatformSetting" (
  key TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount BETWEEN 0 AND 1000000),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);

-- Financial relations
CREATE UNIQUE INDEX "Booking_id_venueId_key" ON "Booking"("id", "venueId");
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_bookingId_venueId_fkey" FOREIGN KEY ("bookingId", "venueId") REFERENCES "Booking"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Production operations
CREATE TABLE "JobLease" (
  name TEXT PRIMARY KEY,
  token UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  cursor UUID
);
CREATE TABLE "JobRun" (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED')),
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  "errorCode" TEXT,
  result JSONB
);
CREATE INDEX "JobRun_name_startedAt_idx" ON "JobRun"(name, "startedAt");
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");

-- Attendance worker index
CREATE INDEX "Booking_status_endAt_idx" ON "Booking"("status", "endAt");

COMMIT;
