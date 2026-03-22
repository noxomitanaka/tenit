CREATE TABLE `line_link_pin` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`pin` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade
);
