import { getRuntimeStatus } from "@/lib/env";
import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readData();
  return Response.json({
    ...data,
    runtime: getRuntimeStatus(),
  });
}

