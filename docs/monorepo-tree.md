# Perfume Shop Monorepo Tree

Proponowane drzewo katalogow dla monorepo PERN:

```text
perfume-shop/
|-- .github/
|   `-- workflows/
|       `-- main.yml
|-- backend/
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   |-- .env
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- app.ts
|   |   |-- server.ts
|   |   |-- config/
|   |   |-- modules/
|   |   |   |-- auth/
|   |   |   |-- perfume/
|   |   |   `-- cart/
|   |   |-- middleware/
|   |   |-- shared/
|   |   `-- tests/
|   `-- jest.config.ts
|-- frontend/
|   |-- Dockerfile
|   |-- package.json
|   |-- vite.config.ts
|   |-- .env
|   |-- src/
|   |   |-- main.tsx
|   |   |-- App.tsx
|   |   |-- api/
|   |   |-- features/
|   |   |-- components/
|   |   `-- tests/
|   `-- jest.config.ts
|-- docs/
|   |-- init-commands.md
|   `-- monorepo-tree.md
|-- docker-compose.yml
|-- Jenkinsfile
|-- .gitlab-ci.yml
|-- .env
`-- package.json
```

Zakres kroku 1 obejmuje wyłącznie pliki infrastrukturalne i schemat danych. Kod backendu i frontendu zostanie dodany w kolejnym kroku.
