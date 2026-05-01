function hasValue(value: string | undefined | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

export function hasUsableSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || !hasValue(url) || !hasValue(anonKey)) {
    return false;
  }

  const resolvedUrl = url.trim();
  const resolvedAnonKey = anonKey.trim();

  return (
    !containsAny(resolvedUrl, ["example.supabase.co"]) &&
    !containsAny(resolvedAnonKey, ["placeholder"])
  );
}

export function hasUsableBeapiEnv() {
  const clientId = process.env.GUESTY_BEAPI_CLIENT_ID;
  const clientSecret = process.env.GUESTY_BEAPI_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret ||
    !hasValue(clientId) ||
    !hasValue(clientSecret)
  ) {
    return false;
  }

  const resolvedClientId = clientId.trim();
  const resolvedClientSecret = clientSecret.trim();

  return (
    !containsAny(resolvedClientId, ["placeholder", "guesty-beapi-client-id"]) &&
    !containsAny(resolvedClientSecret, [
      "placeholder",
      "guesty-beapi-client-secret",
    ])
  );
}

export function shouldSkipCiSupabaseFetches() {
  return process.env.GITHUB_ACTIONS === "true" && !hasUsableSupabasePublicEnv();
}

export function shouldSkipCiBeapiFetches() {
  return process.env.GITHUB_ACTIONS === "true" && !hasUsableBeapiEnv();
}
