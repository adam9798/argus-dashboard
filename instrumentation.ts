// Runs once when the Next server starts. Starts node discovery, so addresses
// stay right across networks, and the Discord alert watcher, so alerts go out
// without anyone having the dashboard open.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDiscovery } = await import("@/lib/discovery/discover");
  startDiscovery();
  const { startAlertWatcher } = await import("@/lib/alerts/watcher");
  startAlertWatcher();
}
