-- CreateEnum
CREATE TYPE "ModActionType" AS ENUM ('warn', 'kick', 'ban', 'tempban', 'unban', 'timeout', 'untimeout', 'purge');

-- CreateEnum
CREATE TYPE "AutomodRuleType" AS ENUM ('spam', 'caps', 'mentions', 'links', 'invites', 'wordlist', 'anti_raid');

-- CreateEnum
CREATE TYPE "AutomodAction" AS ENUM ('delete', 'warn', 'timeout', 'kick', 'ban');

-- CreateTable
CREATE TABLE "Guild" (
    "id" BIGINT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "djRoleId" BIGINT,
    "musicChannelId" BIGINT,
    "announceNowPlaying" BOOLEAN NOT NULL DEFAULT true,
    "twentyFourSeven" BOOLEAN NOT NULL DEFAULT false,
    "autoDisconnectMinutes" INTEGER DEFAULT 5,
    "defaultVolume" INTEGER NOT NULL DEFAULT 100,
    "voteSkipThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "welcomeConfig" JSONB,
    "leaveConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT,
    "ownerId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "tracks" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warn" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "moderatorId" BIGINT NOT NULL,
    "reason" VARCHAR(512) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModLog" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "type" "ModActionType" NOT NULL,
    "targetUserId" BIGINT NOT NULL,
    "moderatorId" BIGINT NOT NULL,
    "reason" VARCHAR(512),
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomodRule" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "type" "AutomodRuleType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "action" "AutomodAction" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "exemptRoleIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "exemptChannelIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomodRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRole" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "channelId" BIGINT NOT NULL,
    "messageId" BIGINT NOT NULL,
    "entries" JSONB NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'toggle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoRole" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "roleId" BIGINT NOT NULL,
    "forBots" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelUser" (
    "guildId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastXpAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelUser_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "channelId" BIGINT NOT NULL,
    "messageId" BIGINT NOT NULL,
    "hostId" BIGINT NOT NULL,
    "prize" VARCHAR(256) NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "winnerIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "requirements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "channelId" BIGINT NOT NULL,
    "openedById" BIGINT NOT NULL,
    "closedById" BIGINT,
    "topic" VARCHAR(256),
    "transcript" JSONB,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomCommand" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT NOT NULL,
    "channelId" BIGINT NOT NULL,
    "createdBy" BIGINT NOT NULL,
    "cron" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lastFiredAt" TIMESTAMP(3),
    "nextFireAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardAuditLog" (
    "id" TEXT NOT NULL,
    "guildId" BIGINT,
    "actorId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guild_locale_idx" ON "Guild"("locale");

-- CreateIndex
CREATE INDEX "Playlist_ownerId_idx" ON "Playlist"("ownerId");

-- CreateIndex
CREATE INDEX "Playlist_guildId_idx" ON "Playlist"("guildId");

-- CreateIndex
CREATE INDEX "Warn_guildId_userId_idx" ON "Warn"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Warn_guildId_active_idx" ON "Warn"("guildId", "active");

-- CreateIndex
CREATE INDEX "ModLog_guildId_createdAt_idx" ON "ModLog"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "ModLog_guildId_targetUserId_idx" ON "ModLog"("guildId", "targetUserId");

-- CreateIndex
CREATE INDEX "ModLog_guildId_type_idx" ON "ModLog"("guildId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AutomodRule_guildId_type_key" ON "AutomodRule"("guildId", "type");

-- CreateIndex
CREATE INDEX "ReactionRole_guildId_idx" ON "ReactionRole"("guildId");

-- CreateIndex
CREATE INDEX "ReactionRole_messageId_idx" ON "ReactionRole"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoRole_guildId_roleId_forBots_key" ON "AutoRole"("guildId", "roleId", "forBots");

-- CreateIndex
CREATE INDEX "LevelUser_guildId_xp_idx" ON "LevelUser"("guildId", "xp");

-- CreateIndex
CREATE INDEX "Giveaway_guildId_endsAt_idx" ON "Giveaway"("guildId", "endsAt");

-- CreateIndex
CREATE INDEX "Ticket_guildId_closedAt_idx" ON "Ticket"("guildId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCommand_guildId_name_key" ON "CustomCommand"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_guildId_name_key" ON "Tag"("guildId", "name");

-- CreateIndex
CREATE INDEX "ScheduledMessage_enabled_nextFireAt_idx" ON "ScheduledMessage"("enabled", "nextFireAt");

-- CreateIndex
CREATE INDEX "DashboardAuditLog_guildId_createdAt_idx" ON "DashboardAuditLog"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "DashboardAuditLog_actorId_createdAt_idx" ON "DashboardAuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warn" ADD CONSTRAINT "Warn_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModLog" ADD CONSTRAINT "ModLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomodRule" ADD CONSTRAINT "AutomodRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionRole" ADD CONSTRAINT "ReactionRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoRole" ADD CONSTRAINT "AutoRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelUser" ADD CONSTRAINT "LevelUser_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomCommand" ADD CONSTRAINT "CustomCommand_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardAuditLog" ADD CONSTRAINT "DashboardAuditLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
