import { lookupAuthUserByEmail } from "@/lib/auth-lookup";

async function main() {
  const result = await lookupAuthUserByEmail("trevor.stout164@gmail.com");
  console.log("Lookup result:", JSON.stringify(result, null, 2));
}

main();
