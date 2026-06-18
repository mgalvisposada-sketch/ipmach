# Deep Web Endpoint Steps

This directory contains step definitions for automated browser interactions with deep web endpoints.

## Structure

Each endpoint has its own file with:
- `{endpoint}LoginSteps` - Steps for login only
- `{endpoint}SearchSteps` - Steps for search only  
- `{endpoint}CombinedSteps` - Combined login + search steps (used in database)

## Step Types

- `goto` / `navigate` - Navigate to a URL
- `wait` - Wait for selector or timeout
- `fill` - Fill an input field
- `click` - Click an element
- `press` - Press a key on an element

## Placeholders

Steps support placeholders that are replaced at runtime:
- `{{username}}` - Login username
- `{{password}}` - Login password
- `{{reference}}` - Search reference/term

## Iframe Support

For iframes (like Zoho in Servitractor), use Playwright syntax:
```
iframe[name="zohoiam"] >>> #login_id
```

This is automatically converted to Puppeteer's iframe handling.

## Files

- `servitractor-steps.ts` - Zoho authentication with iframe
- `partequipos-steps.ts` - Magento store authentication
- `retrotrac-steps.ts` - Angular application authentication
- `index.ts` - Exports all step definitions

## Usage

Steps are imported in `seed-deep-web.ts` and stored in the database as JSON. The Deep Search Service loads them from the database and executes them using Puppeteer.

