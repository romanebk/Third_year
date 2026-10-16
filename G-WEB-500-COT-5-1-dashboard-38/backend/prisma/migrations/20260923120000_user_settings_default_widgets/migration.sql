-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weatherCity" TEXT NOT NULL DEFAULT 'Paris',
    "weatherUnit" TEXT NOT NULL DEFAULT 'celsius',
    "githubRepository" TEXT NOT NULL DEFAULT 'vercel/next.js',
    "rssFeedUrl" TEXT NOT NULL DEFAULT 'https://hnrss.org/frontpage',
    "defaultsSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AlterTable
ALTER TABLE "WidgetInstance" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;