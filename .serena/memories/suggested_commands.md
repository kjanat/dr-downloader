# Suggested Commands for dr-downloader

## Build Commands

```bash
# Quick build for current platform
go build -o dr-downloader

# Build with build script (includes cross-platform options)
./build.sh

# Build using Makefile
make build
```

## Testing Commands

```bash
# Run all tests
make test-all

# Run quick tests (short mode)
make test-quick

# Run tests with coverage
make coverage

# Run specific test categories
make test-unit          # Unit tests only
make test-integration   # Integration tests only
make test-performance   # Performance tests only

# Using test script with options
./run_tests.sh -v -c    # Verbose with coverage
./run_tests.sh -u -s    # Unit tests in short mode
./run_tests.sh -p -b    # Performance tests with benchmarks
```

## Quality Commands

```bash
# Format code
make fmt
gofmt -w .

# Lint code
make lint
golangci-lint run

# Static analysis
go vet ./...
```

## Application Usage

```bash
# Basic usage (auto-detect AUR cache)
./dr-downloader

# Interactive authentication
./dr-downloader

# With command line auth data
./dr-downloader \
  -firstname "Your" \
  -lastname "Name" \
  -email "your.email@example.com" \
  -phone "+1-555-123-4567" \
  -country "United States" \
  -state "Your State" \
  -city "Your City" \
  -street "Your Address" \
  -zipcode "12345"

# Download specific version
./dr-downloader -version 20.1.1

# Download to specific location
./dr-downloader -output ~/Downloads/DaVinci_Resolve_20.2_Linux.zip

# Force redownload
./dr-downloader -force

# With checksum verification
./dr-downloader -verify -checksum "sha256_hash_here"
```

## Integration Commands

```bash
# Complete installation workflow
./install-davinci.sh

# Installation with specific version
./install-davinci.sh --version 20.1.1

# Force redownload and install
./install-davinci.sh --force
```
