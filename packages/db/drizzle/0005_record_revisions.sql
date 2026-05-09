CREATE TABLE "record_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"revision_kind" varchar(16) NOT NULL,
	"data" jsonb NOT NULL,
	"provenance" jsonb,
	"note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_record_id_records_id_fk"
	FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_team_id_teams_id_fk"
	FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_created_by_users_id_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_record_revisions_record" ON "record_revisions" USING btree ("record_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_record_revisions_team_created" ON "record_revisions" USING btree ("team_id","created_at");
