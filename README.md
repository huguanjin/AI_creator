# Sora & VEO & Grok 视频生成器 + Gemini 图片创作

AI 创作平台 - 支持 OpenAI Sora、Google VEO、Grok 视频生成，以及 Gemini 图片创作

## 项目介绍

本项目是一个基于多个 AI 模型的创作平台，支持 **OpenAI Sora**、**Google VEO**、**Grok** 视频生成及 **Gemini** 图片创作。采用前后端分离架构，内置用户认证与多用户管理系统：

- **后端服务** (`service-nest/`): 基于 NestJS + MongoDB 构建的 API 服务
- **前端应用** (`web-video/`): 基于 Vue 3 + Vite 构建的 Web 界面

## 支持功能

### 🎬 AI 创作
- [x] **Sora 视频生成** - 支持文生视频、图生视频（sora-2 模型）
- [x] **VEO 视频生成** - 支持 Google VEO 3.1 模型，支持参考图上传
- [x] **Grok 视频生成** - 支持 Grok 视频生成（grok-video-3 模型），支持参考图上传
- [x] **Gemini 图片创作** - 支持 gemini-3-pro-image-preview 模型
- [x] **多模型支持** - 支持 sora-2、veo_3_1-fast、grok-video-3、gemini-3-pro-image-preview 等多种模型
- [x] **角色管理** - Sora 角色创建与管理
- [x] **自定义参数** - 支持自定义视频时长、分辨率、宽高比、图片清晰度等参数
- [x] **多格式下载** - 图片支持 JPG/PNG 多格式下载

### 👤 用户系统
- [x] **用户注册与登录** - 基于 JWT 的用户认证系统
- [x] **邮箱验证码登录** - 支持邮箱验证码登录，新邮箱自动注册
- [x] **角色权限控制** - 管理员 / 普通用户角色区分
- [x] **密码管理** - 支持用户修改密码，管理员可通过脚本重置密码
- [x] **Token 自动刷新** - JWT Token 过期自动检测与清理

### 📋 任务管理
- [x] **任务记录与追踪** - 所有视频/图片生成任务自动入库，支持状态追踪
- [x] **实时进度查询** - 视频/图片生成进度实时查询
- [x] **任务历史** - 按平台、状态筛选任务，支持分页查询
- [x] **任务清理** - 支持删除单个任务或批量清除已完成任务

### 🔧 系统管理
- [x] **在线配置** - 支持前端可视化配置管理，修改后实时生效无需重启
- [x] **用户级 API 配置** - 每个用户可独立配置 API 密钥，支持一键同步到所有服务
- [x] **使用教程** - 管理员可配置教程链接，导航栏自动显示「使用教程」菜单，用户点击即可跳转
- [x] **管理员面板** - 用户管理、任务统计、平台概览
- [x] **文件存储** - 图片按用户文件夹隔离存储，支持静态文件访问
- [x] **MongoDB 持久化** - 用户数据、任务记录、配置信息持久化存储

## 项目结构

```
├── service-nest/              # 后端服务 (NestJS)
│   ├── src/
│   │   ├── auth/              # 🔐 用户认证模块 (登录/注册/JWT)
│   │   ├── admin/             # 👑 管理员模块 (用户管理/统计)
│   │   ├── config/            # ⚙️ 全局配置管理模块
│   │   ├── user-config/       # 👤 用户级 API 配置模块
│   │   ├── database/          # 🗄️ MongoDB 数据库模块
│   │   ├── video-tasks/       # 📋 视频任务记录模块
│   │   ├── file-storage/      # 📁 文件存储模块
│   │   ├── sora/              # 🎬 Sora 视频生成模块
│   │   ├── veo/               # 🎥 VEO 视频生成模块
│   │   ├── grok-video/        # 🤖 Grok 视频生成模块
│   │   ├── gemini-image/      # 🖼️ Gemini 图片生成模块
│   │   ├── email/             # 📧 邮件服务模块 (验证码发送)
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── scripts/
│   │   └── reset-password.js  # 🔑 管理员密码重置工具
│   ├── mongo_config.yaml      # MongoDB 连接配置 (需自行创建)
│   ├── mongo_config.template.yaml  # MongoDB 配置模板
│   └── package.json
│
├── web-video/                 # 前端应用 (Vue 3)
│   ├── src/
│   │   ├── api/               # API 接口封装
│   │   ├── views/
│   │   │   ├── LoginView.vue      # 登录页
│   │   │   ├── HomeView.vue       # 视频生成主页
│   │   │   ├── ImageView.vue      # 图片创作页
│   │   │   ├── TasksView.vue      # 任务管理页
│   │   │   ├── QueryView.vue      # 任务查询页
│   │   │   ├── CharactersView.vue # 角色管理页
│   │   │   ├── ConfigView.vue     # 配置管理页
│   │   │   └── AdminView.vue      # 管理员面板
│   │   ├── stores/            # Pinia 状态管理
│   │   └── router/            # 路由配置 (含权限守卫)
│   └── package.json
│
├── .github/workflows/         # 🔄 GitHub Actions (CI/CD 自动构建 Docker 镜像)
├── docker-compose.yml         # 🐳 Docker 本地构建部署
├── docker-compose.production.yml  # 🐳 Docker 镜像拉取部署
├── DEPLOY.md                  # 🚀 Linux 服务器部署文档
└── README.md
```

## 配置说明

### 前置条件

- **MongoDB** - 项目使用 MongoDB 存储用户数据、任务记录和配置信息，部署前需安装 MongoDB

### MongoDB 配置 (service-nest/mongo_config.yaml)

```bash
cd service-nest
cp mongo_config.template.yaml mongo_config.yaml
```

支持本地 MongoDB 或 MongoDB Atlas 云端连接，编辑 `mongo_config.yaml` 填入连接信息。

### API 配置（在线管理）

API 配置存储在 MongoDB 中，**通过前端配置页面 `/config` 在线管理**，修改后实时生效无需重启服务。

| 配置项 | 说明 |
| --- | --- |
| `sora.server` / `sora.key` | Sora API 服务地址和密钥 |
| `sora.characterServer` / `sora.characterKey` | Sora 角色 API 地址和密钥 (可选) |
| `veo.server` / `veo.key` | VEO API 服务地址和密钥 |
| `geminiImage.server` / `geminiImage.key` | Gemini 图片 API 地址和密钥 |
| `grok.server` / `grok.key` | Grok 视频 API 地址和密钥 |
| `grokImage.server` / `grokImage.key` | Grok 图片 API 地址和密钥 |

> 每个用户也可在个人配置页设置独立的 API 密钥。

## 快速开始

### 1. 安装 MongoDB

参考 [DEPLOY.md](DEPLOY.md) 中的 MongoDB 安装章节，或使用 MongoDB Atlas 云服务。

### 2. 安装依赖

```bash
# 后端
cd service-nest
pnpm install

# 前端
cd web-video
npm install
```

### 3. 配置

```bash
cd service-nest

# 配置 MongoDB 连接
cp mongo_config.template.yaml mongo_config.yaml
# 编辑 mongo_config.yaml 填入 MongoDB 连接信息
```

> **API 密钥配置**：启动服务后，通过前端 `/config` 页面在线配置各服务的 API 地址和密钥。

### 4. 启动服务

```bash
# 启动后端 (开发模式)
cd service-nest
pnpm start:dev

# 启动前端 (开发模式)
cd web-video
npm run dev
```

### 5. 访问应用

| 地址 | 说明 |
| --- | --- |
| http://localhost:5173 | 前端应用 |
| http://localhost:5173/config | 配置管理 |
| http://localhost:5173/admin | 管理员面板 |
| http://localhost:3003 | 后端 API |

> **首次启动**时系统会自动创建管理员账号，凭据保存在 `service-nest/initial_admin_credentials.txt` 文件中，**请登录后立即修改密码**。

### 6. 邮箱验证码登录

登录页支持三种方式：**账号密码登录**、**邮箱验证码登录**、**注册**。

邮箱登录流程：输入邮箱 → 获取验证码 → 输入6位验证码 → 登录（新邮箱自动注册）。

### 7. 管理员密码重置

如果管理员忘记密码，可使用密码重置脚本：

```bash
cd service-nest

# 方式一：生成加密密码，手动更新数据库
node scripts/reset-password.js myNewPass123

# 方式二：自动生成随机密码并直接更新数据库
node scripts/reset-password.js --update admin

# 方式三：指定密码并直接更新数据库中指定用户
node scripts/reset-password.js myNewPass123 --update admin
```

> 密码加密算法：scrypt（Node.js crypto 内置），存储格式为 `salt:hash`。

## API 接口

### 用户认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/auth/login` | 用户名密码登录 |
| POST | `/v1/auth/register` | 用户注册 |
| POST | `/v1/auth/email/send-code` | 发送邮箱验证码 |
| POST | `/v1/auth/email/login` | 邮箱验证码登录（新邮箱自动注册） |
| GET | `/v1/auth/profile` | 获取用户信息 🔒 |
| PUT | `/v1/auth/password` | 修改密码 🔒 |
| GET | `/v1/auth/verify` | 验证 Token 有效性 🔒 |

### Sora 视频生成

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/video/create` | 创建 Sora 视频任务 🔒 |
| GET | `/v1/video/query?id=xxx` | 查询任务状态 🔒 |

### VEO 视频生成

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/veo/create` | 创建 VEO 视频任务 (支持参考图上传) 🔒 |
| GET | `/v1/veo/query?id=xxx` | 查询任务状态 🔒 |

### Grok 视频生成

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/grok/create` | 创建 Grok 视频任务 (支持参考图上传) 🔒 |
| GET | `/v1/grok/query?id=xxx` | 查询任务状态 🔒 |

### Gemini 图片生成

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/image/create` | 创建图片生成任务 🔒 |
| GET | `/v1/image/query?id=xxx` | 查询图片任务 🔒 |

### 任务管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/tasks` | 获取当前用户任务列表 🔒 |
| DELETE | `/v1/tasks/:id` | 删除指定任务 🔒 |
| DELETE | `/v1/tasks/completed/clear` | 清除所有已完成任务 🔒 |

### 用户配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/user-config` | 获取用户配置 (脱敏) 🔒 |
| GET | `/v1/user-config/full` | 获取用户完整配置 🔒 |
| PUT | `/v1/user-config/sync-default` | 一键同步默认配置 🔒 |
| PUT | `/v1/user-config/:service` | 更新指定服务配置 🔒 |

### 全局配置管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/config` | 获取全局配置 (脱敏) |
| PUT | `/v1/config/:service` | 更新指定服务配置 |

### 管理员接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/admin/users` | 获取用户列表 🔒👑 |
| GET | `/v1/admin/users/:userId` | 获取用户详情 🔒👑 |
| GET | `/v1/admin/users/:userId/video-tasks` | 查看用户视频任务 🔒👑 |
| GET | `/v1/admin/users/:userId/image-tasks` | 查看用户图片任务 🔒👑 |
| GET | `/v1/admin/stats` | 平台统计概览 🔒👑 |

> 🔒 = 需要 JWT 认证 | 👑 = 需要管理员权限

## 技术栈

### 后端
- NestJS 10
- TypeScript 5
- MongoDB 7 (mongodb driver)
- Passport + JWT 认证
- Axios
- class-validator / class-transformer

### 前端
- Vue 3.4
- Vite 5
- Pinia (状态管理)
- Vue Router 4 (含路由守卫)
- TypeScript 5
- Axios

## 开发说明

### 构建生产版本

```bash
# 构建后端
cd service-nest
pnpm build

# 构建前端
cd web-video
npm run build
```

### 生产环境运行

```bash
# 运行后端
cd service-nest
pnpm start:prod
```

## 部署

### CI/CD 自动构建 + 镜像拉取（推荐）

项目已配置 GitHub Actions，**每次推送代码到 master 自动构建 Docker 镜像**并推送到 GitHub Container Registry。服务器上无需克隆代码，只需两条命令即可更新：

```bash
# 服务器上拉取最新镜像并重启
docker compose pull
docker compose up -d
```

### 其他部署方式

详见 [DEPLOY.md](DEPLOY.md)，包含三种部署方式的完整指南：

- **CI/CD 镜像拉取部署（推荐）** — 推送代码自动构建镜像，服务器直接拉取
- **Docker 本地构建部署** — 在服务器上克隆代码并构建
- **手动部署** — Node.js + MongoDB + Nginx + PM2
- MongoDB 安全配置 / SSL 证书 / 防火墙 / 故障排查

## License

MIT
如果我的开源项目对你有帮助，请考虑通过以下任意一种方式赞助: 
<br> `付款备注上您的联系方式`
<div style="display: flex; flex-wrap: wrap">
    <div style="width:200px">
        <img src="./docs/wxpay.jpg"  style="width:200px">
        <div>微信捐助</div>
    </div>
    <div style="width:200px">
        <img src="./docs/alipay.jpg"  style="width:200px"> 
        <div>支付宝捐助</div>
    </div>
</div>

## 项目交流群

<div style="width:200px">
    <img src="https://github.com/user-attachments/assets/94ebe40e-fde0-48c6-9ea6-afde7a677456" style="width:200px">
</div>