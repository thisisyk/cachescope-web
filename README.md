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

## Architecture: what runs where

```text
Browser (this public distribution)
  index.html + styles.css          consent, bilingual UI, input and preview
           |
         app.js                    start, review, confirm, copy, export
           |
         worker.mjs                background worker + cl100k_base tokenizer
           |
         Pyodide / WebAssembly     Python runtime inside the browser
           |
         Engine.preview()
           |-- supported record selection
           |-- bounded Python code-context selection
           |-- bounded document/context selection
           `-- structural compaction / retain original
           |
         checks + sealed preview -> explicit review -> Engine.confirm() -> copy

Desktop project (not included as a working service on this website)
  Personal mode -> local engine -> review and copy
  Team API mode -> local gateway -> provider -> usage observation
                                    |
                         cache strategy comparison / opt-in keepalive
  Validation -> original versus optimized runs -> quality and usage accounting
```

The browser is a personal-mode demo, not a hosted API gateway. The platform
selector does not connect to an account, read remaining quota or change the
tokenizer. Training an adapter is a separate research activity; the current
browser engine is rule-based, not a deployed general-purpose compression model.

## Personal-mode principle and formulas

Let `x` be the original task, `x'` a proposed candidate, and `T` the same local
tokenizer applied to both. The local input reduction is:

```text
saved_input_tokens = T(x) - T(x')
input_reduction = 1 - T(x') / T(x)       when T(x) > 0
input_reduction_percent = 100 × input_reduction
```

For example, reducing a hypothetical 1,000-token input to 750 tokens gives a
25% local input reduction. This does not establish 25% lower total task usage,
API cost or subscription quota consumption.

The research objective can be expressed as:

```text
minimize T(x')
subject to task-relevant information and constraints being retained
and measured output-quality loss staying within an agreed tolerance
```

This is an objective, not a guarantee implemented by a perfect semantic judge.
The current engine recognizes supported structures and uses bounded rules:

1. Capture the original text and token count before any transformation.
2. Try supported record selection, then code context, then document context,
   followed by structural compaction when no earlier strategy applies.
3. Apply the strategy's checks; content guards cover supported cases involving
   numbers, negation, entities and task constraints. Their coverage is limited.
4. Check reversibility using the edit record and preserve the original baseline.
5. Return a candidate for review, or retain the original when unsupported.
6. Bind confirmation to the exact preview and original text. A changed or
   expired preview must be generated again; approval is not automatic.

The engine does not exhaustively search all possible rewrites. Selecting record
17 may be appropriate for an explicit single-record lookup, but not for a task
that requires comparison across all records. Removing JSON whitespace may be
appropriate when formatting is irrelevant, but not when exact text is requested.

Reversibility means the edit record can restore the original. It does **not**
prove that a downstream model will produce the same answer. Human review and
output evaluation remain necessary. No additional LLM request is made by the
ordinary browser preview.

## Team API principle: caching and keepalive

This section explains the broader desktop project; these controls do not run
on the public website.

A stable prefix is the unchanged beginning of repeated requests, such as shared
instructions and reference material. A provider may reuse its cached computation.
TTL is the retention interval under the provider's cache mechanism; it is not
a universal fixed value, and a request does not necessarily refresh it.

For separate uncached-input, cached-input and output token prices:

```text
C_request = (I_uncached × P_input + I_cached × P_cached + O × P_output) / 1,000,000
            + C_write + C_storage + C_other
```

Prices are per million tokens. Extra terms apply only where the provider bills
them separately; do not double-count charges already included in token prices.
Cache hits can lower computation or price without reducing tokens sent.

Keepalive adds requests, so the relevant quantity is net benefit, not hit count:

```text
Expected net benefit = p_reuse × (h_strategy - h_baseline) × D_reuse - K_extra
```

- `p_reuse`: probability the context will be used again over the chosen horizon.
- `h_strategy`, `h_baseline`: conditional cache-hit probabilities with and without the strategy.
- `D_reuse`: cost avoided on a reuse that becomes a hit rather than a miss.
- `K_extra`: additional keepalive, write, storage and other strategy costs.

This simplified expression explains the economics for a reuse event; repeated
events require summing their expected costs. These probabilities are not claimed
to be accurately learned in production. The desktop recommendation path compares
simulated strategies using configured intervals and dated provider assumptions.
Unknown retention is not verified evidence. Active keepalive is opt-in, bounded,
and must be evaluated against doing nothing. A cache hit alone proves no net saving.

## Evaluation: how an improvement should be demonstrated

Use an original-input arm A and an optimized-input arm B on the same task,
model and grading rubric. Use unseen tasks, vary run order, repeat trials and
include failures rather than reporting only successful reductions.

```text
U_arm = optimizer model usage + sum(all task attempts, including retries)
total_token_reduction = 1 - U_B / U_A
cost_reduction = 1 - C_B / C_A
time_reduction = 1 - elapsed_B / elapsed_A
quality_change = pass_rate_B - pass_rate_A
```

Token usage must use comparable definitions in both arms. Include optimization
time and any paid optimizer calls. The ordinary local preview makes no model
calls but still consumes local computing resources. Ratios require a positive,
available baseline; missing usage is not zero. Negative reduction means an increase.
Report quality tolerance, failures, sample size and uncertainty alongside savings.

If reliable settled platform quota measurements exist, a separate metric is:

```text
quota_used_arm = remaining_before - remaining_after
quota_reduction = 1 - quota_used_B / quota_used_A
```

This only makes sense for the same quota bucket and matched conditions, without
resets, purchases or unrelated concurrent activity, with sufficient measurement
resolution and settlement time. The browser does not collect these measurements.
There is no valid universal conversion from local token reduction to subscription
quota reduction.

## Evidence and limitations

| Question | Current answer |
| --- | --- |
| Can the browser execute the local engine? | Runtime tests passed for reduction, guards and confirmation |
| Does it reduce every prompt? | No; unsupported or unsuitable inputs retain the original |
| Is arbitrary-task answer quality guaranteed? | No; supported checks are not a general semantic proof |
| Has broad everyday-task savings been established? | No; the broader development evaluation did not meet the savings target |
| Has subscription quota saving been demonstrated? | No |
| Is the team gateway available on this public site? | No; it belongs to the desktop project |
| Is this a commercial, production-ready service? | No; it is an actively developed prototype |

Passing software tests establishes tested behavior, not real-world savings.
Narrow record-lookup results cannot be generalized to all tasks. No fixed
30–40% savings target is advertised as an achieved result.

## Public file map

| File | Responsibility |
| --- | --- |
| `index.html` | Entry page, consent, task input and review controls |
| `styles.css` | Page layout and appearance |
| `app.js` | UI events, preview state, confirmation and copying |
| `worker.mjs` | Bundled browser worker, tokenizer and Python bridge |
| `python-sources.json` | Minimal Python engine modules loaded into the runtime |
| `runtime/` | Pyodide/WebAssembly and Python standard library |
| `licenses/` | Third-party license notices |

Within `python-sources.json`, `cachescope/engine.py` orchestrates preview and
confirmation; `config.py` and `models.py` define policy and snapshots;
`detectors/` identifies supported content; `optimizers/` contains record,
context and code selection and retention guards; `desktop/structural_compactor.py`
provides structural edits and restoration. This is a generated browser distribution,
not the complete desktop development checkout.

## Privacy and safe use

Draft processing happens in the browser worker. The application has no draft
upload endpoint and does not collect account credentials or read other apps.
Fetching the website still makes normal network requests to its hosting provider;
local processing does not mean the initial page load is offline.
Review candidates before pasting them elsewhere, especially for sensitive or
high-stakes tasks. Do not submit secrets in public issue reports.

## Development direction

The next milestones are broader bilingual task coverage, stronger constraint
checks, independent quality evaluation, full-cost A/B accounting and better
onboarding. Reliable quota observation remains a separate, platform-dependent
problem, not something prompt compression alone solves. Research contributions
and honest negative results are as welcome as successful examples.

## Runtime and licenses

Third-party license texts are in licenses/. Original upstream projects:
Pyodide (0.27.7), CPython, js-tiktoken (1.0.21), OpenAI tiktoken and base64-js.
Runtime components are bundled for same-origin hosting; no CDN is contacted
by the application. To self-host, serve this directory with a static HTTP server
that supports JavaScript modules and WebAssembly. Opening index.html directly
as a file URL is not supported.
