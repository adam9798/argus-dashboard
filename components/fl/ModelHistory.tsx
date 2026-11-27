import { formatEpoch } from "@/lib/format";
import type { HistoryFile, SaverStatus } from "@/lib/fl/types";

// The models each node has accepted, and whether rounds are being saved right
// now. The list is saved with the history, so it shows with a node off.

function checkedText(status: SaverStatus): { text: string; bad: boolean } {
  if (status.state === "ok" && status.checkedAt !== null) {
    return { text: `Saving rounds · checked ${formatEpoch(status.checkedAt)}`, bad: false };
  }
  if (status.state === "checking") return { text: "Checking…", bad: false };
  const since =
    status.checkedAt !== null ? ` · last checked ${formatEpoch(status.checkedAt)}` : "";
  if (status.state === "signin") {
    return { text: `Not saving: the node needs a sign-in${since}`, bad: true };
  }
  if (status.state === "error") {
    return { text: `Not saving: ${status.detail ?? "error"}${since}`, bad: true };
  }
  return { text: `Offline: not saving${since}`, bad: true };
}

export function ModelHistory({
  history,
  saver,
}: {
  history: HistoryFile;
  saver: SaverStatus[];
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-foreground">Accepted models</h2>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        New rounds are saved automatically while this dashboard is running. A node
        keeps only its latest round, so one that is rejected while the dashboard is
        off, and followed by a node restart, is not picked up.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {saver.map((status) => {
          const versions = [...(history.versions?.[status.nodeId] ?? [])].sort(
            (a, b) => b.version - a.version,
          );
          const checked = checkedText(status);
          return (
            <div key={status.nodeId} className="card card-lift p-4 text-xs">
              <h3 className="text-sm text-foreground">{status.name}</h3>
              <p className={`mt-1 ${checked.bad ? "text-danger" : "text-muted"}`}>
                {checked.text}
              </p>
              {versions.length === 0 ? (
                <p className="mt-4 text-muted">No accepted model reported yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {versions.map((model) => (
                    <li key={model.label} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm text-foreground">{model.label}</span>
                        {model.live && (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">
                            in use
                          </span>
                        )}
                      </span>
                      <span className="text-right text-muted">
                        {model.balanced_accuracy !== undefined &&
                          `balanced accuracy ${model.balanced_accuracy.toFixed(2)}`}
                        {model.at !== undefined && (
                          <span className="block">{formatEpoch(model.at)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
