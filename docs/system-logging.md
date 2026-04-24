# System Logging

Sistem sekarang menulis log terpusat ke:

- `logs/system/system-events.ndjson`
- `logs/system/system-events.log`

Format log:

- Satu baris = satu JSON event
- Field utama: `timestamp`, `timestampIsoUtc`, `timezone`, `level`, `source`, `event`, `details`
- `timestamp` ditulis dalam format WIB (`Asia/Jakarta`)
- `timestampIsoUtc` disimpan sebagai referensi teknis UTC
- File `.log` ditulis dalam format blok yang lebih enak dibaca manual saat troubleshooting

Source yang dicatat:

- `backend`
- `database`
- `frontend-server`
- `frontend-client`

Event yang otomatis masuk:

- startup backend
- backend ready
- backend bootstrap failure
- backend uncaught exception / unhandled rejection
- backend HTTP 5xx response
- database client created
- database readiness start / ready / failed
- Prisma warn / error event
- Prisma disconnect / disconnect failure
- frontend server startup register
- frontend server uncaught exception / unhandled rejection
- client-side browser error
- client-side unhandled promise rejection

Contoh baca log terakhir di PowerShell:

```powershell
Get-Content .\logs\system\system-events.ndjson -Tail 50
```

Contoh filter error saja:

```powershell
Get-Content .\logs\system\system-events.ndjson |
  ConvertFrom-Json |
  Where-Object { $_.level -eq "error" } |
  Select-Object timestamp, source, event, details
```

Catatan:

- Log ini fokus untuk trace operasional aplikasi, bukan audit bisnis.
- Kalau frontend/backend gagal start, event bootstrap failure akan tercatat selama proses sempat mengeksekusi handler.
- Browser/client error akan dikirim ke server lewat endpoint internal `/api/system/client-error`.
