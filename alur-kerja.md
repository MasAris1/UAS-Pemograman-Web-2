Fase 1: Eksplorasi Publik & Optimasi Kinerja Mutlak
Fokus: Kecepatan muat, SEO, dan keamanan lapis pertama.
 * Permintaan Akses: Tamu membuka halaman web katalog kamar.
 * Proteksi Perimeter: Lapisan Rate Limiting (misal: via Upstash Redis di rute API/Middleware) memblokir akses jika ada anomali traffic, mencegah serangan DDoS.
 * Kueri Data Terfilter: Klien Next.js mengambil data dari Supabase PostgreSQL menggunakan peran anon. Kueri wajib menyertakan WHERE deleted_at IS NULL untuk menerapkan Soft Deletes.
 * Optimasi Media: Gambar kamar dari Supabase Storage tidak dimuat mentah. Komponen <Image /> Next.js secara real-time mengompresi dan mengubah ukuran gambar menjadi format modern (WebP/AVIF) sebelum disajikan ke peramban tamu.
Fase 2: Intersepsi Keamanan & Resolusi Peran
Fokus: Perlindungan rute transaksi dan kelancaran UX.
 * Tindakan Klien: Tamu memilih kamar dan menekan "Pesan Sekarang".
 * Pencegatan Middleware: Next.js Middleware mendeteksi ketiadaan token sesi otentikasi. Klien langsung dialihkan ke /login?redirect=/checkout.
 * Otentikasi & Penentuan Rute: Pengguna login via Supabase Auth (Google OAuth). Setelah berhasil, sistem membaca peran (role) pengguna:
   * Jika Tamu, mereka dikembalikan secara mulus ke rute /checkout.
   * Jika Admin/Resepsionis, mereka otomatis dialihkan ke Dasbor Manajemen Internal.
Fase 3: Kalkulasi Harga Dinamis & Penguncian Konkurensi
Fokus: Integritas finansial dan pencegahan konflik data (Double Booking).
 * Input Reservasi: Tamu memilih tanggal check-in dan check-out, lalu submit form.
 * Validasi Skema Server (Zod): API Next.js menerima payload. Zod memvalidasi tipe data dan memastikan tanggal valid.
 * Kalkulasi Harga Dinamis: API mengabaikan harga dari sisi client. Sistem melakukan kueri ke tabel Room_Rates untuk mengkalkulasi total harga aktual secara server-side (menggabungkan harga reguler dan harga akhir pekan/libur).
 * Isolasi Transaksi Mutlak: API memanggil Stored Procedure di Supabase. Konstrain PostgreSQL EXCLUDE USING gist memastikan rentang tanggal dikunci. Jika dua orang menekan pesan di milidetik yang sama, database menolak salah satunya. Pesanan yang berhasil mendapat status Unpaid.
Fase 4: Integrasi Pembayaran & Graceful Degradation
Fokus: Ketahanan sistem terhadap gangguan pihak ketiga.
 * Permintaan Snap Token: API Next.js meminta token ke server Midtrans.
 * Penanganan Kegagalan: Terdapat blok try-catch. Jika Midtrans mengalami timeout atau down, sistem menangkap error, membatalkan status Unpaid di database agar kamar tidak terkunci sia-sia, dan menampilkan pesan error elegan di UI tamu.
 * Tampilan UI Pembayaran: Jika sukses, Snap Token dikirim ke klien, dan pop-up Midtrans muncul. Pendengar kejadian (onSuccess, onPending, onClose) di sisi frontend siap merespons aksi tamu.
Fase 5: Webhook Idempotent & Pencatatan Audit (Audit Trail)
Fokus: Otomatisasi pasca-pembayaran dan keamanan data internal.
 * Notifikasi Midtrans: Setelah tamu membayar, Midtrans mengirim Webhook POST ke rute API Next.js.
 * Validasi Kriptografi: API memvalidasi Signature Key dengan algoritma SHA-512.
 * Cek Idempotensi: API mengecek database. Jika order_id sudah berstatus Paid (indikasi webhook ganda), proses dihentikan (HTTP 200). Jika belum, proses dilanjutkan.
 * Pembaruan & Trigger Otomatis: API mengupdate status menjadi Paid. Perubahan ini memicu PostgreSQL Trigger di Supabase yang secara otomatis dan permanen menyalin riwayat perubahan tersebut ke tabel audit_logs.
 * Distribusi Tiket: API men-generate PDF e-Voucher dan mengirimkannya ke email tamu secara otomatis (misal: via Resend).
Fase 6: Sinkronisasi Waktu Nyata & Penyapuan Failsafe
Fokus: Pemeliharaan data otomatis dan pengalaman waktu nyata.
 * Reaksi UI Instan: Supabase Realtime mendeteksi perubahan status di tabel Reservations. Layar klien yang tadinya loading langsung berubah menjadi "Pembayaran Berhasil". Dasbor resepsionis juga memunculkan notifikasi pemesanan baru.
 * Penyapu Otomatis (Cron Job): Ekstensi pg_cron di PostgreSQL secara mandiri menyapu database setiap menit. Pemesanan berstatus Unpaid yang usianya melebihi 1 jam otomatis diubah menjadi Expired, membebaskan kamar kembali ke sistem.
Fase 7: Operasional Pasca-Pembayaran & Manajemen Refund
Fokus: Siklus hidup bisnis dunia nyata.
 * Manajemen Resepsionis: Tamu tiba di hotel. Resepsionis mengubah status menjadi Check-In, lalu Check-Out saat tamu pulang. Setiap perubahan status ini otomatis terekam di audit_logs beserta ID resepsionis yang bertugas.
 * Pembatalan Darurat: Jika tamu meminta pembatalan, resepsionis mengeksekusi fitur Refund di dasbor. API Next.js memanggil Midtrans Refund API untuk mengembalikan dana secara otomatis, mengubah status pesanan menjadi Refunded, dan mengembalikan kamar menjadi Available. 

