#!/bin/bash
# ============================================================================
# BLOG MIGRATION v3 — Proper HTML parsing for clean content
# ============================================================================
# Requires: pip3 install beautifulsoup4
# ============================================================================
set -e

# Install BeautifulSoup if not present
pip3 install beautifulsoup4 --break-system-packages -q 2>/dev/null || true

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

echo "🔄 Blog Migration v3 — Clean HTML Parsing"
echo "============================================"

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
from bs4 import BeautifulSoup
import re

html = open('$TEMP_FILE').read()
soup = BeautifulSoup(html, 'html.parser')

content_html = ''

# ── Strategy 1: Elementor post content widget ──
widget = soup.find('div', class_=lambda c: c and 'elementor-widget-theme-post-content' in c)
if widget:
    container = widget.find('div', class_='elementor-widget-container')
    if container:
        content_html = str(container)

# ── Strategy 2: entry-content div ──
if not content_html:
    entry = soup.find('div', class_='entry-content')
    if entry:
        content_html = str(entry)

# ── Strategy 3: article body after header ──
if not content_html:
    article = soup.find('article')
    if article:
        header = article.find('header')
        if header:
            header.decompose()
        content_html = str(article)

if not content_html:
    print("FAIL: no content found")
    exit(1)

# ── Parse the extracted content and clean it ──
content_soup = BeautifulSoup(content_html, 'html.parser')

# Remove ALL style tags
for tag in content_soup.find_all('style'):
    tag.decompose()

# Remove ALL script tags
for tag in content_soup.find_all('script'):
    tag.decompose()

# Remove ALL noscript tags
for tag in content_soup.find_all('noscript'):
    tag.decompose()

# Remove sidebar/widget sections (Recent Posts, etc.)
for tag in content_soup.find_all(['aside', 'nav']):
    tag.decompose()

for tag in content_soup.find_all(class_=lambda c: c and any(x in str(c) for x in [
    'widget', 'sidebar', 'recent-posts', 'wp-block-latest-posts',
    'post-navigation', 'nav-links', 'comments', 'comment-respond',
    'ast-post-navigation', 'post-meta', 'entry-meta', 'entry-footer',
    'ast-single-post-order', 'ast-row-container-inner',
])):
    tag.decompose()

# Remove Elementor wrapper elements but keep their children
for class_pattern in ['elementor-element', 'elementor-widget', 'elementor-container',
                       'elementor-column', 'elementor-section', 'elementor-row',
                       'elementor-widget-container', 'elementor-column-wrap',
                       'elementor-widget-wrap', 'elementor-inner']:
    for tag in content_soup.find_all(class_=lambda c: c and class_pattern in str(c)):
        tag.unwrap()

# Remove all data- attributes
for tag in content_soup.find_all(True):
    attrs_to_remove = [a for a in tag.attrs if a.startswith('data-')]
    for attr in attrs_to_remove:
        del tag[attr]
    # Remove elementor-specific classes
    if tag.get('class'):
        tag['class'] = [c for c in tag['class'] if not c.startswith('elementor') and not c.startswith('ast-') and not c.startswith('wp-block-')]
        if not tag['class']:
            del tag['class']
    # Remove empty style attributes
    if tag.get('style') and not tag['style'].strip():
        del tag['style']

# Remove empty divs (no text content and no meaningful children)
for tag in content_soup.find_all('div'):
    if not tag.get_text(strip=True) and not tag.find(['img', 'iframe', 'video', 'table']):
        tag.decompose()

# Remove remaining empty spans
for tag in content_soup.find_all('span'):
    if not tag.get_text(strip=True) and not tag.find(['img']):
        tag.decompose()

# Get clean HTML
clean = str(content_soup)

# Remove the outermost wrapper div if present
clean = re.sub(r'^<div[^>]*>\s*', '', clean, count=1)
clean = re.sub(r'\s*</div>\s*$', '', clean, count=1)

# Clean excessive whitespace
clean = re.sub(r'\n{3,}', '\n\n', clean)
clean = clean.strip()

# Escape for JS template literal
clean = clean.replace('\\\\', '\\\\\\\\').replace('\`', '\\\\\`').replace('\${', '\\\${')

with open('$POST_DIR/content.ts', 'w') as f:
    f.write('export const pageContent = \`' + clean + '\`;\n')

# Count content elements
soup2 = BeautifulSoup(clean, 'html.parser')
paragraphs = len(soup2.find_all('p'))
images = len(soup2.find_all('img'))
headings = len(soup2.find_all(['h2', 'h3', 'h4']))

print(f"OK — {len(clean)} chars, {paragraphs}p, {headings}h, {images}img")
PYEOF

  RESULT=$?
  if [ $RESULT -eq 0 ]; then
    MIGRATED=$((MIGRATED + 1))
  else
    echo "❌ extraction failed"
    FAILED=$((FAILED + 1))
    cat > "$POST_DIR/content.ts" << 'PLACEHOLDER'
export const pageContent = `<p>This post is being migrated. Please check back soon.</p>`;
PLACEHOLDER
  fi
  
  rm -f "$TEMP_FILE"
done

echo ""
echo "============================================"
echo "✅ Migrated: $MIGRATED"
echo "❌ Failed: $FAILED"
echo ""
echo "Restart: rm -rf .next && npm run dev"
