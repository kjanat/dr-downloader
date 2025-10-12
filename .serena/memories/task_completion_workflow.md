# Task Completion Workflow

## When a Task is Completed

### 1. Quality Checks (Required)

```bash
# Format the code
make fmt
# OR
gofmt -s -w .
# OR
golangci-lint fmt

# Lint the code
make lint
# OR
golangci-lint run --fix

# Static analysis
go vet ./...
```

### 2. Testing (Required)

```bash
# Run all tests to ensure nothing is broken
make test-all

# Run quick tests for faster feedback
make test-quick

# For performance-sensitive changes
make test-performance
```

### 3. Build Verification (Required)

```bash
# Ensure the project builds successfully
make build
# OR
go build -o dr-downloader
```

### 4. Integration Testing (Recommended)

```bash
# Test the actual application works
./dr-downloader --help

# Test download functionality (if applicable)
./dr-downloader -output /tmp/test-download.zip -version 20.2
```

### 5. Documentation Updates (If Needed)

- Update README.md if new features/flags added
- Update CLAUDE.md for development guidance
- Update help text in flag definitions

### 6. Git Workflow

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "fix: implement proper form-based authentication for Blackmagic Design"

# Push if working on shared repository
git push
```

## Pre-commit Checklist

- [ ] Code formatted with gofmt
- [ ] No linting errors
- [ ] All tests pass
- [ ] Application builds successfully
- [ ] Documentation updated if needed
- [ ] Git commit with clear message

## Continuous Integration Commands

```bash
# Quick CI-style check
make fmt lint test-quick build

# Full CI-style check
make fmt lint test-all coverage build
```
