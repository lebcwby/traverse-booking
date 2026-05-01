#!/bin/bash
# ============================================================================
# BLOG MIGRATION SCRIPT
# ============================================================================
# Fetches all blog posts from WordPress and creates Next.js content files.
#
# Usage:
#   cd ~/guesty\ direct\ booking\ website/guesty-direct-booking-template-main
#   chmod +x migrate-blog.sh
#   ./migrate-blog.sh
# ============================================================================

set -e

BLOG_DIR="src/app/blog"

# Blog post mappings: "new-slug|old-wordpress-slug"
POSTS=(
  "grand-lodge-traverse-vs-vail-resorts|grand-lodge-crested-butte-condos-traverse-vs-vail-resorts-what-s-the-difference"
  "pet-friendly-crested-butte-grand-lodge-153|pet-friendly-crested-butte-condo-grand-lodge-studio-153-walk-to-the-lifts-pool-hot-tub"
  "leadville-complete-visitors-guide|leadville-colorado-the-complete-visitor-s-guide-2026-2"
  "budget-friendly-ski-vacation-leadville|budget-friendly-ski-vacation-affordable-leadville-rentals-near-top-resorts"
  "cozy-winter-rentals-leadville|10-cozy-vacation-rentals-in-leadville-for-the-ultimate-winter-getaway"
  "christmas-getaway-leadville|ultimate-guide-to-a-cozy-christmas-2024-getaway-in-leadville-top-vacation-rentals-for-families"
  "fall-adventures-leadville-hiking-biking|thrilling-fall-adventures-vacation-rentals-near-leadvilles-best-hiking-and-biking-trails"
  "top-5-winter-ski-rentals-leadville|top-5-cozy-vacation-rentals-in-leadville-for-winter-ski-enthusiasts"
  "thanksgiving-leadville-family-rentals|thanksgiving-in-leadville-family-friendly-vacation-rentals-for-a-mountain-holiday-getaway"
  "romantic-getaways-leadville|romantic-getaways-in-leadville-cozy-vacation-rentals-for-two"
  "labor-day-leadville|10-reasons-to-book-a-leadville-vacation-rental-for-labor-day-weekend"
  "solo-to-group-getaways-leadville|from-solo-retreats-to-group-getaways-sizing-up-leadvilles-vacation-rental-options"
  "top-10-leadville-vacation-rentals|top-10-airbnb-properties-in-leadville-co"
  "ski-resorts-near-leadville|top-7-ski-resorts-that-are-less-than-an-hour-drive-from-leadville-colorado"
  "introducing-traverse-hospitality|introducing-traverse-hospitality-a-new-chapter-in-our-journey"
  "vacation-rental-interior-design-tips|dos-and-donts-of-vacation-rental-interior-design"
  "pros-and-cons-online-reviews|pros-and-cons-of-online-reviews"
  "historic-houses-leadville|historic-houses-in-leadville"
)

echo "🔄 Blog Migration: WordPress → Next.js"
echo "========================================"
echo "Migrating ${#POSTS[@]} blog posts..."
echo ""

MIGRATED=0
FAILED=0

for entry in "${POSTS[@]}"; do
  NEW_SLUG="${entry%%|*}"
  OLD_SLUG="${entry##*|}"
  
  WP_URL="https://booktraverse.com/traversehospitality/blog/${OLD_SLUG}/"
  POST_DIR="${BLOG_DIR}/${NEW_SLUG}"
  
  echo -n "  📝 ${NEW_SLUG}... "
  
  # Create directory
  mkdir -p "$POST_DIR"
  
  # Fetch the WordPress page
  TEMP_FILE=$(mktemp)
  HTTP_CODE=$(curl -s -o "$TEMP_FILE" -w "%{http_code}" "$WP_URL" 2>/dev/null)
  
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ HTTP $HTTP_CODE"
    FAILED=$((FAILED + 1))
    rm -f "$TEMP_FILE"
    continue
  fi
  
  # Extract article content using Python
  python3 -c "
import re, sys

html = open('$TEMP_FILE').read()

# Extract the article/post content
# WordPress wraps post content in .entry-content or .elementor-widget-theme-post-content
content = ''

# Try to find Elementor post content
match = re.search(r'<div[^>]*class=\"[^\"]*entry-content[^\"]*\"[^>]*>(.*?)</div>\s*</div>\s*</article>', html, re.DOTALL)
if match:
    content = match.group(1).strip()

if not content:
    # Try alternative: find content between entry-content markers
    match = re.search(r'entry-content[^>]*>(.*?)</div>\s*(?:</div>\s*)*</article>', html, re.DOTALL)
    if match:
        content = match.group(1).strip()

if not content:
    # Fallback: extract everything in the main article area
    match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
    if match:
        content = match.group(1).strip()
        # Remove header/meta sections
        content = re.sub(r'<header.*?</header>', '', content, flags=re.DOTALL)

if not content:
    print('NO_CONTENT', file=sys.stderr)
    sys.exit(1)

# Clean up WordPress artifacts
content = re.sub(r'<div[^>]*class=\"[^\"]*elementor[^\"]*\"[^>]*>', '', content)
content = re.sub(r'<div[^>]*class=\"[^\"]*widget[^\"]*\"[^>]*>', '', content)
content = re.sub(r'<section[^>]*class=\"[^\"]*elementor[^\"]*\"[^>]*>', '', content)
# Remove empty divs
content = re.sub(r'<div>\s*</div>', '', content)
# Remove WordPress inline styles that are just wrappers
content = re.sub(r'<div[^>]*data-id=\"[^\"]*\"[^>]*>', '<div>', content)

# Escape for JS template literal
content = content.replace('\\\\', '\\\\\\\\').replace('\`', '\\\\\`').replace('\${', '\\\\\${')

# Write content.ts
with open('$POST_DIR/content.ts', 'w') as f:
    f.write('export const pageContent = \`' + content + '\`;\n')

print('OK')
" 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "✅"
    MIGRATED=$((MIGRATED + 1))
  else
    echo "❌ content extraction failed"
    FAILED=$((FAILED + 1))
    # Create placeholder content
    cat > "$POST_DIR/content.ts" << 'PLACEHOLDER'
export const pageContent = `<p>This post is being migrated. Please check back soon.</p>`;
PLACEHOLDER
  fi
  
  rm -f "$TEMP_FILE"
done

echo ""
echo "========================================"
echo "✅ Migrated: $MIGRATED"
echo "❌ Failed: $FAILED"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' and visit localhost:3000/blog"
echo "  2. Click through each post to verify content"
echo "  3. Fix any posts that show placeholder content"
echo ""
