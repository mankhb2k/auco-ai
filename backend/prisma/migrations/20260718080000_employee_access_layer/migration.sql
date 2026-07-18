-- role.md Phase R1: 3 lớp quyền demo (it_admin | manager | employee)
ALTER TABLE "Employee"
    ADD COLUMN IF NOT EXISTS "accessLayer" TEXT NOT NULL DEFAULT 'employee';

-- Backfill managers đã seed trước migration
UPDATE "Employee" SET "accessLayer" = 'manager' WHERE "role" = 'branch_manager';
UPDATE "Employee" SET "accessLayer" = 'it_admin' WHERE "role" = 'it_admin';
