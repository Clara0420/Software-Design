# SVG CLI Editor — Phase 1

## 当前阶段与运行方式

权威需求见 [phase_cli_1.md](../requirements/phase_cli_1.md)，开发约束见 [AGENTS.md](../AGENTS.md)。本轮只建立工程基础设施与初步架构，不实现 SVG 编辑业务。下文的类与接口均为设计计划，除 main.ts 外尚未生成实现。

使用 Node.js 24.x 和 npm。首次安装执行 `npm ci`（依赖锁定后）；开发命令：

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 严格检查生产源码并输出到 dist/ |
| `npm run typecheck` | 检查源码、测试和 Vitest 配置，不输出文件 |
| `npm test` | 自动先类型检查、构建，再执行 Vitest 测试 |
| `npm run test:watch` | Vitest 监听模式；当前入口测试读取构建产物，修改入口后需先重新 build |
| `npm run cli` | 自动构建后运行最小入口，显示工程状态后退出 |

采用原生 ESM 与 NodeNext 模块解析，相对模块导入使用运行时的 .js 扩展名。启用 strict、索引访问检查、精确可选属性、显式 override 和未使用代码检查。基础配置检查测试，独立构建配置只输出 src，避免把测试发布到 dist。仅引入 TypeScript、Node 类型声明和 Vitest 作为开发依赖，无业务运行时依赖。

## 架构方案

### 模块职责与计划类

| 模块 | 职责 | 后续计划的类或接口 |
| --- | --- | --- |
| presentation/cli | 交互循环、参数解析、命令分发、输出 | REPL、CommandParser、CommandDispatcher |
| presentation/formatters | 将只读模型信息格式化为文本 | TreeFormatter、ShapeFormatter |
| application | 会话入口与操作协调、撤销重做 | EditorSession、CommandHistory |
| application/commands | 一次编辑操作与恢复信息 | EditCommand、各具体编辑命令 |
| application/ports | 声明应用需要的外部能力 | DocumentRepository |
| domain | 唯一当前文档树、ID 与结构约束、图形工厂 | SvgDocument、ShapeFactory |
| domain/shapes | 图形行为、几何数据封装及容器递归 | Shape、Rectangle、Circle、Ellipse、Line、TextShape、Group |
| infrastructure | SVG XML 解析、序列化、文件读写 | SvgReader、SvgWriter、SvgRepository |
| main.ts | 创建具体对象、注入依赖、启动应用 | 本轮仅为可运行入口 |

采用 SvgDocument 避免与 DOM Document 混淆，采用 EditCommand 明确可撤销编辑接口。EditorSession 作为应用入口并封装会话状态，暂不引入仅做转发的 EditorService。DocumentRepository 是应用层接口，SvgRepository 是基础设施实现。

```text
src/
  presentation/
    cli/
    formatters/
  application/
    commands/
    ports/
  domain/
    shapes/
  infrastructure/
  main.ts
tests/
  unit/
    domain/
    application/
    presentation/
  integration/
  fixtures/
examples/
doc/
  README.md
```

空目录使用 .gitkeep 保留，不创建占位业务类。tests/unit 按职责组织单元测试，integration 验证跨模块或进程行为，fixtures 存测试输入，examples 存后续可回放示例。

### 依赖方向（PlantUML 包图）

箭头表示源代码依赖，非用户操作的执行顺序。

```plantuml
@startuml
package "Presentation" as P
package "Application" as A {
  interface DocumentRepository as Repository
}
package "Domain" as D
package "Infrastructure" as I {
  class SvgRepository
}
component "main.ts" as Main
P --> A : 调用会话入口
P --> D : 只读格式化
A --> D : 操作模型
I --> D : 构建与读取模型
SvgRepository ..|> Repository : 实现存储接口
Main --> P
Main --> A
Main --> I
Main --> D
@enduml
```

1. Domain 不依赖其他层，不读取文件或输出终端，保证图形规则可独立测试。
2. Application 依赖 Domain；外部能力通过本层 ports 接口获得，不导入 Infrastructure 具体实现。
3. Presentation 依赖 Application；格式化可读取 Domain，只能由应用入口发起变更，不直接调用基础设施。
4. Infrastructure 依赖 Domain 与 Application 的 ports，不依赖 Presentation，不管理命令历史。
5. main.ts 是组装入口，可以依赖各层，但不承载编辑算法。
6. 跨层导入按这些规则 review；目前不引入额外依赖分析工具。违反规则的依赖必须记录和修正，不能因目录分层而宣称已解耦。

### Command 设计意图

将一次编辑封装成 EditCommand，保存撤销所需旧值、父节点和位置等信息。CommandHistory 统一管理 execute/undo/redo 顺序；EditorSession 协调当前文档、文件路径与历史。命令组织操作，几何计算仍由图形负责。

最终目标是一条编辑命令一个撤销单元，失败不影响模型或历史，undo 后的新编辑清空 redo。显示操作不入栈；成功的 init/read/save/canvas 修改按需求禁止 undo/redo，直到下一次编辑。具体恢复机制与屏障行为将在命令阶段验证，不在本轮生成接口或栈实现。

### Composite 设计意图与单树约束

Shape 定义图形统一行为，叶子图形实现自身几何变化，Group 持有有序子节点并递归执行容器操作。SvgDocument 维护全局 ID 和树结构约束，避免每条命令分别维护节点归属规则。属性操作遵守需求白名单，不将未来 box 的属性传播规则套到普通 g。

一个会话仅有一棵当前文档树；显示与保存读取同一份模型。ID 索引只引用节点，历史记录不是另一棵长期同步的当前树。Lab1 实现必要的容器语义，不提前实现 Lab2 插件、适配器或装饰器框架。

### 分派位置与待重构点

按名字分派集中在 CommandDispatcher（命令名到处理入口）与 ShapeFactory（类型名到具体图形）两处，并标记为后续待重构点。增加类型时不得在 Reader、Writer、Formatter 中重复 switch(type/tag)。这些模块如何消费多态接口将在对应阶段设计，不预先添加额外模式。

### 初步变化点假设

| 可能变化 | 当前准备或不准备的理由 |
| --- | --- |
| 新编辑命令 | 命令与历史管理分离，后续增加命令不应改变历史栈机制 |
| 新图形类型 | 统一图形行为与集中工厂；暂不实现插件注册和加载 |
| 交互形式与显示格式 | CLI 与格式化分开，应用入口不解析原始文本；本阶段无 GUI |
| 文件格式与存储方式 | 通过 DocumentRepository 隔离存储，但不宣称模型支持任意格式 |
| 撤销性能与记录策略 | 恢复数据归命令，先按具体用例验证，不提前构建快照框架 |
| 大文档与多文档 | 当前只有一棵文档树，不增加缓存同步或多文档管理 |

## 需求歧义待澄清

以下事项仅记录，不在本轮决定或实现：

- 跨父容器 group 时，新容器插入位置，以及“保持相对顺序”采用文档遍历顺序还是参数顺序。
- 外部 SVG 的 transform、非内置标签和非白名单属性应支持、保留还是拒绝。
- 未初始化时 help 是否属于“其他命令”的限制范围。
- 首次 save 指定路径后，无参数 save 是否复用该路径，以及 I/O 屏障解除后旧历史的可达范围。
- 示例中保存的元素计数是否包含 g：部分示例数字与包含容器的节点总数不一致。

进入相关阶段前应结合需求和用户意见确认，不凭示例推导额外功能。

## 与 AI 协作的过程记录

- 用户要求分阶段开发，并强调 Lab1 的 Command、分层与 review，以及当前仅一棵树。方案保留必要 Composite 语义，不提前实现后续插件框架。
- 讨论比较了 cli 平铺与 presentation/cli、formatters 分组，最终选后者；确认 SvgDocument、EditCommand 命名与 EditorSession 应用入口，暂不增加 EditorService。
- 本轮仅初始化工具链、目录和架构文档。工程验证采用真实 Node 子进程启动编译产物，检查 ESM 构建结果能运行并正常退出，不伪造 SVG 业务测试。

## 一致性自查

- 模块目录已按方案建立；尚无业务类，不能据此声称最终实现符合全部架构。
- 当前 main.ts 仅打印工程状态，无跨业务层依赖；后续每阶段抽样检查 import、模型修改入口和文件系统调用位置。
- 未执行 Git Commit、Push、Tag，由用户检查后手动完成。

## 功能完整性与质量保证

当前仅验证工程可构建、配置与测试可类型检查、入口可在 Node 中启动。测试结果以实际运行记录为准；此阶段测试不代表 SVG 功能验收。

后续按阶段补充领域测试、命令执行与恢复测试、CLI 错误测试、SVG 往返测试，以及需求典型会话回放。重点验证失败不改变状态、ID 唯一、树结构顺序、容器递归和 I/O 后历史限制。

尚未实现：REPL、init/create/tree/show/help、六种图形、move/set/scale、group/ungroup/addto、delete/front/back、undo/redo、read/save/canvas，以及相应错误行为。box、插件与 GUI 不在 Phase 1 范围内。

### 本轮验证记录（2026-10-25）

- 环境：Node.js 24.14.1、npm 11.11.0；开发依赖精确锁定为 TypeScript 7.0.2、Vitest 5.0.5、@types/node 24.19.2，完整解析结果见 package-lock.json。
- `npm run build`：通过。
- `npm test`：通过，包含全工程类型检查、构建及 1 个进程启动集成测试（1/1）。
- `npm run cli`：通过，打印工程初始化提示后正常退出；没有进入 REPL 或执行编辑命令。
- 环境待办：`git status` 返回 `this operation must be run in a work tree`，尚需排查已有仓库配置。本轮未修改 Git 配置，也未执行 Commit、Push、Tag。
