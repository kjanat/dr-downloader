# dr-downloader Test Suite Documentation

Comprehensive testing framework for the DaVinci Resolve downloader with authentication, download functionality, edge case handling, and performance validation.

## Overview

The test suite provides comprehensive coverage for:

- **Authentication System**: Registration data validation, HTTP form submission, URL extraction
- **Download Functionality**: Progress tracking, checksum validation, file handling
- **Edge Cases**: Network failures, filesystem errors, malformed responses
- **Performance**: Memory usage, throughput, concurrent operations
- **Integration**: Complete workflow from authentication to file download

## Test Structure

### Core Test Files

#### `main_test.go`

- **NewDownloader**: Constructor validation and client configuration
- **Download**: Complete download workflow testing
- **verifyChecksum**: SHA256 checksum validation
- **ProgressWriter**: Download progress tracking functionality

#### `auth_test.go`

- **RegistrationData**: Data structure validation and JSON marshaling
- **AuthenticatedDownloader**: HTTP client configuration and timeout handling
- **GetAuthenticatedDownloadURL**: Authentication workflow and URL extraction
- **GetProductUUID**: Version mapping and error handling
- **Form Data Encoding**: URL encoding and special character handling

#### `integration_test.go`

- **TestFullDownloadWorkflow**: Complete end-to-end authentication and download
- **TestDownloadWithExistingFile**: File existence and validation behavior
- **TestDownloadProgressTracking**: Progress reporting during large downloads
- **TestAuthenticationRetry**: Retry logic and failure recovery
- **TestDownloadCancellation**: Interruption handling (future enhancement)
- **TestErrorRecovery**: Network disconnection and corruption handling

#### `edge_cases_test.go`

- **TestEdgeCases_FilesystemErrors**: Permission denied, long filenames, special characters
- **TestEdgeCases_HTTPResponses**: Missing headers, zero content, redirects, chunked encoding
- **TestEdgeCases_ChecksumValidation**: Case sensitivity, invalid length, empty checksums
- **TestEdgeCases_ProgressWriter**: Large writes, many small writes, negative values
- **TestEdgeCases_Authentication**: Unicode characters, long fields, malformed responses
- **TestEdgeCases_ConcurrentDownloads**: Multiple simultaneous downloads
- **TestEdgeCases_MemoryConstraints**: Large file streaming behavior
- **TestEdgeCases_FileSystemLimits**: Null bytes, path separators, reserved names

#### `performance_test.go`

- **BenchmarkDownloadProgress**: Progress tracking performance across file sizes
- **BenchmarkChecksumValidation**: SHA256 validation performance
- **BenchmarkAuthenticationFormEncoding**: Form data processing performance
- **BenchmarkConcurrentDownloads**: Throughput under concurrent load
- **TestPerformance_LargeFileDownload**: 50MB download performance validation
- **TestPerformance_MemoryUsage**: Memory consumption during streaming
- **TestPerformance_ProgressUpdateFrequency**: Progress update rate optimization
- **TestPerformance_ComparativeThoughput**: Performance across different network conditions

#### `test_utils.go`

Comprehensive testing utilities and mock servers:

- **TestUtils**: Main utility struct for test management
- **CreateMockDownloadServer**: Configurable HTTP server for download testing
- **CreateMockAuthServer**: Authentication server with flexible response options
- **CreateTestFile/CreateLargeTestFile**: Test file generation with checksums
- **RunFullWorkflowTest**: Complete scenario testing framework
- **Performance Metrics**: Detailed performance tracking and analysis

### Test Categories

#### Unit Tests

Focus on individual components in isolation:

```bash
make test-unit          # Run unit tests only
./run_tests.sh -u -v    # Verbose unit tests
```

#### Integration Tests

Test complete workflows and component interaction:

```bash
make test-integration   # Run integration tests only
./run_tests.sh -i -v    # Verbose integration tests
```

#### Performance Tests

Validate performance characteristics and resource usage:

```bash
make test-performance   # Run performance tests only
./run_tests.sh -p -v    # Verbose performance tests
```

#### Edge Case Tests

Comprehensive error condition and boundary testing:

```bash
go test -v -run "TestEdgeCases" .
```

## Test Execution

### Quick Start

```bash
# Run all tests with coverage
make test-all

# Run quick tests (short mode)
make test-quick

# Run with race detection
make test-race
```

### Detailed Test Runner

The `run_tests.sh` script provides comprehensive test execution:

```bash
# All tests with coverage and verbose output
./run_tests.sh -v -c

# Unit tests only in short mode
./run_tests.sh -u -s

# Performance tests with benchmarks
./run_tests.sh -p -b

# Integration tests with race detection
./run_tests.sh -i -r
```

### Test Runner Options

```sh
-h, --help              Show help message
-v, --verbose           Enable verbose output
-u, --unit-only         Run only unit tests
-i, --integration-only  Run only integration tests
-p, --performance-only  Run only performance tests
-c, --coverage          Generate coverage report
-b, --benchmark         Run benchmarks
-s, --short             Run tests in short mode
-r, --race              Enable race detection
--timeout DURATION      Set test timeout
```

## Test Coverage

### Coverage Goals

- **Unit Tests**: >90% line coverage
- **Integration Tests**: Critical path coverage
- **Edge Cases**: Error condition coverage
- **Performance**: Resource usage validation

### Coverage Reporting

```bash
# Generate HTML coverage report
make coverage

# View coverage summary
go tool cover -func=coverage.out

# Open HTML report
open coverage.html
```

### Coverage Analysis

The test suite tracks coverage across:

- Authentication functions (95%+ target)
- Download workflow (90%+ target)
- Error handling paths (85%+ target)
- Progress tracking (95%+ target)

## Performance Benchmarking

### Benchmark Execution

```bash
# Run all benchmarks
make benchmark

# Run specific benchmarks
go test -bench=BenchmarkDownloadProgress -benchmem

# Save benchmark results
go test -bench=. -benchmem > benchmark.out
```

### Performance Metrics

- **Download Progress**: <1ms per update
- **Checksum Validation**: >100MB/s throughput
- **Authentication**: <100ms form encoding
- **Memory Usage**: <10% of file size during streaming

### Throughput Expectations

- **Local Testing**: >50MB/s
- **Network Simulation**: Adapts to artificial delays
- **Concurrent Downloads**: Linear scaling up to 8 connections

## Mock Servers and Test Data

### Mock Download Server

Configurable HTTP server for download testing:

```go
server := testUtils.CreateMockDownloadServer(content,
    WithChunkDelay(10*time.Millisecond),
    WithStatusCode(http.StatusOK),
    WithFailAfterBytes(1024),
)
```

### Mock Authentication Server

Flexible authentication server with validation:

```go
server := testUtils.CreateMockAuthServer(
    WithAuthResponseType("json"),
    WithAuthRequiredFields([]string{"firstname", "lastname"}),
    WithAuthValidation(customValidationFunc),
)
```

### Test Data Generation

```go
// Small test file with checksum
file, checksum, err := testUtils.CreateTestFile("test.zip", "content")

// Large file for performance testing
file, checksum, err := testUtils.CreateLargeTestFile("large.zip", 10) // 10MB
```

## Test Scenarios

### Complete Workflow Testing

```go
scenario := TestScenario{
    Name:            "successful_download",
    Content:         testContent,
    AuthServer:      authServer,
    DownloadServer:  downloadServer,
    RegData:         registrationData,
    ProductUUID:     "test-uuid",
    VerifyChecksum:  true,
    ExpectedContent: testContent,
}

testUtils.RunFullWorkflowTest(t, scenario)
```

### Error Scenario Testing

- Network timeouts and disconnections
- Invalid authentication responses
- Filesystem permission errors
- Checksum validation failures
- Memory pressure conditions

## Continuous Integration

### CI Test Configuration

```bash
# Quick CI tests (under 5 minutes)
make ci-quick

# Full CI test suite with coverage
make ci-test

# Docker-based testing (if Dockerfile.test exists)
make docker-test
```

### Pre-commit Testing

```bash
# Run pre-commit checks
make pre-commit

# Individual checks
make fmt lint test-quick
```

## Test Debugging

### Verbose Output

Enable verbose logging for detailed test execution:

```bash
./run_tests.sh -v
go test -v -run TestSpecificTest
```

### Race Detection

Detect race conditions in concurrent code:

```bash
go test -race ./...
make test-race
```

### Memory Profiling

Profile memory usage during tests:

```bash
go test -memprofile=mem.prof -bench=BenchmarkLargeDownload
go tool pprof mem.prof
```

### Test Isolation

Each test uses isolated temporary directories and mock servers to prevent interference.

## Best Practices

### Test Organization

- Table-driven tests for multiple scenarios
- Proper setup and teardown with `t.TempDir()`
- Mock servers closed with `defer server.Close()`
- Clear test names describing the scenario

### Error Testing

- Test both expected and unexpected error conditions
- Verify specific error messages when appropriate
- Test error recovery and cleanup

### Performance Testing

- Use realistic test data sizes
- Measure both time and memory usage
- Test under various load conditions
- Include baseline performance expectations

### Integration Testing

- Test complete workflows end-to-end
- Use realistic mock server responses
- Verify file system state after operations
- Test authentication and download integration

## Troubleshooting

### Common Issues

#### Test Timeouts

```bash
# Increase timeout for slow tests
./run_tests.sh --timeout 60m
```

#### Permission Errors

```bash
# Ensure test directory is writable
chmod -R 755 test_tmp_*
```

#### Mock Server Conflicts

Tests use `httptest.NewServer()` for automatic port allocation.

#### Coverage Issues

```bash
# Clean test cache
go clean -testcache
make clean-test
```

### Debug Output

Enable debug output in tests:

```go
t.Logf("Debug info: %v", debugData)
```

## Contributing to Tests

### Adding New Tests

1. Follow table-driven test patterns
2. Use test utilities for common operations
3. Include both positive and negative test cases
4. Add performance tests for new functionality

### Test Naming Convention

- `TestFunctionName_Scenario` for unit tests
- `TestIntegration_Workflow` for integration tests
- `TestPerformance_Metric` for performance tests
- `TestEdgeCases_Condition` for edge cases

### Mock Server Extensions

Add new server options in `test_utils.go`:

```go
func WithCustomBehavior(behavior string) ServerOption {
    return func(c *ServerConfig) {
        c.CustomBehavior = behavior
    }
}
```

## Test Results and Reporting

### Artifacts Generated

- `coverage.out`: Coverage data
- `coverage.html`: HTML coverage report
- `benchmark.out`: Benchmark results
- Test logs with timestamps and performance metrics

### Interpreting Results

- Coverage percentage by function and overall
- Benchmark results with memory allocations
- Performance metrics (throughput, latency)
- Test execution time and resource usage

The comprehensive test suite ensures reliability, performance, and maintainability of the dr-downloader project across all supported use cases and environments.
