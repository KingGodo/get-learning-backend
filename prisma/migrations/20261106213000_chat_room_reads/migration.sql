-- CreateTable
CREATE TABLE "ChatRoomRead" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoomRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatRoomRead_userId_idx" ON "ChatRoomRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomRead_roomId_userId_key" ON "ChatRoomRead"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "ChatRoomRead" ADD CONSTRAINT "ChatRoomRead_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomRead" ADD CONSTRAINT "ChatRoomRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
