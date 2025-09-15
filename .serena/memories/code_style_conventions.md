# Code Style and Conventions (TypeScript/Bun)

## TypeScript Code Style

- **Strict Type Checking**: Use strict TypeScript configuration
- **No Any Types**: Avoid `any`, use proper interfaces and types
- **Async/Await**: Prefer async/await over Promises for readability
- **Error Handling**: Use try/catch blocks with proper error typing
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces

## Code Organization

- **downloader.ts**: Main application logic with browser automation
- **package.json**: Dependencies, scripts, and project configuration
- **tsconfig.json**: TypeScript compiler configuration
- **biome.jsonc**: Code quality and formatting rules
- **tests/**: Test files with .test.ts extension

## Biome Formatting Rules

```json
{
  "formatter": {
    "indentStyle": "tab",
    "lineWidth": 80,
    "indentWidth": 2
  },
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  }
}
```

## Error Handling Patterns

```typescript
// Preferred async error handling
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error(`Operation failed: ${error}`);
  throw new Error(`Failed to complete operation: ${error}`);
}

// Browser automation error handling
try {
  await page.click('#download-button');
} catch (error) {
  console.error('Failed to click download button:', error);
  await browser.close();
  throw error;
}
```

## Browser Automation Conventions

- Always close browsers with `await browser.close()`
- Use headless mode for production, visible for debugging
- Handle page timeouts and network failures gracefully
- Log network requests for debugging purposes
- Use proper selectors (prefer IDs over complex CSS)

## Testing Conventions

- Use Bun test framework with TypeScript
- Test files end with `.test.ts`
- Use descriptive test names: `it('should fill form correctly')`
- Mock external dependencies and network calls
- Test both success and error scenarios

## Interface Definitions

```typescript
// Example interface for form data
interface FormData {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  street: string;
  zipcode: string;
  company?: string; // Optional fields marked with ?
  policy: boolean;
}
```

## Documentation

- Use JSDoc comments for complex functions
- Maintain up-to-date README.md and TESTING.md
- Document browser automation flow and network interception
- Include examples in documentation
