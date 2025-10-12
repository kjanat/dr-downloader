# Code Style and Conventions

## Go Code Style

- **Standard Library Only**: No external dependencies
- **Error Handling**: Use fmt.Errorf for error wrapping
- **Naming**: Standard Go conventions (camelCase for local, PascalCase for exported)
- **Defer**: Use defer for cleanup (file.Close(), resp.Body.Close())
- **Struct Tags**: Use JSON tags for data structures (e.g., `json:"firstname"`)

## Code Organization

- **main.go**: Main application logic and CLI handling
- **auth.go**: Authentication-related structs and functions
- **main_test.go**: Consolidated test suite
- **Separate concerns**: Download logic vs authentication logic

## Error Handling Patterns

```go
// Preferred error wrapping
return fmt.Errorf("failed to create directory: %w", err)

// Warning for non-critical errors
fmt.Fprintf(os.Stderr, "Warning: failed to close file: %v\n", err)

// Defer cleanup with error handling
defer func() {
    if err := file.Close(); err != nil {
        fmt.Fprintf(os.Stderr, "Warning: failed to close file: %v\n", err)
    }
}()
```

## CLI Conventions

- Use flag package for command line arguments
- Provide clear help text and defaults
- Auto-detect reasonable defaults (AUR cache paths)
- Interactive prompts for missing required data

## Testing Conventions

- Use httptest.NewServer for mock HTTP servers
- Use t.TempDir() for temporary directories
- Table-driven tests for multiple scenarios
- Comprehensive error condition testing
- Performance benchmarks with BenchmarkXxx functions

## Documentation

- Clear function comments for exported functions
- README with usage examples
- Comprehensive help in CLI flags
