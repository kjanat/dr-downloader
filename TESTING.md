# dr-daVinciDownloader Testing Documentation

Comprehensive testing guide for the TypeScript/Puppeteer-based DaVinci Resolve daVinciDownloader.

## Overview

The testing framework covers:

- **Browser Automation**: Puppeteer-based form filling and authentication
- **Network Interception**: Download URL capture and file handling
- **Mock Data Testing**: Development testing with fake credentials
- **Code Quality**: Biome linting and TypeScript type checking
- **Integration Testing**: Complete workflow from form to download

## Test Structure

### Core Test Framework

The project uses **Bun test** as the primary testing framework with TypeScript support.

### Test Files

#### `tests/daVinciDownloader.test.ts`

- Browser automation testing
- Form filling validation
- Network request interception
- Download workflow testing

#### `tests/integration.test.ts`

- End-to-end workflow testing
- AUR cache detection
- File placement verification

#### `tests-examples/demo-todo-app.spec.ts`

- Playwright example tests
- Browser interaction patterns
- Local storage handling

## Test Categories

### Unit Tests

Test individual functions and components in isolation:

```bash
# Run unit tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/daVinciDownloader.test.ts
```

### Integration Tests

Test complete browser automation workflows:

```bash
# Run integration tests
bun test tests/integration.test.ts

# Verbose output
bun test --verbose

# Run with timeout for long operations
bun test --timeout 60000
```

### Mock Data Testing

Use the built-in test mode for development:

```bash
# Run test mode (uses mock credentials)
bun run fake

# This will:
# - Use predefined test data (US, New York)
# - Go through complete form automation
# - Capture download URL without actual download
# - Show all network traffic and form interactions
```

### Code Quality Testing

Ensure code quality and type safety:

```bash
# Run TypeScript type checking
bun run type-check

# Run Biome linting
bun run lint

# Fix linting issues
bun run lint:fix

# Format code
bun run format
```

## Test Execution

### Quick Start

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Run linting
bun run lint

# Test the application in mock mode
bun run fake
```

### Development Testing

```bash
# Run in development mode with file watching
bun run dev

# Run test mode for debugging
bun run fake

# Check code quality
bun run lint
```

### Available Scripts

| Script     | Description                    | Usage              |
| ---------- | ------------------------------ | ------------------ |
| `test`     | Run all test suites            | `bun test`         |
| `fake`     | Run with mock credentials      | `bun run fake`     |
| `dev`      | Development mode with watching | `bun run dev`      |
| `lint`     | Code quality checks            | `bun run lint`     |
| `lint:fix` | Auto-fix linting issues        | `bun run lint:fix` |
| `format`   | Format code with Biome         | `bun run format`   |

## Test Configuration

### TypeScript Configuration

```json
{
	"compilerOptions": {
		"strict": true,
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"types": ["bun-types", "node"]
	}
}
```

### Biome Configuration

```json
{
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"suspicious": {
				"noExplicitAny": "error"
			}
		}
	},
	"formatter": {
		"enabled": true,
		"indentStyle": "tab",
		"lineWidth": 80
	}
}
```

## Browser Testing with Puppeteer

### Test Mode Features

The application includes a comprehensive test mode:

```typescript
// Example test configuration
const testMode = process.argv.includes('--test');

if (testMode) {
	console.log('🧪 Running in test mode with mock credentials');
	// Uses predefined test data
	// Shows detailed logging
	// Captures URLs without downloading
}
```

### Browser Automation Testing

```typescript
// Example browser test
describe('DaVinci Resolve Downloader', () => {
	it('should fill form correctly', async () => {
		const browser = await puppeteer.launch({ headless: true });
		const page = await browser.newPage();

		// Test form filling logic
		await page.goto('https://www.blackmagicdesign.com/event/davinciresolvedownload');

		// Verify form elements
		expect(await page.$('#country')).toBeTruthy();
		expect(await page.$('#state')).toBeTruthy();

		await browser.close();
	});
});
```

### Network Interception Testing

```typescript
// Example network monitoring test
it('should capture download URL', async () => {
	const capturedUrls: string[] = [];

	page.on('request', (request) => {
		const url = request.url();
		if (url.includes('swr.cloud.blackmagicdesign.com')) {
			capturedUrls.push(url);
		}
	});

	// Trigger download process
	await clickDownloadButton();

	expect(capturedUrls.length).toBeGreaterThan(0);
	expect(capturedUrls[0]).toContain('DaVinci_Resolve');
});
```

## Mock Data and Test Scenarios

### Test Credentials

The application uses safe mock credentials for testing:

```typescript
const testFormData = {
	firstname: 'Test',
	lastname: 'User',
	email: 'test@example.com',
	phone: '555-123-4567',
	country: 'us',
	state: 'string:New York',
	city: 'Test City',
	street: 'Test Street',
	zipcode: '12345',
};
```

### Test Scenarios

1. **Form Automation Test**
   - Navigate to download page
   - Fill all required fields
   - Select country and state
   - Check policy agreement
   - Submit form

2. **Network Capture Test**
   - Monitor HTTP requests
   - Capture download URL
   - Verify URL format
   - Test URL accessibility

3. **Error Handling Test**
   - Test network failures
   - Test form validation errors
   - Test browser crashes
   - Test timeout scenarios

## Performance Testing

### Browser Performance

```bash
# Test with Chrome DevTools metrics
bun run fake

# Monitor:
# - Page load time
# - Form interaction speed
# - Network request timing
# - Memory usage
```

### Download Performance

- **URL Capture**: <2 seconds after form submission
- **Form Filling**: <5 seconds for complete automation
- **Browser Launch**: <3 seconds for headless mode
- **Memory Usage**: <100MB during operation

## Debugging Tests

### Verbose Output

Enable detailed logging during tests:

```bash
# Run with debug output
DEBUG=true bun run fake

# Show browser interactions (non-headless)
HEADLESS=false bun run fake
```

### Browser Debugging

```typescript
// Launch browser with DevTools
const browser = await puppeteer.launch({
	headless: false,
	devtools: true,
	slowMo: 100, // Slow down for debugging
});
```

### Network Debugging

```typescript
// Log all network requests
page.on('request', (request) => {
	console.log(`→ ${request.method()} ${request.url()}`);
});

page.on('response', (response) => {
	console.log(`← ${response.status()} ${response.url()}`);
});
```

## Continuous Integration

### CI Configuration

```yaml
# Example GitHub Actions workflow
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun test
      - run: bun run fake
```

### Pre-commit Hooks

```bash
#!/bin/bash
# pre-commit hook
bun run lint
bun test
echo "All tests passed!"
```

## Troubleshooting

### Common Issues

#### Browser Launch Failures

```bash
# Install Chrome manually if needed
bun run postinstall

# Check Chrome installation
which google-chrome
```

#### Network Timeout Issues

```bash
# Increase timeout in tests
export TIMEOUT=60000
bun test
```

#### TypeScript Errors

```bash
# Check TypeScript configuration
bunx tsc --noEmit

# Verify types are installed
bun install @types/node
```

### Debug Output

Enable debug logging:

```bash
# Show detailed browser operations
DEBUG=puppeteer:* bun run fake

# Show network requests
DEBUG=network bun run fake
```

## Best Practices

### Test Organization

- Use descriptive test names
- Group related tests with `describe` blocks
- Clean up resources with `afterEach`
- Use TypeScript for type safety

### Browser Testing

- Always close browsers in tests
- Use headless mode for CI
- Handle async operations properly
- Test both success and error cases

### Code Quality

- Follow Biome formatting rules
- Use TypeScript strict mode
- Write self-documenting code
- Add JSDoc comments for complex functions

### Error Handling

- Test network failures
- Test browser crashes
- Test invalid form data
- Test timeout scenarios

## Contributing to Tests

### Adding New Tests

1. Create test file in `tests/` directory
2. Follow existing naming conventions
3. Use TypeScript with proper typing
4. Include both positive and negative cases
5. Add performance considerations

### Test Naming Convention

- `describe('Component')` for test grouping
- `it('should do something')` for individual tests
- Use clear, descriptive test names
- Group by functionality, not by file structure

### Mock Data Guidelines

- Use realistic but safe test data
- Don't use real personal information
- Include edge cases in test data
- Document test scenarios clearly

## Test Results and Reporting

### Artifacts Generated

- TypeScript compilation results
- Biome linting reports
- Test execution logs
- Screenshot captures (if enabled)

### Coverage Reporting

```bash
# Generate coverage report
bun test --coverage

# View coverage summary
cat coverage/lcov-report/index.html
```

### Interpreting Results

- TypeScript errors indicate type safety issues
- Biome warnings highlight code quality concerns
- Test failures show functional problems
- Performance metrics indicate efficiency

The testing framework ensures the reliability, maintainability, and performance of the TypeScript/Puppeteer-based dr-daVinciDownloader across all supported browsers and environments.
