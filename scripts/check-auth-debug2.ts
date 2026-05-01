import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key);

  const { data: listData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    // @ts-expect-error
    email: "trevor.stout164@gmail.com",
  });

  const user = listData?.users?.[0];
  console.log("User email:", JSON.stringify(user?.email));
  console.log("Match check:", user?.email?.toLowerCase() === "trevor.stout164@gmail.com");
  console.log("Identities:", JSON.stringify(user?.identities?.map(i => i.provider)));
}

main();
