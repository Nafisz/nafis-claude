import { z } from "zod";

import { appendUserMessage, runAssistantTurn } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const chatSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  message: z.string().min(1),
  fileIds: z.array(z.string()).default([]),
  model: z.string().optional(),
  toolsEnabled: z.boolean().default(true),
});

function sse(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request) {
  const body = chatSchema.parse(await request.json());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sse(event, payload)));
      };

      try {
        const userMessage = await appendUserMessage({
          sessionId: body.sessionId,
          projectId: body.projectId,
          content: body.message,
          fileIds: body.fileIds,
        });
        send("user", { message: userMessage });

        await runAssistantTurn({
          sessionId: body.sessionId,
          projectId: body.projectId,
          model: body.model,
          toolsEnabled: body.toolsEnabled,
          send,
        });
      } catch (error) {
        send("error", {
          message: error instanceof Error ? error.message : "Unknown chat error.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

