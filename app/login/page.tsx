import { LoginForm } from "@/components/LoginForm";
import { configuredNodes } from "@/lib/nodes";

// Server component, so the camera labels come straight from ARGUS_NODES
// without opening a node-list API to signed-out visitors.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { from } = await searchParams;
  const cameras = configuredNodes().map((node) => node.name);
  return <LoginForm cameras={cameras} from={typeof from === "string" ? from : undefined} />;
}
