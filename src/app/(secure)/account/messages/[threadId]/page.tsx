import { redirect } from "next/navigation";

export default async function ThreadRedirectPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  redirect(`/account/messages?thread=${threadId}`);
}
