# MoneyFlow Backend

轻量云同步后端：Express + SQLite + JWT。

## 部署（宝塔）

1. 上传 `backend/` 到服务器，例如 `/www/wwwroot/moneyflow-api/`
2. 宝塔软件商店安装 **Node.js 版本管理器**（建议 Node 18+）和 **PM2 管理器**
3. 终端进入目录：
   ```bash
   cd /www/wwwroot/moneyflow-api
   npm install
   ```
4. 设置环境变量（重要！）：
   ```bash
   export JWT_SECRET="你的随机长字符串"
   export PORT=3001
   ```
   或在 PM2 启动配置里加 env。
5. PM2 启动：`pm2 start server.js --name moneyflow-api`
6. 宝塔新建站点 → 反向代理到 `http://127.0.0.1:3001`
7. 申请 SSL 证书并强制 HTTPS
8. 防火墙只开放 80/443，不要直接暴露 3001

## 接口

| Method | Path        | 说明                            |
|--------|-------------|---------------------------------|
| POST   | /register   | `{username, pin}` → `{token}`   |
| POST   | /login      | `{username, pin}` → `{token}`   |
| GET    | /me         | 验证 token                      |
| GET    | /sync       | 拉取云端数据                    |
| POST   | /sync       | `{payload, version, force?}` 上传 |

- username: 3-20 位字母/数字/下划线
- pin: 4-6 位数字（bcrypt 哈希存储）
- 登录失败 5 次锁定 15 分钟（按 用户名+IP）
- 上传带 version，低于云端版本会返回 409，需 `force: true` 强制覆盖
