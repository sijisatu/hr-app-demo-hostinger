CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

INSERT INTO "Department" ("id", "name", "active", "createdAt", "updatedAt")
SELECT
  CONCAT('dept-seed-', ROW_NUMBER() OVER (ORDER BY department)),
  department,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM("department") AS department
  FROM "Employee"
  WHERE TRIM("department") <> ''
) AS unique_departments;

