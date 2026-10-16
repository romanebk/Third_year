-- CreateTable
CREATE TABLE "ServiceSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscription_userId_service_key" ON "ServiceSubscription"("userId", "service");

-- AddForeignKey
ALTER TABLE "ServiceSubscription" ADD CONSTRAINT "ServiceSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
