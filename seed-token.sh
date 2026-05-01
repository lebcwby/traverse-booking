#!/bin/bash
# ============================================================================
# SEED GUESTY BEAPI TOKEN
# ============================================================================
# Run this ONCE after setting up your Guesty BEAPI app and Supabase database.
# It requests an OAuth token from Guesty and stores it in the guesty_tokens table.
#
# Usage:
#   ./seed-token.sh <client_id> <client_secret>
#
# You also need these env vars set (or in .env.local):
#   NEXT_PUBLIC_SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
# ============================================================================

set -e

CLIENT_ID="$1"
CLIENT_SECRET="$2"

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "Usage: ./seed-token.sh <guesty_beapi_client_id> <guesty_beapi_client_secret>"
  exit 1
fi

# Load env vars from .env.local if present
if [ -f .env.local ]; then
  export $(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=' .env.local | xargs)
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  echo "   Set these in .env.local or export them before running this script."
  exit 1
fi

echo "🔑 Requesting BEAPI token from Guesty..."

# Request the BEAPI OAuth token
RESPONSE=$(curl -s -X POST "https://booking.guesty.com/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=booking_engine:api")

# Check for errors
if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ Guesty OAuth error:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

# Extract token and expiry
ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
EXPIRES_IN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['expires_in'])")
EXPIRES_AT=$(python3 -c "import time; print(int(time.time() * 1000) + ${EXPIRES_IN} * 1000)")
CREATED_AT=$(python3 -c "import time; print(int(time.time() * 1000))")

echo "✅ Got BEAPI token (expires in ${EXPIRES_IN}s = $(echo "$EXPIRES_IN / 3600" | bc)h)"

# Store in Supabase
echo "📦 Storing token in Supabase guesty_tokens table..."

UPSERT_RESPONSE=$(curl -s -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/guesty_tokens" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{
    \"token_type\": \"beapi\",
    \"access_token\": \"${ACCESS_TOKEN}\",
    \"expires_at\": ${EXPIRES_AT},
    \"created_at\": ${CREATED_AT}
  }")

if echo "$UPSERT_RESPONSE" | grep -q "error\|Error"; then
  echo "❌ Supabase upsert error:"
  echo "$UPSERT_RESPONSE"
  exit 1
fi

echo "✅ BEAPI token stored successfully!"
echo ""
echo "Now request the OpenAPI token (for sync functions)..."

# Also seed the OpenAPI token
echo "🔑 Requesting OpenAPI token from Guesty..."

# Check if we have OpenAPI credentials
if [ -f .env.local ]; then
  OPENAPI_ID=$(grep "^GUESTY_CLIENT_ID=" .env.local | cut -d'=' -f2)
  OPENAPI_SECRET=$(grep "^GUESTY_CLIENT_SECRET=" .env.local | cut -d'=' -f2)
fi

if [ -z "$OPENAPI_ID" ] || [ -z "$OPENAPI_SECRET" ]; then
  echo "⚠️  No OpenAPI credentials found (GUESTY_CLIENT_ID / GUESTY_CLIENT_SECRET)"
  echo "   Skipping OpenAPI token. You can add these later for listing sync."
  echo ""
  echo "Done! Your BEAPI token is ready."
  echo "Restart the dev server and try searching properties at localhost:3000/properties"
  exit 0
fi

OPENAPI_RESPONSE=$(curl -s -X POST "https://open-api.guesty.com/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${OPENAPI_ID}&client_secret=${OPENAPI_SECRET}&scope=open-api")

if echo "$OPENAPI_RESPONSE" | grep -q "error"; then
  echo "⚠️  OpenAPI token request failed (non-critical):"
  echo "$OPENAPI_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$OPENAPI_RESPONSE"
else
  OA_TOKEN=$(echo "$OPENAPI_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  OA_EXPIRES_IN=$(echo "$OPENAPI_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['expires_in'])")
  OA_EXPIRES_AT=$(python3 -c "import time; print(int(time.time() * 1000) + ${OA_EXPIRES_IN} * 1000)")
  OA_CREATED_AT=$(python3 -c "import time; print(int(time.time() * 1000))")

  curl -s -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/guesty_tokens" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{
      \"token_type\": \"openapi\",
      \"access_token\": \"${OA_TOKEN}\",
      \"expires_at\": ${OA_EXPIRES_AT},
      \"created_at\": ${OA_CREATED_AT}
    }" > /dev/null

  echo "✅ OpenAPI token stored too!"
fi

echo ""
echo "============================================"
echo "✅ All done! Token(s) seeded in Supabase."
echo ""
echo "Next steps:"
echo "  1. Restart dev server: rm -rf .next && npm run dev"
echo "  2. Visit localhost:3000/properties"
echo "  3. Try searching for properties"
echo "============================================"
