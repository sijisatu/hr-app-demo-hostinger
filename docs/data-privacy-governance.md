# Data Privacy Governance

Tanggal efektif: 2026-04-17
Scope: aplikasi Pralux HR-App untuk attendance, employee document, reimbursement, leave, dan payroll support data.

## 1. Data Classification

| Data set | Contoh | Classification | Access default |
| --- | --- | --- | --- |
| Public operational metadata | department master, position master, tax profile labels | Internal | admin, hr, manager sesuai kebutuhan kerja |
| Employee PII | nama, email, nomor telepon, alamat, NIK internal | Confidential | admin, hr, owner data, manager terbatas ke direct report |
| Sensitive personal documents | KTP, KK, ijazah, NPWP, BPJS, kontrak kerja | Restricted | admin, hr, owner data, manager direct report bila diperlukan untuk proses kerja |
| Biometric-like media | selfie attendance | Restricted | admin, hr, owner data, manager direct report untuk validasi attendance |
| Financial support data | reimbursement receipt, bank masked account, compensation profile, payslip export | Restricted | admin, hr, owner data, manager terbatas sesuai approval scope |
| Audit trail | approval chain, perubahan data sensitif, publish payroll | Restricted-Controlled | admin/hr ops terbatas, tidak boleh diedit manual |

## 2. Retention Policy

| Data set | Retention target | Operational note |
| --- | --- | --- |
| Attendance selfie | 30 hari | dipakai untuk validasi check-in dan investigasi singkat |
| Reimbursement receipt | 365 hari | mendukung audit reimbursement tahunan dan dispute handling |
| Employee personal documents | 2555 hari | setara 7 tahun untuk dokumen ketenagakerjaan dan compliance operasional |
| Audit trail | 2555 hari | wajib dipertahankan untuk forensik approval dan perubahan data |
| Exported reports | 30 hari | file hasil generate dianggap turunan, bukan source of truth |

Environment template:
- `RETENTION_ATTENDANCE_SELFIE_DAYS`
- `RETENTION_REIMBURSEMENT_RECEIPT_DAYS`
- `RETENTION_EMPLOYEE_DOCUMENT_DAYS`
- `RETENTION_AUDIT_LOG_DAYS`

## 3. Handling Rules

- Dokumen sensitif dan media selfie tidak boleh diakses langsung melalui static public URL production.
- Akses file sensitif wajib melalui endpoint backend yang memvalidasi role dan ownership.
- Manager hanya boleh mengakses dokumen dan media karyawan yang memang berada pada department yang sama dan berada di approval scope manager tersebut.
- File hasil upload harus dibatasi tipe file, ukuran file, dan dicatat pada audit trail saat ada approval/perubahan status.

## 4. Review Cycle

- Review policy minimum per kuartal sebelum release production mayor.
- Review tambahan wajib dilakukan saat ada modul baru yang memproses PII, dokumen personal, atau data finansial.
