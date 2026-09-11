# SSO 回调兼容性修复（2026-09-11）

## 根因与安全边界

Casdoor 4.3.0 签发的 `aud` 是数组，即使只有一个客户端。原实现仅接受字符串，将已验证邮箱的合法身份也拒绝为无效。
线上已脱敏确认：普通注册用户 `email_verified=true`，诗词令牌的 `aud` 为单元素数组。

修复同时接受 OIDC 的字符串和数组受众；仍必须匹配本应用 Client ID。多个受众必须有匹配的 `azp`；只要提供 `azp` 就必须匹配。
保留 RSA 签名、issuer、nonce、有效期、非空 subject/email、严格布尔邮箱验证检查。未修改用户邮箱验证标记、角色或 Casdoor 数据。

参考：[Casdoor 4.3.0 令牌源码](https://github.com/casdoor/casdoor/blob/v4.3.0/object/token_jwt.go#L504)。

## 回归与部署

回归使用临时 RSA 签名令牌覆盖成功回调与拒绝路径，包括字符串/数组受众、错误受众/授权方、nonce/state、缺少 subject/有效期、过期、未验证邮箱及签名错误。测试先在旧代码复现失败，再验证修复通过。

本地构建 Linux amd64 产物；服务器复用上一版运行镜像，只替换应用产物，保持环境变量、挂载、网络和重启策略。发布标签为 `20260911-sso-audfix`。
不以修改生产账户验证标记的方式通过验收。

测试：`npm test`（Node 22.13+），构建：`npm run build`。

依赖审计发现既有 Next.js / sharp 告警；本次 standalone 与线上运行目录使用 vinext，不包含 Next.js 或 sharp，Windows/Next 图像优化漏洞不在本次运行路径。未为认证修复修改依赖锁文件。后续依赖维护仍应升级这些开发兼容依赖。
