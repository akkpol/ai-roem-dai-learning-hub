import { IdentityAccountOperations } from "../../_components/identity-account-operations";

export default async function IdentityAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return (
    <section className="flex flex-col gap-6" aria-labelledby="account-title">
      <div className="flex max-w-3xl flex-col gap-2">
        <p className="text-sm text-muted-foreground">Identity operations</p>
        <h1 id="account-title" className="font-heading text-2xl font-medium">
          รายละเอียดบัญชี
        </h1>
        <p className="break-all text-sm text-muted-foreground">{accountId}</p>
      </div>
      <IdentityAccountOperations accountId={accountId} />
    </section>
  );
}
