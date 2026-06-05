# Nafis Claude Workspace

Prototype UI/UX web app Claude-like yang bisa dipakai dengan Claude API key pribadi.

## Fitur

- Chat streaming via backend proxy lokal ke Claude Messages API.
- Conversation state milik aplikasi dan tersimpan di `localStorage`.
- New Chat membuat conversation baru; Continue Chat memuat history conversation yang sama.
- Model selector per conversation; history tetap utuh saat model diganti.
- Project instruction/memory dikirim sebagai `system` prompt.
- Global/account memory dan Project memory bisa dilihat, diedit, disimpan, disalin, dan diunduh.
- Skills ala Claude berupa fragmen instruksi Markdown dengan trigger keywords; skill bisa aktif/nonaktif, dilihat, diedit, disalin, diunduh, diduplikasi, atau dibuat baru.
- Agentic tool loop tersedia hanya untuk Atlassian: Jira dan Confluence.
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
