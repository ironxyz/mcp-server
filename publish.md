# Publishing Guide for @ironxyz/mcp-server

## Prerequisites

1. Make sure you have npm publish permissions for the `@ironxyz` scope
2. Make sure you're logged in to npm: `npm login`

## Publishing Steps

1. **Build the project:**

   ```bash
   pnpm run build
   ```

2. **Test locally:**

   ```bash
   # Test production mode
   IRON_ENVIRONMENT=production node dist/index.js

   # Test sandbox mode
   IRON_ENVIRONMENT=sandbox node dist/index.js
   ```

3. **Update version (choose one):**

   ```bash
   # Patch version (1.0.0 -> 1.0.1)
   pnpm version patch

   # Minor version (1.0.0 -> 1.1.0)
   pnpm version minor

   # Major version (1.0.0 -> 2.0.0)
   pnpm version major
   ```

4. **Publish to npm:**

   ```bash
   pnpm run release
   ```

5. **Push git changes:**
   ```bash
   git push origin main --tags
   ```

## Testing Published Package

Test that users can install and use the published package:

```bash
# Test with npx
npx @ironxyz/mcp-server

# Test with pnpm dlx (alternative)
pnpm dlx @ironxyz/mcp-server

# Test with different environments
IRON_ENVIRONMENT=sandbox npx @ironxyz/mcp-server
IRON_ENVIRONMENT=production npx @ironxyz/mcp-server
```

## Package Info

- **Package Name:** `@ironxyz/mcp-server`
- **Current Version:** `0.1.0`
- **Registry:** https://npmjs.com/package/@ironxyz/mcp-server
- **Repository:** https://github.com/ironxyz/mcp-server
