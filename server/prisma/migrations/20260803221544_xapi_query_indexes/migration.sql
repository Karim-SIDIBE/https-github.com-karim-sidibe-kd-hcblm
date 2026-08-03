-- DropIndex
DROP INDEX "XapiStatement_forwarded_idx";

-- CreateIndex
CREATE INDEX "XapiStatement_forwarded_storedAt_idx" ON "XapiStatement"("forwarded", "storedAt");

-- CreateIndex
CREATE INDEX "XapiStatement_verb_storedAt_idx" ON "XapiStatement"("verb", "storedAt");

-- CreateIndex
CREATE INDEX "XapiStatement_storedAt_idx" ON "XapiStatement"("storedAt");
