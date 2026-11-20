<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Render the public workspace and authenticated dashboard from one shared workspace component; guests must not receive private queries.
- Validate onboarding through a shared schema on both client and server; mark the profile complete only after the greeting and profile save succeed.
- Administrator entry never grants a role; existing roles are checked on the server because hidden URLs and matching emails are not authorization.
- Display measured account usage only; do not present estimated savings, costs, or unconnected multimedia services as working functionality.
- AI provider keys come from env pools (GEMINI_API_KEYS, MISTRAL_API_KEYS, GROK_API_KEYS, GROQ_API_KEYS, OPENROUTER_KEYS; any count, comma/newline separated) interleaved by index in src/lib/provider-pool.server.ts, with built-in AI as last fallback — so adding accounts needs no code change.
