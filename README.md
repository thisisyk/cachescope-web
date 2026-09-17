# CacheScope Web

**Work in progress — a personal learning and research project, not a commercial product.**

I am developing CacheScope to explore reducing unnecessary LLM input while
preserving important task requirements. This is an experimental demo, not a
finished service. I am sharing it to learn from real testing and community feedback.

[Try the web demo](https://thisisyk.github.io/cachescope-web/)
| [Report an issue or suggest an improvement](https://github.com/thisisyk/cachescope-web/issues)

## Technical core — 原理、公式与代码结构

### Principle / 核心原理

**Personal mode changes the input; Team API mode studies reuse of computation.**
These are different mechanisms and must be measured separately.

个人模式：在支持的任务范围内，保留任务要求和所需材料，删去明确可省的内容或
JSON 空白，从而减少交给模型的输入。当前实现是确定性规则，不是一个已经训练好、
能理解任意任务的通用压缩模型。不能判定适用性时保留原文，产生候选后仍由用户审核。

团队 API 模式：对重复的稳定前缀研究供应商缓存能否复用，必要时评估 keepalive
是否值得。命中缓存主要可能减少重复计算及相应费用，不代表发送的 token 数减少。
这部分属于桌面项目，不在公开网页中执行。

### Formulas / 核心公式

Let `x` be the original input, `x′` the candidate and `T` the same local tokenizer.
原文和候选必须采用相同的计数规则，且原文 token 数大于零：

$$
\Delta T = T(x)-T(x'), \qquad
r_{\mathrm{input}}=1-\frac{T(x')}{T(x)}
$$

`ΔT` 是本地输入减少的 token 数，`100 × r_input` 是页面显示的输入减少百分比。
For the documented English JSON example, `T(x)=34` and `T(x′)=25`, so the
measured local reduction is `9 tokens ≈ 26.47%`—not a quota-saving measurement.

真正的任务级目标是减少完成任务的总消耗，同时把质量损失控制在允许范围内：

$$
\min_s \mathbb{E}[U(s)] \quad
\text{subject to}\quad Q_0-Q_s\leq\varepsilon
$$

Here `s` is a strategy, `U` includes optimizer model calls and every task attempt,
`Q` is an independently defined quality score, and `ε` is a declared tolerance.
这是研究目标，不是当前引擎已经求解的全局最优问题；规则检查也不能替代输出质量评测。

团队缓存的简化净收益公式为：

$$
G=p_{\mathrm{reuse}}(h_s-h_0)D-K
$$

`p_reuse` 是未来复用概率，`h_s-h_0` 是策略带来的命中概率提升，`D` 是一次
由 miss 变成 hit 可避免的费用，`K` 是保活、写入和存储等额外成本。只有在假设成立
且 `G>0` 时，该简化模型才支持策略可能省钱；公式本身不是实测结果。

真实对照结果要比较两组完整消耗，而不是只看输入：

$$
r_{\mathrm{task}}=1-\frac{U_B}{U_A}, \qquad
\Delta Q=Q_B-Q_A
$$

`A` 是原始任务，`B` 是优化任务，计入失败和重试；基线必须可用且为正。
Local token reduction, total task usage, API cost and subscription quota are
separate metrics. No universal token-to-subscription conversion is implemented.

### Code structure / 代码如何实现这些逻辑

```text
User input / 用户输入
  -> app.js: interface state, request IDs, review and copy
  -> worker.mjs: local tokenizer + Python/WASM runtime
  -> bridge (bundled in worker): JS/Python messages, latest plan
  -> cachescope/engine.py: capture original, dispatch, validate, seal
       1. record_selector.py: exact supported id-to-code lookup
       2. code_context_optimizer.py: bounded Python dependency selection
       3. context_optimizer.py: explicit references / exact duplicate prose
       4. prompt_compressor.py -> structural_compactor.py: JSON whitespace
     First applicable strategy, not four transformations always chained.
  -> candidate + metrics / 候选与计数
  -> user review -> Engine.confirm() -> copy to the user's assistant
```

| Module / 模块 | Responsibility / 职责 | Important boundary / 边界 |
| --- | --- | --- |
| `cachescope/engine.py` | Select a strategy, keep the original baseline, validate and confirm | Does not call the target model or verify its answer |
| `cachescope/config.py` | Input and confirmation limits | Default 50,000 characters, 900-second confirmation window |
| `cachescope/models.py` | Input snapshots, counts and hashes | A hash is not semantic-quality evidence |
| `cachescope/optimizers/record_selector.py` | Select one record under an exact query contract | Not a general database query engine |
| `cachescope/optimizers/code_context_optimizer.py` | Parse restricted Python and keep named dependencies | Does not execute submitted code or support arbitrary repositories |
| `cachescope/optimizers/context_optimizer.py` | Select labeled context or remove exact duplicate prose | Not general summarization or semantic deduplication |
| `cachescope/optimizers/retention_guard.py` | Validate declared deletion spans and retained text | Does not prove omitted facts were irrelevant |
| `desktop/structural_compactor.py` | Compact supported JSON and restore edits | Restoration requires the saved patches |
| `web/app.js`, `web/bridge.mjs`, `web/worker.mjs` in the development tree | UI, Python bridge and browser execution | Public artifact bundles bridge/worker and exports selected Python source |

In this public repository, the Python modules above are packaged inside
[`python-sources.json`](python-sources.json), not separate directories. The
browser files are at the repository root: [`app.js`](app.js),
[`worker.mjs`](worker.mjs), [`index.html`](index.html) and [`styles.css`](styles.css).
Full private-source paths describe development modules; they are not promises
that the entire desktop source is published here.

**Continue below for complete strategy contracts, guard boundaries, cache-cost
derivations, evaluation methods and the prioritized development roadmap.**

## Reading guide

This README is both a user guide and a technical design note. It distinguishes
**implemented browser behavior**, **desktop-only functionality**, and **proposed
research methods**. A formula below is not evidence that the corresponding
measurement or prediction is already available in the web demo.

- [User workflow](#how-to-use-it--用户怎么使用)
- [Technical core / 原理、公式与代码结构](#technical-core--原理公式与代码结构)
- [Project motivation and scope](#why-this-project-exists)
- [Architecture](#architecture-what-runs-where)
- [Optimization principles](#personal-mode-principle-and-formulas)
- [Strategy contracts](#strategy-contracts-and-rejection-boundaries)
- [Worked examples](#worked-examples)
- [Preview state and data contracts](#preview-state-and-data-contracts)
- [Cache economics](#team-api-principle-caching-and-keepalive)
- [Evaluation protocol](#evaluation-how-an-improvement-should-be-demonstrated)
- [Evidence and limits](#evidence-and-limitations)
- [Current limitations](#current-limitations--当前局限性)
- [Files and reproducibility](#public-file-map)
- [Privacy](#privacy-and-safe-use)
- [Roadmap and contributions](#development-direction)

## How to use it / 用户怎么使用

### Start here: no installation or API key

1. Open [CacheScope Web](https://thisisyk.github.io/cachescope-web/) and choose English or 中文 in the top-right corner.
2. Read the experimental-use notice, tick the agreement box and click **Start local engine / 启动本地引擎**. The first load downloads the runtime and tokenizer; wait for initialization before previewing.
3. Stay in **Personal / 个人精简**. Choose your intended platform, then paste the task and context you were going to send into **Your task / 你的任务**. You can click **Try an example / 试用示例** first. The platform choice is informational, not an account connection.
4. Click **Check & preview / 检查并预览**. Compare the original with **Candidate / 候选内容** and inspect the local token counts under **This result / 本次结果**.
5. Check that numbers, names, negations, formatting requirements and all task instructions remain correct. If satisfied, tick **I reviewed the important facts and requirements / 我已核对重要事实与要求**, then click **Confirm & copy / 确认并复制**.
6. Paste the copied text into ChatGPT, Claude, Codex or your preferred assistant and send it yourself. CacheScope does not send the message or edit another app's input box.
7. Optionally click **Download result (no prompt text) / 下载结果（不含原文）** to keep the local measurement report. This is not a report of measured subscription savings.

中文快速流程：打开网页 → 选择语言 → 阅读并同意说明 → 启动本地引擎 →
粘贴任务（或试用示例）→ 检查并预览 → 核对候选 → 勾选已核对 → 确认并复制 →
粘贴到你原来使用的聊天工具，由你自己发送。无需安装 Python，也不需要在网页填写 API Key。

### How to interpret the result / 怎么看结果

- **Original tokens / 原文 Token** and **Candidate tokens / 候选 Token** are local `cl100k_base` counts. They are not live readings from your selected platform.
- **Local input reduction / 本地输入减少** measures the difference between those counts, not API billing or remaining subscription quota.
- If the text is unchanged or reduction is 0%, no applicable shorter candidate was found. Use the original; a nonzero result is not forced.
- If important information is missing, do not approve the candidate. Use the original and report an anonymized example if you want to help improve the project.
- If you edit the input or approval expires, click **Check & preview** again. If clipboard permission is denied, follow the page's instruction to copy the selected text with Ctrl+C.

中文提醒：减少的是当前输入的本地估算 token，不等于平台总消耗或订阅额度同比减少。
候选不合适就用原文；没有缩短不代表必须继续删减。请先用非敏感示例体验，不要为了
获得更高比例而删除任务所必需的信息。

### Team API users / 团队 API 用户

The public webpage does not run a gateway or keepalive. Its Team API tab is an
explanation, not a one-click connection to your application. The desktop build
and full source are currently in a private repository; its download link requires
repository access. If you cannot access it, use a public Issue to request testing
access—do not send credentials.

For users with desktop access: open the app, read the agreement, select Team API,
configure your provider locally, start the gateway, then configure a supported
application to use the displayed local API endpoint. Run a small request and
inspect reported usage before considering opt-in keepalive. Provider calls can
cost money, and unsigned Windows builds may be blocked by device policy.

团队版目前不是公开网页里可直接运行的功能。需要桌面版本及相应访问权限，
并在本地配置供应商连接和应用入口。初次使用先观察，不要把启用 keepalive
当作必然省钱；不要在网页或公开 Issue 中填写密钥。

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

## Why this project exists

An LLM task can consume unnecessary resources in several different ways:

1. The user supplies repeated or unnecessarily formatted text.
2. A narrow question is bundled with much more context than it needs.
3. Multiple API requests repeat a stable prefix whose computation could be reused.
4. A shorter prompt produces a worse answer and causes additional clarification or retries.

The first two motivate the personal engine. The third motivates the separate
team cache controller. The fourth is why prompt length alone is insufficient
as a success metric. The goal is **less unnecessary work for an acceptable task
outcome**, not the shortest possible text at any cost.

These mechanisms should not be conflated:

| Mechanism | What changes | In this browser build? | What it does not establish |
| --- | --- | --- | --- |
| Structural compaction | Representation of suitable JSON | Yes, supported cases | Lower total task or subscription usage |
| Task-specific context selection | Which source material reaches the model | Yes, narrow scopes | General semantic equivalence |
| Free-form model rewriting | Natural-language phrasing produced by a model | No | That shorter wording preserves every requirement |
| Provider prefix caching | Reuse of provider computation | No; desktop/API work | Fewer tokens sent |
| Keepalive | Extra requests intended to maintain reusable context | No; opt-in desktop work | That extra spending pays for itself |
| Semantic response caching | Reuse of a previous answer | Not this browser's engine | Correctness for a new question |
| Subscription quota observation | Reading a platform's settled usage measure | No | A universal token-to-quota conversion |

CacheScope is not a new foundation model. The current public artifact combines
a bilingual interface, a local tokenizer, bounded Python transformation rules,
preview integrity checks and explicit user approval. Learned compression and
reuse prediction remain separate research directions rather than assumed capabilities.

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

### Runtime sequence and separation of responsibilities

1. GitHub Pages serves static HTML, JavaScript, CSS, the tokenizer and Python/WASM files.
2. After consent, `app.js` creates a module Web Worker and sends an initialization message.
3. The worker starts Pyodide, loads `python-sources.json` into its virtual filesystem,
   installs the Python engine and provides a JavaScript token-count callback.
4. A preview request passes the current text to `Engine.preview()`. The worker
   isolates this computation from the UI thread; it is not a remote inference server.
5. The Python bridge retains the full latest plan in worker memory and returns
   a smaller presentation object to the UI.
6. Confirmation sends the current draft and approval back to the engine. The
   confirmed result is copied only after the plan checks succeed.
7. A new preview replaces the latest plan. There is no browser-side historical
   experiment database or live subscription account connection in this distribution.

The same Python core is reused to reduce divergence between desktop and browser
behavior. This does not make their surrounding capabilities identical: desktop
processes can run a gateway or experiments; the static website cannot.

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

## Strategy contracts and rejection boundaries

### 1. Exact single-record selection

`record_selector.py` recognizes specific English and Chinese `id -> code` lookup
instructions. The root JSON object must contain only `records`; IDs must be
unique strings; exactly one row must match; the selected `code` must be a string.
The prompt must match the supported instruction and single JSON-fence structure.

The selector keeps the matching record and compacts that JSON. It does not
generalize to arbitrary database queries. Duplicate IDs, multiple targets,
unrecognized wording, comparisons, aggregation or extra instructions prevent
this strategy from being selected. Another safe fallback may still apply.

Removed records are genuinely absent from the candidate. Their recoverability
from an in-memory edit record does not make the candidate lossless by itself.

### 2. Bounded Python dependency selection

`code_context_optimizer.py` parses a single fenced Python module with `ast`;
it does not execute the submitted code. It can retain a clearly targeted
function and statically named dependencies, or a supported print expression
and its dependencies, while removing unrelated definitions.

The accepted subset is deliberately small: undecorated functions with restricted
expressions, local assignments and conditionals, optionally followed by one
top-level print. Imports, classes, defaults, annotations, attribute access,
dynamic calls, loops and other unsupported structures are rejected by this
selector. The parser limits analysis to 4,000 AST nodes and the engine's text bound.
This is not a general repository slicer or a proof of arbitrary Python purity.

### 3. Explicit reference selection and exact duplicate removal

`context_optimizer.py` has two bounded families:

- **Reference selection:** the question clearly identifies one labeled source,
  markers have both opening and closing boundaries, and the selected body has
  query-word support. Supported marker forms include
  `<reference name="Label">...</reference>`, `[Reference: Label]...[/Reference]`,
  and `BEGIN REFERENCE: Label...END REFERENCE`.
- **Duplicate removal:** remove exact repeated prose paragraphs or sentences
  in supported positions, retaining the first copy. Similar-but-not-identical
  passages are not assumed interchangeable.

Cross-reference/global-policy cues, multiple targets, comparison/counting tasks,
protected quotations and code can make these transformations inapplicable.
Repetition may encode emphasis or discourse structure even when text is identical,
so exact matching does not eliminate the need for review.

### 4. Structural JSON compaction

`prompt_compressor.py` delegates to `desktop/structural_compactor.py`. This is
not a neural compressor: it removes permitted whitespace from explicit JSON
fences while preserving supported lexical content. Instructions requiring
original formatting or other protected exact-text behavior can block the edit.
It is a fallback, not a promise that every JSON-containing prompt will shrink.

### 5. Retention guard: a scoped invariant, not an oracle

For declared deletion intervals `D`, the reference/deduplication guard verifies:

```text
candidate = concatenate(original segments outside D)
restore(candidate, original edit patches) = original
protected spans do not intersect D
```

It also checks deletion bounds, supported deletion kinds and exact retained
counterparts for duplicates. It permits at most 128 declared deletion edits
in this context path. The Python-code path has its own guard and dependency checks.
Record selection instead validates its narrow JSON/query contract and restoration;
not every strategy runs the same guard.

Number, negation, entity-token and constraint checks compare **retained material**
against the candidate. Deleted sources can contain numbers or entities that no
longer appear. `global_inventory_unchanged` is distinct from scoped retention.
Entity checks use lexical patterns, including capitalized tokens and CJK runs,
not a trained named-entity recognizer. These checks do not independently establish
that every deletion is semantically irrelevant.

### Dispatch and fallback semantics

```text
capture original snapshot
try exact record selection
if inapplicable: try bounded code selection
if inapplicable: try bounded document/context selection
if still inapplicable: try structural compaction / unchanged original
validate applicable guards, baseline accounting and restoration
seal proposal; await explicit confirmation
```

This is an ordered dispatcher, not a search that scores all transformations
and picks a global optimum. A shorter output must also satisfy its strategy's
eligibility rules. Unsupported scope normally falls back to the original or a
more limited transformation; malformed input, invalid counters or integrity
failures can also raise an error. No candidate should be copied after such an error.

## Worked examples

### Example A: measured local JSON compaction

Input used in a local source-engine check on September 18, 2026:

````text
Read this data and return amount.
```json
{
    "amount": 123,
    "active": false,
    "description": "Example record"
}
```
````

Actual candidate:

````text
Read this data and return amount.
```json
{"amount":123,"active":false,"description":"Example record"}
```
````

| Observation | Measured value |
| --- | --- |
| Strategy | `structural-json-v2` |
| Local `cl100k_base` tokens before / after | 34 / 25 |
| Input reduction | `1 - 25/34 = 26.47%` |
| Edit restoration check | Passed |
| Target-model answer quality tested in this check | No |
| Subscription savings tested in this check | No |

The browser sample uses this English text when English is selected. Changing
whitespace, language or the tokenizer can change the counts. The task still
requires the downstream assistant to answer; CacheScope itself did not call one.

### Example B: a protected-format task

Prefix that input with `Keep the original format.`. The browser integration test
checks that the result remains unchanged for this protected case. Zero reduction
is the appropriate outcome when a supported edit would violate the request.

### Example C: why deleting irrelevant-looking context can be wrong

A question about the price of one item might look like a single-record lookup.
But an additional instruction such as "apply the discount in the shared policy"
makes that other material relevant. A selector that only follows the item name
could silently lose the discount rule. This motivates explicit scope restrictions,
cross-reference rejection and an original-preserving fallback. It remains an
illustration of risk, not a claim that every such dependency is detected.

## Preview state and data contracts

### UI lifecycle

```text
not initialized -> consent -> loading -> ready
ready + input -> checking -> unchanged original OR proposed candidate
proposed candidate + review -> confirm -> copy
edited input / expired plan -> invalidate -> preview again
failure -> show error; do not treat the operation as successful
```

The default policy permits at most 50,000 characters and makes confirmation
valid for 900 seconds. Browser text-field and Python string length conventions
can differ for some Unicode characters; 50,000 is not a token budget.
While a request is busy, action buttons are disabled. Request IDs and captured
input snapshots are checked so a response for an older draft is not shown as a
valid result for a new draft.

### Internal plan versus exported report

| Data | Location and purpose | In the downloaded browser report? |
| --- | --- | --- |
| Original and candidate text | UI and worker memory; review and confirmation | No |
| Edit patches and original hashes | Full Python plan; restoration and integrity | No |
| Plan ID, creation/expiry times and approval seal | Full Python plan; confirmation validation | No |
| `strategy`, `changed`, `reason` | Explain the selected path | Yes |
| `local_before`, `local_after`, `local_reduction` | Local tokenizer measurements | Yes |
| `requires_review` | Candidate review flag | Yes |
| `platform_declared` | User-selected label, not a verified account/model | Yes |
| `measurement` | `local_cl100k_estimate` | Yes |
| `subscription_savings_verified` | Explicitly false for browser preview | Yes |

The engine seals relevant plan fields using an ephemeral per-instance HMAC key.
Confirmation verifies the seal, exact original text, approval and expiration.
This guards against stale or modified proposals inside the workflow. It is
not remote attestation, a proof of model quality or protection against compromised
browser scripts/extensions that can access the runtime itself.

The bridge returns a subset of fields; the UI strips the candidate before export.
The downloaded `cachescope-result.json` is therefore a local preview report, not
an A/B experiment ledger or a detailed guard audit. Hashes and patches in the
internal engine must not be mistaken for data exported by this web interface.

Export is available before approval and records neither successful confirmation
nor downstream use. It cannot show whether the candidate was sent or whether an
answer was correct. An unchanged original can be copied without ticking a review
checkbox. Candidate text is read-only; to make changes, edit the input and preview
again. Code and document selection both use the UI strategy label `daily-context-v1`;
the `reason` field provides a more specific explanation.

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

### Break-even condition and time horizon

For the simplified single-reuse model, if `Δh = h_strategy - h_baseline > 0`
and `D_reuse > 0`, the strategy has positive expected net benefit only if:

```text
p_reuse > K_extra / (Δh × D_reuse)
```

If that threshold exceeds 1, the assumed strategy cannot pay off within this
model. If `Δh <= 0`, spending on keepalive has no modeled cache-hit advantage.
If `K_extra` itself depends on when the session ends, compare the full expected
cost rather than treating it as a known constant.

For multiple possible future requests over horizon `H`:

```text
E[net benefit over H] = sum_j(p_j × Δh_j × D_j) - E[K_extra over H]
```

Here `p_j` is the probability of reuse opportunity `j`; use a conditional or
joint model when dependencies matter. This decomposition is explanatory, not
the browser's algorithm and not a trained predictor already serving users.

Illustrative, non-provider-specific numbers: let `p_reuse = 0.6`, `Δh = 0.7`,
`D_reuse = $0.02` and `K_extra = $0.005`. The expected net benefit is
`0.6 × 0.7 × 0.02 - 0.005 = $0.0034`. At `p_reuse = 0.2`, it becomes
`-$0.0022`. The same keepalive policy can help one workload and hurt another.
These are arithmetic examples, not measured customer savings or current API prices.

TTL experiments should observe provider-reported cache usage after controlled
idle gaps. A hit at one gap and miss at another bounds behavior in those trials;
it does not prove a universal exact TTL. Repeated probes can refresh a cache and
confound the measurement. Independent trials, replication, stable prefixes and
clear separation of natural retention from keepalive effects are needed.

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

### A fuller research protocol, not a result claimed by the demo

Before running an evaluation, define the task population, quality rubric,
allowed quality-loss tolerance `ε`, target model/settings and resource metric.
Keep development examples separate from the final evaluation set.

| Stage | What to control or record | Why it matters |
| --- | --- | --- |
| Sampling | Language, task type, context size, protected content | Avoid testing only easy shrinking cases |
| Assignment | Same tasks for A and B; randomized/counterbalanced order | Reduce task and order confounds |
| Execution | Target model, tool access, output limits, retries | Avoid changing the task while claiming optimization |
| Quality | Independent rubric; numbers, constraints and completeness | Shorter wrong answers are not free improvements |
| Accounting | Optimizer overhead, every attempt, failures, missing usage | Prevent optimistic success-only reporting |
| Analysis | Coverage, paired estimates, uncertainty, task slices | Expose cases where the method does not apply |
| Decision | Savings together with the agreed quality constraint | Distinguish useful savings from unacceptable loss |

At dataset level, a weighted aggregate is:

```text
aggregate_resource_reduction = 1 - sum_i(U_B,i) / sum_i(U_A,i)
quality_loss = Q_A - Q_B
candidate acceptance criterion: resource_reduction > 0 and quality_loss <= ε
```

The ratio of totals is not the average of task-level percentages: it gives more
weight to tasks that consume more resources. Report both when useful, with the
aggregation method explicit. Separate languages/task families; a large gain
on narrow lookup tasks can hide regressions on ordinary instructions.

Two additional diagnostics are useful:

```text
transformation_coverage = tasks with changed candidates / all submitted tasks
measurement_coverage = pairs with valid comparable measurements / expected pairs
```

Retain unchanged tasks in workload-level results, and report missing measurements
separately. Excluding failed or unavailable pairs cannot justify a general saving
claim. Paired confidence intervals or a paired bootstrap can characterize sample
uncertainty; these are proposed analysis methods, not a feature of the current
browser report. Repeated trials must account for task-level dependence.

### Why shorter input can cost more overall

Suppose A consumes 1,000 input tokens and 200 output tokens once: 1,200 tokens.
Suppose B consumes 700 input tokens and 200 output tokens, but requires one
additional 700-input/200-output attempt: 1,800 tokens. Input length fell by 30%,
while total token usage increased by 50%. Actual APIs may charge these token
categories differently, so cost must be evaluated separately as well.

If quota displays are rounded, a zero displayed change means "below the observable
resolution or unsettled", not "free". Resetting windows and unrelated account
activity invalidate simple differences. No finite experiment promises a universal
per-task quota forecast across closed consumer platforms.

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

## Current limitations / 当前局限性

These are known boundaries of the current version, not small-print exceptions
to a promised saving. The project should be used for exploratory testing, with
the original input retained and results reviewed.

| Limitation | Practical consequence | Development still needed |
| --- | --- | --- |
| Narrow deterministic coverage | Many ordinary prompts will remain unchanged; exact record selection needs specific templates | Broader bilingual task handling with independent quality evaluation |
| No universal semantic judge | A structurally valid deletion may still remove an important dependency or emphasis | Task-aware constraint checks, adversarial evaluation and clearer uncertainty |
| Local tokenizer only | `cl100k_base` counts need not match a selected provider/model's actual usage | Versioned model/tokenizer mapping and separate observed-versus-estimated metrics |
| Input reduction is not total savings | Longer outputs, mistakes or retries can offset a shorter prompt | Complete task-level accounting, including all attempts and optimization overhead |
| Subscription savings unverified | The browser cannot say how much ChatGPT/Claude/Codex quota a task saved | Authorized, sufficiently precise platform observations where available; honest unavailable status elsewhere |
| Preview export is incomplete evidence | Reports do not prove approval, copying, model execution, quality or savings | Opt-in experiment records with explicit lifecycle and measurement provenance |
| No automated send or app integration | Users must copy/paste and submit in their own assistant | Usability improvements or permitted integrations with explicit consent |
| Team functionality is not hosted here | The Team API tab does not connect applications or perform keepalive | Separate accessible desktop distribution and provider-specific integration validation |
| No universal TTL or keepalive policy | A policy may add cost, and retention observations may not generalize | Controlled repeated trials, workload-specific comparisons and safe stop conditions |
| Browser memory still holds text | Local processing is not immediate erasure or a complete security guarantee | Lifecycle cleanup, threat modeling and independent security review |
| Runtime and platform compatibility | First load downloads WASM assets; browsers, permissions and device policies may block features | Broader browser/device tests, accessibility tests and better failure recovery |
| Unsigned desktop builds | Windows application control may block installation or launch | Appropriate signing and compatibility checks, without disabling protections |
| No production operations commitment | No SLA, guaranteed support, enterprise compliance claim or complete recovery process | Release discipline and operational/security work before any production offering |

The model-development limitation is equally important: the current browser
does **not** use a fine-tuned general semantic compressor, learned policy,
reinforcement learning controller or reuse-prediction service. Existing research
or training work is not automatically part of the deployed personal engine.

### Appropriate and inappropriate use today

Use it to inspect supported local transformations, try non-sensitive bilingual
examples, compare candidates and help find bugs. Keep the original and review
the resulting task in your normal assistant.

Do not rely on it as an automatic rewriting layer for high-stakes instructions,
a billing auditor, a subscription quota meter, a legal/compliance guarantee or
a production cost-reduction contract. Do not treat a green check or smaller token
number as independent proof of answer quality.

中文总结：目前能做的是本地预览和部分结构化精简，不是“任意任务都能省额度”。
我们还没有证明通用订阅额度节省，也不能保证删减后的模型答案始终等价。
公开网页不读取账户用量，不自动发送任务，不运行团队 Gateway。Windows 桌面包
仍存在未签名兼容限制。这些边界会保留在说明中，不会用模拟、局部成功案例或
测试通过数量代替真实节省证据。

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

### Run the public distribution locally

No build step is needed to serve the public artifact. For developers who already
have Git and Python installed, an optional local workflow is:

```bat
git clone https://github.com/thisisyk/cachescope-web.git
cd cachescope-web
py -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`, keep that terminal running, and stop it with Ctrl+C.
On systems where `py` is unavailable, use the installed `python` or `python3`
command. Regular users can use the hosted demo without these developer tools.
Do not open `index.html` through a `file://` URL: modules and runtime loading
need HTTP(S). The local server should remain bound to the loopback interface.

### Source build and checks for authorized maintainers

The full source checkout contains `web/build.mjs`, `bridge.mjs`, `worker.mjs`,
`test.mjs` and the unbundled Python modules. From its `web` directory:

```text
npm ci
npm run build
npm test
```

The CI build uses Node.js 22. The builder bundles the worker, copies the runtime
and third-party notices, and exports an allowlisted set of Python modules to
`dist/python-sources.json`. These commands do not run in the public distribution
repository, which contains generated assets rather than the complete build tree.

The existing Node test loads the Python/WASM runtime and shared engine. It covers
English/Chinese JSON reduction, approval and non-approval, changed-original
rejection, protected-format retention, an unchanged short prompt, oversized
input rejection and the false subscription-savings flag. It is one integration
test with multiple assertions, not a broad real-world benchmark. Browser clipboard
permissions, UI rendering and platform quota are outside that test's coverage.

Publication currently involves a separately reviewed browser artifact. Updating
private source alone does not prove the public site contains the same revision.
Compare artifact contents and deployment state before describing a fix as live.

### Troubleshooting

| Symptom | Meaning and next action |
| --- | --- |
| Start button is disabled | Read the notice and tick its agreement box |
| Preview is disabled | Wait for engine readiness and enter nonblank text; a request may be busy |
| Loading fails | Check network/resource blocking, then refresh; do not disable device protections |
| Result remains unchanged | No supported reduction was accepted; keep the original |
| Copy is disabled | Review a changed candidate, or generate a new valid preview |
| Preview expired or input changed | Run Check & preview again before approving |
| Clipboard write fails | Use the displayed Ctrl+C fallback on the selected candidate |
| Desktop link returns 404 or access denied | Desktop downloads are private, not a public web capability |

## Privacy and safe use

Draft processing happens in the browser worker. The application has no draft
upload endpoint and does not collect account credentials or read other apps.
Fetching the website still makes normal network requests to its hosting provider;
local processing does not mean the initial page load is offline.
Review candidates before pasting them elsewhere, especially for sensitive or
high-stakes tasks. Do not submit secrets in public issue reports.

Local processing is a data-flow design, not a complete security certification.
The hosting account, browser, extensions and published dependencies remain
part of the trust boundary. A compromised environment could access visible
text. The site's Content Security Policy restricts resources to its origin and
allows the WebAssembly execution needed by the engine; this does not replace
dependency review. Browser caching of application files is not a guarantee of
offline operation. Reloading also is not a certified secure-erasure procedure.

In particular, clearing or editing the UI invalidates its preview but does not
immediately erase the worker's latest Python plan. That plan can contain the
original and restoration patches until replaced or the worker is destroyed.
There is no secure-memory-erasure guarantee for browser or operating-system copies.

## Development direction

The next milestones are broader bilingual task coverage, stronger constraint
checks, independent quality evaluation, full-cost A/B accounting and better
onboarding. Reliable quota observation remains a separate, platform-dependent
problem, not something prompt compression alone solves. Research contributions
and honest negative results are as welcome as successful examples.

### Roadmap with acceptance gates

| Workstream | Next deliverable | Evidence needed before calling it complete |
| --- | --- | --- |
| Broader daily tasks | More bilingual supported scopes | Unseen tasks, failure analysis, measured quality and coverage |
| Retention checks | Better detection of lost constraints | Adversarial cases and explicit false-negative analysis |
| Evaluation | Reproducible full-task A/B reports | All attempts, overhead, missingness and uncertainty recorded |
| UI and onboarding | Clearer strategy explanations | Usability tests and accessible error/review flows |
| Provider strategies | Better cache assumptions and controls | Provider-specific controlled trials and net cost accounting |
| Learned compression | Optional model-backed candidates | Licensed data, clean splits, quality/cost comparison against rules |
| Reuse prediction | Workload-aware decision research | Calibration and out-of-sample net savings beyond fixed policies |
| Desktop distribution | Trustworthy installation path | Appropriate signing, compatibility and release checks |

These are development priorities, not delivery dates or promised product features.
A learned compressor would add model loading, inference latency and potentially
extra paid calls; it should beat the rule-based baseline after those costs are
included. More training data or epochs alone do not demonstrate an improvement.

### Implementation priorities / 还需要开发的地方

This is a proposed order, not a statement that these items are complete or funded.

**P0 — make the evidence and safety boundary clearer.**

- Distinguish preview, approval and actual downstream execution in any future reports.
- Add opt-in full-task records with model/settings, attempt counts, usage source,
  missing measurements and a separately graded outcome. Avoid retaining raw
  prompts by default, and let users inspect what will be stored.
- Add adversarial tests for hidden dependencies, lost negations, shared rules,
  numerical units and formatting requirements, including bilingual examples.
- Improve memory lifecycle handling and warnings; do not claim secure erasure
  without establishing what the platform can actually guarantee.
- Acceptance gate: no simulated, estimated, unavailable or preview-only metric
  is presented as a measured subscription saving or verified model outcome.

**P1 — improve everyday usefulness without obscuring tradeoffs.**

- Broaden supported task structures beyond narrow lookup templates and restricted
  Python modules; explain why a candidate was selected or rejected.
- Add per-model tokenizer configuration only with documented/versioned mappings;
  continue labeling approximate counts rather than implying live account access.
- Expand browser, mobile, clipboard and accessibility checks; improve initial
  loading, timeout and retry guidance without bypassing device protections.
- Acceptance gate: performance is reported on unseen task families in both
  languages, with transformation coverage, quality loss and total resource usage.

**P2 — evaluate learned and provider-specific strategies.**

- Compare any trained compressor with unchanged-input and rule-based baselines,
  using permitted data, isolated test sets and all inference costs included.
- Evaluate cache strategies against no intervention and fixed policies; measure
  net savings rather than cache hits alone.
- Study reuse prediction only when appropriate workload data is available with
  consent. Public training data by itself does not establish provider TTL behavior.
- Acceptance gate: the added complexity produces reproducible out-of-sample
  benefit at a declared quality tolerance. Otherwise retain the simpler baseline.

**Distribution and collaboration — ongoing, separate from algorithm research.**

Improve source/artifact traceability, release checks, desktop signing and a clear
contribution workflow. Keep the public browser distribution distinct from the
private full source, and document what contributors can actually reproduce.
None of these packaging changes by themselves prove a savings claim.

中文开发顺序：先把安全边界和真实测量补完整，再扩展日常中英文任务与兼容性，
最后用严格对照实验判断训练模型、缓存预测等复杂方案是否值得加入。每一步都需要
验收依据，而不是只增加功能按钮或宣称一个节省百分比。

### How to contribute a useful report

Open a public Issue with the following, omitting private data:

```text
Task type and language:
Browser / operating system:
Date and site revision, if known:
Minimal synthetic input that reproduces the behavior:
Expected behavior and important constraints:
Observed candidate or error (sanitized):
Strategy and local token counts:
Did a downstream model run? Which settings, if relevant?
What was actually measured versus still unknown?
```

Research reviews, reproducible negative examples, clearer English/Chinese
wording and code audits are welcome. The public repository contains generated
assets: for substantial engine/build changes, discuss the source workflow first
rather than hand-editing a minified worker. Please do not disclose vulnerabilities
with credentials or exploitable private data in a public report. A formal security
disclosure process and commercial support program have not been established.

### 中文技术导读

本项目分成两个思路：个人模式减少任务里不必要的输入；团队模式研究重复前缀
能否复用，以及 keepalive 的额外费用是否值得。目前公开网页只运行个人模式。
核心不是一个已经训练好的通用压缩大模型，而是规则选择器、结构检查、tokenizer
和人工确认流程。它不会自动读取你的订阅额度，也不会直接操作其他软件的输入框。

个人模式的公式是 `1 - 候选 token / 原文 token`。这只是输入层面的变化；
真正评价任务效果，还要统计输出、错误重试、优化开销和质量差异。团队模式的判断
则是“未来复用概率 × 缓存命中改善 × 单次可省费用 − 保活等额外费用”。两类指标
不能混为一谈，更不能把本地 token 减少直接换算成订阅额度节省。

程序先尝试适用范围很窄的记录选择，再尝试受限的 Python 依赖选择、文档选择
或去重，最后尝试 JSON 空白精简。不适用时可以保留原文。检查保证的是声明范围内
的结构一致性，不是“所有任务都完全无损”。未来重点是扩大适用范围、增强质量检查、
做好独立评测，并欢迎其他开发者帮助验证失败案例，而不是把实验结果包装成商业保证。

## Runtime and licenses

Third-party license texts are in licenses/. Original upstream projects:
Pyodide (0.27.7), CPython, js-tiktoken (1.0.21), OpenAI tiktoken and base64-js.
Runtime components are bundled for same-origin hosting; no CDN is contacted
by the application. To self-host, serve this directory with a static HTTP server
that supports JavaScript modules and WebAssembly. Opening index.html directly
as a file URL is not supported.
