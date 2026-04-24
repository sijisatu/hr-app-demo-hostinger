# Approval Audit Trail

Tanggal efektif: 2026-04-17

## Objective

Approval flow untuk leave, overtime, reimbursement, payroll, dan perubahan employee harus memiliki jejak audit append-only yang tamper-evident.

## Current Implementation

- Audit entries disimpan di `storage/audit.log`.
- Setiap entry ditulis sebagai satu baris JSON append-only.
- Entry baru membawa:
  - `sequence`
  - `timestamp`
  - `action`
  - `details`
  - `previousHash`
  - `entryHash`
  - `immutable`
  - `hashAlgorithm`
- `entryHash` dibentuk dari hash `sha256` atas payload entry + `previousHash`, sehingga perubahan pada baris lama akan memutus chain.

## Protected Actions

- `employee.create`
- `employee.update`
- `employee.delete`
- `department.create`
- `department.update`
- `department.delete`
- `overtime.approve`
- `leave.approve`
- `reimbursement.manager-approve`
- `reimbursement.hr-process`
- `payroll.generate-run`
- `payroll.publish-run`

## Operational Rules

- Audit log tidak boleh diedit manual.
- Jika file audit dipindahkan atau diarsipkan, hash chain terakhir harus dicatat dalam release/deployment note.
- Validasi chain hash direkomendasikan sebagai langkah operasional sebelum backup rotation dan saat incident review.
