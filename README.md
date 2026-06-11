# Nafis Claude Workspace

Prototype UI/UX web app Claude-like yang bisa dipakai dengan Claude API key pribadi.

## Fitur

- Chat streaming via backend proxy lokal ke Claude Messages API.
- Conversation state milik aplikasi dan tersimpan di `localStorage`.
- New Chat membuat conversation baru; Continue Chat memuat history conversation yang sama. Chat juga dapat di-branch dari akhir sesi atau respons tertentu untuk melanjutkan konteks ke arah berbeda; branch otomatis mewarisi Project dan model sumber.
- Model selector per conversation; history tetap utuh saat model diganti.
- Global/account memory dan Project memory diretrieval per topik lalu dikirim sebagai konteks relevan, tanpa mencampur scope.
- Memory global/project diperbarui otomatis dalam format Claude-like (`Purpose & context`, `Current state`, `On the horizon`, `Key learnings & principles`, `Approach & patterns`, `Tools & resources`) dan tetap bisa dilihat, diedit, disimpan, disalin, atau diunduh.
- Skills ala Claude berupa fragmen instruksi Markdown dengan trigger keywords; keyword kosong berarti selalu aktif. Skill bisa aktif/nonaktif, dilihat, diedit, disalin, diunduh, diduplikasi, atau dibuat baru.
- Agentic tool loop tersedia hanya untuk Atlassian: pencarian/pembacaan Confluence dan Jira, update halaman Confluence, serta create/update/comment Jira. Operasi tulis hanya dijalankan saat diminta eksplisit oleh user.
- File/artefak yang dihasilkan bisa dibuka, disalin, dan diunduh dari panel Artefak.
- Token counter memakai `/api/count-tokens` jika API key tersedia.

## Menjalankan

```bash
npm run start
```

Lalu buka <http://localhost:4173>.

### API key Claude

```bash
ANTHROPIC_API_KEY="sk-ant-..." npm run start
```

Atau isi API key dari panel kanan aplikasi.

### Atlassian tools

Tools yang disediakan hanya Jira dan Confluence. Untuk mengaktifkan akses nyata, jalankan server dengan:

```bash
ATLASSIAN_BASE_URL="https://your-domain.atlassian.net" \
ATLASSIAN_EMAIL="you@example.com" \
ATLASSIAN_API_TOKEN="..." \
ANTHROPIC_API_KEY="sk-ant-..." \
npm run start
```

Jika env Atlassian belum ada, tool akan memberi hasil bahwa connector belum dikonfigurasi.

## Check

```bash
npm run check
```
