CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`vendor` text NOT NULL,
	`location` text NOT NULL,
	`cost` real NOT NULL,
	`comments` text,
	`trip_name` text NOT NULL,
	`receipt_path` text,
	`created_at` integer DEFAULT '"2025-04-02T01:22:27.396Z"',
	`updated_at` integer DEFAULT '"2025-04-02T01:22:27.396Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT '"2025-04-02T01:22:27.396Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`phone_number` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`bio` text,
	`created_at` integer DEFAULT '"2025-04-02T01:22:27.395Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);