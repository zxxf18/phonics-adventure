# 独立域名部署

前端部署在站点根路径，媒体 URL 使用 `/media/phonics/...`，不再携带旧应用前缀。Nginx 将根路径原样转发到应用，AAC 返回 `audio/aac`、MP4 返回 `video/mp4`，并保留 Range 请求。不要把这些媒体请求转发到首页服务。

构建镜像时必须保留 `public/media`；实际音视频不提交 Git。发布后检查 HTML、JS/CSS、AAC/MP4 的 200 和 Range 206，以及容器重启后的可用性。旧域名路径入口由边缘代理重定向到新域名，不在应用中兼容旧媒体前缀。
