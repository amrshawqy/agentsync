ALTER TABLE "accounts" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_accounts_super_admin" ON "accounts" USING btree ("is_super_admin");
--> statement-breakpoint
CREATE TABLE "setup_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_setup_tokens_hash" ON "setup_tokens" USING btree ("token_hash");
