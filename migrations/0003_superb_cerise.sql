CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_slot_id` text NOT NULL,
	`member_id` text NOT NULL,
	`method` text DEFAULT 'manual' NOT NULL,
	`marked_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`marked_by` text,
	FOREIGN KEY (`lesson_slot_id`) REFERENCES `lesson_slot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`marked_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `broadcast_message` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`target_type` text DEFAULT 'all' NOT NULL,
	`target_id` text,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`sent_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
