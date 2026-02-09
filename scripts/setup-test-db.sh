#!/bin/bash
set -e

echo "🔧 Setting up test database..."

# Check if DATABASE_URL is set in .env.test
if [ ! -f .env.test ]; then
  echo "❌ .env.test file not found"
  echo "   Copy .env.test.example and configure your test database URL"
  exit 1
fi

# Load test DATABASE_URL
export $(grep -v '^#' .env.test | xargs)

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set in .env.test"
  exit 1
fi

echo "📦 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Test database ready!"
echo ""
echo "To run tests:"
echo "  npm test                    # Run all tests"
echo "  npm test -- tests/unit/     # Run only unit tests"
echo "  npm test -- tests/integration/  # Run only integration tests"
