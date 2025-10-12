# dr-downloader Makefile
# Comprehensive build and test management

.PHONY: help build test test-unit test-integration test-performance test-all
.PHONY: coverage benchmark lint fmt clean install deps
.PHONY: test-quick test-verbose test-race docker-test fake

# Default target
.DEFAULT_GOAL := help

# Variables
BINARY_NAME := dr-downloader
COVERAGE_FILE := coverage.out
COVERAGE_HTML := coverage.html
BENCHMARK_FILE := benchmark.out
LINT_CACHE := .lint-cache

# Go build flags
BUILD_FLAGS := -ldflags="-s -w"
TEST_FLAGS := -timeout=30m
BENCH_FLAGS := -bench=. -benchmem

# Colors for pretty printing
GREEN := \\033[0;32m
YELLOW := \\033[1;33m
RED := \\033[0;31m
NC := \\033[0m # No Color

help: ## Show this help message
	@echo "dr-downloader - Build and Test Management"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Examples:"
	@echo "  make test-all        # Run all tests with coverage"
	@echo "  make test-quick      # Run tests in short mode"
	@echo "  make benchmark       # Run performance benchmarks"
	@echo "  make coverage        # Generate coverage report"
	@echo "  make fake            # Test authentication with mock values"

build: ## Build the binary
	@echo "$(GREEN)Building $(BINARY_NAME)...$(NC)"
	go build $(BUILD_FLAGS) -o $(BINARY_NAME) .
	@echo "$(GREEN)Build complete: $(BINARY_NAME)$(NC)"

install: build ## Install the binary to GOPATH/bin
	@echo "$(GREEN)Installing $(BINARY_NAME)...$(NC)"
	go install $(BUILD_FLAGS) .
	@echo "$(GREEN)Installation complete$(NC)"

deps: ## Download and verify dependencies
	@echo "$(GREEN)Downloading dependencies...$(NC)"
	go mod download
	go mod verify
	go mod tidy
	@echo "$(GREEN)Dependencies updated$(NC)"

fmt: ## Format Go code
	@echo "$(GREEN)Formatting code...$(NC)"
	gofmt -s -w .
	@echo "$(GREEN)Code formatted$(NC)"

lint: ## Run static analysis
	@echo "$(GREEN)Running static analysis...$(NC)"
	@if ! command -v golangci-lint > /dev/null 2>&1; then \
		echo "$(YELLOW)golangci-lint not found, using go vet...$(NC)"; \
		go vet ./...; \
	else \
		golangci-lint run --fix --cache-dir $(LINT_CACHE); \
	fi
	@echo "$(GREEN)Static analysis complete$(NC)"

test: ## Run all tests
	@echo "$(GREEN)Running all tests...$(NC)"
	./run_tests.sh -v

test-unit: ## Run unit tests only
	@echo "$(GREEN)Running unit tests...$(NC)"
	./run_tests.sh -u -v

test-integration: ## Run integration tests only
	@echo "$(GREEN)Running integration tests...$(NC)"
	./run_tests.sh -i -v

test-performance: ## Run performance tests only
	@echo "$(GREEN)Running performance tests...$(NC)"
	./run_tests.sh -p -v

test-all: ## Run all tests with coverage
	@echo "$(GREEN)Running complete test suite...$(NC)"
	./run_tests.sh -v -c

test-quick: ## Run tests in short mode (skip long-running tests)
	@echo "$(GREEN)Running quick tests...$(NC)"
	./run_tests.sh -s -v

test-verbose: ## Run tests with verbose output
	@echo "$(GREEN)Running verbose tests...$(NC)"
	./run_tests.sh -v

test-race: ## Run tests with race detection
	@echo "$(GREEN)Running tests with race detection...$(NC)"
	./run_tests.sh -r -v

coverage: ## Generate test coverage report
	@echo "$(GREEN)Generating coverage report...$(NC)"
	./run_tests.sh -c -v
	@if [ -f $(COVERAGE_HTML) ]; then \
		echo "$(GREEN)Coverage report: $(COVERAGE_HTML)$(NC)"; \
	fi

benchmark: ## Run performance benchmarks
	@echo "$(GREEN)Running benchmarks...$(NC)"
	./run_tests.sh -b -v

# Advanced test targets
test-auth: ## Run authentication-specific tests
	@echo "$(GREEN)Running authentication tests...$(NC)"
	go test $(TEST_FLAGS) -v -run "TestAuth|TestRegistration|TestGetProduct" .

test-download: ## Run download-specific tests
	@echo "$(GREEN)Running download tests...$(NC)"
	go test $(TEST_FLAGS) -v -run "TestDownload|TestProgress" .

test-edge-cases: ## Run edge case tests
	@echo "$(GREEN)Running edge case tests...$(NC)"
	go test $(TEST_FLAGS) -v -run "TestEdgeCases" .

# Continuous Integration targets
ci-test: deps lint ## Run CI test suite
	@echo "$(GREEN)Running CI test suite...$(NC)"
	./run_tests.sh -c -r -v

ci-quick: ## Run quick CI tests
	@echo "$(GREEN)Running quick CI tests...$(NC)"
	./run_tests.sh -s -u -v

# Docker targets (optional, if Dockerfile exists)
docker-test: ## Run tests in Docker container
	@if [ -f Dockerfile.test ]; then \
		echo "$(GREEN)Running tests in Docker...$(NC)"; \
		docker build -f Dockerfile.test -t dr-downloader-test .; \
		docker run --rm dr-downloader-test; \
	else \
		echo "$(YELLOW)Dockerfile.test not found, skipping Docker tests$(NC)"; \
	fi

# Development targets
dev-setup: deps fmt lint ## Setup development environment
	@echo "$(GREEN)Development environment ready$(NC)"

dev-test: ## Run development tests (unit + quick integration)
	@echo "$(GREEN)Running development tests...$(NC)"
	go test $(TEST_FLAGS) -v -short ./...

# Clean targets
clean: ## Clean build artifacts and test files
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -f $(BINARY_NAME)
	rm -f $(COVERAGE_FILE) $(COVERAGE_HTML) $(BENCHMARK_FILE)
	rm -rf test_tmp_* .lint-cache
	go clean -cache -testcache -modcache
	@echo "$(GREEN)Clean complete$(NC)"

clean-test: ## Clean only test artifacts
	@echo "$(GREEN)Cleaning test artifacts...$(NC)"
	rm -f $(COVERAGE_FILE) $(COVERAGE_HTML) $(BENCHMARK_FILE)
	rm -rf test_tmp_*
	go clean -testcache
	@echo "$(GREEN)Test artifacts cleaned$(NC)"

# Utility targets
check-deps: ## Check for missing dependencies
	@echo "$(GREEN)Checking dependencies...$(NC)"
	go list -m all
	go mod verify

update-deps: ## Update dependencies to latest versions
	@echo "$(GREEN)Updating dependencies...$(NC)"
	go get -u ./...
	go mod tidy

security-scan: ## Run security vulnerability scan
	@echo "$(GREEN)Running security scan...$(NC)"
	@if command -v govulncheck > /dev/null 2>&1; then \
		govulncheck ./...; \
	else \
		echo "$(YELLOW)govulncheck not installed, install with: go install golang.org/x/vuln/cmd/govulncheck@latest$(NC)"; \
	fi

# Test data and mock server targets
test-data: ## Generate test data files
	@echo "$(GREEN)Generating test data...$(NC)"
	@mkdir -p testdata
	@echo "Sample DaVinci Resolve content for testing" > testdata/sample.zip
	@echo "$(GREEN)Test data generated$(NC)"

fake: build ## Test authentication with known-working mock values
	@echo "$(GREEN)Testing authentication with mock values...$(NC)"
	@echo "$(YELLOW)Using test credentials - not for production use$(NC)"
	@echo "$(YELLOW)Will timeout after 15 seconds to avoid full download$(NC)"
	@timeout 15s ./$(BINARY_NAME) \
		--firstname "John" \
		--lastname "Doe" \
		--email "john.doe@example.com" \
		--phone "555-123-4567" \
		--country "United States" \
		--state "New York" \
		--city "New York" \
		--street "123 Main St" \
		--zipcode "10001" \
		--company "Test Company" \
		--version "20.2" \
		--output "/tmp/davinci-test-download.zip" 2>&1 | head -10 || true
	@rm -f /tmp/davinci-test-download.zip /tmp/davinci-test-download.zip.tmp 2>/dev/null || true
	@echo "$(GREEN)Authentication test complete (check output above for success/failure)$(NC)"

mock-server: ## Start mock server for testing
	@echo "$(GREEN)Starting mock server on :8080...$(NC)"
	@echo "Use Ctrl+C to stop"
	@go run -tags mock ./cmd/mock-server

# Documentation targets
docs: ## Generate documentation
	@echo "$(GREEN)Generating documentation...$(NC)"
	@if command -v godoc > /dev/null 2>&1; then \
		echo "Starting godoc server on :6060"; \
		godoc -http=:6060; \
	else \
		echo "$(YELLOW)godoc not available, install with: go install golang.org/x/tools/cmd/godoc@latest$(NC)"; \
	fi

# Release targets
version: ## Show current version information
	@echo "$(GREEN)Version Information:$(NC)"
	@echo "Go version: $$(go version)"
	@echo "Git commit: $$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
	@echo "Git branch: $$(git branch --show-current 2>/dev/null || echo 'unknown')"
	@echo "Build date: $$(date)"

pre-commit: fmt lint test-quick ## Run pre-commit checks
	@echo "$(GREEN)Pre-commit checks complete$(NC)"

# Help for test runner script
test-help: ## Show test runner help
	./run_tests.sh --help

# Show test status and coverage
status: ## Show current test status and coverage
	@echo "$(GREEN)Test Status:$(NC)"
	@if [ -f $(COVERAGE_FILE) ]; then \
		echo "Last coverage: $$(go tool cover -func=$(COVERAGE_FILE) | grep total | awk '{print $$3}')"; \
	else \
		echo "No coverage data available"; \
	fi
	@if [ -f $(BENCHMARK_FILE) ]; then \
		echo "Last benchmark: $$(wc -l < $(BENCHMARK_FILE)) results"; \
	else \
		echo "No benchmark data available"; \
	fi
