import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { capture, nodeTokens } from "@/lib/fl/capture";
import { saverStatus, startRoundSaver } from "@/lib/fl/saver";
import { dataDir } from "@/lib/fl/store";
import type { HistoryResponse } from "@/lib/fl/types";
import { hasAnySession } from "@/lib/session";

// The saved history. The background saver (lib/fl/saver.ts) records rounds on
// its own; each read of the page also copies anything new from the aggregator
// and the nodes (lib/fl/capture.ts, GET-only).

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasAnySession(await cookies())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Idempotent. Covers a dev-server that loaded this file after start-up.
    startRoundSaver();
    const { history, errors } = await capture(await nodeTokens());
    const body: HistoryResponse = {
      history,
      errors,
      dataDir: dataDir(),
      saver: saverStatus(),
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      {
        error: `History could not be read or saved: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 500 },
    );
  }
}
