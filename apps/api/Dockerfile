FROM node:22-slim
WORKDIR /repo
COPY docker/certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt > /usr/local/share/extra-ca.pem 2>/dev/null || true
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY db db
COPY data/packages data/packages
COPY data/demo-documents data/demo-documents
COPY data/keys/collector-ed25519.pub.pem data/keys/
RUN pnpm install --frozen-lockfile --filter @tigeris/api...
WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "start"]
