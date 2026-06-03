# Claude-Like Personal Workspace

Local-first web app for using the Claude API with projects, memory, files, local skills, Markdown artifacts, and approval-gated Atlassian/Rovo MCP tools.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.local.example` and set:

```bash
ANTHROPIC_API_KEY=your_api_key
```

3. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Optional Atlassian Rovo MCP

Run the OAuth setup command locally:

```bash
npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2
```

After OAuth succeeds, set this in `.env.local` and restart the dev server:

```bash
ATLASSIAN_MCP_ENABLED=true
```

Write actions are created as pending approval cards before execution.

## Optional Claude API Skills

Local skills are enabled by default as project instruction packs. To pass API Skills to Anthropic beta messages, set:

```bash
ANTHROPIC_ENABLE_API_SKILLS=true
ANTHROPIC_API_SKILLS_JSON=[{"skill_id":"your_skill_id","type":"custom","version":"latest"}]
```

## Local Data

Runtime data is stored under `data/` by default and is intentionally ignored by git.
