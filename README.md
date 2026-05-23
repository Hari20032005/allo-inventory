# Allo — Inventory Reservation System

A Next.js application that implements a race-condition-free inventory reservation system for multi-warehouse retail. Customers can temporarily hold stock for 10 minutes while completing payment.

**Live URL:** https://allo-three.vercel.app

**GitHub:** https://github.com/Hari20032005/allo-inventory

---

## Running locally

### 1. Prerequisites

- Node.js 20+
- A hosted Postgres instance (Neon, Supabase, Railway — free tiers work)
- An Upstash Redis instance (free tier works)

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (with `?sslmode=require` for Neon/Supabase) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `CRON_SECRET` | Arbitrary secret that authenticates the cron endpoint |

### 3. Migrate and seed

```bash
npm install
npx prisma migrate dev --name init   # creates tables
npm run db:seed                       # inserts demo products, warehouses, stock
```

### 4. Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the concurrency guarantee works

The core risk: two checkout requests arrive simultaneously for the last unit. Both read `reservedQuantity = 0`, both see 1 available, both succeed — and one customer ends up without a physical unit.

**Solution: `SELECT FOR UPDATE` inside a serialisable Postgres transaction.**

```sql
-- src/app/api/reservations/route.ts
SELECT id, "totalQuantity", "reservedQuantity"
FROM "Stock"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;
```

`FOR UPDATE` places a row-level exclusive lock on the `Stock` record for the lifetime of the transaction. The second concurrent request blocks at this line until the first transaction commits or rolls back. By the time it acquires the lock, `reservedQuantity` has already been incremented and it correctly sees 0 available units, returning a 409.

This approach does not require Redis for correctness. Redis is used only for the optional idempotency layer.

---

## How reservation expiry works in production

### Primary: lazy cleanup on read (the real-time guarantee)

`GET /api/reservations/:id` and `POST /api/reservations/:id/confirm` both check `expiresAt` inline and immediately release expired reservations in the same transaction. This means stock is returned the instant any user or endpoint touches an expired reservation — no background job needed for correctness.

### Secondary: Vercel Cron (daily garbage collection)

`vercel.json` schedules `GET /api/cron/expire-reservations` to run once per day at 2am UTC. This sweeps up any expired `PENDING` reservations that were never read after expiry (e.g. a user who closed the tab). The endpoint is protected by a `CRON_SECRET` bearer token.

> **Note:** Vercel's hobby plan only supports daily cron jobs. The designed architecture assumed per-minute cron as the primary mechanism, but because we have lazy cleanup on every read, correctness is maintained regardless — the cron is just a daily sweep of stale rows. On a Pro plan the cron would be changed back to `* * * * *`.

---

## Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` both honour the `Idempotency-Key` header.

**Implementation:** Both endpoints use Redis as the idempotency store (`src/lib/idempotency.ts`). On first request, the response is cached in Redis under `idempotency:reserve:<key>` or `idempotency:confirm:<key>` with a 24-hour TTL. On any subsequent request with the same key, the cached `{ status, body }` is returned directly — no database write, no lock acquisition.

**Reserve additionally** stores the key on the `Reservation` row (`idempotencyKey UNIQUE`) as a secondary guard. If Redis is unavailable, the `UNIQUE` constraint on the DB row will catch a true duplicate insert and prevent a double-reservation.

**Why Redis over DB-only:** Storing the full response body (not just the key) in Redis means retries get back exactly the original response, including fields like `expiresAt` that would differ if re-computed. The DB constraint alone can't replay the original response.

The frontend generates a fresh `crypto.randomUUID()` per Reserve button click, so network retries are protected, but deliberate re-clicks create new reservations.

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | List all products with stock per warehouse |
| `GET` | `/api/warehouses` | List all warehouses |
| `POST` | `/api/reservations` | Create a reservation. Body: `{ productId, warehouseId, quantity }`. Returns 409 if stock is insufficient. |
| `GET` | `/api/reservations/:id` | Get reservation details (triggers lazy expiry check) |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation (payment success). Returns 410 if expired. |
| `POST` | `/api/reservations/:id/release` | Release reservation early (cancellation) |
| `GET` | `/api/cron/expire-reservations` | Cron endpoint — requires `Authorization: Bearer <CRON_SECRET>` |

---

## Trade-offs and what I'd do differently

**What I chose and why:**

- **`SELECT FOR UPDATE` over application-level locks (Redis Redlock):** Database-level locking is simpler, removes a failure mode (Redis outage = can't reserve), and is guaranteed correct by the DB's ACID machinery. Redis Redlock has well-documented edge cases with clock skew and network partitions. For a single Postgres instance (or a primary-replica pair), `FOR UPDATE` is the right tool.

- **Lazy cleanup on read in addition to cron:** Vercel's hobby cron runs at 1-minute granularity. Without lazy cleanup, a user sitting on the checkout page would see a countdown reach zero but the reservation status would stay `PENDING` until the next cron tick. The lazy check makes the UI immediately consistent.

- **No WebSocket / Server-Sent Events:** The countdown is driven entirely client-side from the `expiresAt` timestamp. The page re-fetches once the timer hits zero. This is simpler and sufficient for a 10-minute window — there's no need for a persistent connection.

**With more time I would:**

- Add a proper auth layer (session tokens, user IDs on reservations) so a user can't confirm or cancel someone else's reservation.
- Add optimistic UI with `useSWR` or React Query for background polling, so stock counts refresh without a full page reload.
- Write integration tests that spin up a real Postgres instance and fire concurrent reservation requests to verify the `FOR UPDATE` guarantee in CI.
- Add a proper error boundary and toast notifications instead of inline error divs.
- Paginate the product listing and add search/filter.
