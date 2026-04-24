# HRIS Roadmap

## Phase 1 - Foundation HRIS

- [x] Employee master baseline
- [x] Department and role structure
- [x] Contract data
- [x] Payroll baseline data structure
- [x] Auth and role-based access

## Phase 2 - Attendance Core

- [x] Check-in / check-out
- [x] GPS validation
- [x] Camera / selfie upload
- [x] Shift and schedule management
- [x] Overtime management

## Phase 3 - Leave and Approval

- [x] Annual leave
- [x] Sick leave
- [x] Permission flow
- [x] Automatic approval rules
- [x] Leave balance tracking

## Phase 4 - Payroll

- [x] Salary component engine
- [x] Automatic payroll calculation
- [x] Tax deduction (PPh)
- [x] Payslip generation

## Phase 5 - Employee Self Service and Reporting

- [x] Employee self-service portal
- [x] Payslip download
- [x] Payroll reports
- [x] Employee reports
- [x] Attendance reports

## Roadmap Update

Modul hr-app karyawan:

1. Modul kehadiran
   - On duty request
   - Sick submission
   - Leave request
     cuti ada annual, keagamaan, lahiran, kedukaan. tambahin balance setiap cuti di leave request (DONE)
   - Half day leave
   - Attendance summary
   - Submit overtime (karyawan submit overtime, atasan acc overtime)
   - Semua Records (Summary) disamain kaya attendance records semua
   - Tombol clock in kalo udah disubmit jadi clock out (DONE)
   - Foto selfie harusnya otomatis ke capture waktu dia submit check-in, terus pilihan employee nya ga usah ada, otomatis sesuai akun yang login aja. (DONE)

2. Modul payroll
   - Generate slip gaji
   - History slip gaji
   - Slip gaji jadiin pdf terus dirapihin yang proper (NEW)

3. Modul Profil
   - Data karyawan

4. Modul Reimbursement (Future Feature) (DONE)
   1. medical
      - 10 jt rawat jalan out patient & flexi (claim yang bisa digunakan untuk keperluan pekerjaan)
      - lahiran (normal & cesar)
   2. other reimbursement
   3. upload dokumen receipt/struk

5. Dashboard
   - Grafik attendance

6. modul dinas luar buat tracking berapa lamanya, budget perjalanan dinas nya (NEW)

Modul hr-app HR:

1. Modul Kehadiran
   - Report kehadiran karyawan
   - Biar bisa liat selfie karyawan clock in (DONE)

2. Modul Employee List
   - Masukin data karyawan termasuk gaji, tunjangan, deduction (bpjs, pajak), akun portal hr (Done)
   - upload dokumen karyawan kaya ktp, ijazah, sertifikat (Done)

3. Modul Payroll (Belakangan)
   - Data gaji karyawan, termasuk kalkulasi kehadiran. Nanti di akhir bulan biar keliatan gaji karyawan tersebut berapa
   - pertimbangin payroll pro-rate buat karyawan yang baru masuk, perhitungan THR & Bonus (perkalian atau amount) gimana
   - payroll otomatis kirim email
   - di add employee financial detail perlu ada total gaji, base salary + allowances - deduction. perhitungan pajak nya dikalkulasiin sama gaji gross. minta perhitungan pajaknya otomatis, dan diambil perhitungan pajaknya dari sumber pajak resmi di indonesia
   - sebelum submit ke bank bikin approval 2 step, dari hrd ke dan manager hrd
   - kita mau bikin sistem yang pake payroll dan ga pake payroll. sistem yang ga pake payroll semua financial things disembunyiin, yang pake payroll tampilin semua financial things
   - bikin fitur payroll nya bisa di-disable enable buat customer yang ga pake modul payroll

4. Modul report (Done)
   - Generate report attendance, employee list, payroll
   - Grafik attendance, grafik jumlah karyawan
5. Dashboard (Done)
   - Grafik attendance, grafik jumlah karyawan, grafik payroll (jumlah gaji yang dibayarkan tiap bulan)

6. Modul buat ngatur cuti karyawan (Done)

Beresin login page

bikin responsive buat di browser mobile (DONE)

## Production Storage & Database Migration Plan

### Goal

Migrasi storage aplikasi dari `local JSON file` ke `production-ready relational database` dengan pendekatan bertahap agar backend tetap bisa jalan selama proses transisi. File upload tetap disimpan di local storage dulu, dan baru bisa dipindah ke object storage di fase berikutnya.

### Current State

- Data utama backend masih disimpan di `backend/storage/data.json`
- Upload file, export, dan dokumen masih disimpan di `backend/storage/...`
- Backend belum memakai database server untuk transaksi data HRIS

### Implementation Plan

1. Setup fondasi database production-ready
   - Pilih PostgreSQL sebagai database utama
   - Tambahkan ORM dan migration tooling
   - Rapikan konfigurasi environment database

2. Modelkan schema database
   - Buat schema untuk employees, attendance, leave, overtime, payroll, reimbursement, dan payslip
   - Tentukan relasi, unique constraint, index, dan audit timestamp

3. Siapkan migrasi data dari JSON ke database
   - Buat script import dari `backend/storage/data.json`
   - Pastikan seed/demo data bisa dimasukkan ke database baru
   - Validasi hasil migrasi sebelum cutover

4. Refactor backend bertahap
   - Pisahkan layer akses data dari business logic
   - Ganti pembacaan/penulisan JSON ke query database
   - Pertahankan local file storage untuk upload dan generated file

5. Hardening untuk production
   - Tambahkan migration workflow untuk deployment
   - Tambahkan backup/restore guideline database
   - Siapkan env template production
   - Review error handling dan concurrency saat multi-user

### Delivery Stages

- Stage 1: Foundation database + schema + migration script
- Stage 2: Employees, attendance, leave, overtime pindah ke database
- Stage 3: Payroll, reimbursement, payslip pindah ke database
- Stage 4: Cutover penuh dan deprecate `data.json`

## Implementation Update

### Database & Storage

- [x] Setup PostgreSQL lokal untuk development
- [x] Tambah Prisma schema untuk modul utama HRIS
- [x] Tambah baseline migration SQL untuk deployment database
- [x] Tambah import script dari `backend/storage/data.json` ke PostgreSQL
- [x] Cut over persistence backend dari file JSON ke PostgreSQL saat `APP_STORAGE_MODE=database`
- [x] Pertahankan local file storage untuk upload dokumen, selfie, export, dan generated file

### Backend Hardening

- [x] Tambah database readiness check saat startup backend
- [x] Ubah mode aplikasi jadi strict database saat storage mode pakai `database`
- [x] Ganti write path dari model full rewrite DB ke serialised sync dengan `upsert + prune`
- [x] Tambah script database migration deploy dan migration status
- [x] Tambah script backup dan restore PostgreSQL

### Auth Hardening

- [x] Hash password employee dengan bcrypt
- [x] Auto-upgrade password plain text lama menjadi hash saat backend startup
- [x] Pindahkan verifikasi login employee ke backend API
- [x] Tambah endpoint employee session khusus untuk lookup session
- [x] Sembunyikan `loginPassword` dari response `GET /api/employees`

### Current Status

- [x] Backend sudah jalan dengan PostgreSQL sebagai storage utama
- [x] Healthcheck backend sudah menampilkan status database
- [x] Migration deploy sudah tervalidasi di database kosong
- [x] Backup dump database sudah berhasil dibuat
