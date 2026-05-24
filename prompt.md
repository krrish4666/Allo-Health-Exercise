# Role and Objective
Act as an elite Staff Software Engineer specializing in high-performance Next.js applications and distributed systems. Your objective is to build an end-to-end inventory and order-fulfillment reservation system to solve a high-concurrency checkout race condition. 

You must write production-ready, race-condition-free, strictly typed TypeScript code. Prioritize clear separation of concerns, clean architecture, and robust error handling.

# Tech Stack Required
* **Framework:** Next.js (App Router)
* **Language:** TypeScript (strict mode enabled)
* **Database & ORM:** PostgreSQL (via Supabase or Neon) + Prisma
* **Caching/Locking:** Redis (via Upstash)
* **Validation:** Zod
* **Styling & UI:** Tailwind CSS + shadcn/ui

# Domain Problem & Core Challenge
Thousands of shoppers may try to buy the same product simultaneously. If stock is decremented only at payment time, overselling occurs. 
**Solution:** A reservation system. When a user checks out, hold units for 10 minutes. 
* Payment succeeds -> Confirm reservation, permanently decrement stock.
* Payment fails/timeout -> Release hold, units available again.

**CRITICAL CONSTRAINT:** The system MUST be correct under concurrency. If two requests come in simultaneously for the last unit of a SKU, exactly one should succeed, and the other must get a `409 Conflict`. 

# Step 1: Data Model (Prisma)
Design the Prisma schema with the following requirements:
1.  **Warehouse**: `id`, `name`, `location`.
2.  **Product**: `id`, `name`, `sku`, `price`.
3.  **Stock**: Maps Product to Warehouse. Fields: `id`, `productId`, `warehouseId`, `totalUnits`, `reservedUnits` (Available stock = `totalUnits - reservedUnits`). Create a unique compound index on `[productId, warehouseId]`.
4.  **Reservation**: `id`, `stockId`, `quantity`, `status` (Enum: PENDING, CONFIRMED, RELEASED), `expiresAt`, `createdAt`.

# Step 2: Concurrency & Database Strategy
Implement robust concurrency control. You must use Database-level row locking to prevent race conditions. 
* When creating a reservation, use Prisma's `$transaction` with raw SQL to execute a `SELECT ... FOR UPDATE` on the specific `Stock` row to lock it during the reservation check and update.
* Check if `totalUnits - reservedUnits >= requestedQuantity`. If yes, update `reservedUnits` and create the `Reservation`. If no, rollback and throw a `409 Conflict`.

# Step 3: API Endpoints Specification
Build the following endpoints (use Next.js Route Handlers). Apply Zod validation on all inputs.

1.  `GET /api/products`: Return products, including nested available stock per warehouse (calculated dynamically or mapped directly).
2.  `GET /api/warehouses`: Return list of warehouses.
3.  `POST /api/reservations`: 
    * Body: `productId`, `warehouseId`, `quantity`.
    * Action: Reserve units. Must enforce concurrency locking.
    * Return: 200 OK with reservation details, or 409 Conflict if insufficient stock.
4.  `POST /api/reservations/:id/confirm`:
    * Action: Mark as CONFIRMED. Decrement `totalUnits` by reservation quantity, and decrement `reservedUnits` by reservation quantity. 
    * Check: If `expiresAt` < now AND status is PENDING, return 410 Gone.
5.  `POST /api/reservations/:id/release`:
    * Action: Mark as RELEASED. Decrement `reservedUnits` by reservation quantity.

# Step 4: Bonus - Idempotency
Implement Idempotency for the reserve and confirm endpoints. 
* Check for the `Idempotency-Key` header.
* Use Redis (Upstash) to store the exact HTTP response against the idempotency key for 24 hours.
* If a request comes in with an existing key, bypass the database logic and immediately return the cached response.

# Step 5: Reservation Expiry Strategy
Implement a dual-strategy for expiry:
1.  **Lazy Cleanup (On Read):** Whenever `GET /api/products` is called, filter out or dynamically recalculate available stock by ignoring `PENDING` reservations where `expiresAt` is in the past.
2.  **Background Cleanup:** Create an endpoint `/api/cron/cleanup-reservations` (secured by a bearer token) that finds all expired, PENDING reservations, changes them to RELEASED, and decrements the corresponding `reservedUnits` in the Stock table.

# Step 6: Frontend Experience (Next.js App Router)
Create a responsive, clean UI using Tailwind and shadcn/ui.
1.  **Product Listing Page (`/`)**: Show products and available stock per warehouse. Include a "Reserve" button.
2.  **Checkout Page (`/checkout/[reservationId]`)**:
    * Show reservation details.
    * Display a **live, ticking countdown** to expiry using React state.
    * Provide "Confirm purchase" and "Cancel" buttons.
    * **Crucial UI State:** Upon confirm/cancel, the UI must update to the new state immediately without a full page reload (use React Query or Next.js Server Actions with `revalidatePath`).
    * Gracefully surface 409 and 410 errors as toast notifications (do not swallow them).

# Execution Instructions for the AI
1.  Start by providing the complete `schema.prisma` file.
2.  Provide the core database utility file demonstrating the `SELECT ... FOR UPDATE` transaction for concurrency.
3.  Provide the Redis idempotency middleware/wrapper logic.
4.  Provide the exact code for the 3 main API endpoints.
5.  Provide the frontend logic for the live countdown timer and optimistic UI updates.
6.  Finally, write a structured `README.md` explaining how to run the app locally, how the expiry mechanism works in production, and how idempotency was achieved.