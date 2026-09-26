-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "accent" TEXT NOT NULL DEFAULT 'violet',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "monthlyTarget" INTEGER NOT NULL DEFAULT 0,
    "retainer" INTEGER NOT NULL DEFAULT 0,
    "services" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "accent" TEXT NOT NULL DEFAULT 'violet',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "inviteTokenHash" TEXT,
    "inviteExpires" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "payType" TEXT NOT NULL DEFAULT 'per_task',
    "rate" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ref" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "idea" TEXT,
    "format" TEXT NOT NULL DEFAULT 'reel',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "stage" TEXT NOT NULL DEFAULT 'planned',
    "monthKey" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "cycleStart" TIMESTAMP(3),
    "scriptDue" TIMESTAMP(3),
    "scriptApprovalDue" TIMESTAMP(3),
    "shootDue" TIMESTAMP(3),
    "editDue" TIMESTAMP(3),
    "finalApprovalDue" TIMESTAMP(3),
    "publishDue" TIMESTAMP(3),
    "scriptwriterId" TEXT,
    "cameramanId" TEXT,
    "editorId" TEXT,
    "publisherId" TEXT,
    "scriptBody" TEXT,
    "scriptSubmittedAt" TIMESTAMP(3),
    "scriptApprovedAt" TIMESTAMP(3),
    "shootDate" TIMESTAMP(3),
    "shootLocation" TEXT,
    "shootNotes" TEXT,
    "shootCompletedAt" TIMESTAMP(3),
    "footageUrl" TEXT,
    "editBrief" TEXT,
    "editStartedAt" TIMESTAMP(3),
    "editSubmittedAt" TIMESTAMP(3),
    "editApprovedAt" TIMESTAMP(3),
    "editUrl" TEXT,
    "platform" TEXT,
    "caption" TEXT,
    "hashtags" TEXT,
    "thumbnailUrl" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "revisions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "deliveries" INTEGER NOT NULL,
    "rate" INTEGER NOT NULL,
    "salary" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentEvent" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE INDEX "Client_agencyId_status_idx" ON "Client"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_inviteTokenHash_key" ON "Member"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "Member_agencyId_role_idx" ON "Member"("agencyId", "role");

-- CreateIndex
CREATE INDEX "ContentItem_clientId_monthKey_idx" ON "ContentItem"("clientId", "monthKey");

-- CreateIndex
CREATE INDEX "ContentItem_agencyId_stage_idx" ON "ContentItem"("agencyId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_agencyId_ref_key" ON "ContentItem"("agencyId", "ref");

-- CreateIndex
CREATE INDEX "Payout_agencyId_monthKey_idx" ON "Payout"("agencyId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_memberId_monthKey_key" ON "Payout"("memberId", "monthKey");

-- CreateIndex
CREATE INDEX "Session_memberId_idx" ON "Session"("memberId");

-- CreateIndex
CREATE INDEX "ContentEvent_contentId_idx" ON "ContentEvent"("contentId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_scriptwriterId_fkey" FOREIGN KEY ("scriptwriterId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_cameramanId_fkey" FOREIGN KEY ("cameramanId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEvent" ADD CONSTRAINT "ContentEvent_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
