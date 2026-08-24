# 音标探险岛

面向儿童的英语音标学习站点，包含 48 个音标、例词音频、发音视频、字母组合学习和多场景互动游戏。

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

访问 <http://localhost:3000>。

音视频文件不纳入 Git。需要完整播放功能时，请在本地补充 `public/audio` 和 `public/media` 下的对应文件。

生产构建与启动：

```bash
npm run build
npm run start -- --host 0.0.0.0
```

## Docker 构建

容器镜像的操作系统是 Linux，因此不存在 `darwin/arm64` Docker 镜像。Apple Silicon Mac 上的 Docker Desktop 会运行 `linux/arm64` 镜像；项目同时提供 `linux/amd64` 和 `linux/arm64` 构建。

为当前 Apple Silicon Mac 构建并载入本机 Docker：

```bash
IMAGE=phonics-adventure:latest docker buildx bake local-arm64
docker run --rm -p 3000:3000 phonics-adventure:latest
```

为 Intel Linux 构建并载入本机 Docker：

```bash
IMAGE=phonics-adventure:latest docker buildx bake local-amd64
```

构建包含两个架构的 OCI 归档：

```bash
mkdir -p outputs
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag phonics-adventure:latest \
  --output type=oci,dest=outputs/phonics-adventure.oci.tar \
  .
```

发布多架构镜像到仓库：

```bash
IMAGE=your-registry/phonics-adventure:latest docker buildx bake --push release
```

本地存在的 `public/audio` 和 `public/media` 会随镜像打包，但不会提交到 Git；`private-assets`、本地缓存和历史构建产物不会进入构建上下文。

## 页面结构

- 探险首页：学习进度与模块入口。
- 系统学习：元音、辅音、字母密码三个子 Tab。
- 音标图鉴：48 个音标、例词与发音视频。
- 游戏乐园：怪兽对战、森林快递、13×13 宝藏迷宫、起重建房、管道急修、铁路调度、机器人装配、云朵花园、峡谷搭桥、星际对接、海盗航线和魔法厨房；支持手动选择或每题随机切换。
- 游戏题型：可以指定“听音选音标”或“根据音标选单词”，也可以混合交替。
