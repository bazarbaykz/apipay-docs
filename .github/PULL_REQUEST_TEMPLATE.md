> ⚠️ This is a public repository — pull requests and their history stay visible forever.
> Do not include API keys, customer phone numbers or real invoice/receipt/transaction IDs.
> Use placeholders: `YOUR_API_KEY`, `87001234567`, amount `10000`.

## What changed

Briefly describe what you changed and why.

## Checklist

- [ ] **One change per PR** — the pull request is focused on a single change
- [ ] **Clear description** — it is clear what changed and why
- [ ] **Parity check passes** — `node scripts/check-parity.mjs` is green: both locales updated together (Russian is the source, English is its translation) and every machine identifier present in the spec
- [ ] **Code examples tested** — every example added or edited was actually run
- [ ] **Editable files only** — the change touches `docs/**` or `examples/**`; `openapi.yaml`, `openapi-partner.yaml` and `llms.txt` are mirrors of the upstream source and get overwritten by the next sync
- [ ] **No real data** — no API keys, customer numbers or real IDs in the diff

## Related issue

Closes #

---

See [CONTRIBUTING.md](https://github.com/bazarbaykz/apipay-docs/blob/main/CONTRIBUTING.md) for the full guidelines.
