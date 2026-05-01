#!/bin/bash
# ============================================================================
# BLOG MIGRATION v2 — Better content extraction
# ============================================================================
set -e

BLOG_DIR="src/app/blog"

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

echo "🔄 Blog Migration v2 — Clean content extraction"
echo "================================================="

MIGRATED=0
FAILED=0

for entry in "${POSTS[@]}"; do
  NEW_SLUG="${entry%%|*}"
  OLD_SLUG="${entry##*|}"
  
  WP_URL="https://booktraverse.com/traversehospitality/blog/${OLD_SLUG}/"
  POST_DIR="${BLOG_DIR}/${NEW_SLUG}"
  
  echo -n "  📝 ${NEW_SLUG}... "
  
  mkdir -p "$POST_DIR"
  
  TEMP_FILE=$(mktemp)
  HTTP_CODE=$(curl -s -o "$TEMP_FILE" -w "%{http_code}" "$WP_URL" 2>/dev/null)
  
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ HTTP $HTTP_CODE"
    FAILED=$((FAILED + 1))
    rm -f "$TEMP_FILE"
    continue
  fi
  
  python3 << PYEOF
import re

html = open('$TEMP_FILE').read()
content = ''

# Strategy 1: Find the Elementor post content widget
# This is the most reliable — Elementor wraps the actual post content in a specific widget
match = re.search(
    r'elementor-widget-theme-post-content.*?<div[^>]*class="elementor-widget-container"[^>]*>(.*?)</div>\s*</div>\s*</div>\s*</div>\s*</section>',
    html, re.DOTALL
)
if match:
    content = match.group(1).strip()

# Strategy 2: Find entry-content div
if not content:
    match = re.search(r'<div[^>]*class="entry-content[^"]*"[^>]*>(.*?)</div>\s*(?:</div>\s*)*?(?=<footer|<nav|<div[^>]*class="post-navigation|<div[^>]*id="comments)', html, re.DOTALL)
    if match:
        content = match.group(1).strip()

# Strategy 3: Find content between ast-post-format- and the footer
if not content:
    match = re.search(r'class="entry-content[^"]*"[^>]*>(.*?)<(?:footer|div[^>]*class="(?:ast-post|post-navigation))', html, re.DOTALL)
    if match:
        content = match.group(1).strip()

# Strategy 4: Broadest — everything in the article tag after the header
if not content:
    match = re.search(r'<article[^>]*>.*?</header>(.*?)</article>', html, re.DOTALL)
    if match:
        content = match.group(1).strip()

if not content:
    print("FAIL: no content found")
    exit(1)

# Clean up: remove ALL <style> tags and their contents
content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL)

# Remove <script> tags
content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)

# Remove WordPress/Elementor wrapper divs but keep their content
content = re.sub(r'<div[^>]*class="[^"]*(?:elementor-element|elementor-widget|elementor-container|elementor-column|elementor-section|widget-wrap|elementor-widget-container|elementor-row)[^"]*"[^>]*>', '', content)

# Remove data attributes
content = re.sub(r'\s*data-[a-z-]+="[^"]*"', '', content)

# Remove empty divs
content = re.sub(r'<div>\s*</div>', '', content)

# Remove excessive closing divs (leftover from stripped opening divs)
# Count and balance divs
open_divs = len(re.findall(r'<div[^>]*>', content))
close_divs = len(re.findall(r'</div>', content))
excess = close_divs - open_divs
if excess > 0:
    # Remove excess closing divs from the end
    for _ in range(excess):
        content = re.sub(r'</div>\s*$', '', content.rstrip())

# Remove inline styles that are just WordPress noise
content = re.sub(r'\s*style="[^"]*(?:elementor|var\(--)[^"]*"', '', content)

# Clean up whitespace
content = re.sub(r'\n{3,}', '\n\n', content)
content = content.strip()

# Escape for JS template literal
content = content.replace('\\\\', '\\\\\\\\').replace('\`', '\\\\\`').replace('\${', '\\\${')

with open('$POST_DIR/content.ts', 'w') as f:
    f.write('export const pageContent = \`' + content + '\`;\n')

print("OK ({} chars)".format(len(content)))
PYEOF

  RESULT=$?
  if [ $RESULT -eq 0 ]; then
    MIGRATED=$((MIGRATED + 1))
  else
    echo "❌"
    FAILED=$((FAILED + 1))
    cat > "$POST_DIR/content.ts" << 'PLACEHOLDER'
export const pageContent = `<p>This post is being migrated. Please check back soon.</p>`;
PLACEHOLDER
  fi
  
  rm -f "$TEMP_FILE"
done

echo ""
echo "================================================="
echo "✅ Migrated: $MIGRATED"
echo "❌ Failed: $FAILED"
echo ""
echo "Restart dev server: rm -rf .next && npm run dev"
