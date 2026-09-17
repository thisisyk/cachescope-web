# CacheScope Web

Browser-only distribution of CacheScope's personal context-reduction tool.

Open the published site, read the notice, start the local engine, paste a task,
review the preview and copy the candidate. No Python installation or API key is
needed. The first load downloads the Python/WASM runtime and tokenizer.

Inputs are processed inside a browser worker. This distribution has no prompt
upload endpoint, account collector or API-key field. Local token estimates are
not platform subscription savings. Unsupported tasks retain the original.

This public repository contains only browser assets and the minimal Python
modules required to run them. It does not publish the private desktop project,
training data, customer records, API credentials or model weights.

Built with vibe coding. Experimental: review changes before using them.
The selected chat platform is informational; all local estimates use
cl100k_base. Team API routing requires the desktop gateway.

Third-party license texts are in licenses/. Original upstream projects:
Pyodide (0.27.7), CPython, js-tiktoken (1.0.21), OpenAI tiktoken and base64-js.
Runtime components are bundled for same-origin hosting; no CDN is contacted
by the application. To self-host, serve this directory with a static HTTP server
that supports JavaScript modules and WebAssembly. Opening index.html directly
as a file URL is not supported.
