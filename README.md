# Nafis Claude Workspace

Prototype UI/UX web app yang dibuat agar terasa lebih dekat dengan Claude:

- Sidebar bergaya Claude dengan Chat baru, Obrolan, Proyek, Artefak, Sesuaikan, produk, dan daftar sesi terbaru.
- Sesi percakapan dapat berjalan **di luar Project** atau dipindahkan ke **Project folder** tertentu.
- Setiap Project folder memiliki memori sendiri untuk konteks jangka panjang, sehingga folder proyek berfungsi seperti ruang kerja khusus ala Claude.
- Panel Skills memungkinkan kemampuan seperti Confluence, Generate File, Analisis Produk, dan Desain UI aktif sebagai kemampuan LLM-aware.
- Pemilih model dan intensitas berpikir tersedia langsung di composer.
- Tool calling dan file generation dipresentasikan sebagai aksi organik dari percakapan: pengguna cukup menulis instruksi seperti “cari di Confluence” atau “buat file roadmap.md”.

## Menjalankan

```bash
npm run start
```

Lalu buka <http://localhost:4173>.

## Check

```bash
npm run check
```
