import { readSession, unauthorized } from "@/lib/session-server";
import { subscribe } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/** Signed-in browsers keep this stream open and refetch when a write happens anywhere. */
export async function GET(req: Request) {
  const session = readSession(req);
  if (!session) return unauthorized();

  const encoder = new TextEncoder();
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const unsubscribe = subscribe(send);
      send(": connected\n\n");
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      stop = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
