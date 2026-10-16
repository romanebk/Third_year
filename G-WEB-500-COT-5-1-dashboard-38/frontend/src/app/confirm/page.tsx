import Confirm16 from "@/components/ui/confirm-16";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return <Confirm16 initialToken={token ?? ""} />;
}