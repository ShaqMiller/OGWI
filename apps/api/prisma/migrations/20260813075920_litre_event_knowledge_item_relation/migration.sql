-- AddForeignKey
ALTER TABLE "litre_events" ADD CONSTRAINT "litre_events_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
