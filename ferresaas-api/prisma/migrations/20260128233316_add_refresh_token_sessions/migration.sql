-- CreateTable
CREATE TABLE "refresh_token_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tokenFamily" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "reuseDetected" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "refresh_token_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_sessions_tokenHash_key" ON "refresh_token_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_userId_idx" ON "refresh_token_sessions"("userId");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_businessId_idx" ON "refresh_token_sessions"("businessId");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_tokenFamily_idx" ON "refresh_token_sessions"("tokenFamily");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_tokenHash_idx" ON "refresh_token_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_expiresAt_idx" ON "refresh_token_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "refresh_token_sessions" ADD CONSTRAINT "refresh_token_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token_sessions" ADD CONSTRAINT "refresh_token_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
