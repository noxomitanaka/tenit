DROP INDEX `lesson_slot_lesson_date_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_slot_lesson_date_time_idx` ON `lesson_slot` (`lesson_id`,`date`,`start_time`);--> statement-breakpoint
DROP INDEX `monthly_fee_member_month_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_fee_member_month_idx` ON `monthly_fee` (`member_id`,`month`);