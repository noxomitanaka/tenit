CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `club_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`line_channel_access_token` text,
	`line_channel_secret` text,
	`substitution_deadline_days` integer DEFAULT 31 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `court` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`surface` text,
	`is_indoor` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`level` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`cancel_reason` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lesson` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`coach_id` text,
	`court_id` text,
	`group_id` text,
	`type` text DEFAULT 'lesson' NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_day_of_week` integer,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`max_participants` integer,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`coach_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`court_id`) REFERENCES `court`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `member_group` (
	`member_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`member_id`, `group_id`),
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member` (
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
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_slot_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`is_substitution` integer DEFAULT false NOT NULL,
	`original_reservation_id` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`lesson_slot_id`) REFERENCES `lesson_slot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `substitution_credit` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`source_reservation_id` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_reservation_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`role` text DEFAULT 'member' NOT NULL,
	`hashed_password` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
