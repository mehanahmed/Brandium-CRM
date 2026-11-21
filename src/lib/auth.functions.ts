import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";

import { getMySQLConfig, getMySQLTimestamp } from "./mysql-client";
import { MATRIX_EXTRA_PERMISSIONS } from "./permission-matrix";

// Schema bootstrap latch. On globalThis: `next dev` loads this module once per route bundle,
// and a plain module variable re-ran the whole DDL in each one.
type SchemaLatch = { done: boolean; running: Promise<void> | null; failedAt: number };
const latchStore = globalThis as typeof globalThis & { __brandiumSchemaLatch?: SchemaLatch };
const latch: SchemaLatch = (latchStore.__brandiumSchemaLatch ??= {
  done: false,
  running: null,
  failedAt: 0,
});
// After a failed bootstrap, requests skip it for a minute instead of re-running all DDL each time
const RETRY_AFTER_MS = 60_000;

/**
 * ERP-Style Enterprise Automatic Database Schema Bootstrapper.
 * Automatically checks and creates all missing tables & columns on connection with one-time execution cache.
 */
export async function ensureMySQLTablesExist(
  conn: mysql.Connection,
  dbName?: string,
): Promise<void> {
  if (latch.done) return;
  if (latch.running) return latch.running;
  if (Date.now() - latch.failedAt < RETRY_AFTER_MS) return;

  latch.running = (async () => {
    const targetDb = dbName || getMySQLConfig().database;
    try {
      // Disable foreign key checks for safe table bootstrapping
      await conn.query("SET FOREIGN_KEY_CHECKS = 0;");
      // Hosted MySQL users often lack ALTER on the database; tables still get utf8mb4 below
      try {
        await conn.query(
          `ALTER DATABASE \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        );
      } catch (err) {
        console.warn("Could not set the database charset (continuing):", err);
      }

      // Auto-delete \`user_avatars\` table if it exists in MySQL
      try {
        await conn.query("DROP TABLE IF EXISTS `user_avatars`;");
      } catch {
        // Ignore
      }

      // 1. \`users\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('ADMIN', 'AGENT') NOT NULL DEFAULT 'AGENT',
        \`status\` ENUM('Active', 'Inactive', 'Deleted') NOT NULL DEFAULT 'Active',
        \`avatar_url\` LONGTEXT NULL,
        \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`deleted_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 2. \`profiles\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`profiles\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`full_name\` VARCHAR(255) NULL,
        \`email\` VARCHAR(255) NULL,
        \`avatar_url\` LONGTEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_profiles_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 4. \`user_roles\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`user_roles\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`role\` ENUM('admin', 'agent') NOT NULL DEFAULT 'agent',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_roles_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 5. \`services\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`services\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_services_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 6. \`stages\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`stages\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`stage_group\` VARCHAR(100) NOT NULL DEFAULT 'prospect',
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`color\` VARCHAR(50) NULL,
        \`icon\` VARCHAR(50) NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`is_follow_up\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_system\` TINYINT(1) NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_stages_group_sort\` (\`stage_group\`, \`sort_order\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 7. \`prospects\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`prospects\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`contact_name\` VARCHAR(255) NOT NULL,
        \`business_name\` VARCHAR(255) NULL,
        \`designation\` VARCHAR(150) NULL,
        \`phone\` VARCHAR(50) NULL,
        \`alternative_phone\` VARCHAR(50) NULL,
        \`email\` VARCHAR(255) NULL,
        \`address\` TEXT NULL,
        \`website_url\` VARCHAR(500) NULL,
        \`logo_url\` VARCHAR(500) NULL,
        \`service_id\` VARCHAR(36) NULL,
        \`stage_id\` VARCHAR(36) NULL,
        \`assigned_to\` VARCHAR(36) NULL,
        \`created_by\` VARCHAR(36) NULL,
        \`notes\` TEXT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_prospects_stage\` (\`stage_id\`),
        KEY \`idx_prospects_assigned\` (\`assigned_to\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 8. \`prospect_stage_history\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`prospect_stage_history\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`prospect_id\` VARCHAR(36) NOT NULL,
        \`from_stage_id\` VARCHAR(36) NULL,
        \`to_stage_id\` VARCHAR(36) NOT NULL,
        \`changed_by\` VARCHAR(36) NULL,
        \`note\` TEXT NULL,
        \`changed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_psh_prospect\` (\`prospect_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 9. \`sales\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`sales\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`prospect_id\` VARCHAR(36) NULL,
        \`service_id\` VARCHAR(36) NULL,
        \`agent_id\` VARCHAR(36) NULL,
        \`amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`paid_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'closed',
        \`closed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_sales_prospect\` (\`prospect_id\`),
        KEY \`idx_sales_agent\` (\`agent_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 10a. \`followup_stages\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`followup_stages\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(100) NOT NULL,
        \`color\` VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
        \`position\` INT NOT NULL DEFAULT 0,
        \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_by\` VARCHAR(36) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_followup_stages_name\` (\`name\`),
        KEY \`idx_followup_stages_position\` (\`position\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 11. \`activities\` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`activities\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`prospect_id\` VARCHAR(36) NULL,
        \`actor_id\` VARCHAR(36) NULL,
        \`activity_type\` VARCHAR(100) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_activities_prospect\` (\`prospect_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 12. `meetings` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meetings\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`prospect_id\` VARCHAR(36) NULL,
        \`phone\` VARCHAR(50) NULL,
        \`location\` VARCHAR(255) NULL,
        \`meeting_type\` VARCHAR(50) NOT NULL DEFAULT 'Office',
        \`meeting_date\` VARCHAR(20) NULL,
        \`meeting_time\` VARCHAR(20) NULL,
        \`assigned_user_id\` VARCHAR(36) NULL,
        \`assigned_to\` VARCHAR(36) NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`scheduled_at\` DATETIME NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
        \`sms_sent\` TINYINT(1) NOT NULL DEFAULT 0,
        \`notes\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_meetings_prospect\` (\`prospect_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 13. `opportunities` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`opportunities\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`prospect_id\` VARCHAR(36) NOT NULL,
        \`value\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`estimated_value\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`stage\` VARCHAR(100) NOT NULL DEFAULT 'qualification',
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'Opportunity Created',
        \`assigned_to\` VARCHAR(36) NULL,
        \`created_by\` VARCHAR(36) NULL,
        \`notes\` TEXT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`expected_close_date\` DATE NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_opportunities_prospect\` (\`prospect_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 14. `invoices` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`invoices\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`prospect_id\` VARCHAR(36) NULL,
        \`invoice_number\` VARCHAR(100) NOT NULL,
        \`total_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`paid_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`due_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`description\` TEXT NULL,
        \`bill_date\` VARCHAR(20) NULL,
        \`due_date\` VARCHAR(20) NULL,
        \`notes\` TEXT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'Pending',
        \`created_by\` VARCHAR(36) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_invoices_prospect\` (\`prospect_id\`),
        KEY \`idx_invoices_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 15. `payments` table
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`payments\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`invoice_id\` VARCHAR(36) NULL,
        \`prospect_id\` VARCHAR(36) NULL,
        \`amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`payment_method\` VARCHAR(100) NOT NULL DEFAULT 'Bank Transfer',
        \`transaction_reference\` VARCHAR(100) NULL,
        \`notes\` TEXT NULL,
        \`recorded_by\` VARCHAR(36) NULL,
        \`payment_date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`is_valid\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_payments_invoice\` (\`invoice_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // 16. `sessions` table — stores auth sessions server-side
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`sessions\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`user_email\` VARCHAR(255) NOT NULL,
          \`user_name\` VARCHAR(255) NOT NULL,
          \`user_role\` ENUM('admin', 'agent') NOT NULL DEFAULT 'agent',
          \`avatar_url\` LONGTEXT NULL,
          \`expires_at\` DATETIME NOT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_sessions_user\` (\`user_id\`),
          KEY \`idx_sessions_expires\` (\`expires_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // `sms_gateway_settings` — single-row SMS provider config (MRAM Technologies)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`sms_gateway_settings\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`provider\` VARCHAR(100) NOT NULL DEFAULT 'MRAM Technologies',
          \`api_url\` VARCHAR(500) NOT NULL DEFAULT 'https://sms.mram.com.bd/smsapi',
          \`balance_url\` VARCHAR(500) NOT NULL DEFAULT 'https://sms.mram.com.bd/miscapi/{API_KEY}/getBalance',
          \`api_key\` VARCHAR(255) NULL,
          \`sender_id\` VARCHAR(50) NULL,
          \`label\` VARCHAR(20) NOT NULL DEFAULT 'transactional',
          \`is_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
          \`updated_by\` VARCHAR(36) NULL,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await conn.query("INSERT IGNORE INTO `sms_gateway_settings` (`id`) VALUES ('default');");

      // `telegram_settings` — single-row Telegram bot config for payment notifications
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`telegram_settings\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`bot_token\` VARCHAR(255) NULL,
          \`chat_ids\` TEXT NULL,
          \`app_url\` VARCHAR(500) NULL,
          \`is_enabled\` TINYINT(1) NOT NULL DEFAULT 0,
          \`notify_payment_add\` TINYINT(1) NOT NULL DEFAULT 1,
          \`notify_payment_adjust\` TINYINT(1) NOT NULL DEFAULT 1,
          \`updated_by\` VARCHAR(36) NULL,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await conn.query("INSERT IGNORE INTO `telegram_settings` (`id`) VALUES ('default');");

      // `app_settings` — single-row app settings: invoice/quotation letterhead, maintenance mode
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`app_settings\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`invoice_bg_url\` VARCHAR(500) NULL,
          \`maintenance_mode\` TINYINT(1) NOT NULL DEFAULT 0,
          \`maintenance_message\` TEXT NULL,
          \`updated_by\` VARCHAR(36) NULL,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await conn.query("INSERT IGNORE INTO `app_settings` (`id`) VALUES ('default');");

      // `telegram_payment_notices` — one row per payment sent to Telegram (the key stops repeats)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`telegram_payment_notices\` (
          \`payment_id\` VARCHAR(64) NOT NULL,
          \`order_id\` VARCHAR(36) NOT NULL,
          \`order_number\` VARCHAR(50) NULL,
          \`kind\` VARCHAR(20) NOT NULL,
          \`amount\` DECIMAL(14,2) NOT NULL DEFAULT 0,
          \`status\` VARCHAR(20) NOT NULL,
          \`response\` TEXT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`payment_id\`),
          KEY \`idx_tg_notice_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // `sms_logs` — one row per SMS attempt, written by the server after the gateway replies
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`sms_logs\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`recipient_phone\` VARCHAR(20) NOT NULL,
          \`recipient_name\` VARCHAR(255) NULL,
          \`prospect_id\` VARCHAR(36) NULL,
          \`message\` TEXT NOT NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'Sent',
          \`mode\` VARCHAR(20) NOT NULL DEFAULT 'Single',
          \`provider_response\` TEXT NULL,
          \`sent_by\` VARCHAR(36) NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_sms_logs_created\` (\`created_at\`),
          KEY \`idx_sms_logs_sent_by\` (\`sent_by\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 17. `projects` table — ERPApp-style Projects & Creative Production Lifecycle
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`projects\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`project_code\` VARCHAR(50) NOT NULL,
          \`title\` VARCHAR(255) NOT NULL,
          \`prospect_id\` VARCHAR(36) NULL,
          \`client_name\` VARCHAR(255) NOT NULL,
          \`service_id\` VARCHAR(36) NULL,
          \`status\` VARCHAR(50) NOT NULL DEFAULT 'Project Started',
          \`assigned_agent_id\` VARCHAR(36) NULL,
          \`assigned_artist_id\` VARCHAR(36) NULL,
          \`assigned_user_ids\` TEXT NULL,
          \`budget\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`paid_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`progress\` INT NOT NULL DEFAULT 0,
          \`order_date\` DATE NULL,
          \`deadline\` DATE NULL,
          \`notes\` TEXT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_projects_code\` (\`project_code\`),
          KEY \`idx_projects_status\` (\`status\`),
          KEY \`idx_projects_prospect\` (\`prospect_id\`),
          KEY \`idx_projects_artist\` (\`assigned_artist_id\`),
          KEY \`idx_projects_agent\` (\`assigned_agent_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`project_assignees\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`project_id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`role\` VARCHAR(50) NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_proj_user\` (\`project_id\`, \`user_id\`),
          KEY \`idx_proj_assignee_project\` (\`project_id\`),
          KEY \`idx_proj_assignee_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 17b. `quotations` table — Client Quotations (cloned from Projects lifecycle)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`quotations\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`quotation_code\` VARCHAR(50) NOT NULL,
          \`title\` VARCHAR(255) NOT NULL,
          \`prospect_id\` VARCHAR(36) NULL,
          \`client_name\` VARCHAR(255) NOT NULL,
          \`client_phone\` VARCHAR(50) NULL,
          \`client_email\` VARCHAR(255) NULL,
          \`service_id\` VARCHAR(36) NULL,
          \`status\` VARCHAR(50) NOT NULL DEFAULT 'Draft',
          \`priority\` VARCHAR(20) NOT NULL DEFAULT 'Medium',
          \`assigned_agent_id\` VARCHAR(36) NULL,
          \`assigned_artist_id\` VARCHAR(36) NULL,
          \`assigned_user_ids\` TEXT NULL,
          \`created_by\` VARCHAR(36) NULL,
          \`budget\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`paid_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`advance_payments\` LONGTEXT NULL,
          \`progress\` INT NOT NULL DEFAULT 0,
          \`order_date\` DATE NULL,
          \`deadline\` DATE NULL,
          \`notes\` TEXT NULL,
          \`status_history\` LONGTEXT NULL,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_quotations_code\` (\`quotation_code\`),
          KEY \`idx_quotations_status\` (\`status\`),
          KEY \`idx_quotations_prospect\` (\`prospect_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`quotation_assignees\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`quotation_id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`role\` VARCHAR(50) NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_quot_user\` (\`quotation_id\`, \`user_id\`),
          KEY \`idx_quot_assignee_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 17c. \`orders\` table — ERPApp-style Orders (/orders & /track/[id])
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`orders\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`order_number\` VARCHAR(50) NOT NULL,
          \`job_id\` VARCHAR(100) NULL,
          \`prospect_id\` VARCHAR(36) NULL,
          \`client_name\` VARCHAR(255) NOT NULL,
          \`company_name\` VARCHAR(255) NULL,
          \`phone\` VARCHAR(50) NULL,
          \`email\` VARCHAR(255) NULL,
          \`address\` TEXT NULL,
          \`service_id\` VARCHAR(36) NULL,
          \`service_name\` VARCHAR(255) NULL,
          \`status\` VARCHAR(50) NOT NULL DEFAULT 'order-submitted',
          \`crm_user_id\` VARCHAR(36) NULL,
          \`designer_id\` VARCHAR(36) NULL,
          \`total_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`paid_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`due_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`discount_amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`shipping_charge\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`is_starred\` DECIMAL(3, 1) NOT NULL DEFAULT 0,
          \`items_json\` LONGTEXT NULL,
          \`payments_json\` LONGTEXT NULL,
          \`status_history\` LONGTEXT NULL,
          \`notes\` TEXT NULL,
          \`order_date\` DATETIME NULL,
          \`delivery_date\` DATETIME NULL,
          \`is_deleted\` TINYINT(1) NOT NULL DEFAULT 0,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_orders_number\` (\`order_number\`),
          KEY \`idx_orders_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`order_comments\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`order_id\` VARCHAR(36) NOT NULL,
          \`parent_id\` VARCHAR(36) NULL,
          \`user_id\` VARCHAR(36) NULL,
          \`user_name\` VARCHAR(255) NOT NULL,
          \`user_role\` VARCHAR(50) NULL,
          \`text\` TEXT NOT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_order_comments_order\` (\`order_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 18. \`expenses\` table — Finance & Operating Expense Management
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`expenses\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`title\` VARCHAR(255) NOT NULL,
          \`category\` VARCHAR(100) NOT NULL,
          \`amount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
          \`payment_method\` VARCHAR(100) NOT NULL DEFAULT 'Cash',
          \`expense_date\` DATE NOT NULL,
          \`vendor\` VARCHAR(255) NULL,
          \`reference_no\` VARCHAR(100) NULL,
          \`receipt_url\` TEXT NULL,
          \`notes\` TEXT NULL,
          \`recorded_by\` VARCHAR(36) NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_expenses_category\` (\`category\`),
          KEY \`idx_expenses_date\` (\`expense_date\`),
          KEY \`idx_expenses_recorded\` (\`recorded_by\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 17. Production operations tables for tenancy, RBAC, migrations, audit, and outbox jobs
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`tenants\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`slug\` VARCHAR(120) NOT NULL,
        \`status\` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_tenants_slug\` (\`slug\`),
        KEY \`idx_tenants_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`memberships\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NOT NULL,
        \`status\` ENUM('active', 'inactive', 'invited') NOT NULL DEFAULT 'active',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_memberships_user_tenant\` (\`user_id\`, \`tenant_id\`),
        KEY \`idx_memberships_tenant\` (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`roles\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`tenant_id\` VARCHAR(36) NULL,
        \`name\` VARCHAR(80) NOT NULL,
        \`description\` VARCHAR(255) NULL,
        \`is_system\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_roles_scope_name\` (\`tenant_id\`, \`name\`),
        KEY \`idx_roles_tenant\` (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`permissions\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`resource\` VARCHAR(100) NOT NULL,
        \`action\` VARCHAR(80) NOT NULL,
        \`description\` VARCHAR(255) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_permissions_resource_action\` (\`resource\`, \`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`role_permissions\` (
        \`role_id\` VARCHAR(36) NOT NULL,
        \`permission_id\` VARCHAR(36) NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`role_id\`, \`permission_id\`),
        KEY \`idx_role_permissions_permission\` (\`permission_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // Admin-set order of the project (order) stages; stages without a row keep their code order
      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`order_stage_positions\` (
        \`stage_id\` VARCHAR(64) NOT NULL,
        \`position\` INT NOT NULL,
        PRIMARY KEY (\`stage_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
        \`id\` VARCHAR(64) NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`token_hash\` VARCHAR(255) NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`revoked_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_refresh_tokens_hash\` (\`token_hash\`),
        KEY \`idx_refresh_tokens_user\` (\`user_id\`),
        KEY \`idx_refresh_tokens_expires\` (\`expires_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`audit_events\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`actor_id\` VARCHAR(36) NULL,
        \`tenant_id\` VARCHAR(36) NULL,
        \`action\` VARCHAR(120) NOT NULL,
        \`resource\` VARCHAR(120) NOT NULL,
        \`resource_id\` VARCHAR(120) NULL,
        \`metadata\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_audit_actor\` (\`actor_id\`),
        KEY \`idx_audit_tenant_resource\` (\`tenant_id\`, \`resource\`, \`resource_id\`),
        KEY \`idx_audit_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`outbox_events\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`type\` VARCHAR(120) NOT NULL,
        \`aggregate_id\` VARCHAR(120) NULL,
        \`payload\` JSON NOT NULL,
        \`status\` ENUM('pending', 'processing', 'sent', 'failed', 'dead_letter') NOT NULL DEFAULT 'pending',
        \`attempts\` INT NOT NULL DEFAULT 0,
        \`available_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`last_error\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_outbox_status_available\` (\`status\`, \`available_at\`),
        KEY \`idx_outbox_aggregate\` (\`aggregate_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      await conn.query(`
      CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
        \`id\` VARCHAR(120) NOT NULL,
        \`checksum\` VARCHAR(128) NOT NULL,
        \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

      // Safe dynamic column migrations for existing tables
      const ensureColumns = [
        // meetings
        { table: "meetings", column: "assigned_user_id", def: "VARCHAR(36) NULL" },
        { table: "meetings", column: "assigned_to", def: "VARCHAR(36) NULL" },
        { table: "meetings", column: "phone", def: "VARCHAR(50) NULL" },
        { table: "meetings", column: "location", def: "VARCHAR(255) NULL" },
        { table: "meetings", column: "meeting_type", def: "VARCHAR(50) NOT NULL DEFAULT 'Office'" },
        { table: "meetings", column: "meeting_date", def: "VARCHAR(20) NULL" },
        { table: "meetings", column: "meeting_time", def: "VARCHAR(20) NULL" },
        { table: "meetings", column: "scheduled_at", def: "DATETIME NULL" },
        { table: "meetings", column: "status", def: "VARCHAR(50) NOT NULL DEFAULT 'Scheduled'" },
        { table: "meetings", column: "sms_sent", def: "TINYINT(1) NOT NULL DEFAULT 0" },
        { table: "meetings", column: "notes", def: "TEXT NULL" },
        // prospects
        { table: "prospects", column: "assigned_artist_id", def: "VARCHAR(36) NULL" },
        { table: "prospects", column: "business_name", def: "VARCHAR(255) NULL" },
        { table: "prospects", column: "logo_url", def: "TEXT NULL" },
        { table: "prospects", column: "address", def: "TEXT NULL" },
        { table: "prospects", column: "currency", def: "VARCHAR(10) NOT NULL DEFAULT 'USD'" },
        { table: "prospects", column: "lead_score", def: "INT NOT NULL DEFAULT 0" },
        { table: "prospects", column: "tags", def: "TEXT NULL" },
        { table: "prospects", column: "last_activity", def: "DATETIME NULL" },
        { table: "prospects", column: "website", def: "VARCHAR(255) NULL" },
        { table: "prospects", column: "city", def: "VARCHAR(100) NULL" },
        { table: "prospects", column: "country", def: "VARCHAR(100) NULL" },
        { table: "prospects", column: "state", def: "VARCHAR(100) NULL" },
        { table: "prospects", column: "priority", def: "VARCHAR(20) NULL" },
        { table: "prospects", column: "source", def: "VARCHAR(100) NULL" },
        { table: "prospects", column: "notes", def: "TEXT NULL" },
        // invoices
        { table: "invoices", column: "due_amount", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "invoices", column: "bill_date", def: "VARCHAR(20) NULL" },
        { table: "invoices", column: "due_date", def: "VARCHAR(20) NULL" },
        { table: "invoices", column: "description", def: "TEXT NULL" },
        { table: "invoices", column: "notes", def: "TEXT NULL" },
        { table: "invoices", column: "created_by", def: "VARCHAR(36) NULL" },
        // payments
        {
          table: "payments",
          column: "payment_method",
          def: "VARCHAR(100) NOT NULL DEFAULT 'Bank Transfer'",
        },
        { table: "payments", column: "transaction_reference", def: "VARCHAR(100) NULL" },
        { table: "payments", column: "notes", def: "TEXT NULL" },
        { table: "payments", column: "recorded_by", def: "VARCHAR(36) NULL" },
        { table: "payments", column: "is_valid", def: "TINYINT(1) NOT NULL DEFAULT 1" },
        // services
        { table: "services", column: "icon", def: "VARCHAR(50) NULL" },
        { table: "services", column: "is_active", def: "TINYINT(1) NOT NULL DEFAULT 1" },
        // opportunities
        {
          table: "opportunities",
          column: "estimated_value",
          def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00",
        },
        { table: "opportunities", column: "is_active", def: "TINYINT(1) NOT NULL DEFAULT 1" },
        { table: "opportunities", column: "expected_close_date", def: "DATE NULL" },
        // projects
        { table: "projects", column: "assigned_agent_id", def: "VARCHAR(36) NULL" },
        { table: "projects", column: "assigned_artist_id", def: "VARCHAR(36) NULL" },
        { table: "projects", column: "budget", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "projects", column: "paid_amount", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "projects", column: "progress", def: "INT NOT NULL DEFAULT 0" },
        { table: "projects", column: "deadline", def: "DATE NULL" },
        { table: "projects", column: "notes", def: "TEXT NULL" },
        { table: "projects", column: "created_by", def: "VARCHAR(36) NULL" },
        { table: "projects", column: "advance_payments", def: "LONGTEXT NULL" },
        // quotations
        { table: "quotations", column: "client_phone", def: "VARCHAR(50) NULL" },
        { table: "quotations", column: "terms", def: "LONGTEXT NULL" },
        { table: "quotations", column: "client_email", def: "VARCHAR(255) NULL" },
        { table: "quotations", column: "client_address", def: "TEXT NULL" },
        // orders
        { table: "orders", column: "job_id", def: "VARCHAR(100) NULL" },
        { table: "orders", column: "terms", def: "LONGTEXT NULL" },
        { table: "orders", column: "brief", def: "LONGTEXT NULL" },
        { table: "orders", column: "stage_briefs", def: "LONGTEXT NULL" },
        {
          table: "order_stage_positions",
          column: "is_hidden",
          def: "TINYINT(1) NOT NULL DEFAULT 0",
        },
        { table: "orders", column: "address", def: "TEXT NULL" },
        { table: "orders", column: "crm_user_id", def: "VARCHAR(36) NULL" },
        { table: "orders", column: "designer_id", def: "VARCHAR(36) NULL" },
        { table: "orders", column: "discount_amount", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "orders", column: "shipping_charge", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "orders", column: "is_starred", def: "DECIMAL(3, 1) NOT NULL DEFAULT 0" },
        { table: "orders", column: "items_json", def: "LONGTEXT NULL" },
        { table: "orders", column: "payments_json", def: "LONGTEXT NULL" },
        { table: "orders", column: "status_history", def: "LONGTEXT NULL" },
        { table: "orders", column: "order_date", def: "DATETIME NULL" },
        { table: "orders", column: "delivery_date", def: "DATETIME NULL" },
        { table: "orders", column: "is_deleted", def: "TINYINT(1) NOT NULL DEFAULT 0" },
        { table: "quotations", column: "priority", def: "VARCHAR(20) NOT NULL DEFAULT 'Medium'" },
        { table: "quotations", column: "assigned_agent_id", def: "VARCHAR(36) NULL" },
        { table: "quotations", column: "assigned_artist_id", def: "VARCHAR(36) NULL" },
        { table: "quotations", column: "assigned_user_ids", def: "TEXT NULL" },
        { table: "quotations", column: "created_by", def: "VARCHAR(36) NULL" },
        { table: "quotations", column: "budget", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "quotations", column: "paid_amount", def: "DECIMAL(12, 2) NOT NULL DEFAULT 0.00" },
        { table: "quotations", column: "advance_payments", def: "LONGTEXT NULL" },
        { table: "quotations", column: "progress", def: "INT NOT NULL DEFAULT 0" },
        { table: "quotations", column: "order_date", def: "DATE NULL" },
        { table: "quotations", column: "deadline", def: "DATE NULL" },
        { table: "quotations", column: "notes", def: "TEXT NULL" },
        { table: "quotations", column: "status_history", def: "LONGTEXT NULL" },
        { table: "quotations", column: "is_active", def: "TINYINT(1) NOT NULL DEFAULT 1" },
        // users & profiles
        { table: "users", column: "phone", def: "VARCHAR(50) NULL" },
        { table: "users", column: "avatar_url", def: "TEXT NULL" },
        { table: "users", column: "status", def: "VARCHAR(20) NOT NULL DEFAULT 'active'" },
        { table: "profiles", column: "phone", def: "VARCHAR(50) NULL" },
        { table: "profiles", column: "avatar_url", def: "TEXT NULL" },
        // prospects qualification
        { table: "prospects", column: "is_qualified", def: "TINYINT(1) NOT NULL DEFAULT 0" },
        { table: "prospects", column: "estimated_budget", def: "DECIMAL(12, 2) NULL" },
        { table: "prospects", column: "qualification_notes", def: "TEXT NULL" },
        // quotations protection
        { table: "quotations", column: "is_protected", def: "TINYINT(1) NOT NULL DEFAULT 0" },
        // expenses
        { table: "expenses", column: "receipt_url", def: "TEXT NULL" },
        { table: "expenses", column: "reference_no", def: "VARCHAR(100) NULL" },
        { table: "expenses", column: "vendor", def: "VARCHAR(255) NULL" },
        // follow-ups live on their stage history row (no separate table)
        { table: "prospect_stage_history", column: "follow_up_due_at", def: "DATETIME NULL" },
        {
          table: "prospect_stage_history",
          column: "follow_up_assigned_to",
          def: "VARCHAR(36) NULL",
        },
        { table: "prospect_stage_history", column: "follow_up_status", def: "VARCHAR(20) NULL" },
      ];

      for (const col of ensureColumns) {
        try {
          const [cols] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [col.table, col.column],
          );
          if (cols.length === 0) {
            await conn.query(
              `ALTER TABLE \`${col.table}\` ADD COLUMN \`${col.column}\` ${col.def}`,
            );
          }
        } catch {
          // Ignore if table does not exist yet or column already exists
        }
      }

      // Copy legacy `follow_ups` rows onto stage history (follow-ups no longer have a table).
      // Rows already written alongside a stage change get the follow-up fields; the rest are
      // inserted with the same id, so this is safe to re-run. Legacy due_at was UTC; +6h = Dhaka.
      try {
        const [legacyTables] = await conn.query<mysql.RowDataPacket[]>(
          "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'follow_ups'",
        );
        if (legacyTables.length > 0) {
          await conn.query(`
            UPDATE \`prospect_stage_history\` h
            JOIN \`follow_ups\` f ON f.prospect_id = h.prospect_id
              AND ABS(TIMESTAMPDIFF(SECOND, h.changed_at, f.created_at)) <= 120
            SET h.follow_up_due_at = DATE_ADD(f.due_at, INTERVAL 6 HOUR),
                h.follow_up_assigned_to = f.assigned_to,
                h.follow_up_status = f.status,
                h.changed_by = COALESCE(h.changed_by, f.created_by)
            WHERE h.follow_up_due_at IS NULL AND h.note LIKE '%Follow-up scheduled for%'
          `);
          await conn.query(`
            INSERT IGNORE INTO \`prospect_stage_history\`
              (id, prospect_id, from_stage_id, to_stage_id, changed_by, note, changed_at, created_at,
               follow_up_due_at, follow_up_assigned_to, follow_up_status)
            SELECT f.id, f.prospect_id, NULL,
              COALESCE((SELECT s.id FROM \`stages\` s WHERE LOWER(s.name) LIKE '%follow%' LIMIT 1), 'follow-up'),
              f.created_by, f.note, f.created_at, f.created_at,
              DATE_ADD(f.due_at, INTERVAL 6 HOUR), f.assigned_to, f.status
            FROM \`follow_ups\` f
            WHERE NOT EXISTS (
              SELECT 1 FROM \`prospect_stage_history\` h
              WHERE h.prospect_id = f.prospect_id AND h.follow_up_due_at IS NOT NULL
                AND ABS(TIMESTAMPDIFF(SECOND, h.changed_at, f.created_at)) <= 120
            )
          `);
        }
      } catch (err) {
        console.warn("Legacy follow_ups copy skipped:", err);
      }

      // Loosen strict NOT NULL constraints on legacy columns for smooth insertion
      const legacyModifications = [
        "ALTER TABLE `meetings` MODIFY COLUMN `scheduled_at` DATETIME NULL DEFAULT NULL;",
        "ALTER TABLE `meetings` MODIFY COLUMN `meeting_date` VARCHAR(20) NULL DEFAULT NULL;",
        "ALTER TABLE `meetings` MODIFY COLUMN `meeting_time` VARCHAR(20) NULL DEFAULT NULL;",
        "ALTER TABLE `meetings` MODIFY COLUMN `phone` VARCHAR(50) NULL DEFAULT NULL;",
        "ALTER TABLE `meetings` MODIFY COLUMN `location` VARCHAR(255) NULL DEFAULT NULL;",
        "ALTER TABLE `meetings` MODIFY COLUMN `assigned_user_id` VARCHAR(36) NULL DEFAULT NULL;",
        "ALTER TABLE `meetings` MODIFY COLUMN `assigned_to` VARCHAR(36) NULL DEFAULT NULL;",
      ];

      for (const modSql of legacyModifications) {
        try {
          await conn.query(modSql);
        } catch {
          // Ignore if table doesn't exist yet
        }
      }

      await conn.query(`
        INSERT INTO \`roles\` (\`id\`, \`tenant_id\`, \`name\`, \`description\`, \`is_system\`)
        VALUES
          ('role-global-admin', NULL, 'Admin', 'Platform administrator with full system access', 1),
          ('role-global-agent', NULL, 'Agent', 'CRM sales agent for telesales & prospect management', 1),
          ('role-global-artist', NULL, 'Artist', 'Creative artist for graphic designs, video ads & media assets', 1),
          ('role-stage-sw', NULL, 'SW', 'Script Writer: assigned the Script Writer project stage', 1),
          ('role-stage-cp', NULL, 'CP', 'Content Planner: assigned the Content Planner project stage', 1),
          ('role-stage-vg', NULL, 'VG', 'Videographer: assigned the Videographer project stage', 1),
          ('role-stage-ve', NULL, 'VE', 'Video Editor: assigned the Video Editor project stage', 1),
          ('role-stage-mk', NULL, 'MK', 'Marketer: assigned the Marketer project stage', 1),
          ('role-stage-dev', NULL, 'DEV', 'Developer: assigned the Developer project stage', 1)
        ON DUPLICATE KEY UPDATE \`is_system\` = 1, \`description\` = VALUES(\`description\`);
      `);

      // Pages that used to share one permission now have their own ([new id, old shared id]),
      // so changing one page in the Roles matrix no longer changes the other. On a new id's
      // first seed only, roles holding the old id get it too, so nobody loses access and a
      // later untick is not undone by a restart.
      const PERMISSION_SPLITS: [string, string][] = [
        ["perm-agent-reports-view", "perm-reports-view"],
        ["perm-scope-all-followups", "perm-scope-all-leads"],
        ["perm-scope-all-projects", "perm-scope-all-orders"],
      ];
      const [seededSplitRows] = await conn.query(
        "SELECT `id` FROM `permissions` WHERE `id` IN (?);",
        [PERMISSION_SPLITS.map(([id]) => id)],
      );
      const seededSplits = new Set((seededSplitRows as Array<{ id: string }>).map((r) => r.id));

      await conn.query(`
        INSERT INTO \`permissions\` (\`id\`, \`resource\`, \`action\`, \`description\`)
        VALUES
          ('perm-prospects-read', 'prospects', 'read', 'View prospects and lead records'),
          ('perm-prospects-write', 'prospects', 'write', 'Create and update prospects'),
          ('perm-prospects-delete', 'prospects', 'delete', 'Delete and manage prospects'),
          ('perm-prospects-export', 'prospects', 'export', 'Export prospects to CSV/Excel'),
          ('perm-opportunities-manage', 'opportunities', 'manage', 'Manage sales opportunities and deals'),
          ('perm-followups-manage', 'follow_ups', 'manage', 'Manage prospect follow-ups'),
          ('perm-meetings-manage', 'meetings', 'manage', 'Schedule and manage client meetings'),
          ('perm-quotations-read', 'quotations', 'read', 'View quotations and proposals'),
          ('perm-quotations-write', 'quotations', 'write', 'Create and edit quotations'),
          ('perm-quotations-delete', 'quotations', 'delete', 'Delete quotations'),
          ('perm-orders-read', 'orders', 'read', 'View client orders'),
          ('perm-orders-manage', 'orders', 'manage', 'Create and update client orders'),
          ('perm-projects-read', 'projects', 'read', 'View production projects'),
          ('perm-projects-manage', 'projects', 'manage', 'Create and manage projects'),
          ('perm-sales-view', 'sales', 'read', 'View won sales and achievements'),
          ('perm-services-read', 'services', 'read', 'View agency services and packages'),
          ('perm-services-manage', 'services', 'manage', 'Create and modify services'),
          ('perm-stages-manage', 'stages', 'manage', 'Configure pipeline stages'),
          ('perm-stage-history-view', 'stages', 'read', 'View stage transitions audit history'),
          ('perm-billing-read', 'billing', 'read', 'Read billing and invoice records'),
          ('perm-billing-write', 'billing', 'write', 'Create and collect payments/invoices'),
          ('perm-expenses-read', 'expenses', 'read', 'View operational expenses'),
          ('perm-expenses-manage', 'expenses', 'manage', 'Create and manage expenses'),
          ('perm-sms-send', 'sms', 'send', 'Send bulk SMS to clients'),
          ('perm-sms-logs', 'sms', 'read', 'View SMS delivery logs'),
          ('perm-reports-view', 'reports', 'read', 'View the Agent Activity log'),
          ('perm-agent-reports-view', 'agent_reports', 'read', 'View the Agent Reports leaderboard'),
          ('perm-scope-all-leads', 'leads', 'scope_all', 'See every user''s prospects'),
          ('perm-scope-all-followups', 'followups', 'scope_all', 'See every user''s follow-ups'),
          ('perm-scope-all-projects', 'projects', 'scope_all', 'See every user''s projects'),
          ('perm-scope-all-meetings', 'meetings', 'scope_all', 'See every user''s meetings'),
          ('perm-scope-all-quotations', 'quotations', 'scope_all', 'See every user''s quotations'),
          ('perm-scope-all-orders', 'orders', 'scope_all', 'See every user''s orders'),
          ('perm-scope-all-sms', 'sms', 'scope_all', 'See every user''s SMS logs'),
          ('perm-scope-all-expenses', 'expenses', 'scope_all', 'See every user''s expenses'),
          ('perm-admin-users', 'users', 'admin', 'Manage user accounts and credentials'),
          ('perm-admin-roles', 'roles', 'admin', 'Manage system roles and permissions'),
          ('perm-admin-sms-gateway', 'sms_gateway', 'admin', 'Configure SMS Gateway settings'),
          ('perm-admin-notifications', 'notifications', 'admin', 'Configure Telegram notifications'),
          ('perm-admin-settings', 'settings', 'admin', 'Change app settings and maintenance mode'),
          ('perm-admin-backup', 'backup', 'admin', 'Manage database backups and exports')
        ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`), \`resource\` = VALUES(\`resource\`), \`action\` = VALUES(\`action\`);
      `);

      // Per-box permissions of the Roles matrix (Edit / View / Delete of each page)
      await conn.query(
        "INSERT IGNORE INTO `permissions` (`id`, `resource`, `action`, `description`) VALUES ?",
        [MATRIX_EXTRA_PERMISSIONS.map((p) => [p.id, p.resource, p.action, p.description])],
      );
      await conn.query(
        "INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES ?",
        [MATRIX_EXTRA_PERMISSIONS.map((p) => ["role-global-admin", p.id])],
      );

      await conn.query(`
        INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
        VALUES
          ('role-global-admin', 'perm-prospects-read'),
          ('role-global-admin', 'perm-prospects-write'),
          ('role-global-admin', 'perm-prospects-delete'),
          ('role-global-admin', 'perm-prospects-export'),
          ('role-global-admin', 'perm-opportunities-manage'),
          ('role-global-admin', 'perm-followups-manage'),
          ('role-global-admin', 'perm-meetings-manage'),
          ('role-global-admin', 'perm-quotations-read'),
          ('role-global-admin', 'perm-quotations-write'),
          ('role-global-admin', 'perm-quotations-delete'),
          ('role-global-admin', 'perm-orders-read'),
          ('role-global-admin', 'perm-orders-manage'),
          ('role-global-admin', 'perm-projects-read'),
          ('role-global-admin', 'perm-projects-manage'),
          ('role-global-admin', 'perm-sales-view'),
          ('role-global-admin', 'perm-services-read'),
          ('role-global-admin', 'perm-services-manage'),
          ('role-global-admin', 'perm-stages-manage'),
          ('role-global-admin', 'perm-stage-history-view'),
          ('role-global-admin', 'perm-billing-read'),
          ('role-global-admin', 'perm-billing-write'),
          ('role-global-admin', 'perm-expenses-read'),
          ('role-global-admin', 'perm-expenses-manage'),
          ('role-global-admin', 'perm-sms-send'),
          ('role-global-admin', 'perm-sms-logs'),
          ('role-global-admin', 'perm-reports-view'),
          ('role-global-admin', 'perm-agent-reports-view'),
          ('role-global-admin', 'perm-admin-users'),
          ('role-global-admin', 'perm-admin-roles'),
          ('role-global-admin', 'perm-admin-sms-gateway'),
          ('role-global-admin', 'perm-admin-notifications'),
          ('role-global-admin', 'perm-admin-settings'),
          ('role-global-admin', 'perm-admin-backup'),

          ('role-global-agent', 'perm-prospects-read'),
          ('role-global-agent', 'perm-prospects-write'),
          ('role-global-agent', 'perm-opportunities-manage'),
          ('role-global-agent', 'perm-followups-manage'),
          ('role-global-agent', 'perm-meetings-manage'),
          ('role-global-agent', 'perm-quotations-read'),
          ('role-global-agent', 'perm-quotations-write'),
          ('role-global-agent', 'perm-orders-read'),
          ('role-global-agent', 'perm-services-read'),
          ('role-global-agent', 'perm-sales-view'),
          ('role-global-agent', 'perm-sms-send'),
          ('role-global-agent', 'perm-sms-logs'),

          ('role-global-artist', 'perm-projects-read'),
          ('role-global-artist', 'perm-projects-manage'),
          ('role-global-artist', 'perm-orders-read'),
          ('role-global-artist', 'perm-prospects-read'),
          ('role-global-artist', 'perm-services-read'),
          ('role-global-artist', 'perm-sales-view'),

          ('role-stage-sw', 'perm-projects-read'), ('role-stage-sw', 'perm-projects-manage'),
          ('role-stage-sw', 'perm-orders-read'), ('role-stage-sw', 'perm-services-read'),
          ('role-stage-cp', 'perm-projects-read'), ('role-stage-cp', 'perm-projects-manage'),
          ('role-stage-cp', 'perm-orders-read'), ('role-stage-cp', 'perm-services-read'),
          ('role-stage-vg', 'perm-projects-read'), ('role-stage-vg', 'perm-projects-manage'),
          ('role-stage-vg', 'perm-orders-read'), ('role-stage-vg', 'perm-services-read'),
          ('role-stage-ve', 'perm-projects-read'), ('role-stage-ve', 'perm-projects-manage'),
          ('role-stage-ve', 'perm-orders-read'), ('role-stage-ve', 'perm-services-read'),
          ('role-stage-mk', 'perm-projects-read'), ('role-stage-mk', 'perm-projects-manage'),
          ('role-stage-mk', 'perm-orders-read'), ('role-stage-mk', 'perm-services-read'),
          ('role-stage-dev', 'perm-projects-read'), ('role-stage-dev', 'perm-projects-manage'),
          ('role-stage-dev', 'perm-orders-read'), ('role-stage-dev', 'perm-services-read');
      `);

      for (const [newId, oldId] of PERMISSION_SPLITS) {
        if (seededSplits.has(newId)) continue;
        await conn.query(
          `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
           SELECT \`role_id\`, ? FROM \`role_permissions\` WHERE \`permission_id\` = ?;`,
          [newId, oldId],
        );
      }

      // Seed default follow-up stages
      await conn.query(`
        INSERT IGNORE INTO \`followup_stages\` (\`id\`, \`name\`, \`color\`, \`position\`, \`is_default\`)
        VALUES
          ('stage-pending', 'Pending', '#3B82F6', 0, 1),
          ('stage-in-progress', 'In Progress', '#8B5CF6', 1, 1),
          ('stage-completed', 'Completed', '#10B981', 2, 1),
          ('stage-canceled', 'Canceled', '#EF4444', 3, 1);
      `);

      // Mark default quotations as protected to prevent accidental deletion
      try {
        await conn.query(
          "UPDATE `quotations` SET `is_protected` = 1 WHERE `quotation_code` IN ('QT-12145', 'QT-12147', 'QT-12148');",
        );
      } catch {
        // Ignore if quotations table does not exist yet
      }

      try {
        await conn.query(
          "ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'AGENT';",
        );
      } catch {
        // Ignore if already modified
      }
      // Auto-column verification for existing tables
      const [userCols] = await conn.query(
        `
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'
    `,
        [dbName],
      );
      if (Number((userCols as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
        try {
          await conn.query(
            `ALTER TABLE \`users\` ADD COLUMN \`avatar_url\` LONGTEXT NULL AFTER \`status\`;`,
          );
        } catch {
          // Ignore if exists
        }
      }

      const [profCols] = await conn.query(
        `
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'avatar_url'
    `,
        [dbName],
      );
      if (Number((profCols as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
        try {
          await conn.query(
            `ALTER TABLE \`profiles\` ADD COLUMN \`avatar_url\` LONGTEXT NULL AFTER \`email\`;`,
          );
        } catch {
          // Ignore if exists
        }
      }

      // Safe auto-column additions for invoices, opportunities, meetings, payments, services
      const autoColumns: Array<{ table: string; col: string; query: string }> = [
        {
          table: "invoices",
          col: "due_amount",
          query:
            "ALTER TABLE `invoices` ADD COLUMN `due_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `paid_amount`;",
        },
        {
          table: "invoices",
          col: "description",
          query: "ALTER TABLE `invoices` ADD COLUMN `description` TEXT NULL AFTER `due_amount`;",
        },
        {
          table: "invoices",
          col: "bill_date",
          query:
            "ALTER TABLE `invoices` ADD COLUMN `bill_date` VARCHAR(20) NULL AFTER `description`;",
        },
        {
          table: "invoices",
          col: "due_date",
          query: "ALTER TABLE `invoices` ADD COLUMN `due_date` VARCHAR(20) NULL AFTER `bill_date`;",
        },
        {
          table: "invoices",
          col: "notes",
          query: "ALTER TABLE `invoices` ADD COLUMN `notes` TEXT NULL AFTER `due_date`;",
        },
        {
          table: "opportunities",
          col: "status",
          query: "ALTER TABLE `opportunities` ADD COLUMN `status` VARCHAR(100) NULL AFTER `stage`;",
        },
        {
          table: "opportunities",
          col: "estimated_value",
          query:
            "ALTER TABLE `opportunities` ADD COLUMN `estimated_value` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `value`;",
        },
        {
          table: "opportunities",
          col: "notes",
          query:
            "ALTER TABLE `opportunities` ADD COLUMN `notes` TEXT NULL AFTER `expected_close_date`;",
        },
        {
          table: "opportunities",
          col: "assigned_to",
          query:
            "ALTER TABLE `opportunities` ADD COLUMN `assigned_to` VARCHAR(36) NULL AFTER `notes`;",
        },
        {
          table: "opportunities",
          col: "updated_at",
          query:
            "ALTER TABLE `opportunities` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;",
        },
        {
          table: "meetings",
          col: "phone",
          query: "ALTER TABLE `meetings` ADD COLUMN `phone` VARCHAR(50) NULL AFTER `notes`;",
        },
        {
          table: "meetings",
          col: "location",
          query: "ALTER TABLE `meetings` ADD COLUMN `location` VARCHAR(255) NULL AFTER `phone`;",
        },
        {
          table: "meetings",
          col: "meeting_type",
          query:
            "ALTER TABLE `meetings` ADD COLUMN `meeting_type` VARCHAR(50) NULL AFTER `location`;",
        },
        {
          table: "meetings",
          col: "meeting_date",
          query:
            "ALTER TABLE `meetings` ADD COLUMN `meeting_date` VARCHAR(20) NULL AFTER `meeting_type`;",
        },
        {
          table: "meetings",
          col: "meeting_time",
          query:
            "ALTER TABLE `meetings` ADD COLUMN `meeting_time` VARCHAR(20) NULL AFTER `meeting_date`;",
        },
        {
          table: "meetings",
          col: "updated_at",
          query:
            "ALTER TABLE `meetings` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;",
        },
        {
          table: "payments",
          col: "transaction_reference",
          query:
            "ALTER TABLE `payments` ADD COLUMN `transaction_reference` VARCHAR(255) NULL AFTER `payment_method`;",
        },
        {
          table: "payments",
          col: "notes",
          query:
            "ALTER TABLE `payments` ADD COLUMN `notes` TEXT NULL AFTER `transaction_reference`;",
        },
        {
          table: "services",
          col: "price",
          query:
            "ALTER TABLE `services` ADD COLUMN `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `description`;",
        },
        {
          table: "services",
          col: "category",
          query: "ALTER TABLE `services` ADD COLUMN `category` VARCHAR(100) NULL AFTER `price`;",
        },
        {
          table: "services",
          col: "icon",
          query: "ALTER TABLE `services` ADD COLUMN `icon` VARCHAR(100) NULL AFTER `category`;",
        },
        {
          table: "prospects",
          col: "assigned_artist_id",
          query:
            "ALTER TABLE `prospects` ADD COLUMN `assigned_artist_id` VARCHAR(36) NULL AFTER `assigned_to`;",
        },
        {
          table: "prospects",
          col: "budget",
          query:
            "ALTER TABLE `prospects` ADD COLUMN `budget` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `assigned_artist_id`;",
        },
        {
          table: "prospects",
          col: "paid_amount",
          query:
            "ALTER TABLE `prospects` ADD COLUMN `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `budget`;",
        },
        {
          table: "prospects",
          col: "progress",
          query:
            "ALTER TABLE `prospects` ADD COLUMN `progress` INT NOT NULL DEFAULT 0 AFTER `paid_amount`;",
        },
        {
          table: "prospects",
          col: "website_url",
          query:
            "ALTER TABLE `prospects` ADD COLUMN `website_url` VARCHAR(500) NULL AFTER `address`;",
        },
        {
          table: "prospects",
          col: "logo_url",
          query:
            "ALTER TABLE `prospects` ADD COLUMN `logo_url` VARCHAR(500) NULL AFTER `website_url`;",
        },
        {
          table: "prospects",
          col: "deadline",
          query: "ALTER TABLE `prospects` ADD COLUMN `deadline` DATE NULL AFTER `progress`;",
        },
      ];

      for (const c of autoColumns) {
        try {
          const [colCheck] = await conn.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [dbName, c.table, c.col],
          );
          if (Number((colCheck as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
            await conn.query(c.query);
          }
        } catch {
          // Ignore if column already exists
        }
      }

      // Re-enable foreign key checks
      await conn.query("SET FOREIGN_KEY_CHECKS = 1;");

      // First run only: one admin. The password comes from INITIAL_ADMIN_PASSWORD, or a random
      // one is printed once in the server log. No fixed passwords live in the source.
      const [countRows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`users\`;`);
      if (Number((countRows as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
        const envPassword = process.env["INITIAL_ADMIN_PASSWORD"];
        const password = envPassword || randomBytes(9).toString("base64url");
        const now = getMySQLTimestamp();
        await conn.query(
          `INSERT INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password_hash\`, \`role\`, \`status\`, \`avatar_url\`, \`is_deleted\`, \`created_at\`, \`updated_at\`)
           VALUES ('usr-admin-1', 'System Admin', 'admin@example.com', ?, 'ADMIN', 'Active', NULL, 0, ?, ?);`,
          [bcrypt.hashSync(password, 10), now, now],
        );
        if (!envPassword) {
          console.warn(
            `[Brandium] First admin created: admin@example.com / ${password} (change it after signing in)`,
          );
        }
      }

      // Always sync users into profiles table
      try {
        await conn.query(`
        INSERT INTO \`profiles\` (\`id\`, \`full_name\`, \`email\`, \`created_at\`, \`updated_at\`)
        SELECT \`id\`, \`name\`, \`email\`, \`created_at\`, \`updated_at\` FROM \`users\`
        ON DUPLICATE KEY UPDATE \`full_name\` = VALUES(\`full_name\`), \`email\` = VALUES(\`email\`);
      `);
      } catch {
        // Ignore
      }

      // Seed default stages into \`stages\` if table is empty
      const [stageRows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`stages\`;`);
      if (Number((stageRows as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
        await conn.query(`
        INSERT INTO \`stages\` (\`id\`, \`name\`, \`stage_group\`, \`sort_order\`, \`is_follow_up\`, \`is_active\`, \`is_system\`)
        VALUES
        ('prospect', 'Prospect', 'new', 1, 0, 1, 1),
        ('follow-up', 'Follow-up', 'in_progress', 2, 1, 1, 1),
        ('opportunity-created', 'Opportunity Created', 'in_progress', 3, 0, 1, 1),
        ('sales-won', 'Sales won', 'won', 4, 0, 1, 1),
        ('dnp', 'DNP (Did Not Pick)', 'unreachable', 5, 0, 1, 1),
        ('switched-off', 'Switched Off', 'unreachable', 6, 0, 1, 1),
        ('invalid-number', 'Invalid Number', 'unreachable', 7, 0, 1, 1),
        ('meeting-scheduled', 'Meeting Scheduled', 'in_progress', 8, 1, 1, 1),
        ('quotation-sent', 'Quotation Sent', 'in_progress', 9, 0, 1, 1);
      `);
      }

      // Seed default services into \`services\` if table is empty
      const [serviceRows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`services\`;`);
      if (Number((serviceRows as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
        await conn.query(`
        INSERT INTO \`services\` (\`id\`, \`name\`, \`description\`, \`is_active\`)
        VALUES
        ('srv-1', 'Product Photography', 'High-end studio & e-commerce product catalog shoot.', 1),
        ('srv-2', 'Graphics Design', 'Social media banners, ad creatives, and print designs.', 1),
        ('srv-3', 'Monthly Plan', 'All-in-one monthly digital marketing & telesales management.', 1),
        ('srv-4', 'Website Development', 'Custom responsive React, Next.js, and WordPress websites.', 1),
        ('srv-5', 'Celebrity Video Ads', 'Commercial video ads featuring popular celebrities.', 1),
        ('srv-6', 'TVC', 'Television Commercial production & broadcast formatting.', 1),
        ('srv-7', 'OVC', 'Online Video Commercials optimized for social media.', 1),
        ('srv-8', 'Voice-Over Video Ads', 'Professional voice-over narration with dynamic visuals.', 1),
        ('srv-9', 'Corporate AV', 'Corporate Audio-Visual presentations & company profiles.', 1),
        ('srv-10', 'Influencer Video Ads', 'Influencer endorsement videos for TikTok, Instagram & FB.', 1),
        ('srv-11', 'Motion Video Ads', '2D/3D motion graphics animation and visual FX.', 1),
        ('srv-12', 'Logo Design', 'Custom brand identity, vector logos, and brand guidelines.', 1);
      `);
      }

      // Seed default projects into `projects` if table is empty
      const [projectRows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`projects\`;`);
      if (Number((projectRows as Array<{ cnt: number }>)?.[0]?.cnt ?? 0) === 0) {
        await conn.query(`
          INSERT INTO \`projects\` (
            \`id\`, \`project_code\`, \`title\`, \`client_name\`, \`service_id\`, \`status\`, 
            \`budget\`, \`paid_amount\`, \`progress\`, \`deadline\`, \`notes\`
          )
          VALUES
          ('prj-1001', 'PRJ-1001', 'Apex Footwear E-Commerce Commercial Ads', 'Apex Footwear Ltd.', 'srv-5', 'Project Started', 45000.00, 25000.00, 15, DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 'High-priority celebrity video ad production for seasonal footwear launch.'),
          ('prj-1002', 'PRJ-1002', 'Navana Real Estate Brand Identity & Logo Suite', 'Navana Group', 'srv-12', 'Script Writer', 30000.00, 15000.00, 25, DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), 'Script writing and storyboarding with brand guidelines.'),
          ('prj-1003', 'PRJ-1003', 'Shwapno Supermarket 3D Motion Promo Video', 'ACI Logistics / Shwapno', 'srv-11', 'Content Planner', 55000.00, 30000.00, 35, DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY), 'Content planning & campaign strategy for Facebook & YouTube.'),
          ('prj-1004', 'PRJ-1004', 'Beximco Pharma Medical Product Catalog Shoot', 'Beximco Pharma', 'srv-1', 'Videographer', 40000.00, 40000.00, 50, DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY), 'Studio video production and high-resolution cinematography.'),
          ('prj-1005', 'PRJ-1005', 'Chaldal Monthly Social Media & Ad Campaigns', 'Chaldal.com', 'srv-3', 'Delivered', 75000.00, 75000.00, 100, CURRENT_DATE, 'Monthly digital marketing plan, ad copy, and video production completed.'),
          ('prj-1006', 'PRJ-1006', 'Aarong Handcraft Artisans Video Docu-Series', 'BRAC Aarong', 'srv-6', 'Video Editor', 60000.00, 20000.00, 70, DATE_ADD(CURRENT_DATE, INTERVAL 21 DAY), 'Video editing, color grading and audio mastering in progress.');
        `);
      }

      // Mark as initialized in memory for lightning fast 0ms subsequent queries
      latch.done = true;
    } catch (e) {
      console.error("ERP Auto Database Init Error:", e);
      latch.failedAt = Date.now();
    } finally {
      latch.running = null;
      try {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1;");
      } catch {
        // Ignore
      }
    }
  })();

  return latch.running;
}
