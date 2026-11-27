import type { NextConfig } from "next";
import { hostname, networkInterfaces } from "os";

// Phones and other computers on the home network load the dev server by this
// computer's address or name rather than localhost, and Next blocks its own
// scripts for any host not listed here. Read at start-up, so restart the
// server after moving to another network.
const thisComputer = [
  ...Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address),
  hostname().toLowerCase(),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [...thisComputer, "*.local"],
};

export default nextConfig;
