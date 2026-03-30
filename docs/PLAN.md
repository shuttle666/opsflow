# OpsFlow 更新版 Phase 3-8 实施计划

## Summary
- 现在项目已经完成了底座部分：多租户数据层、Auth、Tenant Context、RBAC、站内邀请箱、前端基础认证流。
- 后续不应该继续以“基础设施优先”为主，而应该进入“业务闭环优先”阶段。
- 新阶段的目标是逐步做出一个真正可演示的 SaaS 业务链路：`认证 -> 客户 -> 工单 -> 分配 -> 工作流 -> 附件 -> 仪表盘与工程增强`。
- 从现在开始，每个阶段都必须同时交付：`后端接口 + 前端页面 + 测试 + 文档同步`，不再做纯后端阶段。

## Implementation Changes

### Phase 3 — Customer 模块完整落地
目标：做出第一个真正完整的业务模块。

- 后端：
  - 新增 `GET /api/customers`、`POST /api/customers`、`GET /api/customers/:customerId`、`PATCH /api/customers/:customerId`
  - tenant 范围来自当前登录 token 中的 tenant context，不从请求体传 `tenantId`
  - 支持搜索：`name/phone/email`
  - 支持分页与排序：`page/pageSize/sort`
  - 权限规则：
    - `OWNER/MANAGER` 可创建、编辑
    - `STAFF` 只读
- 前端：
  - 新增客户列表页
  - 新增创建客户表单
  - 新增客户详情页
  - 新增编辑客户页
  - 补齐空状态、加载状态、错误提示、搜索与筛选 UI
- 类型/接口：
  - 新增 `CustomerListItem`、`CustomerDetail`、`CreateCustomerRequest`、`UpdateCustomerRequest`
  - 新增分页返回 `meta`
- 验收结果：
  - 登录后的用户可以完整创建客户并在 UI 中查看、编辑
  - 不允许跨租户读取或修改客户

### Phase 4 — Job 模块完整落地
目标：做出平台核心业务对象“工单”。

- 后端：
  - 新增 `GET /api/jobs`、`POST /api/jobs`、`GET /api/jobs/:jobId`、`PATCH /api/jobs/:jobId`
  - 创建 job 时字段包含：`customerId/title/description/scheduledAt?`
  - `status` 初始默认 `NEW`
  - 状态流转不放进通用 update，保持单独接口处理
  - 支持筛选：`status/customerId/scheduledFrom/scheduledTo/page/pageSize`
  - 权限规则：
    - `OWNER/MANAGER` 可创建、编辑
    - `STAFF` 只读
- 前端：
  - 新增工单列表页
  - 新增创建工单表单
  - 新增工单详情页
  - 新增编辑工单页
  - 支持从客户详情进入创建工单
  - 在工单详情中展示客户摘要、预约时间、指派位占位信息
- 类型/接口：
  - 新增 `JobListItem`、`JobDetail`、`CreateJobRequest`、`UpdateJobRequest`
- 验收结果：
  - 可以演示完整链路：`注册/登录 -> 创建客户 -> 创建工单 -> 查看工单详情`

### Phase 5 — 团队管理 + Assignment + Staff Workspace
目标：让 RBAC 真正落在业务场景里。

- 后端：
  - 新增成员管理接口：`GET /api/memberships`、`PATCH /api/memberships/:membershipId`
  - 新增工单分配接口：`POST /api/jobs/:jobId/assign`、`POST /api/jobs/:jobId/unassign`
  - 新增 staff 视角接口：`GET /api/jobs/my`
  - `PATCH membership` 支持更新 role/status，但仅限当前 tenant
  - 权限规则：
    - `OWNER` 可管理成员角色与状态
    - `MANAGER` 可分配工单，但不能创建/提升新的 OWNER
    - `STAFF` 无成员管理权限
- 前端：
  - 新增团队成员页，展示成员列表、角色、状态
  - 支持禁用/恢复成员、调整角色
  - 在工单详情页加入分配 staff 的能力
  - 新增 staff workspace 页面，只看“分配给我”的工单
- 类型/接口：
  - 新增 `MembershipListItem`、`UpdateMembershipRequest`、`AssignJobRequest`
- 验收结果：
  - Owner/Manager 可以邀请、管理成员、分配工单
  - Staff 登录后只看到自己的工单

### Phase 6 — Workflow UI + Timeline + Activity Feed
目标：把 Phase 1 已经做好的状态机和审计能力真正展示出来。

- 后端：
  - 新增 `POST /api/jobs/:jobId/status-transitions`
  - 新增 `GET /api/jobs/:jobId/history`
  - 新增 `GET /api/activity`
  - 复用已有 `transitionJobStatus` 领域服务
  - Controller 层只负责鉴权、校验、响应，不重写状态流逻辑
  - 必须严格遵守当前已实现的状态迁移规则
- 前端：
  - 在工单详情页加入状态时间线
  - 只显示合法的下一步状态按钮
  - 对 `CANCELLED` 提供 reason 输入
  - 对 `COMPLETED` 提供完成说明输入
  - 在 Dashboard 或独立页面展示 activity feed / 审计日志
- 类型/接口：
  - 新增 `JobStatusTransitionRequest`、`JobHistoryItem`、`ActivityFeedItem`
- 验收结果：
  - Manager 可以推动工单完成整个生命周期
  - 每一步状态变更都能在时间线上看到

### Phase 7 — Job Evidence / Documents
目标：让工单不仅有结构化状态，还能保留现场证明材料与完成文档。

- 后端：
  - 新增 `JobEvidence` 模型，字段包含：
    - `tenantId`
    - `jobId`
    - `uploadedById`
    - `kind`
    - `fileName`
    - `mimeType`
    - `sizeBytes`
    - `storageKey`
    - `note`
    - `createdAt`
  - 新增 migration
  - 新增接口：
    - `POST /api/jobs/:jobId/evidence`
    - `GET /api/jobs/:jobId/evidence`
    - `GET /api/jobs/:jobId/evidence/:evidenceId/download`
    - `DELETE /api/jobs/:jobId/evidence/:evidenceId`
  - 使用 `multipart/form-data`
  - dev 环境默认本地磁盘存储，但必须抽象成 storage layer，方便以后切到 S3
  - 权限规则：
    - `OWNER/MANAGER` 可管理任意当前 tenant 工单的 evidence
    - `STAFF` 只能管理分配给自己的工单 evidence
- 前端：
  - 在工单详情页加入 `Job Evidence` 区块
  - 展示 evidence 列表
  - 支持上传、下载、删除
  - 前端先做文件大小/类型校验
- 类型/接口：
  - 新增 `JobEvidenceKind`
  - 新增 `JobEvidenceItem`
  - 返回中包含受控下载路径字段
- 验收结果：
  - Staff 可以上传现场图片、完成证明或问题证据
  - Manager 可以在工单详情中查看并下载这些证据材料

### Phase 8 — Dashboard Metrics + 工程化完善
目标：把项目从“功能 demo”升级成“成熟作品集项目”。

- 后端：
  - 新增 `GET /api/dashboard/summary`
  - 返回指标：
    - customer 总数
    - job 按状态分组统计
    - pending invitations 数量
    - active staff 数量
    - recent jobs / recent activity
  - 增加 rate limiting
  - 增加 request id
  - 增加结构化日志
  - 增加统一生产级错误映射
  - 加 CI：至少覆盖 `typecheck + test + lint`
- 前端：
  - 用真实数据替换现在 Dashboard 占位卡片
  - 按角色展示不同模块：owner/manager vs staff
  - 优化导航、空状态、成功/失败反馈、整体一致性
- 文档与运维：
  - 更新 `roadmap.md`、`api-design.md`、`erd.md`、`openapi.yaml`、README
  - 新增部署说明：迁移、seed、生产启动流程
- 验收结果：
  - 项目达到“可完整演示、可持续开发、可展示工程能力”的状态

## Public APIs / Types
- 继续保持现有统一响应结构：`success/message/data/meta`
- 新业务接口默认不在请求体中传 `tenantId`，tenant scope 由当前会话决定
- `customers/jobs/memberships/activity` 的列表接口统一做分页返回
- 新增持久化模型只有一个强制项：
  - Phase 7 的 `JobEvidence`
- Phase 8 默认只新增 dashboard summary DTO，不强制新增数据库表

## Test Plan
- Phase 3：
  - customer 创建、列表、详情、编辑成功路径
  - 搜索、分页、校验错误
  - `STAFF` 被禁止 create/update
  - 跨租户客户访问被拒绝
- Phase 4：
  - job 创建、列表、详情、编辑成功路径
  - job 必须属于当前 tenant
  - job 引用 customer 时必须保证同 tenant
  - 通用 update 不能绕过状态机直接修改 status
- Phase 5：
  - 成员角色/状态管理权限矩阵
  - assign/unassign 成功与拒绝场景
  - `GET /api/jobs/my` 只返回当前用户被分配的工单
- Phase 6：
  - 合法状态流转成功，非法流转失败
  - history 与 audit 正确写入
  - activity feed 只返回当前 tenant 数据
- Phase 7：
  - evidence 上传校验
  - evidence 列表、下载与删除权限
  - `STAFF` 不能给未分配给自己的 job 上传 evidence
  - 存储元数据持久化正确
- Phase 8：
  - Dashboard 指标准确性
  - rate limit 行为
  - CI 能稳定运行 server/client 的 typecheck、test、lint
- 每个阶段都要包含：
  - server：unit + integration + Supertest API 测试
  - client：Vitest + RTL 的关键路径 smoke tests

## Assumptions
- 当前 Auth、Tenant Context、Refresh、RBAC、站内邀请箱实现保持不变，后续阶段直接复用
- Phase 3-8 只聚焦内部业务系统，不包含 customer portal
- 这几个阶段默认不为 `Customer` 和 `Job` 加软删除；如未来需要，可单独开 phase
- AI 功能不放进 Phase 3-8 主线，等核心业务链路做完后，再作为展示增强单独规划
- 从现在开始，每个阶段完成后必须立即同步文档，而不是最后集中补
