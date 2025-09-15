# Task Completion Workflow

## When a Task is Completed

### 1. Quality Checks (Required)

```bash
# Format the code
bun run format

# Lint the code  
bun run lint

# Fix linting issues automatically
bun run lint:fix

# TypeScript type checking
bunx tsc --noEmit
```

### 2. Testing (Required)

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test tests/daVinciDownloader.test.ts

# Run with verbose output
bun test --verbose
```

### 3. Build Verification (Required)

```bash
# Test the application in mock mode
bun run fake

# Test production mode (requires real credentials)
bun run start

# Development mode with file watching
bun run dev
```

### 4. Integration Testing (Recommended)

```bash
# Test the actual download workflow (test mode)
bun run fake

# Verify browser automation works
DEBUG=true bun run fake

# Non-headless mode for debugging
HEADLESS=false bun run fake
```

### 5. Documentation Updates (If Needed)

- Update README.md if new features/scripts added
- Update TESTING.md for testing guidance
- Update package.json scripts if needed

### 6. Git Workflow

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: implement automatic download functionality with Puppeteer"

# Push if working on shared repository
git push
```

## Pre-commit Checklist

- [ ] Code formatted with Biome
- [ ] No linting errors or warnings
- [ ] All tests pass
- [ ] Application runs successfully in test mode
- [ ] Documentation updated if needed
- [ ] Git commit with clear message

## Continuous Integration Commands

```bash
# Quick CI-style check
bun run lint && bun test && bun run fake

# Full quality check
bun run lint:fix && bun run format && bun test --coverage && bun run fake
```

## Available Scripts Reference

| Script       | Description                     | Usage                |
|--------------|---------------------------------|----------------------|
| `start`      | Run production mode            | `bun run start`      |
| `fake`       | Run test mode with mock data   | `bun run fake`       |
| `dev`        | Run with file watching         | `bun run dev`        |
| `lint`       | Code quality checks            | `bun run lint`       |
| `lint:fix`   | Auto-fix linting issues       | `bun run lint:fix`   |
| `format`     | Format code with Biome         | `bun run format`     |
