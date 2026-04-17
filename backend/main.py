from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sqlite3
import json
import asyncio
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

DB_PATH = os.path.join(os.path.dirname(__file__), "orders.db")

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                order_id          TEXT PRIMARY KEY,
                phone             TEXT NOT NULL,
                otp               TEXT NOT NULL,
                status            TEXT NOT NULL DEFAULT 'pending_kitchen',
                created_at        REAL NOT NULL,
                kitchen_started_at REAL,
                cook_time_secs    REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id      TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
                item_id       TEXT NOT NULL,
                name          TEXT NOT NULL,
                prep_time_secs INTEGER NOT NULL,
                emoji         TEXT NOT NULL
            )
        """)
        conn.commit()


def db_save_order(order: dict):
    """Insert a brand-new order (and its items) into the database."""
    with get_db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO orders
                (order_id, phone, otp, status, created_at, kitchen_started_at, cook_time_secs)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            order["order_id"],
            order["phone"],
            order["otp"],
            order["status"],
            order["created_at"],
            order["kitchen_started_at"],
            order["cook_time_secs"],
        ))
        # Delete existing items first (for idempotency)
        conn.execute("DELETE FROM order_items WHERE order_id = ?", (order["order_id"],))
        for item in order["items"]:
            conn.execute("""
                INSERT INTO order_items (order_id, item_id, name, prep_time_secs, emoji)
                VALUES (?, ?, ?, ?, ?)
            """, (order["order_id"], item["id"], item["name"], item["prep_time_secs"], item["emoji"]))
        conn.commit()


def db_update_order(order_id: str, status: str, kitchen_started_at: float | None = None):
    """Update the status (and optionally kitchen_started_at) of an existing order."""
    with get_db() as conn:
        if kitchen_started_at is not None:
            conn.execute(
                "UPDATE orders SET status=?, kitchen_started_at=? WHERE order_id=?",
                (status, kitchen_started_at, order_id)
            )
        else:
            conn.execute(
                "UPDATE orders SET status=? WHERE order_id=?",
                (status, order_id)
            )
        conn.commit()


def db_delete_order(order_id: str):
    """Remove an order from the database (e.g. after kiosk pickup)."""
    with get_db() as conn:
        conn.execute("DELETE FROM orders WHERE order_id=?", (order_id,))
        conn.commit()


def db_load_orders() -> list[dict]:
    """
    Load all active orders from the database and reconstruct the
    in-memory list structure (including nested items list).
    """
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM orders ORDER BY created_at").fetchall()
        orders = []
        for row in rows:
            items = conn.execute(
                "SELECT item_id as id, name, prep_time_secs, emoji FROM order_items WHERE order_id=?",
                (row["order_id"],)
            ).fetchall()
            orders.append({
                "order_id":          row["order_id"],
                "phone":             row["phone"],
                "otp":               row["otp"],
                "status":            row["status"],
                "created_at":        row["created_at"],
                "kitchen_started_at": row["kitchen_started_at"],
                "cook_time_secs":    row["cook_time_secs"],
                "items":             [dict(i) for i in items],
            })
    return orders


# ---------------------------------------------------------------------------
# Application lifespan: DB init + order recovery on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB, reload orders, resume kitchen timers."""
    init_db()
    recovered = db_load_orders()
    MOCK_ORDERS.extend(recovered)

    now = time.time()
    for order in recovered:
        status = order["status"]
        cook_time = order["cook_time_secs"]

        if status == "pending_kitchen":
            # Figure out how long ago the order was created
            elapsed_since_creation = now - order["created_at"]
            remaining_pickup = max(KITCHEN_PICKUP_DELAY - elapsed_since_creation, 0)
            print(f"[Recovery] {order['order_id']} QUEUED — resuming kitchen pickup in {remaining_pickup:.1f}s")
            asyncio.create_task(_resume_kitchen_agent(order, remaining_pickup))

        elif status == "in_kitchen":
            # Cook timer started at kitchen_started_at; resume with the remainder
            elapsed_cooking = now - (order["kitchen_started_at"] or now)
            remaining_cook = max(cook_time - elapsed_cooking, 0)
            print(f"[Recovery] {order['order_id']} IN KITCHEN — {remaining_cook:.1f}s left on cook timer")
            asyncio.create_task(_resume_ready_agent(order, remaining_cook))

        elif status == "ready_for_pickup":
            print(f"[Recovery] {order['order_id']} already READY — no timer needed")

    if recovered:
        print(f"[DB] Recovered {len(recovered)} order(s) from orders.db")
    else:
        print("[DB] No previous orders found — fresh start")

    yield  # Application runs here

    print("[DB] Shutting down — all state is persisted in orders.db")


# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="Concession Manager Agents", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class OrderRequest(BaseModel):
    user_phone: str
    items: list[str]

class OrderResponse(BaseModel):
    order_id: str
    otp: str
    wait_time_secs: int

# ---------------------------------------------------------------------------
# Menu catalog  (single source of truth for prep times)
# ---------------------------------------------------------------------------

MENU_CATALOG: dict[str, dict] = {
    "hd1": {"name": "Premium Hot Dog",        "price": 8.50,  "prep_time_secs": 20, "emoji": "🌭"},
    "bz1": {"name": "Craft Beer",              "price": 12.00, "prep_time_secs": 5,  "emoji": "🍺"},
    "pz1": {"name": "Slice of Pepperoni",      "price": 9.00,  "prep_time_secs": 25, "emoji": "🍕"},
    "nb1": {"name": "Nachos & Cheese",         "price": 7.50,  "prep_time_secs": 15, "emoji": "🧀"},
    "cc1": {"name": "Chicken Strips (x3)",     "price": 11.00, "prep_time_secs": 35, "emoji": "🍗"},
    "sd1": {"name": "Loaded Stadium Fries",    "price": 6.50,  "prep_time_secs": 18, "emoji": "🍟"},
    "sw1": {"name": "Soft Drink (Large)",      "price": 4.50,  "prep_time_secs": 3,  "emoji": "🥤"},
    "pr1": {"name": "Soft Pretzel",            "price": 5.00,  "prep_time_secs": 12, "emoji": "🥨"},
}

KITCHEN_PICKUP_DELAY = 5   # seconds (agent A2A handshake latency)

# In-memory working set — loaded from DB on startup
MOCK_ORDERS: list[dict] = []

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "Agents are listening..."}


@app.get("/api/menu")
def get_menu():
    """Returns the full menu catalog so the frontend can display live prep times."""
    return {
        "items": [
            {"id": item_id, **details}
            for item_id, details in MENU_CATALOG.items()
        ]
    }


@app.post("/api/order", response_model=OrderResponse)
async def create_order(order: OrderRequest):
    """
    Ordering Agent — resolves each item's prep time from MENU_CATALOG,
    persists the order to DB, and hands off to the Kitchen Agent.

    Cook time = max(prep_time_secs), because a real kitchen cooks items
    simultaneously on the grill/fryer.
    """
    order_id = f"ORDER-{len(MOCK_ORDERS) + 100}"
    otp = "123456"  # Mock OTP

    resolved_items = []
    for item_id in order.items:
        cat = MENU_CATALOG.get(item_id)
        if cat:
            resolved_items.append({
                "id":             item_id,
                "name":           cat["name"],
                "prep_time_secs": cat["prep_time_secs"],
                "emoji":          cat["emoji"],
            })
        else:
            resolved_items.append({"id": item_id, "name": item_id, "prep_time_secs": 15, "emoji": "🍽️"})

    # Bottleneck item drives the total kitchen time
    cook_time_secs = max((i["prep_time_secs"] for i in resolved_items), default=15)

    order_data = {
        "order_id":          order_id,
        "phone":             order.user_phone,
        "items":             resolved_items,
        "status":            "pending_kitchen",
        "otp":               otp,
        "created_at":        time.time(),
        "kitchen_started_at": None,
        "cook_time_secs":    cook_time_secs,
    }

    MOCK_ORDERS.append(order_data)
    db_save_order(order_data)   # ← persist immediately

    item_summary = ", ".join(f"{i['emoji']} {i['name']} ({i['prep_time_secs']}s)" for i in resolved_items)
    print(f"[Ordering Agent] {order_id} — {item_summary} | Cook time: {cook_time_secs}s")

    asyncio.create_task(trigger_kitchen_agent(order_data))

    orders_ahead = sum(
        1 for o in MOCK_ORDERS
        if o["status"] in ("pending_kitchen", "in_kitchen") and o["order_id"] != order_id
    )
    estimated_wait_secs = KITCHEN_PICKUP_DELAY + (orders_ahead * 5) + cook_time_secs
    estimated_wait_mins = max(round(estimated_wait_secs / 60, 1), 1)

    estimated_wait_secs_display = max(int(estimated_wait_secs), 1)
    return OrderResponse(order_id=order_id, otp=otp, wait_time_secs=estimated_wait_secs_display)


@app.get("/api/status")
def get_order_status(identifier: str):
    """Returns the current status of an order by order_id or phone number."""
    for order in MOCK_ORDERS:
        if order["order_id"] == identifier or order["phone"] == identifier:
            wait_time = _calculate_wait_time(order)
            status_label = {
                "pending_kitchen":  "QUEUED",
                "in_kitchen":       "IN KITCHEN",
                "ready_for_pickup": "READY",
            }.get(order["status"], order["status"].upper())
            return {
                "status":        "success",
                "order_id":      order["order_id"],
                "order_status":  status_label,
                "wait_time_secs": wait_time,
            }
    return {"status": "error", "message": "Order not found"}


@app.get("/api/kitchen-queue")
def get_queue():
    """
    Big screen dashboard data — separates orders by status so the
    display can show 'In Kitchen Prep' vs 'Now Serving'.
    """
    in_kitchen, ready = [], []
    for order in MOCK_ORDERS:
        entry = {"order_id": order["order_id"], "wait_time_secs": _calculate_wait_time(order)}
        if order["status"] == "in_kitchen":
            in_kitchen.append(entry)
        elif order["status"] == "ready_for_pickup":
            ready.append(entry)
    return {"in_kitchen": in_kitchen, "ready": ready}


@app.post("/api/kiosk-pickup/{order_id}")
def pickup_order(order_id: str):
    """Kiosk scanner marks an order as collected and removes it from DB."""
    for order in MOCK_ORDERS:
        if order["order_id"] == order_id:
            if order["status"] == "ready_for_pickup":
                MOCK_ORDERS.remove(order)
                db_delete_order(order_id)   # ← remove from DB
                return {"status": "success", "message": f"{order_id} collected!"}
            else:
                return {"status": "error", "message": f"{order_id} not ready yet (status: {order['status']})"}
    return {"status": "error", "message": "Order not found"}


# ---------------------------------------------------------------------------
# Simulated Agent Tasks (A2A handshakes)
# ---------------------------------------------------------------------------

async def trigger_kitchen_agent(order: dict):
    """
    Kitchen Agent — waits KITCHEN_PICKUP_DELAY, then moves the order
    to 'in_kitchen' and starts the item-specific cook timer.
    """
    await asyncio.sleep(KITCHEN_PICKUP_DELAY)
    if order["status"] != "pending_kitchen":
        return
    await _start_cooking(order)


async def _resume_kitchen_agent(order: dict, delay: float):
    """Recovery path: picks up a QUEUED order with an adjusted delay."""
    await asyncio.sleep(delay)
    if order["status"] != "pending_kitchen":
        return
    await _start_cooking(order)


async def _start_cooking(order: dict):
    """Shared logic: transition order to in_kitchen and fire cook + notify timers."""
    cook_time = order["cook_time_secs"]
    order["status"] = "in_kitchen"
    order["kitchen_started_at"] = time.time()
    db_update_order(order["order_id"], "in_kitchen", order["kitchen_started_at"])  # ← persist

    item_names = ", ".join(i["name"] for i in order["items"])
    print(f"[Kitchen Agent] {order['order_id']} IN KITCHEN -- {item_names} | Cook: {cook_time}s")

    notify_delay = max(cook_time - 5, 1)
    asyncio.create_task(trigger_notification_agent(order, notify_delay))
    asyncio.create_task(trigger_ready_agent(order, cook_time))


async def trigger_ready_agent(order: dict, cook_time_secs: float):
    """Waits for the full cook time then marks the order ready."""
    await asyncio.sleep(cook_time_secs)
    await _mark_ready(order, cook_time_secs)


async def _resume_ready_agent(order: dict, remaining_secs: float):
    """Recovery path: resumes the cook timer with whatever time is left."""
    await asyncio.sleep(remaining_secs)
    if order["status"] != "in_kitchen":
        return
    await _mark_ready(order, order["cook_time_secs"])


async def _mark_ready(order: dict, cook_time_secs: float):
    """Shared logic: transition order to ready_for_pickup."""
    if order["status"] != "in_kitchen":
        return
    order["status"] = "ready_for_pickup"
    db_update_order(order["order_id"], "ready_for_pickup")   # ← persist
    print(f"[Kitchen Agent] {order['order_id']} READY FOR PICKUP! (cooked in {cook_time_secs}s)")



async def trigger_notification_agent(order: dict, delay: float):
    """Notification Agent — fires a mock SMS ~5s before the order is ready."""
    await asyncio.sleep(delay)
    if order["status"] == "in_kitchen":
        print(
            f"[Notification Agent] SMS -> {order['phone']}: "
            f"Order {order['order_id']} ready in ~5s! (cook: {order['cook_time_secs']}s)"
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calculate_wait_time(order: dict) -> int:
    """Returns the remaining wait time in seconds."""

    if order["status"] == "ready_for_pickup":
        return 0
    if order["status"] == "in_kitchen" and order["kitchen_started_at"]:
        cook_time = order.get("cook_time_secs", 15)
        elapsed   = time.time() - order["kitchen_started_at"]
        return max(int(cook_time - elapsed), 1)
    # pending_kitchen
    cook_time = order.get("cook_time_secs", 15)
    return KITCHEN_PICKUP_DELAY + int(cook_time)


@app.post("/api/vision-checkout")
async def vision_checkout_simulation():
    items_detected = ["Hot Dog", "Soda Can"]
    total = sum(5.00 for _ in items_detected)
    return {"status": "success", "items": items_detected, "charged": f"${total:.2f}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
