ALTER TABLE "records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_indexes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_relations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "org_isolation" ON "records";
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "records"
	USING ("team_id" = nullif(current_setting('app.current_team_id', true), '')::uuid)
	WITH CHECK ("team_id" = nullif(current_setting('app.current_team_id', true), '')::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "org_isolation" ON "record_indexes";
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "record_indexes"
	USING ("team_id" = nullif(current_setting('app.current_team_id', true), '')::uuid)
	WITH CHECK ("team_id" = nullif(current_setting('app.current_team_id', true), '')::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "org_isolation" ON "record_relations";
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "record_relations"
	USING ("team_id" = nullif(current_setting('app.current_team_id', true), '')::uuid)
	WITH CHECK ("team_id" = nullif(current_setting('app.current_team_id', true), '')::uuid);
