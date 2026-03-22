CREATE INDEX `attendance_slot_member_idx` ON `attendance` (`lesson_slot_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `lesson_slot_lesson_date_idx` ON `lesson_slot` (`lesson_id`,`date`);--> statement-breakpoint
CREATE INDEX `monthly_fee_member_month_idx` ON `monthly_fee` (`member_id`,`month`);--> statement-breakpoint
CREATE INDEX `substitution_credit_member_idx` ON `substitution_credit` (`member_id`);--> statement-breakpoint
CREATE INDEX `tournament_entry_tournament_member_idx` ON `tournament_entry` (`tournament_id`,`member_id`);