# Allo Inventory Reservations

Next.js App Router demo for reserving warehouse inventory without overselling under concurrent requests.

## Stack

- Next.js + TypeScript
- Prisma + hosted Postgres
- Zod for request validation
- Tailwind CSS

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your Postgres URLs:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/DATABASE?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
RESERVATION_TTL_SECONDS="300"
CRON_SECRET="replace-me"
```

3. Apply migrations and seed:

```bash
npm run prisma:deploy
npm run seed
```

4. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API

- `GET /api/products` lists products with total, reserved, and available stock per warehouse.
- `GET /api/warehouses` lists warehouses.
- `POST /api/reservations` reserves stock for `{ productId, warehouseId, quantity }`. Returns `409` when stock is not available.
- `POST /api/reservations/:id/confirm` confirms a pending reservation. Returns `410` when the hold has expired.
- `POST /api/reservations/:id/release` releases a pending reservation early.

## Concurrency Approach

The important operation is reservation creation. It does not read available stock in application code and then update later. Instead, it performs one atomic Postgres statement inside a transaction:

```sql
UPDATE "stock_levels"
SET "reserved_units" = "reserved_units" + $quantity
WHERE "productId" = $productId
  AND "warehouseId" = $warehouseId
  AND ("total_units" - "reserved_units") >= $quantity
RETURNING *
```

Postgres obtains the row lock for the update and rechecks the `WHERE` predicate against the latest committed row version. If two clients race for the final unit, one update returns the row and creates the reservation; the other update returns no rows and the API returns `409`.

Confirmation decrements both `total_units` and `reserved_units`, because the purchased units leave sellable inventory. Release and expiry decrement only `reserved_units`.

## Expiry

Expiry is implemented two ways:

- Lazy cleanup runs before product reads and reservation writes. Expired pending reservations are marked `released` and their reserved units return to stock.
- `GET/POST /api/cron/release-expired` can be called by Vercel Cron. `vercel.json` schedules it every five minutes. Set `CRON_SECRET` and call it with `Authorization: Bearer <secret>` for manual invocations.

The cleanup uses a single `UPDATE ... RETURNING` for expired pending reservations, then releases the returned stock quantities. That avoids double-release if another process already changed the reservation status.

## Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header. The server stores the original status code and JSON response for a matching method/path/body hash and replays it on retry. Reusing a key with a different body returns `409`.

With more time, I would add a short-lived "in progress" idempotency record so two identical retries arriving at the exact same millisecond wait on the first request instead of both executing before the response record exists.

## Trade-offs

- The app uses hosted Postgres as the source of truth and does not require Redis. The atomic conditional update gives the core concurrency guarantee without a distributed lock.
- The UI reserves one unit at a time to keep the exercise flow compact. The API accepts arbitrary positive quantities up to 50.
- Vercel deployment needs `DATABASE_URL`, `RESERVATION_TTL_SECONDS`, and `CRON_SECRET`, followed by `npm run prisma:deploy && npm run seed` against the hosted database.
