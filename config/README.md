# Config

Store shared configuration templates in this directory.

- Commit examples such as `.env.example`, `.env.template`, or `.env.development.example`.
- Do not commit real `.env` files, local overrides, secrets, tokens, or private keys.
- Keep runtime-specific values documented in example files with safe placeholder values.
- Use OpenAI-compatible LLM placeholders only: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, and optional `SUPPLY_ANALYSIS_LLM_MODEL`.
