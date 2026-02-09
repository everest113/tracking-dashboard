#!/bin/bash
# Fix all 'any' types in the codebase

# Create backup
echo "Creating backups..."
find app components lib -name "*.ts" -o -name "*.tsx" | while read file; do
  cp "$file" "$file.bak"
done

echo "Fixing files..."

# Fix common error handling pattern: catch (error: any)
find app components lib -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/catch (error: any)/catch (error: unknown)/g'

# Fix common API response pattern: (data as any)
# This one needs manual review, so we'll skip automated replacement

echo "Done! Review changes and run: npm run lint"
