CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_owner_type_name` ON `categories` (`owner_id`,`type`,`name`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `paid_by_person_id` integer REFERENCES people(id);