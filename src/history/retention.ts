import type { Monitor } from "../adapters/monitor.ts";
import type { NetworkMonitor } from "../adapters/network-monitor.ts";
import type { HistoryStore } from "./storage.ts";
export const COMPACT_TARGET = 96;
// Called only after awaited persistence. No GM reads on the request path.
export async function compactClosed(
  monitor: Monitor,
  network: NetworkMonitor,
  history: HistoryStore,
  selected: () => string | null,
) {
  const journal = monitor.journal;
  const latest = () =>
    journal
      .ids()
      .filter((id) => journal.snapshot(id)?.start.mode === "live")
      .at(-1);
  const eligible = (id: string) =>
    id !== selected() &&
    id !== latest() &&
    monitor.canReleaseClosed(id) &&
    network.canReleaseClosed(id);
  for (const id of journal.ids()) {
    if (journal.ids().length <= COMPACT_TARGET) break;
    if (!eligible(id)) continue;
    const snapshot = journal.snapshot(id);
    if (!snapshot || !(await history.committedThrough(snapshot))) continue;
    // Async proof may race a late revision, UI selection or a clear epoch.
    if (
      !eligible(id) ||
      JSON.stringify(journal.snapshot(id)) !== JSON.stringify(snapshot)
    )
      continue;
    network.releaseClosedCapture(id);
    monitor.releaseClosedCapture(id);
    journal.discard(id);
    history.releaseCommitted(id);
  }
}
