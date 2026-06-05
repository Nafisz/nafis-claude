# Nafis Claude Workspace

Prototype UI/UX web app yang dibuat agar terasa lebih dekat dengan Claude dan bisa dipakai dengan Claude API key pribadi.

## Fitur

- Sidebar bergaya Claude dengan Chat baru, Obrolan, Proyek, Artefak, Sesuaikan, produk, dan daftar sesi terbaru.
- Setiap conversation memiliki riwayat pesan sendiri dan dapat dipindahkan ke Project folder.
- Setiap Project folder memiliki memori sendiri untuk konteks jangka panjang, sehingga folder proyek berfungsi seperti ruang kerja khusus ala Claude.
- Panel Skills memungkinkan kemampuan seperti Confluence, Generate File, Analisis Produk, dan Desain UI aktif/nonaktif sebagai konteks LLM-aware.
- Pemilih model dan intensitas berpikir tersedia langsung di composer.
- Backend proxy lokal `POST /api/chat` meneruskan pesan ke Claude Messages API setelah API key dipasang.
- API key bisa dimasukkan di panel kanan atau disediakan lewat environment variable `ANTHROPIC_API_KEY`.
- File/artefak yang dihasilkan dapat dibuka, disalin, dan diunduh dari panel Artefak.
- State conversation, project, skill, dan artefak disimpan di `localStorage` browser.

## Menjalankan

```bash
npm run start
```

Lalu buka <http://localhost:4173>.

### Memasang API key

Opsi 1 — lewat environment variable:

```bash
ANTHROPIC_API_KEY="sk-ant-..." npm run start
```

Opsi 2 — lewat UI:

1. Jalankan `npm run start`.
2. Buka <http://localhost:4173>.
3. Isi API key pada panel kanan.
4. Centang “Simpan di browser ini” jika ingin disimpan di `localStorage`.

> Catatan: Confluence masih membutuhkan konektor/data source terpisah. Jika skill Confluence aktif, Claude akan diberi konteks bahwa skill tersedia, tetapi aplikasi tidak mengakses Confluence nyata sebelum kredensial/konektor ditambahkan.

## Check

```bash
npm run check
```
