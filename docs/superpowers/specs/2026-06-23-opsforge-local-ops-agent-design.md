# OpsForge 设计文档（本机优先运维 Agent）

- **日期**: 2026-06-23
- **状态**: 设计已确认，待实现计划（writing-plans）
- **作者**: brainstorming 会话产出
- **npm org / scope**: `@opsforge`（CLI 包 `@opsforge/cli`，全局命令 `ops`）

---

## 1. 背景与目标

仓库当前是 greenfield，只有一份 README 蓝图。README 把 OpsForge 描述成"远程多机运维平台"（SSH、CMDB、bastion、多人审批、批量并发）。

经过澄清，**真实产品意图收敛为一个更聚焦的形态**：

> **OpsForge 是一个 npm 可全局安装、Pi/LLM 驱动、本机优先的安全运维 Agent CLI。**
> 用户 `npm i -g @opsforge/cli` 后用命令 `ops`，用自然语言让它在**当前这台机器上**装软件、配服务、诊断、巡检；它在 LLM 与"高权限执行"之间插一道**结构化安全管线**：plan → 风险门禁 → 编译 → 护栏 → 执行 → 验证 → 回滚 → 审计。

类比：`claude` / `pi` / `codex` 操作本地代码与机器；OpsForge 专做**系统运维**，并且默认就是安全可审计的。

**核心设计论点（不可妥协）**：模型只负责理解与规划，执行器只负责受控执行，策略层决定"能不能做"，验证器决定"做没做好"。绝不把"LLM 推理"和"高权限执行"揉成一个自由 bash 黑盒。

### 目标（MVP = "完整 Phase 1，本机版"）

- 一个真能用的本机运维 agent，而非玩具切片。
- 自然语言 → 结构化 Plan（DSL）→ 安全执行 → 验证 → 审计的完整闭环。
- 同时支持 **Linux 与 Windows 本机执行**，运行时检测当前 OS。
- 大脑用 Pi 作为 harness（session/compaction/模型路由/TUI），OpsForge 接管并守护执行。

### 非目标（MVP 明确不做，留后期）

- 远程 SSH / WinRM / PowerShell-over-SSH 远程执行
- inventory / CMDB、多主机选择与批量并发
- secrets broker、短期票据、bastion / runner 分离
- 多人审批状态机、工单系统对接、签名任务
- Web Console、`apps/api`、`apps/worker`
- 独立 MCP servers（mcp-inventory / mcp-secrets / mcp-kb）

这些不是被否决，而是被推迟。架构需为它们留接口，但 MVP 不实现。

---

## 2. 架构总览

### 2.1 分层（本机版）

```text
┌──────────────────────────────────────────────┐
│  Entry: ops CLI / TUI（交互式确认 + dry-run） │
└──────────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│  Pi Harness（@opsforge/pi-runtime）           │
│  session / compaction / 模型路由 / TUI        │
│  + extension: ops / policy / guard            │
│  ※ 禁用/拦截 Pi 原生裸 bash                   │
└──────────────────────────────────────────────┘
                    │  build_plan(NL) → Plan(DSL)
┌──────────────────────────────────────────────┐
│  Orchestration（@opsforge/core）              │
│  plan → classify → gate → compile → guard →   │
│  execute → verify → (rollback) → audit        │
└──────────────────────────────────────────────┘
        │                 │                │
   @opsforge/policy   @opsforge/verifier  @opsforge/audit
        │                                   │
┌──────────────────────────────────────────────┐
│  Local Execution（executor-base/-linux/-win） │
│  child_process: bash / PowerShell（本机）     │
└──────────────────────────────────────────────┘
```

### 2.2 Pi 集成策略（方案 C：Pi 当 harness，OpsForge 接管执行）

已评估三种接法，采用 **C**：

| 方案 | 做法 | 取舍 |
|---|---|---|
| A 只借 LLM | 仅用 `@earendil-works/pi-ai` 当模型客户端 | 简单但丢掉 Pi session/compaction/TUI |
| B 完全交给 Pi | 让 Pi 原生 bash 自由跑 | 违背核心安全论点 ❌ |
| **C（采用）** | 用 Pi SDK 的 session/compaction/模型路由/TUI；**禁用/拦截裸 bash**，只暴露结构化 ops 工具；策略与护栏做成 Pi extension | 拿到 Pi 全套基础设施，又守住安全边界。对齐 README 的"Pi 作内核 + 包安全壳" |

落地：`@earendil-works/pi-coding-agent` 的 SDK（`createAgentSession` / `SessionManager` / `ModelRegistry` / `AuthStorage`），注册 OpsForge 自定义工具，**不注册原生 `bash`/`write`/`edit` 自由工具**（或将其路由进 command-guard + 风险门禁 + 审计）。

> 依赖前提：走 Pi/LLM 需配置 `ANTHROPIC_API_KEY`（或其他 provider）。与 claude code / pi / codex 心智一致，可接受。Pi SDK 版本需 pin（当前 ≥0.74.x，仍在演进）。

---

## 3. 核心领域模型 / DSL（`@opsforge/dsl`，灵魂包）

DSL 以 **zod 为单一事实源**，TS 类型由 `z.infer` 推导，并可导出 JSON Schema 供文档/校验。

### 3.1 基础枚举

```ts
type RiskLevel = "L0" | "L1" | "L2" | "L3";
type OsFamily  = "linux" | "windows";
type Intent    = "install" | "upgrade" | "configure" | "diagnose" | "verify" | "rollback";
```

### 3.2 Plan

```ts
interface Plan {
  id: string;
  title: string;
  intent: Intent;
  osFamily?: OsFamily;          // 缺省 = 运行时检测的本机 OS
  packageSpec?: PackageSpec;    // { name, source, version }
  prechecks: Precheck[];
  steps: Step[];
  verifications: Verification[];
  rollback: RollbackStep[];     // 可为空数组
  risk: RiskLevel;              // 由 classifier 填充
  explanation: string[];        // 模型给出的理由，用于审计与人审
  createdAt: string;
}
```

### 3.3 Step（OS 无关的判别联合，由执行器编译成具体命令）

```ts
type Step =
  | { type: "package-update-cache" }
  | { type: "package-install"; name: string; version?: string; source?: string }
  | { type: "package-remove";  name: string }
  | { type: "service-enable";  name: string }
  | { type: "service-start";   name: string }
  | { type: "service-stop";    name: string }
  | { type: "service-status";  name: string }
  | { type: "file-write";      path: string; content: string; mode?: string }
  | { type: "file-template";   path: string; template: string; vars: Record<string,string> }
  | { type: "shell";           cmd: string; shell?: "bash" | "powershell" }; // 逃生舱：MVP 默认禁用，需 --allow-shell；启用时恒为 L3 + 强护栏
```

> 同一个 `service-start{name}`：Linux 编译为 `systemctl start <name>`，Windows 编译为 `Start-Service <name>`。同一个 `package-install`：apt/yum 或 winget/choco 各自落地。**这就是 DSL 跨平台编译的价值。**

### 3.4 Precheck / Verification / Rollback

```ts
type Precheck =
  | { type: "os-detect" }
  | { type: "privilege-check"; requireElevated?: boolean }   // Linux: sudo / Windows: admin
  | { type: "disk-check"; minFreeMB: number }
  | { type: "command-exists"; name: string };

type Verification =
  | { type: "package-version"; name: string; expect?: string }
  | { type: "service-status";  name: string; expect: "active" | "running" | "stopped" }
  | { type: "port-open";       port: number }
  | { type: "process-alive";   name: string }
  | { type: "file-checksum";   path: string; sha256: string }
  | { type: "smoke-test";      cmd: string; expectExit?: number };

type RollbackStep = Step;  // 复用 Step；回滚步骤同样受护栏与审计
```

DSL 包同时导出 zod schema、TS 类型、JSON Schema，以及构造/校验 helper。

---

## 4. 执行管线（`@opsforge/core`）

一次任务的生命周期（全部在本机）：

```text
NL 指令
  → [Planner / Pi]  build_plan → Plan(DSL)          # 模型只产计划
  → [Policy]        risk-classify(Plan/Step) → RiskLevel
  → [Gate]          风险门禁（见 §5.2）：L0/L1 自动 · L2 确认 · L3 强制确认+原因
  → [Compiler]      每个 Step → CompiledCommand（本机命令）   # 可单独用于 dry-run 预览
  → [Guard]         command-guard + path-guard 校验 CompiledCommand
  → [Executor]      本机执行，采集 stdout/stderr/exitCode（超时、输出截断、artifact 落盘）
  → [Verifier]      跑 verifications → VerificationResult[]
  → 失败/验证未过   → [Rollback]（默认提示，--auto-rollback 自动）
  → [Audit]         全程事件落 SQLite + artifacts
```

`core` 不感知 SSH/具体包管理器，只编排。对外用例服务：`createPlan()` / `classifyPlan()` / `compilePlan()` / `executePlan()` / `verifyRun()` / `rollbackRun()` / `recordAudit()`。

### 4.1 Executor 抽象（`@opsforge/executor-base`）

```ts
interface HostFacts {
  osFamily: OsFamily;
  distro?: string; version?: string; arch: string;
  isElevated: boolean;             // sudo 可用 / Windows admin
  packageManagers: string[];       // ["apt"] | ["yum","dnf"] | ["winget","choco"]
}

interface CompiledCommand {
  argv: string[] | string;         // 具体命令（用于 dry-run 展示 + guard 校验）
  shell: "bash" | "powershell";
  needsElevation: boolean;
  describe: string;                // 人类可读：这条命令在做什么
}

interface StepResult {
  step: Step; command: CompiledCommand;
  stdout: string; stderr: string; exitCode: number;
  startedAt: string; endedAt: string; truncated: boolean;
}

interface Executor {
  osFamily: OsFamily;
  detect(): Promise<HostFacts>;
  compile(step: Step, facts: HostFacts): CompiledCommand;   // 纯函数，便于单测 + dry-run
  run(cmd: CompiledCommand, opts: RunOpts): Promise<StepResult>; // 注入式 command runner，便于测试
}
```

- `compile` 与 `run` 分离 → dry-run 只编译不执行；guard 校验编译结果；单测可只测 compile。
- `run` 内部的进程调用走**可注入的 runner**，集成测试可换成 fake/recording runner，避免真改系统。

### 4.2 Linux 执行器（`@opsforge/executor-linux`）

- 包管理器：apt / yum / dnf（MVP 起步 apt + yum/dnf；zypper/apk 留扩展点）
- 服务：systemd（`systemctl`）
- shell：bash/sh；提权：sudo（按需）
- 能力：distro detect、shell exec、package install/remove/query、service start/stop/enable/status、file write/template

### 4.3 Windows 执行器（`@opsforge/executor-windows`）

- 包管理器优先级：winget → choco →（MSI/exe silent 留扩展点）
- 服务：`Get-Service` / `Start-Service` / `Stop-Service` / `Set-Service`
- shell：PowerShell 7（本机，**不走 SSH remoting**）
- 提权：检测/要求管理员（UAC）；注册表写入走 safe-write 包装（高危路径默认护栏拦截）

### 4.4 OS 检测与执行器选择

启动时 `detect()` 决定 osFamily，`core` 选择对应 executor。`ops doctor` 暴露这些 facts 供排查。

---

## 5. 安全模型（`@opsforge/policy` + guard）

### 5.1 风险分级（沿用 README）

| 级别 | 示例 | 默认策略 |
|---|---|---|
| L0 | 查版本、查服务、看日志 | 自动执行 |
| L1 | 装白名单软件、启停普通服务 | 自动执行并审计 |
| L2 | 改配置、改 systemd unit、改 PATH、改普通注册表项 | 需交互确认 |
| L3 | 改 sudoers/sshd/防火墙、删目录、`shell` 逃生舱、改高危注册表 | 强制确认 + 记录原因 |

`risk-classifier`：基于 step-type 的基础分 + 路径/命令升级规则的查表式实现（确定性、可单测）。

### 5.2 风险门禁（交互式确认，取代远程版多人审批）

本机单用户场景下，README 的"多人审批链/工单"退化为**交互式确认**（类似 Claude Code 权限提示）：

- L0 / L1：自动执行（仍审计）
- L2：执行前弹一次确认
- L3：执行前强制确认，并要求/记录一句原因
- 非交互模式（CI / `--yes`）：默认拒绝 L2+，除非显式 `--yes`；可配 `--risk-max` 上限

### 5.3 命令护栏（`command-guard`，默认拒绝）

`curl|sh`、未签名远程脚本执行、`rm -rf /`、任意开放防火墙、改 sshd/sudoers/root ssh 等。作用于**编译后的 CompiledCommand**（不是模型自然语言）。

### 5.4 路径护栏（`path-guard`，默认保护）

`/etc/sudoers`、`/root/.ssh`、`/etc/ssh/sshd_config`、`/usr/lib/systemd/system`、`C:\Windows\System32`、高危注册表路径等的写/删默认拦截（升级为 L3 或直接 block，可配）。

### 5.5 运行时硬护栏（`pi-extension-guard`）

protected paths、blocked commands、max runtime、max output size、（出站域名白名单留扩展点）。

---

## 6. Pi 集成设计（`@opsforge/pi-runtime`）

- 用 `createAgentSession({ sessionManager: SessionManager.inMemory()/persistent, authStorage, modelRegistry })`。
- **三个 extension：**
  - `pi-extension-ops`：注入结构化工具 `inspect_host` / `build_plan` / `execute_job` / `verify_run` / `rollback_run`。模型用 `build_plan` 产出 DSL Plan（参数受 DSL zod schema 校验，schema 不匹配则模型重试）；其余执行交给 `core` 确定性管线。
  - `pi-extension-policy`：工具调用前后拦截——risk 检查、门禁、确认状态。
  - `pi-extension-guard`：硬保护（§5.5）。
- **禁用裸 bash**：不注册 Pi 原生自由 `bash`；若需 shell，只能经 `shell` Step（高风险 + 双重护栏 + 审计）。
- Planner = "prompt 模板 + build_plan 工具 schema + 校验"。skill 模板（§9）作为 few-shot 知识与确定性兜底喂给 planner，但主路径是 LLM。

---

## 7. CLI 设计（`@opsforge/cli`，命令 `ops`）

```text
ops "在本机安装 nginx"     # 默认：plan → 确认 → 执行 → 验证（交互一条龙）
ops plan "<NL>"           # 只生成并展示 Plan（dry-run，不执行）
ops apply <plan_id>       # 执行一个已生成的 Plan
ops run "<NL>"            # plan+execute 一步到位（默认行为的显式形式）
ops verify <run_id>       # 重跑某次执行的验证
ops rollback <run_id>     # 回滚某次执行
ops audit ls              # 列出历史 plan/run
ops audit show <run_id>   # 查看审计/回放（含编译命令、输出、验证、回滚）
ops doctor                # 自检：OS facts、包管理器、提权、API key、Pi 状态
ops config ...            # 配置 provider/key、风险默认、护栏开关
```

通用 flags：`--dry-run` · `--yes/-y` · `--auto-rollback` · `--risk-max <L0..L3>` · `--json`。

交互确认用轻量 prompt 库（如 `@clack/prompts`）；完整 Ink TUI 留后期。

---

## 8. 审计与可追溯（`@opsforge/audit`）

### 8.1 存储

- **SQLite**（`~/.opsforge/opsforge.db`，better-sqlite3）：表 `plans` / `runs` / `step_runs` / `audit_events`。
- **artifacts**：`~/.opsforge/artifacts/<run_id>/`（stdout/stderr dump、快照、报告）。

### 8.2 事件模型（append-only）

```ts
type AuditEvent =
  | { type: "plan.created";          payload: { planId, intent, risk } }
  | { type: "plan.classified";       payload: { planId, risk } }
  | { type: "gate.confirmed";        payload: { planId, risk, reason? } }
  | { type: "job.dispatched";        payload: { runId, planId } }
  | { type: "run.step.started";      payload: { runId, step, command } }
  | { type: "run.step.finished";     payload: { runId, step, exitCode } }
  | { type: "run.verified";          payload: { runId, results } }
  | { type: "run.rollback.started";  payload: { runId } }
  | { type: "run.rollback.finished"; payload: { runId, results } };
```

每次执行至少记录：who/when/target(本机)/plan/risk/确认链/编译后步骤/stdout-stderr/exitCode/验证/回滚/artifacts。

---

## 9. Monorepo / 包拆分（本机版 Phase 1）

```text
opsforge/
├─ apps/
│  └─ cli/                       # @opsforge/cli → 命令 ops
├─ packages/
│  ├─ dsl/                       # Plan/Step/Risk/Verify/Rollback（zod + 类型 + JSON Schema）
│  ├─ core/                      # 管线编排（plan→gate→compile→exec→verify→audit）
│  ├─ planner/                   # NL→Plan：Pi/LLM adapter + skill 模板兜底
│  ├─ policy/                    # risk-classifier / command-guard / path-guard
│  ├─ verifier/                  # service/port/version/checksum/smoke 验证
│  ├─ executor-base/             # 本机执行器抽象接口
│  ├─ executor-linux/            # apt/yum/dnf + systemd + shell
│  ├─ executor-windows/          # winget/choco + PowerShell + 服务
│  ├─ audit/                     # 事件 + SQLite + artifacts
│  ├─ pi-runtime/                # Pi SDK 接入 + extension(ops/policy/guard)
│  ├─ config/                    # 配置/env schema/feature flags
│  └─ shared/                    # types/errors/utils/logger(pino)
├─ skills/                       # install-nginx / install-docker / install-nodejs ...
├─ schemas/                      # 导出的 *.schema.json
├─ prompts/                      # planner / system prompt 模板
├─ examples/
├─ pnpm-workspace.yaml  turbo.json  tsconfig.base.json  package.json
```

### 依赖关系

```text
cli → core, pi-runtime, planner, config, shared
core → dsl, policy, verifier, audit, executor-base, shared
executor-linux / executor-windows → executor-base, shared
pi-runtime → core, planner, (pi-extension ops/policy/guard 内联其中)
planner → dsl, pi-ai(@earendil-works), shared
policy / verifier / audit → dsl, shared
```

### 第一阶段包清单（本机语义）

必做：`dsl` · `core` · `planner` · `policy` · `verifier` · `executor-base` · `executor-linux` · `executor-windows` · `pi-runtime` · `audit` · `config` · `shared` · `cli`。

---

## 10. 技术栈与分发

- 语言：TypeScript，Node 20+
- monorepo：**pnpm workspace + Turbo**；打包 **tsup**；版本 changesets
- schema：**zod**（+ 导出 JSON Schema）；日志：**pino**
- CLI：commander（+ `@clack/prompts` 交互确认）；完整 Ink TUI 后期
- 执行：`child_process`（bash / PowerShell）；**不引入 `ssh2`**（本机无需）
- 存储：**better-sqlite3** + 本地文件 artifacts
- 大脑：`@earendil-works/pi-coding-agent`（SDK）+ `@earendil-works/pi-ai`（模型客户端）
- 测试：**vitest**
- 分发：`npm i -g @opsforge/cli` → 命令 `ops`

---

## 11. 测试策略

- **单元（确定性、无 LLM/无副作用）**：dsl schema 校验、risk-classifier、command-guard、path-guard、verifier matcher、executor `compile()`（step→命令字符串）。
- **集成（不改系统）**：executor 用**注入式 fake/recording runner**；真实只读命令（`whoami`、`--version` 查询）可跑。**任何会改系统的真实安装测试默认关闭**，由 `OPSFORGE_E2E=1` 显式开启，且建议在容器/一次性 VM 中跑。
- **Planner**：mock Pi/LLM 客户端，断言 NL+HostFacts → schema-valid Plan；真实 LLM 测试 opt-in。
- **门禁/护栏**：针对危险输入（`rm -rf /`、改 sshd、写受保护路径）断言被 block 或升级 L3。

---

## 12. MVP 交付清单

**交付（Done 定义）**：

- `@opsforge/dsl`：完整 Plan/Step/Verify/Rollback schema + 类型 + JSON Schema 导出。
- 管线 `core`：plan → classify → gate → compile → guard → execute → verify → rollback → audit 全链路可跑。
- `planner`：经 Pi/LLM 把 NL 变成 schema-valid Plan（含 build_plan 工具 + 校验 + 重试）。
- `policy`：风险分级 + 命令护栏 + 路径护栏。
- 执行器：**Linux + Windows 本机**，运行时 OS 检测。
- `verifier`：service/port/version/checksum/smoke。
- `audit`：SQLite 落库 + artifacts + 事件流。
- `cli`：`plan / apply / run / verify / rollback / audit / doctor / config` + dry-run + 交互确认。
- 3–5 个 skill 模板（install-nginx / install-docker / install-nodejs 等）。
- `ops doctor` 自检通过；端到端 demo：`ops "在本机安装 nginx"`（Linux）/ 等价 Windows 场景。

**明确不交付（见 §1 非目标）**：远程 SSH、inventory、secrets、审批状态机、Web/api/worker、MCP servers、签名任务。

---

## 13. 风险与开放问题

1. **Pi SDK 演进**：版本仍在迭代（≥0.74.x），需 pin 版本，并把 Pi 接入隔离在 `pi-runtime` 一个包内，降低 API 变动影响。
2. **Windows 提权（UAC）**：本机管理员检测与提权交互需验证；winget 可用性需 `doctor` 探测。
3. **`shell` 逃生舱**：最危险的 Step。**MVP 默认禁用**，仅 `--allow-shell` 显式开启；启用时恒为 L3 + 命令/路径双重护栏。（已定，非开放项。）
4. **LLM 成本/延迟**：planning 走模型，需配 key；可加 skill 模板兜底减少必需的 LLM 调用。
5. **自动回滚边界**：默认仅"提示回滚"，`--auto-rollback` 才自动；部分操作不可逆（删除类）需在 plan 阶段标注。

---

## 14. 命名（已定）

- 仓库：`opsforge`
- npm scope：`@opsforge`，CLI 包 `@opsforge/cli`
- 全局命令：`ops`
- 产品名：**OpsForge**

---

## 附：与 README 蓝图的差异摘要

| 维度 | README 蓝图 | 本设计（MVP） |
|---|---|---|
| 执行目标 | 远程多机（SSH/WinRM） | **本机 localhost**（child_process） |
| 审批 | 多人审批链/工单 | **交互式确认**（L2 确认 / L3 确认+原因） |
| 资产 | inventory / CMDB | 无（目标恒为本机，仅 HostFacts） |
| 凭证 | secrets broker / 短期票据 | 无（用当前用户权限 + UAC/sudo） |
| OS | Linux 优先，Windows Phase 2 | **Linux + Windows 同期**（本机执行更简单） |
| Pi | 控制面内核 | 同左，方案 C：harness + 接管执行 |
| 存储 | Postgres/Redis/S3 | **SQLite + 本地文件** |
| 形态 | 平台（cli+api+web+worker） | **单一 npm CLI**（`@opsforge/cli`） |
