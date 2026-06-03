import { promises as fs } from "node:fs";
import path from "node:path";

import { createId, nowIso } from "@/lib/ids";
import { addFileToData, getUploadsDir, updateData } from "@/lib/store";
import type { StoredFile } from "@/lib/types";

export const dynamic = "force-dynamic";

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
]);

async function extractPreview(file: File, bytes: Uint8Array) {
  const ext = path.extname(file.name).toLowerCase();
  const textLike =
    TEXT_MIME_TYPES.has(file.type) ||
    [".md", ".txt", ".csv", ".json", ".xml", ".log"].includes(ext);

  if (!textLike) {
    return `Binary file stored locally. MIME: ${file.type || "unknown"}. Size: ${file.size} bytes.`;
  }

  return new TextDecoder().decode(bytes).slice(0, 16000);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "File is larger than 20MB" }, { status: 413 });
  }

  const projectId = String(form.get("projectId") ?? "") || null;
  const sessionId = String(form.get("sessionId") ?? "") || null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = createId("file");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const storedName = `${id}-${safeName}`;
  const storagePath = path.join(getUploadsDir(), storedName);
  await fs.mkdir(getUploadsDir(), { recursive: true });
  await fs.writeFile(storagePath, bytes);

  const now = nowIso();
  const stored = await updateData((data) => {
    const item: StoredFile = {
      id,
      projectId,
      sessionId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storagePath,
      textPreview: "",
      providerFileId: null,
      status: "ready",
      createdAt: now,
    };
    addFileToData(data, item);
    return item;
  });

  const preview = await extractPreview(file, bytes);
  const updated = await updateData((data) => {
    const item = data.files.find((candidate) => candidate.id === id);
    if (!item) {
      return stored;
    }
    item.textPreview = preview;
    return item;
  });

  return Response.json({ file: updated });
}

