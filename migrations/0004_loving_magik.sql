CREATE TABLE `monthly_fee` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`stripe_payment_intent_id` text,
	`stripe_checkout_session_id` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `club_settings` ADD `default_monthly_fee` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `club_settings` ADD `stripe_publishable_key` text;--> statement-breakpoint
ALTER TABLE `club_settings` ADD `stripe_secret_key` text;--> statement-breakpoint
ALTER TABLE `club_settings` ADD `stripe_webhook_secret` text;--> statement-breakpoint
ALTER TABLE `member` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `member` ADD `monthly_fee` integer;