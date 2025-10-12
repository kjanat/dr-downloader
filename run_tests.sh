#!/bin/bash

# dr-downloader Test Suite Runner
# Comprehensive testing with coverage reporting and performance analysis

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COVERAGE_FILE="coverage.out"
COVERAGE_HTML="coverage.html"
BENCHMARK_FILE="benchmark.out"
TEST_TIMEOUT="30m"
VERBOSE=${VERBOSE:-false}
INTEGRATION=${INTEGRATION:-true}
PERFORMANCE=${PERFORMANCE:-true}

# Helper functions
log_info() {
	echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
	echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
	echo "Usage: $0 [OPTIONS]"
	echo ""
	echo "Options:"
	echo "  -h, --help              Show this help message"
	echo "  -v, --verbose           Enable verbose output"
	echo "  -u, --unit-only         Run only unit tests"
	echo "  -i, --integration-only  Run only integration tests"
	echo "  -p, --performance-only  Run only performance tests"
	echo "  -c, --coverage          Generate coverage report"
	echo "  -b, --benchmark         Run benchmarks"
	echo "  -s, --short             Run tests in short mode (skip long-running tests)"
	echo "  -r, --race              Enable race detection"
	echo "  --timeout DURATION      Set test timeout (default: 30m)"
	echo ""
	echo "Examples:"
	echo "  $0 -v -c              # Run all tests with verbose output and coverage"
	echo "  $0 -u -s              # Run only unit tests in short mode"
	echo "  $0 -b                 # Run benchmarks only"
	echo "  $0 --timeout 5m -s    # Run tests with 5 minute timeout in short mode"
}

# Parse command line arguments
UNIT_ONLY=false
INTEGRATION_ONLY=false
PERFORMANCE_ONLY=false
COVERAGE=false
BENCHMARK=false
SHORT=false
RACE=false

while [[ $# -gt 0 ]]; do
	case $1 in
	-h | --help)
		show_usage
		exit 0
		;;
	-v | --verbose)
		VERBOSE=true
		shift
		;;
	-u | --unit-only)
		UNIT_ONLY=true
		INTEGRATION=false
		PERFORMANCE=false
		shift
		;;
	-i | --integration-only)
		INTEGRATION_ONLY=true
		UNIT_ONLY=false
		PERFORMANCE=false
		shift
		;;
	-p | --performance-only)
		PERFORMANCE_ONLY=true
		UNIT_ONLY=false
		INTEGRATION=false
		shift
		;;
	-c | --coverage)
		COVERAGE=true
		shift
		;;
	-b | --benchmark)
		BENCHMARK=true
		shift
		;;
	-s | --short)
		SHORT=true
		shift
		;;
	-r | --race)
		RACE=true
		shift
		;;
	--timeout)
		TEST_TIMEOUT="$2"
		shift 2
		;;
	*)
		log_error "Unknown option: $1"
		show_usage
		exit 1
		;;
	esac
done

# Validate Go installation
if ! command -v go &>/dev/null; then
	log_error "Go is not installed or not in PATH"
	exit 1
fi

# Check Go version
GO_VERSION=$(go version | cut -d' ' -f3)
log_info "Using Go version: $GO_VERSION"

# Clean previous artifacts
cleanup() {
	log_info "Cleaning up previous test artifacts..."
	rm -f "$COVERAGE_FILE" "$COVERAGE_HTML" "$BENCHMARK_FILE"
	rm -rf ./test_tmp_*
}

# Build test flags
build_test_flags() {
	local flags=""

	if [[ "$VERBOSE" == "true" ]]; then
		flags="$flags -v"
	fi

	if [[ "$SHORT" == "true" ]]; then
		flags="$flags -short"
	fi

	if [[ "$RACE" == "true" ]]; then
		flags="$flags -race"
	fi

	flags="$flags -timeout $TEST_TIMEOUT"

	echo "$flags"
}

# Run unit tests
run_unit_tests() {
	log_info "Running unit tests..."

	local flags test_pattern
	flags=$(build_test_flags)
	test_pattern=""

	# Exclude integration and performance tests
	if [[ "$COVERAGE" == "true" ]]; then
		flags="$flags -coverprofile=$COVERAGE_FILE -covermode=atomic"
	fi

	# Run specific test patterns based on mode
	if [[ "$UNIT_ONLY" == "true" ]]; then
		# Run main tests excluding integration and performance
		test_pattern="-run ^Test.*$ -skip TestPerformance|TestEdgeCases.*Integration|TestFullDownloadWorkflow"
	fi

	if go test "$flags" "$test_pattern" ./...; then
		log_success "Unit tests passed"
		return 0
	else
		log_error "Unit tests failed"
		return 1
	fi
}

# Run integration tests
run_integration_tests() {
	log_info "Running integration tests..."

	local flags test_pattern
	flags=$(build_test_flags)

	# Run integration test patterns
	test_pattern="-run TestFullDownloadWorkflow|TestEdgeCases.*Integration"

	if go test "$flags" "$test_pattern" ./...; then
		log_success "Integration tests passed"
		return 0
	else
		log_error "Integration tests failed"
		return 1
	fi
}

# Run performance tests
run_performance_tests() {
	log_info "Running performance tests..."

	local flags test_pattern
	flags=$(build_test_flags)

	# Run performance test patterns
	test_pattern="-run TestPerformance"

	if go test "$flags" "$test_pattern" ./...; then
		log_success "Performance tests passed"
		return 0
	else
		log_error "Performance tests failed"
		return 1
	fi
}

# Run benchmarks
run_benchmarks() {
	log_info "Running benchmarks..."

	local flags="-bench=. -benchmem"

	if [[ "$VERBOSE" == "true" ]]; then
		flags="$flags -v"
	fi

	flags="$flags -timeout $TEST_TIMEOUT"

	if go test "$flags" ./... | tee "$BENCHMARK_FILE"; then
		log_success "Benchmarks completed"

		# Show benchmark summary
		if [[ -f "$BENCHMARK_FILE" ]]; then
			log_info "Benchmark summary:"
			grep -E "^Benchmark" "$BENCHMARK_FILE" | head -10
		fi

		return 0
	else
		log_error "Benchmarks failed"
		return 1
	fi
}

# Generate coverage report
generate_coverage_report() {
	if [[ ! -f "$COVERAGE_FILE" ]]; then
		log_warning "Coverage file not found, skipping coverage report"
		return 0
	fi

	log_info "Generating coverage report..."

	# Generate HTML coverage report
	if go tool cover -html="$COVERAGE_FILE" -o "$COVERAGE_HTML"; then
		log_success "Coverage report generated: $COVERAGE_HTML"
	else
		log_error "Failed to generate HTML coverage report"
	fi

	# Show coverage summary
	local coverage_percent
	coverage_percent=$(go tool cover -func="$COVERAGE_FILE" | grep total | awk '{print $3}')
	log_info "Total coverage: $coverage_percent"

	# Show detailed coverage by function
	if [[ "$VERBOSE" == "true" ]]; then
		log_info "Coverage by function:"
		go tool cover -func="$COVERAGE_FILE"
	fi
}

# Check test dependencies
check_dependencies() {
	log_info "Checking test dependencies..."

	# Check if go mod is initialized
	if [[ ! -f "go.mod" ]]; then
		log_warning "go.mod not found, initializing..."
		go mod init github.com/kjanat/dr-downloader
	fi

	# Download dependencies
	go mod tidy

	log_success "Dependencies checked"
}

# Run static analysis
run_static_analysis() {
	log_info "Running static analysis..."

	# Check if gofmt is needed
	if ! gofmt_output=$(gofmt -l .); then
		log_error "gofmt check failed"
		return 1
	fi

	if [[ -n "$gofmt_output" ]]; then
		log_warning "Files need formatting:"
		echo "$gofmt_output"
	else
		log_success "All files are properly formatted"
	fi

	# Check if go vet passes
	if go vet ./...; then
		log_success "go vet passed"
	else
		log_error "go vet failed"
		return 1
	fi

	return 0
}

# Main execution
main() {
	log_info "Starting dr-downloader test suite..."
	log_info "Configuration: VERBOSE=$VERBOSE, SHORT=$SHORT, RACE=$RACE, TIMEOUT=$TEST_TIMEOUT"

	# Cleanup previous runs
	cleanup

	# Check dependencies
	check_dependencies

	# Run static analysis
	if ! run_static_analysis; then
		log_error "Static analysis failed"
		exit 1
	fi

	local exit_code=0

	# Run tests based on mode
	if [[ "$UNIT_ONLY" == "true" ]]; then
		run_unit_tests || exit_code=1
	elif [[ "$INTEGRATION_ONLY" == "true" ]]; then
		run_integration_tests || exit_code=1
	elif [[ "$PERFORMANCE_ONLY" == "true" ]]; then
		run_performance_tests || exit_code=1
	else
		# Run all test types
		run_unit_tests || exit_code=1

		if [[ "$INTEGRATION" == "true" ]]; then
			run_integration_tests || exit_code=1
		fi

		if [[ "$PERFORMANCE" == "true" ]]; then
			run_performance_tests || exit_code=1
		fi
	fi

	# Run benchmarks if requested
	if [[ "$BENCHMARK" == "true" ]]; then
		run_benchmarks || exit_code=1
	fi

	# Generate coverage report if requested
	if [[ "$COVERAGE" == "true" ]]; then
		generate_coverage_report
	fi

	# Final summary
	if [[ $exit_code -eq 0 ]]; then
		log_success "All tests completed successfully!"
	else
		log_error "Some tests failed!"
	fi

	log_info "Test artifacts:"
	[[ -f "$COVERAGE_FILE" ]] && echo "  - Coverage data: $COVERAGE_FILE"
	[[ -f "$COVERAGE_HTML" ]] && echo "  - Coverage report: $COVERAGE_HTML"
	[[ -f "$BENCHMARK_FILE" ]] && echo "  - Benchmark results: $BENCHMARK_FILE"

	exit $exit_code
}

# Run main function
main "$@"
