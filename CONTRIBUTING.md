# Contributing to @stellar-sharpy/sdk

Thank you for helping improve the Sharpy TypeScript SDK!

## Getting Started

```bash
git clone https://github.com/stellar-sharpy/sharpy-sdk.git
cd sharpy-sdk
npm install
npm run build
```

## How to Contribute

### Reporting Bugs

Use the **Bug Report** issue template. Include the SDK version, code snippet, and the error you received.

### Suggesting Features

Use the **Feature Request** template. Reference the underlying contract method if applicable.

### Pull Requests

1. Fork and branch from `main`
2. Run `npm run lint` — must pass with 0 errors
3. Run `npm run build` — must succeed
4. Add or update tests if relevant
5. Open a PR with a clear description and link to the related issue

## Code Standards

- All public exports must have JSDoc comments
- Match existing patterns in `src/client.ts`
- Use `bigint` for all on-chain amounts (stroops)
- Never expose secret keys or sign transactions outside `wallet.ts`

## Commit Messages

Conventional commits:
- `feat:` new SDK method or export
- `fix:` bug fix
- `docs:` documentation
- `chore:` build/config
- `test:` tests only
- `refactor:` no behaviour change

## License

MIT
