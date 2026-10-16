-- CreateTable
CREATE TABLE "WidgetInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "widget" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "refreshRateSeconds" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WidgetInstance_userId_idx" ON "WidgetInstance"("userId");

-- AddForeignKey
ALTER TABLE "WidgetInstance" ADD CONSTRAINT "WidgetInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
