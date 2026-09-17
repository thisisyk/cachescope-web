# CacheScope Web

**Work in progress — a personal learning and research project, not a commercial product.**

I am developing CacheScope to explore reducing unnecessary LLM input while
preserving important task requirements. This is an experimental demo, not a
finished service. I am sharing it to learn from real testing and community feedback.

[Try the web demo](https://thisisyk.github.io/cachescope-web/)
| [Report an issue or suggest an improvement](https://github.com/thisisyk/cachescope-web/issues)

## Help wanted and next steps

- Test more everyday English and Chinese tasks, including failure cases.
- Improve checks for numbers, negation, entities and task constraints.
- Evaluate output quality and total usage, including optimization overhead and retries.
- Review code, security, accessibility and usability.
- Explore more reliable ways to measure real platform usage rather than infer it from prompt length.

I welcome reproducible bug reports, research suggestions and collaboration.
Please remove personal information, customer data and API keys from examples.
There is no promised savings rate, production-readiness guarantee or commercial
support. Shorter input is not proof of lower ChatGPT, Claude or Codex subscription
consumption, and the current checks cannot guarantee quality on every task.

中文说明：这是我正在开发的个人学习与研究项目，不是商业版本，也不是已经
完成验证的省额度产品。欢迎帮助测试中英文任务、反馈问题、分享论文和提出
改进建议。可以通过 Issues 联系我；请勿上传隐私内容或密钥。

## What the demo does

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
