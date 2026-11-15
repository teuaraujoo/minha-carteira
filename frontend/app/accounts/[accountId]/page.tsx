import { AccountDetailView } from "@/components/accounts/account-detail-view";
import { AppShell } from "@/components/app-shell";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  return (
    <AppShell>
      <AccountDetailView accountId={accountId} />
    </AppShell>
  );
}
