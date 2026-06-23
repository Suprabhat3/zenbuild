-- CreateTable
CREATE TABLE "intake_key" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "intake_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intake_key_token_key" ON "intake_key"("token");

-- CreateIndex
CREATE UNIQUE INDEX "intake_key_organizationId_key" ON "intake_key"("organizationId");

-- AddForeignKey
ALTER TABLE "intake_key" ADD CONSTRAINT "intake_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
