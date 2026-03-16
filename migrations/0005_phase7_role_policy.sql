PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_substitution_credit` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`source_reservation_id` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_reservation_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_substitution_credit`("id", "member_id", "source_reservation_id", "expires_at", "used_at", "used_reservation_id", "created_at") SELECT "id", "member_id", "source_reservation_id", "expires_at", "used_at", "used_reservation_id", "created_at" FROM `substitution_credit`;--> statement-breakpoint
DROP TABLE `substitution_credit`;--> statement-breakpoint
ALTER TABLE `__new_substitution_credit` RENAME TO `substitution_credit`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `club_settings` ADD `cancellation_deadline_hours` integer DEFAULT 24 NOT NULL;--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `reservation_slot_member_idx` ON `reservation` (`lesson_slot_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `__new_member` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`name_kana` text,
	`email` text,
	`phone` text,
	`level` text DEFAULT 'beginner',
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer,
	`left_at` integer,
	`parent_member_id` text,
	`line_user_id` text,
	`stripe_customer_id` text,
	`monthly_fee` integer,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_member`("id", "user_id", "name", "name_kana", "email", "phone", "level", "status", "joined_at", "left_at", "parent_member_id", "line_user_id", "stripe_customer_id", "monthly_fee", "notes", "created_at") SELECT "id", "user_id", "name", "name_kana", "email", "phone", "level", "status", "joined_at", "left_at", "parent_member_id", "line_user_id", "stripe_customer_id", "monthly_fee", "notes", "created_at" FROM `member`;--> statement-breakpoint
DROP TABLE `member`;--> statement-breakpoint
ALTER TABLE `__new_member` RENAME TO `member`;