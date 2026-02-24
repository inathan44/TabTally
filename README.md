# TabTally

A group expense tracking app. Built with [Next.js](https://nextjs.org), [tRPC](https://trpc.io), [Prisma](https://prisma.io), [Tailwind CSS](https://tailwindcss.com), and [Clerk](https://clerk.com) for auth.

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` and fill in the required values (Clerk keys, database URL, etc.).

### 3. Start the database

Starts a local Postgres instance in Docker:

```bash
./start-database.sh
```

### 4. Push the database schema

```bash
npm run db:push
```

To seed with sample data:

```bash
npm run db:seed
```

### 5. Start the dev server

The frontend and backend both run in a single Next.js process (tRPC API routes are part of the Next.js app):

```bash
npm run dev
```

App will be available at [http://localhost:3000](http://localhost:3000).

---

## Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (frontend + backend) |
| `npm run build` | Production build |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:generate` | Generate and run a migration |
| `npm run db:studio` | Open Prisma Studio to browse the database |
| `npm run db:seed` | Seed the database with sample data |
| `npm test` | Run tests |
| `npm run check` | Lint + typecheck |
