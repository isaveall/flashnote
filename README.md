# FlashNote

一个极简的自托管笔记应用，零依赖，纯 Node.js 实现。笔记以 Markdown 文件形式存储在本地，无需数据库。

## 功能

- 创建、编辑、删除、重命名笔记
- 实时搜索
- 输入时自动保存（800ms 防抖）
- 暗色侧边栏 + 浅色编辑区双栏布局
- 键盘快捷键：`Ctrl+N` 新建，`Ctrl+S` 手动保存
- 支持中文笔记标题

## 快速开始

```bash
# 安装依赖（仅部署脚本需要）
npm install

# 启动服务
npm start
```

浏览器打开 `http://localhost:3000`。

环境变量 `PORT` 可指定端口，默认 3000。

## 目录结构

```
├── server.js          # HTTP 服务端 + REST API
├── public/
│   ├── index.html     # 前端页面
│   ├── app.js         # 前端逻辑（自动保存、搜索、快捷键）
│   └── style.css      # 样式
├── notes/             # 笔记存储目录（.md 文件）
├── deploy.js          # SSH 远程部署脚本
├── upload.js          # SFTP 上传脚本
└── package.json
```

## API

| 方法     | 路径              | 说明             |
| -------- | ----------------- | ---------------- |
| `GET`    | `/api/notes`      | 获取笔记列表     |
| `GET`    | `/api/notes/:id`  | 获取单篇笔记     |
| `POST`   | `/api/notes`      | 新建笔记         |
| `PUT`    | `/api/notes/:id`  | 更新笔记内容     |
| `PATCH`  | `/api/notes/:id`  | 重命名笔记       |
| `DELETE` | `/api/notes/:id`  | 删除笔记         |

## 技术栈

- **后端**：Node.js 内置 `http`、`fs`、`path` 模块，无第三方框架
- **前端**：原生 HTML/CSS/JS，无构建工具，无框架
- **存储**：文件系统，每篇笔记一个 `.md` 文件
