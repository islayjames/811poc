#!/bin/bash

# Sprint 3 E2E Test Runner
# Usage: ./test-sprint3.sh [smoke|stable|full|help]

set -e

echo "🧪 Sprint 3 E2E Test Runner"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from frontend directory"
    exit 1
fi

# Check if Playwright is installed
if ! npx playwright --version &> /dev/null; then
    echo "❌ Error: Playwright not found. Install with: npm install @playwright/test"
    exit 1
fi

# Function to run tests with proper reporting
run_tests() {
    local test_file=$1
    local description=$2
    local timeout=${3:-30000}

    echo ""
    echo "🚀 Running $description..."
    echo "Test file: $test_file"
    echo "Timeout: ${timeout}ms"
    echo "----------------------------------------"

    npx playwright test "$test_file" \
        --reporter=list \
        --timeout="$timeout" \
        --output-dir=test-results/sprint3 || {
        echo "❌ Tests failed or encountered issues"
        echo "💡 Check test-results/sprint3/ for detailed output"
        return 1
    }

    echo "✅ $description completed"
}

# Function to show help
show_help() {
    echo ""
    echo "Sprint 3 Test Suite Options:"
    echo ""
    echo "  smoke   - Quick smoke tests (5 minutes)"
    echo "            Validates basic Sprint 3 functionality"
    echo ""
    echo "  stable  - Stable feature tests (15 minutes)"
    echo "            Robust tests with enhanced error handling"
    echo ""
    echo "  full    - Complete comprehensive suite (30+ minutes)"
    echo "            All Sprint 3 features with detailed scenarios"
    echo ""
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./test-sprint3.sh smoke"
    echo "  ./test-sprint3.sh stable"
    echo "  ./test-sprint3.sh full"
    echo ""
}

# Parse command line argument
TEST_TYPE=${1:-smoke}

case $TEST_TYPE in
    smoke)
        echo "🔍 Running Sprint 3 Smoke Tests"
        echo "Tests: 4 scenarios - Basic functionality validation"
        run_tests "tests/e2e/sprint3-smoke-test.spec.ts" "Sprint 3 Smoke Tests" 30000
        ;;

    stable)
        echo "🛡️ Running Sprint 3 Stable Tests"
        echo "Tests: 5 scenarios - Enhanced error handling and reliability"
        run_tests "tests/e2e/sprint3-workflow-stable.spec.ts" "Sprint 3 Stable Tests" 60000
        ;;

    full)
        echo "🎯 Running Complete Sprint 3 Test Suite"
        echo "Tests: 17 scenarios - Comprehensive feature coverage"
        run_tests "tests/e2e/sprint3-workflow.spec.ts" "Complete Sprint 3 Tests" 120000
        ;;

    help|--help|-h)
        show_help
        exit 0
        ;;

    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo ""
        show_help
        exit 1
        ;;
esac

echo ""
echo "📊 Test Summary"
echo "==============="
echo "Sprint 3 Features Tested:"
echo "  ✓ TRD-009: In-Edit Status Management"
echo "  ✓ TRD-010: Form Validation Enhancement"
echo "  ✓ TRD-011: Error Boundaries and Recovery"
echo "  ✓ Integration with Sprint 2 features"
echo "  ✓ Accessibility and responsive design"
echo ""
echo "📁 Test results saved to: test-results/sprint3/"
echo "🔍 For detailed analysis, check the test output above"
echo ""
echo "Next steps:"
echo "  - Review any failing tests in the output"
echo "  - Check screenshots for visual debugging"
echo "  - Run with --ui flag for interactive debugging"
echo ""
echo "Happy testing! 🎉"