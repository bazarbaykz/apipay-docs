# Contributing to ApiPay.kz Documentation

Thank you for your interest in improving the ApiPay.kz documentation! This guide will help you contribute effectively.

## Ways to Contribute

### Reporting Issues

If you find an error in the documentation or have a suggestion:

1. Check if the issue already exists in [GitHub Issues](https://github.com/bazarbaykz/apipay-docs/issues)
2. If not, create a new issue with:
   - Clear description of the problem
   - Location in documentation (file, section)
   - Suggested fix (if applicable)

### Improving Documentation

We welcome improvements to:

- **Clarity** — Make explanations clearer
- **Examples** — Add or improve code examples
- **Translations** — Improve Russian translations or add new languages
- **Typos** — Fix spelling and grammar errors

> **Which files can be edited.** Pull requests are accepted only for `docs/**` and `examples/**`.
> The files `openapi.yaml`, `openapi-partner.yaml` and `llms.txt` are mirrors of the upstream
> source and are regenerated automatically — any change to them will be overwritten by the next
> sync. If you spot a problem in those files, please open an issue instead of a pull request.

### Adding Examples

If you'd like to add code examples:

1. Place them in the appropriate `examples/` subdirectory
2. Include clear comments explaining each step
3. Test the code before submitting
4. Follow the existing code style

## How to Submit Changes

### For Small Changes

1. Fork the repository
2. Make your changes
3. Submit a Pull Request

### For Larger Changes

1. Open an issue first to discuss the proposed changes
2. Fork the repository
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test thoroughly
6. Submit a Pull Request

## Pull Request Guidelines

- **One change per PR** — Keep pull requests focused
- **Clear description** — Explain what you changed and why
- **Test your changes** — Ensure code examples work
- **Follow style** — Match existing documentation style

## Documentation Style Guide

### Where the truth lives

Three layers, each with its own source. Know which one you are editing.

| Layer | Source | Derived from it |
|---|---|---|
| **Facts** — field names, error codes, endpoints, limits | `openapi.yaml`, `openapi-partner.yaml` (mirrors of the upstream spec) | everything else |
| **Prose** — explanations, warnings, walkthroughs | `docs/ru/` | — |
| **English** | `docs/ru/` | `docs/en/` |

A term that is not in the spec does not belong in a chapter. Two chapters can agree with
each other and still both be wrong, which is why the check below compares chapters against
the spec and not only against each other.

### Language

- **Russian** — source of truth in `docs/ru/`. Russian files are written first
- **English** — translation of the Russian source in `docs/en/`
- **Both locales in one PR** — any content change must update `docs/ru/` and `docs/en/`
  together, so the two never drift apart
- Keep language simple and direct
- Avoid jargon when possible

### Checking your change

```bash
node scripts/check-parity.mjs
```

It verifies four things: that both locales have the same document shape, that they mention
the same machine identifiers, that every identifier exists in the spec, and — with
`--staged` — that you did not touch one locale without the other. No dependencies, no
`npm install`; plain Node is enough.

To have it run before every commit:

```bash
git config core.hooksPath githooks
```

The same check runs on every pull request. If a refusal is wrong, add the exact term with
a reason to `scripts/parity-allow.json` rather than working around the check — but first
make sure it is not a typo in a field name or a genuine gap in the spec.

### Code Examples

- Use synthetic values that merely look realistic: phone `87001234567`, amount `10000`, `YOUR_API_KEY` as a key placeholder
- Never paste real API keys, customer phone numbers, invoice/receipt/transaction IDs or links to real Kaspi receipts — this repository is public and its history is permanent
- Include error handling where appropriate
- Add comments for complex logic
- Test all examples before submitting

### Markdown

- Use ATX-style headers (`#`, `##`, etc.)
- Use fenced code blocks with language identifiers
- Use tables for structured data
- Keep lines under 100 characters when possible

## Questions?

If you have questions about contributing:

- Open an issue on GitHub
- Contact us via [WhatsApp](https://wa.me/77003076512)

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on improving documentation for all users

Thank you for helping improve ApiPay.kz documentation!
