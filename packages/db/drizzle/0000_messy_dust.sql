CREATE TYPE "public"."check_status" AS ENUM('passed', 'issue_found', 'not_applicable', 'unable_to_verify');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_mode" AS ENUM('passive', 'verified_active');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('dns_txt', 'html_meta');--> statement-breakpoint
CREATE TABLE "check_metadata" (
	"check_id" varchar(20) PRIMARY KEY NOT NULL,
	"version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"module" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"detector_path" varchar(255) NOT NULL,
	"required_evidence" jsonb NOT NULL,
	"method" varchar(100) NOT NULL,
	"enabled_in_wave" varchar(10) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remediation_template" text NOT NULL,
	"exposure_model_id" varchar(50),
	"legal_references" jsonb,
	"last_reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"evidence_type" varchar(100) NOT NULL,
	"page_url" text,
	"source_locator" text,
	"blob_key" text,
	"structured_value" jsonb NOT NULL,
	"content_hash" varchar(64),
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exposure_models" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"statutory_max_inr" numeric(14, 2),
	"plausible_direct_cost_min_inr" numeric(14, 2),
	"plausible_direct_cost_max_inr" numeric(14, 2),
	"remediation_cost_estimate_inr" numeric(14, 2),
	"operational_impact" text NOT NULL,
	"statutory_basis" text NOT NULL,
	"review_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"check_id" varchar(20) NOT NULL,
	"status" "check_status" NOT NULL,
	"severity" "severity",
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"reason_code" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"remediation" text,
	"exposure_details" jsonb,
	"requires_human_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"prompt_version" varchar(50) NOT NULL,
	"model_id" varchar(50) NOT NULL,
	"check_id" varchar(20) NOT NULL,
	"structured_output" jsonb NOT NULL,
	"verbatim_quote" text NOT NULL,
	"quote_verified" boolean NOT NULL,
	"token_usage" jsonb NOT NULL,
	"cost_estimate" numeric(8, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"email" text NOT NULL,
	"provider" varchar(50) DEFAULT 'razorpay' NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"payment_id" varchar(100),
	"signature" varchar(255),
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"webhook_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"stage" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"target_host" varchar(255) NOT NULL,
	"mode" "scan_mode" DEFAULT 'passive' NOT NULL,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"score" integer,
	"scanner_version" varchar(50) NOT NULL,
	"rule_library_version" varchar(50) NOT NULL,
	"snapshot_schema_version" varchar(50) DEFAULT '1.0.0' NOT NULL,
	"ip_hash" varchar(64),
	"authorisation_acknowledged" boolean DEFAULT true NOT NULL,
	"terms_version" varchar(50) DEFAULT 'v1' NOT NULL,
	"report_token_hash" varchar(64),
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_unlocked_at" timestamp with time zone,
	"parent_scan_id" uuid,
	"error_code" varchar(100),
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(255) NOT NULL,
	"method" "verification_method" NOT NULL,
	"token" varchar(128) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_check_id_check_metadata_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."check_metadata"("check_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_cache" ADD CONSTRAINT "llm_cache_check_id_check_metadata_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."check_metadata"("check_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_metadata_module_idx" ON "check_metadata" USING btree ("module");--> statement-breakpoint
CREATE INDEX "check_metadata_wave_idx" ON "check_metadata" USING btree ("enabled_in_wave");--> statement-breakpoint
CREATE INDEX "evidence_scan_id_idx" ON "evidence" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "evidence_type_idx" ON "evidence" USING btree ("evidence_type");--> statement-breakpoint
CREATE INDEX "exposure_models_jurisdiction_idx" ON "exposure_models" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "findings_scan_id_idx" ON "findings" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "findings_check_id_idx" ON "findings" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "findings_status_idx" ON "findings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "llm_cache_hash_prompt_model_idx" ON "llm_cache" USING btree ("content_hash","prompt_version","model_id","check_id");--> statement-breakpoint
CREATE INDEX "payments_scan_id_idx" ON "payments" USING btree ("scan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_payment_id_idx" ON "payments" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "scan_events_scan_id_idx" ON "scan_events" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "scan_events_timestamp_idx" ON "scan_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "scans_target_host_idx" ON "scans" USING btree ("target_host");--> statement-breakpoint
CREATE INDEX "scans_status_idx" ON "scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scans_created_at_idx" ON "scans" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scans_report_token_hash_idx" ON "scans" USING btree ("report_token_hash");--> statement-breakpoint
CREATE INDEX "verifications_domain_idx" ON "verifications" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_token_hash_idx" ON "verifications" USING btree ("token_hash");