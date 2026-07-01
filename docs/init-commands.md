# Initialization Commands

Powershell commands do inicjalizacji monorepo, aplikacji i Prismy:

```powershell
npm init -y
npm pkg set name="perfume-shop" private=true
npm pkg set "workspaces[0]=frontend" "workspaces[1]=backend"

npm create vite@latest frontend -- --template react-ts

New-Item -ItemType Directory -Path backend | Out-Null
Set-Location backend
npm init -y

npm install express cors dotenv helmet morgan bcrypt jsonwebtoken @prisma/client
npm install -D typescript tsx tsup nodemon jest ts-jest supertest prisma eslint @eslint/js typescript-eslint @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken @types/morgan @types/jest @types/supertest

npx prisma init --datasource-provider postgresql

Set-Location ..\frontend
npm install
npm install -D jest @types/jest @testing-library/react @testing-library/jest-dom eslint @eslint/js typescript-eslint

Set-Location ..
```

Po wygenerowaniu podstawowych projektow warto od razu dodac skrypty do `package.json` w `frontend` i `backend`: `lint`, `test`, `build`, `dev`.
