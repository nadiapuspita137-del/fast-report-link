# Statistik real-time (Cloudflare Pages + D1)

Dashboard hanya menyimpan ID acak browser, ID sesi, waktu aktivitas, dan penghitung agregat. URL laporan, deskripsi, IP, nama, serta data akun tidak ditulis ke D1.

## Aktivasi

1. Buat database: `npx wrangler d1 create fast-report-link-stats`.
2. Salin `database_id` hasilnya ke `wrangler.toml`.
3. Jalankan skema: `npx wrangler d1 execute fast-report-link-stats --remote --file=schema.sql`.
4. Di Cloudflare Pages, buka **Settings → Bindings → D1 database bindings**.
5. Tambahkan binding bernama persis `DB` ke database `fast-report-link-stats`.
6. Deploy ulang branch produksi.

Saat binding belum dipasang, dashboard menampilkan status belum tersambung dan fungsi report tetap berjalan normal.

## Definisi angka

- Aktif sekarang: browser dengan heartbeat dalam 2 menit terakhir.
- Total pengguna anonim: ID acak persisten per browser.
- Total kunjungan: satu hit per sesi browser.
- Proses bulk: jumlah eksekusi tombol tab/window.
- Link diproses: total jumlah URL dalam proses bulk.
