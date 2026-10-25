# SVG CLI Editor — Phase 1

## 当前阶段与运行方式

权威需求见 [phase_cli_1.md](../requirements/phase_cli_1.md)，开发约束见 [AGENTS.md](../AGENTS.md)。当前已实现最小 Domain 模型及 `init → create rect → tree` CLI 功能链。本文原始架构方案与早期记录保留为历史背景；当前实现范围、命名调整及验证结果见文末最新记录。

使用 Node.js 24.x 和 npm。首次安装执行 `npm ci`（依赖锁定后）；开发命令：

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 严格检查生产源码并输出到 dist/ |
| `npm run typecheck` | 检查源码、测试和 Vitest 配置，不输出文件 |
| `npm test` | 自动先类型检查、构建，再执行 Vitest 测试 |
| `npm run test:watch` | Vitest 监听模式；当前入口测试读取构建产物，修改入口后需先重新 build |
| `npm run cli` | 自动构建后进入 REPL；终端使用 `svg> ` 提示符，输入 EOF 结束；支持管道脚本 |

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

- 跨父容器 group 的位置与排序已于分组实现轮由用户确认：按原文档深度优先顺序排列，新组放在最近公共父容器的首个选中分支位置，详见文末记录。
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

### CLI 最小功能链记录（2026-10-25）

本轮实现 `init [w] [h]`、`create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]`、`tree [id]`。REPL 支持逐行处理、空行、整行注释、双引号参数、错误后继续执行及 EOF 退出。交互终端显示 `svg> `，管道输入不输出提示符。`init 500` 按两个独立可选参数解释为 500×600；矩形允许零尺寸，画布尺寸必须为有限正数。颜色保存为原字符串，未提供 fill 时不补写默认值。

- Presentation：`cli/REPL` 管理输入输出，`CommandParser` 负责分词与完整数值校验，`CommandDispatcher` 集中分派三个命令；`formatters/TreeFormatter` 读取模型输出树。
- Application：`EditorSession` 持有唯一当前 Document；`commands/Command` 定义 execute/undo，`CreateCommand` 保存图形和目标容器，执行添加并可撤销及再次执行。当前没有历史管理器，也没有开放 undo/redo CLI。
- Domain：沿用实际类名 Document（未引入 DOM 类型）及平铺文件结构；ShapeFactory 是唯一类型名分派位置，本轮仅支持 rect。Rectangle 增加只读可选 fill；ShapeVisitor/accept 让格式化读取 Rectangle、Group，而不复制类型名分派。新增类型时需扩展访问接口，这是当前封闭类型集合的明确取舍。
- Infrastructure：本轮没有实现；main.ts 仅组装会话、分发器和 REPL。不存在文件读写依赖。

按名字分派仍仅位于 CommandDispatcher、ShapeFactory，保留为待重构点。Presentation 不直接改模型；Application 调用 Domain；Domain 不依赖外层。Document 和 Group 继续复用 ShapeCollection 的结构约束。`in` 可定位已存在的 Group，本轮 CLI 尚不能创建 Group；对应成功路径由应用集成测试构建已有模型验证。

实际修订与检查：将旧脚手架入口测试替换为真实子进程会话回放；为避免格式化层新增类型分支，采用访问接口；创建命令只在添加成功后更新执行状态，初始化只在新文档构造成功后替换当前文档。错误路径覆盖重复 ID、非法尺寸、无文档、无容器、非容器、未知命令、未知类型和语法错误。

验证：全工程 TypeScript 检查通过，生产构建通过，Vitest 共 4 个文件、26 项测试通过（包含原有 13 项 Domain 测试及 7 项真实 CLI 进程测试）。没有实现其他编辑命令、历史管理、SVG I/O、其他图形类型或插件，也没有执行 Git Commit/Push/Tag。

### 六种内置图形 create 扩展（2026-10-25）

当前 `create` 支持 rect/circle/ellipse/line/text/g，所有类型均支持可选尾缀 `in <containerId>`。新增 Circle、Ellipse、Line、TextShape；Rectangle 和 Group 继续复用。每个具体图形封装只读几何信息并实现 Shape 的移动与访问接口，Group 对混合子图形仍递归执行移动。

ShapeFactory 集中保存每种类型的构造器与参数元数据（名称、数值/字符串、是否可选）；工厂在构造前校验缺失参数、额外参数、类型和有限数值，具体图形校验自身尺寸约束。EditorSession 向 Presentation 提供只读参数描述；CommandDispatcher 按描述统一转换参数，不复制类型名分派。CommandParser 负责词法解析并保留引号标记，Domain 不解析 CLI 字符串。TreeFormatter 通过扩展后的 ShapeVisitor 输出每种类型的信息，不使用类型名 switch。原有 CreateCommand 和文档树约束无需修改。

语法与边界：

- rect/circle/ellipse 可选 fill；line 可选 stroke；省略样式保持 undefined，不补写 SVG 默认样式。text 接受 x/y/text，g 不接受额外几何或样式参数。
- 坐标允许负数和有限浮点数；宽高和半径允许零、拒绝负值。颜色按原字符串存储，本轮不做 CSS 颜色语义校验。
- 带空格文本使用双引号；保留中文、首尾空白及空字符串。单个不含空白的文本也可以不加引号。整行以 # 开头才视为注释，参数中的 # 可用于颜色或文本。
- 只有必选参数之后、未被引号包围的 in 才作为容器子句标记；因此文本 `"in"`、`"a in b"` 和被引号包围的样式值 `"in"` 不会误判。尾缀缺少目标、多余参数和重复 in 均拒绝。
- ID 非空、大小写敏感，在整份文档内跨类型和跨层唯一。新增 g 不能复用已有父组 ID；目标必须存在且为 Group。失败不会添加节点或改变已有父子关系。

本轮修订了旧测试中“circle 尚不支持”的假设，改用 box 验证未知类型。新增元数据驱动的逐类型参数校验测试、混合 Group 移动与溢出原子性测试、逐类型根级/嵌套创建和错误状态保持测试，以及真实 CLI 的六类型嵌套树回放。没有新增依赖，没有实现 box、插件系统、其他 CLI 命令或 SVG I/O。

验证：全工程类型检查通过，生产构建通过；Vitest 5 个测试文件、49 项测试全部通过。按名字分派继续集中于 CommandDispatcher 和 ShapeFactory，仍为既有架构记录中的待重构点。未执行 Git Commit/Push/Tag。

### move 与撤销重做（2026-10-25）

当前新增 `move <id> <dx> <dy>`、`undo`、`redo`；此前六种类型的 create 均进入历史并支持撤销重做。tree 等查询不进入历史。每次成功的 create 或 move 占一个撤销单元；空 Group 或零位移的成功 move 也按一条编辑处理。

- `application/CommandHistory` 统一调度 Command.execute/undo。execute、undo、redo 均先调用命令，成功后才改变栈；失败不弹出或新增记录，也不清空 redo。undo 后下一条成功编辑清空 redo；失败编辑和查询保留 redo。
- `application/commands/MoveCommand` 保存目标图形、位移和恢复函数。几何修改继续由 Shape.move 多态完成，Group 递归到所有子孙；整组只记录一个 MoveCommand。原有预验证保证任何后代坐标溢出时全组不变。
- `Shape.savePosition` 提供不暴露可写字段的坐标快照恢复函数，各具体图形保存自己的坐标，Group 组合后代恢复函数。采用原值恢复，避免 `x + dx - dx` 的浮点精度丢失。快照仅保存在命令中，不维护第二棵当前文档树；redo 在精确恢复后重新执行相同位移。
- `CreateCommand` 继续保存原父容器和原图形实例；撤销移除该实例，重做再次挂载。当前只有追加式 create 和 move，在正常 LIFO 历史流程下同级顺序得以恢复；未提前实现重排或删除命令。
- `EditorSession` 持有私有历史对象。成功 init 清除旧文档的 undo/redo，并设置需求规定的禁用状态；之后 undo/redo 均报 `undo not allowed after io command`，直到下一条编辑成功。失败 init 保留原文档及原历史。新文档不会通过撤销重新访问旧文档。
- `Command<Result>` 的泛型返回值用于传递结构化 EditResult；Application 不生成终端反馈。Presentation 新增 EditResultFormatter，以 ShapeVisitor 格式化移动后的坐标、组位移及创建/撤销创建反馈，不增加类型名分支。

本轮实现前识别并处理了反向位移无法精确恢复浮点数的问题；测试包括 0.1 + 0.2 和大位移抹去小坐标的情况。旧 CLI 测试中“move 是未知命令”改用尚未实现的 scale。新增历史顺序、失败 execute/undo/redo 保持栈、六类 create/move 撤销重做、嵌套混合组单步撤销、溢出失败、redo 分支清理、init 禁用与旧历史隔离、根级及子级创建顺序恢复测试，以及真实 CLI 会话回放。

验证：全工程 TypeScript 检查、生产构建通过；Vitest 6 个文件、70 项测试全部通过。本轮未实现 read/save/canvas，因此没有预先决定这些操作之后旧历史的保留策略；后续实现时按需求增加相应历史限制。仍未实现其他编辑命令、SVG I/O、box 或插件。未新增依赖，未执行 Git Commit/Push/Tag。

### set / scale 与撤销重做（2026-10-25）

新增 `set <id> <attr> <value>` 和 `scale <id> <factor>`。SetCommand、ScaleCommand 通过 EditorSession 与现有 CommandHistory 执行，每次成功编辑只占一个历史单元；失败不入栈、不清空 redo，撤销后成功的新编辑清空 redo。命令只协调操作与保存恢复函数，不计算图形几何。

白名单严格按 4.1：所有图形具有 fill、stroke、stroke-width；Rectangle 额外接受 x/y/width/height，Circle 接受 cx/cy/r，Ellipse 接受 cx/cy/rx/ry，Line 接受 x1/y1/x2/y2，TextShape 接受 x/y/text。Group 没有自身几何或文本属性。id、transform、font-size、别名 w/h、其他类型的几何属性等均报 `unknown attribute: <attr>`。Shape 提供公共样式绑定，各具体类自行提供几何属性绑定；CLI 从模型获取属性值类型后进行数值解析，不重复按图形类型分派。

Group set 的递归范围依据本轮用户明确要求落实：仅公共样式可设置，同时更新当前 Group 和所有子孙；Group 上的 x、r、text 等仍拒绝。需求 4.1 未明确说明普通 Group 的样式传播细节，因此这是结合本轮“Group 递归操作”的具体实现约定，不将 box 的 label 等插件属性引入普通 Group。递归 set 先验证全树再应用。撤销恢复每个节点先前的独立样式，包括原来未设置的 undefined，不把 SVG 默认样式写成显式值。

scale 的 factor 必须为有限正数，非正数报 `scale factor must be positive`；CLI 非数字仍沿用 `invalid number`。每种图形自己将全部几何属性（位置、尺寸）乘以 factor，Line 两端都缩放，TextShape 只缩放位置；fill/stroke/stroke-width 属样式，文本内容不参与缩放。Group 递归到每个后代，统一预验证后执行，避免某个坐标或尺寸溢出时留下部分状态。

Shape.saveState 返回不暴露内部字段的恢复函数；具体类保存自身几何和文本，基类保存公共样式，Group 组合后代快照。SetCommand 和 ScaleCommand 使用该快照精确撤销，不用反向设置或倒数缩放，从而保留浮点数原值、缩放下溢前的值，以及不存在的样式属性。既有 MoveCommand 的位置快照继续使用。TreeFormatter 显示所有显式公共样式，方便检查 set 结果；EditResultFormatter 处理更新、缩放及撤销反馈。Presentation → Application → Domain 的依赖保持不变，没有新增类型名分派点。

测试覆盖逐类型完整白名单、禁止属性、数值/尺寸校验、带引号和空文本、公共样式递归与独立旧值恢复、逐类型全部几何缩放、混合组一次撤销、非法 factor、溢出原子性、下溢后的精确恢复、create/move/set/scale 混合历史、redo 保留/清理，以及真实 CLI 会话与错误反馈。旧测试中“scale 尚未实现”改用 delete。

验证：全工程类型检查和生产构建通过；Vitest 7 个文件、91 项测试全部通过。没有实现其他命令、SVG I/O、box 或插件，没有新增依赖，也未执行 Git Commit/Push/Tag。

### group / ungroup / addto 与撤销重做（2026-10-25）

本轮新增三个 CLI 命令及 GroupCommand、UngroupCommand、AddToCommand，继续由 EditorSession 和 CommandHistory 调度。每条命令仅占一个 undo 单元；执行失败不改变树或历史，成功的新编辑按既有规则清空 redo。

需求中的跨父容器分组位置和排序此前未明确。本轮向用户列出选择并获得“采用建议规则”的确认：选中图形按操作前文档的深度优先遍历顺序排列，与参数顺序无关；新组放入所有选中图形的最近公共父容器，插入首个选中分支所在位置。若同级非连续节点被选中，新组占首个选中节点的位置，其余未选中同级节点保持原相对顺序。跨分支收编后，未选中的原容器保留，即使变为空容器。至少选择一个图形，不接受重复 ID；选中容器及其后代同时出现时，按需求拒绝并报告祖先容器 ID。

ungroup 仅允许非根级 Group，将其直接子节点按原顺序提升到父容器，在原 Group 的位置展开；空组可解散。根级 Group 报 `cannot ungroup top-level container: <id>`，叶子报 `not a container: <id>`。撤销恢复原 Group 实例、样式、原父容器位置和内部子节点顺序。

addto 将整个节点子树移到目标 Group 的最后；若节点已经在该 Group 下，按需求移到末尾，不重复插入。目标为自身或其后代时拒绝；允许把后代提升到祖先 Group。撤销恢复原父容器和原始索引。三种操作不改变节点几何或样式值。

实现分工：Document 的 planGroup/planUngroup/planAddTo 负责领域规则和顺序规划；TreeChange 保存所有受影响容器的前后子节点序列，保存的是原节点引用而非克隆树。ShapeCollection.replaceChildren 在提交前验证最终森林的单一父容器、ID 唯一性和无环约束，然后一起更新 children 与父容器映射。所有公开 children 仍是冻结快照。TreeChange 还检查受影响容器是否已被其他操作修改，拒绝过期计划，避免覆盖中途新增节点。应用 Command 保存 TreeChange 并调用 apply/revert；Presentation 只负责分发和结构化结果输出。

测试涵盖：同级非连续选择、逆序参数、跨容器及跨深度的 LCA/DFS 规则、单节点分组、子树身份保持、ungroup 原位展开和空组、根级限制、同父 addto 重排、向祖先提升、自身/后代循环、重复选择及 ID、错误后保留 redo、根和子节点顺序恢复、多次 undo/redo，以及 group/move/set/scale/addto/ungroup 混合历史。领域测试额外验证原子变更拒绝重复父容器、循环、ID 冲突、外文档节点和过期计划。真实 CLI 集成回放验证命令链及错误文本。

验证：全工程 TypeScript 检查、生产构建通过；Vitest 9 个文件、108 项测试全部通过。未新增依赖，未实现其他命令、SVG I/O 或 box 插件，未执行 Git Commit/Push/Tag。

### delete / front / back 与撤销重做（2026-10-25）

本轮新增 `delete <id>`、`front <id>`、`back <id>` 及 DeleteCommand、ReorderCommand，沿用 EditorSession、CommandHistory 和领域层原子 TreeChange。每条成功命令是一个 undo 单元；失败不改变树或历史，undo 后成功的新编辑继续清空 redo。

delete 从目标的直接父容器移除目标节点。删除 Group 时仅摘除子树根，保留同一批对象及其内部父子关系、顺序、几何和样式；因此整棵子树一起从 Document.findById 的可见范围消失。撤销将同一根节点插回原父容器的原索引，所有后代 ID 随树重新可查。重做再次摘除相同子树。删除后若执行新编辑，redo 按既有规则清空，不能借旧删除命令覆盖新占用的 ID。

front/back 只读取目标的直接父容器并重排该层 children：SVG 后绘制的同级元素在视觉上更靠前，因此 front 移到同级末尾，back 移到同级开头。目标的父节点、子树内部顺序、几何、样式和其他容器均不变。已在边缘和唯一子节点上的操作仍视为成功编辑并占一个 undo 单元，行为与其他成功编辑一致。

Document 新增 planDelete 和 planReorder，负责成员校验并生成 TreeChange；应用命令只保存计划并执行或回滚。TreeChange 保存受影响父容器的完整前后节点引用序列，恢复时继续经过 ShapeCollection 的 ID 唯一、单一父容器和无环校验。ID 查找仍直接遍历当前文档树，没有维护第二份可漂移的图形状态。

测试覆盖叶子和多层 Group 删除、整棵子树 ID 消失与恢复、对象身份及原父节点/原索引恢复、根级与嵌套同级重排、子树内部顺序保持、边缘及唯一节点操作、失败保留 redo、成功编辑清空 redo、命令状态保护，以及 delete/front/back 与 group/move 等命令的混合历史。真实 CLI 回放验证成功反馈、错误反馈和最终 tree 顺序。

验证：全工程 TypeScript 检查、生产构建通过；Vitest 11 个文件、123 项测试全部通过。未新增依赖，未实现 SVG I/O、box 或插件，未执行 Git Commit/Push/Tag。
