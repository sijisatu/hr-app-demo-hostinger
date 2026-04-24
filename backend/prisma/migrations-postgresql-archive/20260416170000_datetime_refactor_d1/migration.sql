-- D1 reliability refactor: move critical date/time fields from text to native timestamp

ALTER TABLE "Employee"
  ALTER COLUMN "birthDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("birthDate") = '' THEN now()
      WHEN "birthDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("birthDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "birthDate"::timestamptz
    END
  ),
  ALTER COLUMN "marriageDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN "marriageDate" IS NULL OR btrim("marriageDate") = '' THEN NULL
      WHEN "marriageDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("marriageDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "marriageDate"::timestamptz
    END
  ),
  ALTER COLUMN "joinDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("joinDate") = '' THEN now()
      WHEN "joinDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("joinDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "joinDate"::timestamptz
    END
  ),
  ALTER COLUMN "contractStart" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("contractStart") = '' THEN now()
      WHEN "contractStart" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("contractStart" || 'T00:00:00.000Z')::timestamptz
      ELSE "contractStart"::timestamptz
    END
  ),
  ALTER COLUMN "contractEnd" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN "contractEnd" IS NULL OR btrim("contractEnd") = '' THEN NULL
      WHEN "contractEnd" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("contractEnd" || 'T00:00:00.000Z')::timestamptz
      ELSE "contractEnd"::timestamptz
    END
  );

ALTER TABLE "AttendanceLog"
  ALTER COLUMN "timestamp" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("timestamp") = '' THEN now()
      ELSE "timestamp"::timestamptz
    END
  );

ALTER TABLE "OvertimeRequest"
  ALTER COLUMN "date" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("date") = '' THEN now()
      WHEN "date" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("date" || 'T00:00:00.000Z')::timestamptz
      ELSE "date"::timestamptz
    END
  );

ALTER TABLE "LeaveRequest"
  ALTER COLUMN "startDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("startDate") = '' THEN now()
      WHEN "startDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("startDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "startDate"::timestamptz
    END
  ),
  ALTER COLUMN "endDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("endDate") = '' THEN now()
      WHEN "endDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("endDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "endDate"::timestamptz
    END
  ),
  ALTER COLUMN "requestedAt" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("requestedAt") = '' THEN now()
      ELSE "requestedAt"::timestamptz
    END
  );

ALTER TABLE "PayRun"
  ALTER COLUMN "periodStart" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("periodStart") = '' THEN now()
      WHEN "periodStart" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("periodStart" || 'T00:00:00.000Z')::timestamptz
      ELSE "periodStart"::timestamptz
    END
  ),
  ALTER COLUMN "periodEnd" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("periodEnd") = '' THEN now()
      WHEN "periodEnd" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("periodEnd" || 'T00:00:00.000Z')::timestamptz
      ELSE "periodEnd"::timestamptz
    END
  ),
  ALTER COLUMN "payDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("payDate") = '' THEN now()
      WHEN "payDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("payDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "payDate"::timestamptz
    END
  );

ALTER TABLE "Payslip"
  ALTER COLUMN "periodStart" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("periodStart") = '' THEN now()
      WHEN "periodStart" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("periodStart" || 'T00:00:00.000Z')::timestamptz
      ELSE "periodStart"::timestamptz
    END
  ),
  ALTER COLUMN "periodEnd" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("periodEnd") = '' THEN now()
      WHEN "periodEnd" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("periodEnd" || 'T00:00:00.000Z')::timestamptz
      ELSE "periodEnd"::timestamptz
    END
  ),
  ALTER COLUMN "payDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("payDate") = '' THEN now()
      WHEN "payDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("payDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "payDate"::timestamptz
    END
  );

ALTER TABLE "ReimbursementRequest"
  ALTER COLUMN "receiptDate" TYPE TIMESTAMP(3) USING (
    CASE
      WHEN btrim("receiptDate") = '' THEN now()
      WHEN "receiptDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN ("receiptDate" || 'T00:00:00.000Z')::timestamptz
      ELSE "receiptDate"::timestamptz
    END
  );

