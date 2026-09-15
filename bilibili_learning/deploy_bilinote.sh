#!/usr/bin/env bash
# =============================================================================
# BiliNote 一键部署脚本 (Windows WSL/Linux)
# =============================================================================
# 用法:
#   cd /mnt/c/workSpace/navia/bilinote
#   cp .env.example .env   # 第一次跑
#   bash /mnt/c/workSpace/navia/bilibili_learning/deploy_bilinote.sh
#
# 做什么:
#   1. 探测最快的 docker 镜像源 (国内加速)
#   2. 设置 BASE_REGISTRY 环境变量
#   3. docker compose build (自建 backend + frontend 镜像)
#   4. docker compose up -d (启动 3 容器: backend / frontend / nginx)
#   5. 等 nginx healthcheck 通过
#   6. 打印浏览器访问 URL
#
# ⚠️ 前置要求:
#   - Docker Desktop 已在 Windows 启动, WSL 集成已开
#   - Docker daemon 在 WSL 里可访问 (docker info 能看到 Server Version)
# =============================================================================

set -e  # 任一步失败立刻停

BILINOTE_DIR="/mnt/c/workSpace/navia/bilinote"
LOG_PREFIX="[deploy_bilinote]"

cd "$BILINOTE_DIR"

# 加载 .env (让脚本读 BASE_REGISTRY)
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    BASE_REGISTRY_FROM_ENV="$BASE_REGISTRY"
fi

echo "$LOG_PREFIX === BiliNote 一键部署 ==="
echo "$LOG_PREFIX 工作目录: $(pwd)"

# -----------------------------------------------------------------------------
# Step 1: 探测最快 docker 镜像源
# -----------------------------------------------------------------------------
echo "$LOG_PREFIX [1/6] 探测最快 docker 镜像源..."

REGISTRIES=(
    "docker.m.daocloud.io"
    "docker.1ms.run"
    "registry.cn-hangzhou.aliyuncs.com"
    "docker.io"
)

BEST_REGISTRY="docker.m.daocloud.io"
BEST_TIME=99999

for reg in "${REGISTRIES[@]}"; do
    # 用 docker pull 一个小镜像测延迟, 取最快的
    start=$(date +%s%N)
    if timeout 30 docker pull --quiet "$reg/library/alpine:latest" >/dev/null 2>&1; then
        end=$(date +%s%N)
        elapsed=$(( (end - start) / 1000000 ))  # ms
        echo "$LOG_PREFIX   $reg → ${elapsed}ms"
        if [ "$elapsed" -lt "$BEST_TIME" ]; then
            BEST_TIME=$elapsed
            BEST_REGISTRY=$reg
        fi
    else
        echo "$LOG_PREFIX   $reg → 超时/失败"
    fi
done

# 如果探测全失败, 用 .env 里的 BASE_REGISTRY 兜底
if [ "$BEST_TIME" -eq 99999 ] && [ -n "$BASE_REGISTRY_FROM_ENV" ]; then
    BEST_REGISTRY="$BASE_REGISTRY_FROM_ENV"
    echo "$LOG_PREFIX registry 探测全失败, 用 .env 里的 BASE_REGISTRY=$BEST_REGISTRY"
fi

echo "$LOG_PREFIX 最快: $BEST_REGISTRY (${BEST_TIME}ms)"
export BASE_REGISTRY="$BEST_REGISTRY"

# -----------------------------------------------------------------------------
# Step 2: 检查 .env
# -----------------------------------------------------------------------------
echo "$LOG_PREFIX [2/6] 检查 .env..."
if [ ! -f ".env" ]; then
    echo "$LOG_PREFIX .env 不存在, 从 .env.example 复制"
    cp .env.example .env
    echo "$LOG_PREFIX 已生成 .env, 你可以根据需要修改 (默认端口 3015/8483)"
fi

# -----------------------------------------------------------------------------
# Step 3: docker compose build (自建镜像, 走国内加速)
# -----------------------------------------------------------------------------
echo "$LOG_PREFIX [3/6] docker compose build (会比较慢, 第一次可能要 10-20 分钟)..."
docker compose build --no-cache

# -----------------------------------------------------------------------------
# Step 4: docker compose up -d
# -----------------------------------------------------------------------------
echo "$LOG_PREFIX [4/6] docker compose up -d..."
docker compose up -d

# -----------------------------------------------------------------------------
# Step 5: 等 nginx healthcheck
# -----------------------------------------------------------------------------
echo "$LOG_PREFIX [5/6] 等 nginx 健康检查..."
APP_PORT=$(grep "^APP_PORT=" .env | cut -d= -f2 | cut -d' ' -f1)
APP_PORT=${APP_PORT:-3015}

for i in {1..30}; do
    if curl -sf "http://localhost:$APP_PORT/" > /dev/null 2>&1; then
        echo "$LOG_PREFIX [+] nginx 已就绪 (用了 ${i} 秒)"
        break
    fi
    sleep 2
    echo -n "."
done

# -----------------------------------------------------------------------------
# Step 6: 打印访问信息
# -----------------------------------------------------------------------------
echo ""
echo "$LOG_PREFIX [6/6] 部署完成!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  BiliNote 已启动                                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Web UI:    http://localhost:$APP_PORT                       ║"
echo "║  后端 API:  http://localhost:8483                         ║"
echo "║                                                          ║"
echo "║  下一步:                                                  ║"
echo "║  1. 浏览器打开 http://localhost:$APP_PORT                    ║"
echo "║  2. 进入「模型供应商」页 → 添加 LLM provider                ║"
echo "║  3. 填 base_url + api_key (用你的 minimax / deepseek)       ║"
echo "║  4. 复制 B 站视频 URL 进去试生成笔记                       ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "$LOG_PREFIX 容器状态:"
docker compose ps