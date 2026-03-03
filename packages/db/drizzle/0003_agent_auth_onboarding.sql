CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_email" varchar(255),
	"email_verified_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"limits_tier" varchar(20) DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_primary_email" ON "accounts" USING btree ("primary_email");
--> statement-breakpoint
CREATE INDEX "idx_accounts_status" ON "accounts" USING btree ("status");
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"thumbprint" varchar(255) NOT NULL,
	"public_key_jwk" jsonb NOT NULL,
	"label" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agents_thumbprint" ON "agents" USING btree ("thumbprint");
--> statement-breakpoint
CREATE INDEX "idx_agents_account" ON "agents" USING btree ("account_id");
--> statement-breakpoint

CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"email" varchar(255),
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_team_invites_token" ON "team_invites" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "idx_team_invites_team_status" ON "team_invites" USING btree ("team_id","status");
--> statement-breakpoint

CREATE TABLE "email_otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"otp_hash" varchar(255) NOT NULL,
	"purpose" varchar(50) DEFAULT 'verify_email' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_otp_challenges" ADD CONSTRAINT "email_otp_challenges_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_email_otp_account" ON "email_otp_challenges" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "idx_email_otp_expires" ON "email_otp_challenges" USING btree ("expires_at");
--> statement-breakpoint

CREATE TABLE "agent_auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge" varchar(255) NOT NULL,
	"public_key_jwk" varchar(4000) NOT NULL,
	"label" varchar(255),
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_auth_challenge" ON "agent_auth_challenges" USING btree ("challenge");
--> statement-breakpoint
CREATE INDEX "idx_agent_auth_expires" ON "agent_auth_challenges" USING btree ("expires_at");
--> statement-breakpoint

CREATE TABLE "account_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(255) NOT NULL,
	"account_id" uuid NOT NULL,
	"client_id" varchar(255) DEFAULT 'agentsync-onboarding' NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "account_refresh_tokens" ADD CONSTRAINT "account_refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_account_refresh_account" ON "account_refresh_tokens" USING btree ("account_id");
