#!/bin/bash
set -e
echo "🔄 Starting rebrand: Stay Portland → Book Traverse"

find src supabase scripts public -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" -o -name "*.html" \) | while read file; do
  sed -i '' \
    -e 's/Stay Portland/Book Traverse/g' \
    -e 's/stay portland/book traverse/g' \
    -e 's/stay-portland/book-traverse/g' \
    -e 's/StayPortland/BookTraverse/g' \
    -e 's/stayportland\.com/booktraverse.com/g' \
    -e 's/www\.stayportland\.com/www.booktraverse.com/g' \
    -e 's/stayportland/booktraverse/g' \
    -e 's/(503) 961-0874/(720) 759-2013/g' \
    -e 's/5039610874/7207592013/g' \
    -e 's/hello@stayportland\.com/info@booktraverse.com/g' \
    "$file"
done

sed -i '' 's/"stay-portland"/"book-traverse"/g' package.json

echo "✅ Brand names, phone, email replaced"
echo ""
echo "Remaining: Replace logos, update homepage content, update nav links"
