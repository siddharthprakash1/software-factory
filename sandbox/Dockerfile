# The container every sandboxed agent runs in. Build it once:
#   npm run sandbox:build
# It holds the toolchains agents need to run a repository's tests (Node, Python with uv, git)
# and the claude CLI. Nothing from the host is baked in: the worktree and a copy of the
# claude login are mounted per call by the factory.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 python3-venv python3-pip ripgrep \
 && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages uv \
 && npm install -g @anthropic-ai/claude-code \
 && npm cache clean --force

# Run as the image's unprivileged user. Caches live in its home, inside the container only.
USER node
ENV HOME=/home/node \
    UV_CACHE_DIR=/home/node/.cache/uv \
    UV_LINK_MODE=copy \
    DISABLE_AUTOUPDATER=1
RUN mkdir -p /home/node/.claude /home/node/.cache
WORKDIR /work
