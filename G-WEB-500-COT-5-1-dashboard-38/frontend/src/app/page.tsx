import { getBackendSession } from "@/lib/auth-guard";
import SaaSTemplate from "@/components/ui/saa-s-template";

export default async function HomePage() {
  const session = await getBackendSession();
  return <SaaSTemplate isLoggedIn={Boolean(session.user?.id)} />;
}