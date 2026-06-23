# OpsForge

## Current implementation status

OpsForge is now being built plan-by-plan on `main`.

- Design spec: `docs/superpowers/specs/2026-06-23-opsforge-local-ops-agent-design.md`
- Plan 1 foundation: `docs/superpowers/plans/2026-06-23-opsforge-plan-1-foundation.md`
- Plan 2 deterministic pipeline: `docs/superpowers/plans/2026-06-23-opsforge-plan-2-deterministic-pipeline.md`
- Plan 3 audit persistence: `docs/superpowers/plans/2026-06-23-opsforge-plan-3-audit-persistence.md`
- Plan 4 planner scaffold: `docs/superpowers/plans/2026-06-23-opsforge-plan-4-planner-provider-scaffold.md`
- Plan 5 schema and plan output: `docs/superpowers/plans/2026-06-23-opsforge-plan-5-json-schema-plan-output.md`
- Plan 6 CLI run flow: `docs/superpowers/plans/2026-06-23-opsforge-plan-6-cli-run-flow.md`
- Plan 7 provider config and OpenAI-compatible adapter: `docs/superpowers/plans/2026-06-23-opsforge-plan-7-provider-config-openai-adapter.md`
- Plan 8 rollback command: `docs/superpowers/plans/2026-06-23-opsforge-plan-8-rollback-command.md`
- Plan 9 verify command: `docs/superpowers/plans/2026-06-23-opsforge-plan-9-verify-command.md`
- Plan 10 auto rollback trigger: `docs/superpowers/plans/2026-06-23-opsforge-plan-10-auto-rollback.md`
- Plan 11 verifier coverage: `docs/superpowers/plans/2026-06-23-opsforge-plan-11-verifier-coverage.md`
- Plan 12 default verifier probes: `docs/superpowers/plans/2026-06-23-opsforge-plan-12-default-verifier-probes.md`
- Plan 13 host facts and doctor: `docs/superpowers/plans/2026-06-23-opsforge-plan-13-host-facts-doctor.md`
- Plan 14 TUI foundation: `docs/superpowers/plans/2026-06-23-opsforge-plan-14-tui-foundation.md`
- Plan 15 TUI plan card: `docs/superpowers/plans/2026-06-23-opsforge-plan-15-tui-plan-card.md`
- Plan 16 TUI execution timeline: `docs/superpowers/plans/2026-06-23-opsforge-plan-16-tui-execution-timeline.md`
- Plan 17 TUI inline approval and rollback prompts: `docs/superpowers/plans/2026-06-23-opsforge-plan-17-tui-inline-approval-rollback-prompts.md`
- Plan 18 TUI event and input state: `docs/superpowers/plans/2026-06-23-opsforge-plan-18-tui-event-input-state.md`
- Plan 19 Pi runtime event bridge: `docs/superpowers/plans/2026-06-23-opsforge-plan-19-pi-runtime-event-bridge.md`
- Plan 20 TUI keyboard session controls: `docs/superpowers/plans/2026-06-23-opsforge-plan-20-tui-keyboard-session-controls.md`
- Plan 21 runtime action controller: `docs/superpowers/plans/2026-06-23-opsforge-plan-21-runtime-action-controller.md`
- Plan 22 provider depth and capabilities: `docs/superpowers/plans/2026-06-23-opsforge-plan-22-provider-depth-capabilities.md`
- Plan 23 TUI runtime wiring: `docs/superpowers/plans/2026-06-23-opsforge-plan-23-tui-runtime-wiring.md`
- Plan 24 safe file write and template execution: `docs/superpowers/plans/2026-06-23-opsforge-plan-24-safe-file-write-template.md`
- Current implementation status and design alignment: `docs/implementation-status.md`
- Checked-in Plan schema artifact: `schemas/plan.schema.json`

Useful commands:

```bash
pnpm build
pnpm test
pnpm typecheck
node apps/cli/dist/index.js
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js plan "install nginx"
node apps/cli/dist/index.js plan "install nginx" --json
node apps/cli/dist/index.js plan "install nginx" --out .opsforge-tmp/plan-nginx.json
node apps/cli/dist/index.js run "install nginx" --dry-run
node apps/cli/dist/index.js run "install nginx" --dry-run --json
node apps/cli/dist/index.js run "install nginx" --auto-rollback
node apps/cli/dist/index.js config provider openai-compatible --model gpt-4.1-mini --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY
node apps/cli/dist/index.js config provider anthropic
node apps/cli/dist/index.js config provider google
node apps/cli/dist/index.js config show
node apps/cli/dist/index.js plan "install nginx" --provider configured --json
node apps/cli/dist/index.js apply .opsforge-tmp/plan-nginx.json --dry-run
node apps/cli/dist/index.js apply examples/plan-install-nginx.local.json --dry-run
node apps/cli/dist/index.js apply examples/plan-install-nginx.local.json --auto-rollback
node apps/cli/dist/index.js verify <run_id>
node apps/cli/dist/index.js verify <run_id> --json
node apps/cli/dist/index.js rollback <run_id> --dry-run
node apps/cli/dist/index.js rollback <run_id> --dry-run --json
node apps/cli/dist/index.js audit ls
node apps/cli/dist/index.js audit show <run_id>
```

OpsForge Agent
下面我直接给你一份**能开工的产品蓝图**：先给可落地的 **monorepo 目录结构 + TypeScript 包拆分方案**，再给完整的 **产品整体设计**，最后给你一个我认为最适合的命名。整个方案默认你以 [Pi](https://pi.dev/) 作为 agent harness 内核，外面包一层你自己的策略、执行、审计和安全体系；这种做法最符合 Pi 的定位，因为 Pi 本身就强调可扩展、可通过 extensions / skills / SDK / RPC 自定义工作流，而不是一个封闭产品。[Source](https://pi.dev/) [Source](https://pi.dev/docs/latest/sdk)

---

# 一、产品定位：基于 [Pi](https://pi.dev/) 的“安全运维执行平台”

我建议你把它定义成：

> **面向 Linux / Windows 的智能运维 Agent 平台**  
> 能理解自然语言任务，先生成结构化 plan，再在策略约束下执行远程安装、配置、验证与回滚，并保留完整审计链。

这个定位比“装软件助手”更稳，因为它天然覆盖后续能力扩展：安装、升级、诊断、巡检、加固、批量变更、审批流、资产联动、知识沉淀。Pi 的 session、message history、compaction、event streaming、custom tools 和 extension 机制，很适合做这种“可解释、可插拔、可审计”的控制面内核。[Source](https://pi.dev/docs/latest/sdk)

---

# 二、完整产品蓝图

## 2.1 总体分层

```text
┌──────────────────────────────────────────────────────────┐
│                    UX / Entry Layer                      │
│ TUI (ops) | Web Console | API | CI/CD | Chat Interface  │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                  Agent Control Plane                     │
│ Pi Runtime | Planner | Policy Engine | Context Engine   │
│ Session Manager | Approval Orchestrator | Audit Adapter │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                  Operation Abstraction                   │
│ Intent DSL | Plan Schema | Risk Classifier | Verifier   │
│ Rollback Generator | Idempotency Rules                  │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                    Execution Plane                       │
│ Linux Executor (SSH/Bash) | Windows Executor (PS/SSH)   │
│ File Transfer | Package Manager Adapter | Service Ops   │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│               Security / Infra Integration               │
│ Secrets | CMDB | Inventory | Artifact Repo | Bastion    │
│ Logging | OPA/Policy | Ticket/Approval | Metrics        │
└──────────────────────────────────────────────────────────┘
```

这套结构的核心思想是：**模型只负责理解与规划，执行器只负责受控执行，策略层决定“能不能做”，验证器决定“做没做好”。** 不把“LLM 推理”和“高权限执行”揉成一个黑盒，是你这个产品能不能进生产的分水岭。[Source](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

---

## 2.2 四大核心对象

### A. Session
表示一次人机交互和任务上下文，底层可直接映射到 Pi session。Pi 官方说明 session 本身就管理 agent lifecycle、message history、model state、compaction 和 event streaming，这使它天然适合作为你的任务会话容器。[Source](https://pi.dev/docs/latest/sdk)

### B. Plan
表示结构化执行计划，不是自由文本。所有任务先落成 plan，再审批，再执行。

### C. Job
表示已经过策略评估、可执行的任务实例，带目标机、超时、并发、审批状态、签名摘要等。

### D. Run
表示一次真实执行记录，记录 stdout/stderr、exit code、变更痕迹、验证结果和回滚结果。

---

# 三、可落地的 Monorepo 目录结构

我建议你从一开始就做成 **pnpm workspace + Turbo/Nx** 的 monorepo，原因很简单：你后面一定会拆成 CLI、核心 DSL、Linux/Windows 执行器、Pi 扩展、审批、审计、MCP 适配器、Web API，多包是迟早的事。

## 3.1 顶层目录

```text
opsforge/
├─ apps/
│  ├─ cli/                     # 最终用户入口：ops
│  ├─ api/                     # HTTP / WebSocket 控制面
│  ├─ web/                     # 管理台（后续可选）
│  ├─ worker/                  # 异步任务、审计回放、批量执行
│  └─ docs/                    # 产品文档站点（可选）
│
├─ packages/
│  ├─ core/                    # 核心领域模型与流程编排
│  ├─ dsl/                     # Plan / Job / Policy / Verify Schema
│  ├─ planner/                 # 自然语言 -> 结构化计划
│  ├─ policy/                  # 风险分级、审批规则、路径保护
│  ├─ verifier/                # 安装后验证、健康检查、回滚建议
│  ├─ audit/                   # 审计事件模型与审计适配
│  ├─ inventory/               # 资产查询接口与缓存
│  ├─ secrets/                 # 凭证代理与短期票据
│  ├─ artifacts/               # 日志、脚本、报告、快照
│  ├─ executor-base/           # 执行器抽象接口
│  ├─ executor-linux/          # Linux SSH/Bash 执行器
│  ├─ executor-windows/        # Windows PowerShell/SSH 执行器
│  ├─ adapter-ssh/             # SSH 连接与命令传输
│  ├─ adapter-powershell/      # PowerShell remoting 抽象
│  ├─ adapter-packages/        # apt/yum/dnf/zypper/apk/winget/choco
│  ├─ adapter-services/        # systemd/service/windows service
│  ├─ adapter-files/           # scp/sftp/rsync/upload/download
│  ├─ pi-runtime/              # Pi session/runtime 接入层
│  ├─ pi-extension-policy/     # Pi 扩展：策略门禁
│  ├─ pi-extension-ops/        # Pi 扩展：运维工具注入
│  ├─ pi-extension-guard/      # Pi 扩展：路径/命令/网络保护
│  ├─ promptkit/               # system prompt / skills / templates
│  ├─ approval/                # 审批状态机与审批接口
│  ├─ telemetry/               # metrics/traces/logs
│  ├─ mcp-inventory/           # MCP: inventory server
│  ├─ mcp-secrets/             # MCP: secrets server
│  ├─ mcp-kb/                  # MCP: 知识库/安装基线
│  ├─ config/                  # 配置加载、env schema、feature flags
│  ├─ shared/                  # 工具函数、types、errors、utils
│  └─ ui-kit/                  # CLI/web 共享展示组件（可选）
│
├─ skills/
│  ├─ install-package-linux/
│  ├─ install-package-windows/
│  ├─ install-docker/
│  ├─ install-nodejs/
│  ├─ install-python/
│  ├─ configure-service/
│  ├─ verify-service/
│  ├─ collect-diagnostics/
│  └─ rollback-install/
│
├─ prompts/
│  ├─ system/
│  ├─ policies/
│  ├─ planners/
│  ├─ verifiers/
│  └─ explainers/
│
├─ schemas/
│  ├─ plan.schema.json
│  ├─ job.schema.json
│  ├─ approval.schema.json
│  ├─ inventory.schema.json
│  └─ audit.schema.json
│
├─ examples/
│  ├─ local-dev/
│  ├─ staging/
│  ├─ production/
│  └─ policies/
│
├─ scripts/
│  ├─ bootstrap.ts
│  ├─ release.ts
│  └─ validate-schemas.ts
│
├─ .changeset/
├─ pnpm-workspace.yaml
├─ turbo.json
├─ package.json
├─ tsconfig.base.json
├─ eslint.config.js
└─ README.md
```

---

# 四、TypeScript 包拆分方案

下面这套拆包方式是“够工程化，但不会一上来过度设计”的平衡版。

## 4.1 必选包

| 包名 | 作用 | 是否第一阶段必须 |
|---|---|---|
| `@yourorg/core` | 任务编排、用例服务、领域对象 | 是 |
| `@yourorg/dsl` | Plan/Job/Verify/Audit 的类型与 schema | 是 |
| `@yourorg/planner` | NL -> 结构化计划 | 是 |
| `@yourorg/policy` | 风险分级、审批、路径保护 | 是 |
| `@yourorg/verifier` | 安装后验证、回滚建议 | 是 |
| `@yourorg/executor-base` | 执行器接口抽象 | 是 |
| `@yourorg/executor-linux` | Linux 执行能力 | 是 |
| `@yourorg/executor-windows` | Windows 执行能力 | 第二阶段 |
| `@yourorg/pi-runtime` | Pi session / extension 集成 | 是 |
| `@yourorg/approval` | 审批流状态机 | 第二阶段 |
| `@yourorg/audit` | 审计事件与审计落库 | 是 |
| `@yourorg/inventory` | 主机资产接口 | 是 |
| `@yourorg/secrets` | 凭证代理 | 是 |
| `@yourorg/config` | 统一配置 | 是 |
| `@yourorg/shared` | errors/types/utils | 是 |

---

## 4.2 推荐包职责

### [`@yourorg/dsl`](#)
你的产品“灵魂包”，一定要早做稳。

负责：
- `Plan`
- `PlanStep`
- `Job`
- `Run`
- `Approval`
- `RiskLevel`
- `VerificationSpec`
- `RollbackSpec`

建议导出：
```ts
export type RiskLevel = "L0" | "L1" | "L2" | "L3";

export interface OperationPlan {
  id: string;
  intent: string;
  target: TargetSelector[];
  osFamily?: "linux" | "windows";
  prechecks: CheckSpec[];
  steps: StepSpec[];
  verifications: VerificationSpec[];
  rollback?: RollbackSpec[];
  risk: RiskLevel;
  rationale: string[];
}
```

### [`@yourorg/core`](#)
不直接感知 SSH/WinRM 等实现细节，只编排：

- `createPlan()`
- `reviewPlan()`
- `requestApproval()`
- `dispatchJob()`
- `verifyRun()`
- `recordAudit()`

### [`@yourorg/planner`](#)
这里面可以有：
- plan parser
- plan normalizer
- OS capability matcher
- package source resolver
- rollback generator

### [`@yourorg/policy`](#)
建议拆四块：
- `risk-classifier`
- `approval-engine`
- `command-guard`
- `target-guard`

### [`@yourorg/verifier`](#)
建议支持：
- process alive
- service active
- package version match
- port open
- config syntax valid
- file checksum
- smoke test command

### [`@yourorg/executor-linux`](#)
建议能力矩阵：
- distro detect
- shell exec
- package install/remove/query
- service start/stop/enable/status
- file upload
- file template render

### [`@yourorg/executor-windows`](#)
建议能力矩阵：
- PowerShell session
- installer dispatch
- winget/choco/msi/exe silent install
- Windows service verify
- registry safe-write wrapper

PowerShell over SSH 对 Windows / Linux 混合运维非常适合，因为它能用统一 PowerShell remoting 语义，同时认证和 MFA 由 SSH 体系承接，权限也保持用户原边界。[Source](https://learn.microsoft.com/en-us/powershell/scripting/security/remoting/ssh-remoting-in-powershell?view=powershell-7.6)

---

# 五、Apps 层怎么拆

## 5.1 `apps/cli`
这是你第一优先级产品。

### 目标
做出一个像 `pi` / `codex` / `claude` 一样自然的入口体验。Pi 本身可通过 npm 安装并运行 `pi`；Codex CLI 支持本地终端运行与 MCP；Claude Code 也支持 npm 全局安装。这三者都说明“终端优先 + npm 分发”是完全成立的路径。[Source](https://pi.dev/docs/latest/quickstart) [Source](https://developers.openai.com/codex/cli) [Source](https://code.claude.com/docs/en/setup)

### 建议命令
```bash
ops
ops login
ops env use staging
ops host ls
ops plan "在 web-01 上安装 nginx 并开机自启"
ops apply plan_123
ops run "检查 db-01 的 docker 状态"
ops audit show run_456
```

### 子命令结构
```text
ops
├─ login
├─ doctor
├─ env
│  ├─ ls
│  └─ use
├─ host
│  ├─ ls
│  ├─ show
│  └─ tags
├─ plan
├─ apply
├─ run
├─ verify
├─ rollback
├─ audit
└─ config
```

---

## 5.2 `apps/api`
后面你迟早会需要：
- 审批页面
- 批量任务
- 任务查询
- 审计检索
- WebSocket 实时日志流

所以 API 层建议早留位，但第一阶段不一定全做完。

### 建议接口
```text
POST   /plans
POST   /plans/:id/review
POST   /plans/:id/approve
POST   /plans/:id/execute
GET    /runs/:id
POST   /runs/:id/rollback
GET    /hosts
GET    /audits
WS     /runs/:id/stream
```

---

## 5.3 `apps/worker`
处理：
- 异步执行
- 验证重试
- 审计归档
- 报告生成
- 批量并发
- 超时终止

---

# 六、Pi 集成设计

## 6.1 为什么保留 [Pi](https://pi.dev/) 在“控制面”
因为 Pi 不是只给你一个聊天框，它本身有：
- session 生命周期
- message history
- model state
- compaction
- event streaming
- custom tools
- extensions
- AGENTS.md / 系统提示覆盖
- SDK / RPC 模式  
这些都非常适合拿来做 agent orchestration，而不需要你重复造一个基础 harness。[Source](https://pi.dev/docs/latest/sdk) [Source](https://pi.dev/docs/latest/quickstart)

---

## 6.2 你的 Pi 侧建议只做三类扩展

### A. `pi-extension-ops`
给 Pi 注入这些工具：
- `resolve_target`
- `inspect_host`
- `build_plan`
- `review_risk`
- `submit_approval`
- `execute_job`
- `verify_run`
- `rollback_run`

### B. `pi-extension-policy`
在工具调用前后拦截：
- 检查 risk
- 检查 host tag
- 检查命令白名单
- 检查审批状态

### C. `pi-extension-guard`
负责硬保护：
- protected paths
- blocked commands
- blocked outbound domains
- blocked env vars
- max runtime
- max output size

Pi 官方强调它适合通过扩展改变工具、命令、工作流与 UI，本身也有 permission gates、protected paths、SSH execution、sandbox 等示例方向，和你的产品目标很契合。[Source](https://pi.dev/)

---

# 七、核心领域模型设计

## 7.1 `Plan`

```ts
interface Plan {
  id: string;
  title: string;
  intent: "install" | "upgrade" | "configure" | "diagnose" | "verify" | "rollback";
  targets: TargetRef[];
  osFamily?: "linux" | "windows";
  packageSpec?: PackageSpec;
  prechecks: Precheck[];
  steps: Step[];
  verifications: Verification[];
  rollback?: RollbackStep[];
  risk: "L0" | "L1" | "L2" | "L3";
  approvalsRequired: number;
  explanation: string[];
  createdAt: string;
}
```

## 7.2 `Job`

```ts
interface Job {
  id: string;
  planId: string;
  targets: ResolvedHost[];
  status: "pending" | "waiting_approval" | "approved" | "running" | "succeeded" | "failed" | "rolled_back";
  concurrency: number;
  timeoutSec: number;
  ticketId?: string;
  signedDigest: string;
}
```

## 7.3 `Run`

```ts
interface Run {
  id: string;
  jobId: string;
  host: string;
  startedAt: string;
  endedAt?: string;
  steps: StepRun[];
  result: "success" | "failed" | "partial";
  verification: VerificationResult[];
  rollback?: RollbackResult[];
}
```

---

# 八、执行协议设计：必须结构化，不要自由 shell

这是完整产品里最关键的一个点。

## 8.1 推荐 DSL 样例

```json
{
  "title": "Install nginx on web-01",
  "intent": "install",
  "targets": [{ "host": "web-01" }],
  "osFamily": "linux",
  "packageSpec": {
    "name": "nginx",
    "source": "system-repo",
    "version": "latest"
  },
  "prechecks": [
    { "type": "os-detect" },
    { "type": "privilege-check", "requireSudo": true },
    { "type": "disk-check", "minFreeMB": 500 },
    { "type": "network-check", "destinations": ["repo.internal"] }
  ],
  "steps": [
    { "type": "package-update-cache" },
    { "type": "package-install", "name": "nginx" },
    { "type": "service-enable", "name": "nginx" },
    { "type": "service-start", "name": "nginx" }
  ],
  "verifications": [
    { "type": "package-version", "name": "nginx" },
    { "type": "service-status", "name": "nginx", "expect": "active" }
  ],
  "rollback": [
    { "type": "service-stop", "name": "nginx" },
    { "type": "package-remove", "name": "nginx" }
  ],
  "risk": "L1"
}
```

### 为什么要 DSL
因为它带来三件事：
1. **可审计**
2. **可审批**
3. **可跨平台编译**

同一个 `service-start`，Linux 编译成 `systemctl start`，Windows 编译成 `Start-Service`；同一个 `package-install`，apt/yum/winget/choco 各自落地。

---

# 九、统一跨平台执行模型

## 9.1 Linux 执行器

### 支持矩阵
- 连接：SSH
- Shell：bash/sh
- 包管理器：apt / yum / dnf / zypper / apk
- 服务：systemd / service
- 传输：sftp/scp/rsync
- 权限：sudo

### 执行策略
- 所有命令先 dry-run 生成
- 通过 command guard 校验
- 落地执行前做 host facts refresh
- 每一步采集 stdout/stderr/exit code
- 长输出做截断与 artifact 落盘

---

## 9.2 Windows 执行器

### 首选模型
- PowerShell 7
- SSH remoting
- 统一 cmdlet 风格
- 尽量不直接裸用 WinRM

这样可以减少双协议复杂度，而且更符合你“一个 agent 同时管理 Linux / Windows”的产品心智。PowerShell over SSH 官方已明确支持 Windows 与 Linux 之间的基础远程场景，并复用 SSH 认证体系。[Source](https://learn.microsoft.com/en-us/powershell/scripting/security/remoting/ssh-remoting-in-powershell?view=powershell-7.6)

### Windows 安装适配顺序
1. winget
2. choco
3. MSI silent install
4. exe silent args
5. 内部制品库脚本

---

# 十、安全设计：这是产品成败的关键

## 10.1 风险分级

| 级别 | 示例 | 默认策略 |
|---|---|---|
| L0 | 查询版本、查服务、看日志 | 自动执行 |
| L1 | 安装白名单软件、启停普通服务 | 自动执行并审计 |
| L2 | 改配置、改 systemd、改 PATH、改注册表普通项 | 需要计划确认 |
| L3 | 改 sudoers、改 sshd、改防火墙、删目录、重启核心主机 | 强制审批 |

---

## 10.2 你必须做的护栏

### 命令护栏
默认拒绝：
- `curl | sh`
- 未签名远程脚本
- `rm -rf /`
- 任意防火墙开放
- 改 sshd / sudoers / root ssh

### 路径护栏
默认保护：
- `/etc/sudoers`
- `/root/.ssh`
- `/etc/ssh/sshd_config`
- `/usr/lib/systemd/system`
- `C:\Windows\System32`
- 高危注册表路径

### 网络护栏
默认只允许访问：
- 官方镜像白名单
- 内部制品库
- CMDB
- secrets broker
- audit/logging endpoint

### 凭证护栏
- 永久 root key 禁止
- 使用短期 token / SSH cert
- sudo 限定命令
- 审批后临时提权
- 过期自动回收

### 会话护栏
MCP 官方安全建议里，尤其值得你吸收的包括：会话 ID 必须安全随机且与用户绑定、最小权限、工具运行沙箱化、资源限制、限制文件系统/网络访问、避免 token passthrough、限制出站访问。这些原则几乎可以直接成为你的产品安全基线。[Source](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

---

# 十一、审计与可追溯设计

你的平台必须天然支持“回放”和“追责”。

## 11.1 每次执行至少记录

```text
who             谁发起
when            何时发起
target          目标机
plan            结构化计划
risk            风险等级
approval        审批链
resolvedSteps   编译后的实际步骤
stdout/stderr   执行输出
exitCode        退出码
verification    验收结果
rollback        回滚结果
artifacts       日志/快照/附件
```

## 11.2 建议事件模型

```ts
type AuditEvent =
  | { type: "plan.created"; payload: ... }
  | { type: "plan.reviewed"; payload: ... }
  | { type: "approval.requested"; payload: ... }
  | { type: "approval.granted"; payload: ... }
  | { type: "job.dispatched"; payload: ... }
  | { type: "run.step.started"; payload: ... }
  | { type: "run.step.finished"; payload: ... }
  | { type: "run.verified"; payload: ... }
  | { type: "run.rollback.started"; payload: ... }
  | { type: "run.rollback.finished"; payload: ... };
```

---

# 十二、建议的数据与外部系统集成

## 12.1 最少要接的外部系统
- **Inventory / CMDB**：主机事实、标签、环境、owner
- **Secrets Broker**：SSH cert、token、临时票据
- **Artifact Repo**：安装包、脚本、日志
- **Approval/Ticket**：审批、变更单
- **Observability**：日志、指标、trace

## 12.2 最少要有的主机标签
```text
env=dev|staging|prod
os=linux|windows
role=web|db|cache|agent
criticality=low|medium|high
internet=true|false
approval=required|optional
```

---

# 十三、建议的开发阶段拆解

## Phase 1：MVP，先跑通 Linux
目标是“可用”，不是“全能”。

### 范围
- Pi runtime 接入
- CLI
- Linux SSH executor
- apt + yum
- 安装/验证/回滚 DSL
- 基础 policy
- 基础 audit
- inventory + secrets 简单适配

### 成果
你能执行：
- `ops plan "在 web-01 安装 nginx"`
- `ops apply plan_123`
- `ops verify run_123`

---

## Phase 2：扩展到 Windows + 审批
### 新增
- PowerShell over SSH executor
- winget/choco/MSI
- 审批状态机
- host tag policy
- protected path / command allowlist
- artifact 持久化

---

## Phase 3：生产级控制平面
### 新增
- Web Console
- 签名任务
- Runner/Bastion 分离
- 并发批量执行
- 回滚编排
- 审计检索与报表

---

# 十四、发布与分发建议

## 14.1 npm 分发形态
我建议主包就一个：

```bash
npm install -g @yourorg/opsforge
```

然后入口命令：

```bash
ops
```

之所以这样设计，是因为你想要的用户心智和 [Codex CLI](https://developers.openai.com/codex/cli)、[Claude Code](https://code.claude.com/docs/en/setup)、[Pi](https://pi.dev/docs/latest/quickstart) 很一致：**全局安装、终端启动、TUI 优先、配置驱动**。Codex 官方支持本地终端运行且有 npm 包 `@openai/codex`；Claude Code 也支持 `npm install -g @anthropic-ai/claude-code` 且要求 Node.js 18+；Pi 官方同样支持 npm 安装并启动 `pi`。[Source](https://www.npmjs.com/package/@openai/codex) [Source](https://developers.openai.com/codex/cli) [Source](https://www.npmjs.com/package/@anthropic-ai/claude-code) [Source](https://code.claude.com/docs/en/setup) [Source](https://pi.dev/docs/latest/quickstart)

## 14.2 workspace 建议
- `pnpm`
- `changesets`
- `turbo`
- `tsup` 或 `unbuild`
- `zod + json schema`
- `vitest`

---

# 十五、推荐的技术栈

## 15.1 语言与框架
- TypeScript
- Node.js 20+
- pnpm workspace
- Turbo
- Fastify / Hono（API）
- Ink / oclif / commander（CLI/TUI）
- Zod（schema）
- Pino（logging）

## 15.2 连接层
- SSH：`ssh2`
- PowerShell：基于 SSH 的封装适配
- 文件传输：sftp/scp

## 15.3 状态与队列
- PostgreSQL（plan/job/run/audit）
- Redis（队列/锁/短期状态）
- S3/MinIO（artifacts）

---

# 十六、建议的包依赖关系

```text
apps/cli
  ├─ core
  ├─ pi-runtime
  ├─ promptkit
  ├─ config
  └─ shared

core
  ├─ dsl
  ├─ planner
  ├─ policy
  ├─ verifier
  ├─ audit
  ├─ inventory
  ├─ secrets
  ├─ executor-base
  └─ shared

executor-linux
  ├─ executor-base
  ├─ adapter-ssh
  ├─ adapter-packages
  ├─ adapter-services
  └─ shared

executor-windows
  ├─ executor-base
  ├─ adapter-powershell
  ├─ adapter-packages
  ├─ adapter-services
  └─ shared

pi-runtime
  ├─ core
  ├─ pi-extension-ops
  ├─ pi-extension-policy
  ├─ pi-extension-guard
  └─ promptkit
```

---

# 十七、建议的首批 skills

这里建议你把“能力”做成 skill 包，而不是把所有逻辑写死在 prompt 里。

```text
skills/
├─ install-package-linux
├─ install-package-windows
├─ install-nginx
├─ install-docker
├─ install-nodejs
├─ install-python
├─ configure-service
├─ verify-service
├─ collect-diagnostics
└─ rollback-install
```

每个 skill 都统一输出：
1. 环境识别
2. 前置检查
3. 结构化计划
4. 风险等级
5. 执行步骤
6. 验证步骤
7. 回滚建议

---

# 十八、给你一份最小“开工版” README 心智模型

```text
产品名：OpsForge（示例）

它不是直接执行任意命令的聊天机器人。
它是一个以 Pi 为控制面内核的安全运维执行平台。

工作流：
1. 用户提出自然语言任务
2. Planner 生成结构化 Plan
3. Policy Engine 做风险审查
4. 审批通过后生成 Job
5. Executor 在目标主机执行
6. Verifier 做安装后验证
7. Audit 记录全过程
8. 失败时给出回滚或自动回滚
```

---

# 十九、推荐命名

我给你三个方向，最后给一个我最推荐的。

## 方案 A：**OpsForge** ← 我最推荐
含义是“锻造运维能力的平台”，有“工程化、坚固、可打造规则与工具链”的感觉。它不像纯 AI 名字那么虚，更像一个真能进生产的系统名，适合你的产品气质。

### 对应命名建议
- 仓库：`opsforge`
- npm：`@yourorg/opsforge`
- 命令：`ops`

---

## 方案 B：**SentinelOps**
强调守护、风控、边界感，适合突出安全运维。

缺点是稍微偏安全产品，不如 OpsForge 兼容“安装、执行、回滚、自动化平台”这么全面。

---

## 方案 C：**Runsmith**
强调“打造执行任务”的能力，名字挺现代，但安全与运维属性不如 OpsForge 直观。

---

# 二十、我的最终建议

如果你要一个**能一步步落地，又能最终成长为完整产品**的方向，我建议你这么定：

### 产品名
**OpsForge**

### 技术路线
**Pi 作为控制面内核**  
**TypeScript monorepo 作为工程骨架**  
**结构化 DSL 作为执行语言**  
**Policy + Approval + Audit 作为安全闭环**

### 第一阶段只做
- `apps/cli`
- `packages/core`
- `packages/dsl`
- `packages/planner`
- `packages/policy`
- `packages/verifier`
- `packages/executor-linux`
- `packages/pi-runtime`
- `packages/audit`
- `packages/inventory`
- `packages/secrets`

这样你 2~4 周内就能做出第一版可用内测产品。

---

## 参考界面/形态
你如果想对齐主流终端 agent 的产品形态，可以参考这些公开界面与入口方式：
- [Codex CLI 文档](https://developers.openai.com/codex/cli)
- [Codex CLI npm 包](https://www.npmjs.com/package/@openai/codex)
- [Claude Code 安装文档](https://code.claude.com/docs/en/setup)
- [Claude Code Demo GIF](https://github.com/anthropics/claude-code/blob/main/demo.gif?raw=1)
- [Pi 文档首页](https://pi.dev/docs/latest)
- [Pi Quickstart](https://pi.dev/docs/latest/quickstart)

---

如果你愿意，我下一步可以直接继续给你两份更“能开工”的内容，二选一：

### 方向 1
**把这套蓝图继续细化成 `package-by-package` 的接口定义**
我会直接写出每个包的 `index.ts`、核心 interface、service class、依赖边界。

### 方向 2
**直接给你第一版脚手架**
我会按 `pnpm workspace` 形式，把 `apps/cli + packages/core + dsl + executor-linux + policy + pi-runtime` 的初始文件树和样板代码直接写出来。

如果你要效率最高，我建议下一步走 **方向 2**。
