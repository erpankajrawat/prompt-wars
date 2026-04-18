from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import asyncio
import time
import datetime
import jwt
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from google.cloud import firestore
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import random

try:
    from google.adk.agents import Agent
except ImportError:
    # Fallback or warning if ADK is not found
    pass

load_dotenv()

# ---------------------------------------------------------------------------
# Database setup (Firestore)
# ---------------------------------------------------------------------------

# Firestore client will automatically use the project ID from environment
# or from the Cloud Run service account.
db = firestore.Client()

def db_save_order(order: dict):
    """Insert or update an order into Firestore."""
    doc_ref = db.collection("orders").document(order["order_id"])
    doc_ref.set(order)

def db_update_order(order_id: str, status: str, kitchen_started_at: float = None):
    """Update the status (and optionally kitchen_started_at) of an existing order."""
    doc_ref = db.collection("orders").document(order_id)
    update_data = {"status": status}
    if kitchen_started_at is not None:
        update_data["kitchen_started_at"] = kitchen_started_at
    doc_ref.update(update_data)

def db_delete_order(order_id: str):
    """Remove an order from Firestore."""
    db.collection("orders").document(order_id).delete()

def db_load_orders() -> list[dict]:
    """Load all active orders from Firestore, ordered by creation time."""
    orders_ref = db.collection("orders").order_by("created_at")
    docs = orders_ref.stream()
    return [doc.to_dict() for doc in docs]


# ---------------------------------------------------------------------------
# Application lifespan: DB init + order recovery on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize Agents with external prompts and sync roster."""
    global orchestrator_agent
    
    # 0. Sync Firestore Roster & Prompt Config
    _sync_initial_roster()
    _sync_system_config() # Ensure maintenance_mode document exists
    
    try:
        with open("prompts.json", "r") as f:
            p_config = json.load(f)
    except Exception:
        p_config = {
            "orchestrator_instruction": "Lead kitchen coordinator.",
            "roster_instruction": "Roster monitor.",
            "ops_instruction": "Task executor."
        }
    
    # 1. Initialize the GADK Agent Swarm inside lifespan
    try:
        from google.adk.agents import Agent
        
        roster_agent = Agent(
            model="gemini-1.5-flash",
            name="RosterAgent",
            instruction=p_config["roster_instruction"],
            tools=[get_available_chefs_v2]
        )

        kitchen_ops_agent = Agent(
            model="gemini-1.5-flash",
            name="KitchenOpsAgent",
            instruction=p_config["ops_instruction"],
            tools=[assign_task_staged]
        )

        orchestrator_agent = Agent(
            model="gemini-1.5-flash",
            name="OrchestratorAgent",
            instruction=p_config["orchestrator_instruction"],
            tools=[is_system_active, commit_staged_tasks],
            sub_agents=[roster_agent, kitchen_ops_agent]
        )
        print("[Agents] Atomic Distributed Swarm Online (External Prompts Loaded).")
    except Exception as e:
        print(f"[Agents Warning] GADK initialization failed: {e}")
        orchestrator_agent = None

    # recovery logic
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
        print(f"[DB] Recovered {len(recovered)} order(s) from Firestore")
    else:
        print("[DB] No previous orders found in Firestore — fresh start")

    yield  # Application runs here

    print("[DB] Shutting down — state is managed in Firestore")


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

class ChefInput(BaseModel):
    name: str

class LoginRequest(BaseModel):
    username: str
    password: str

# ---------------------------------------------------------------------------
# JWT Security setup
# ---------------------------------------------------------------------------
SECRET_KEY = "prompt-wars-super-secret-key"
ALGORITHM = "HS256"
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------------------------------------------------------------------
# Structured Models for Agent Protocol
# ---------------------------------------------------------------------------
from pydantic import Field

class ChefAvailability(BaseModel):
    id: str
    name: str
    current_load_secs: int

class AssignmentResult(BaseModel):
    task_id: str
    status: str
    message: str

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

# ---------------------------------------------------------------------------
# Firestore Agent State & Maintenance (Distributed Persistence)
# ---------------------------------------------------------------------------
def _sync_initial_roster():
    """Ensure baseline chefs exist in Firestore on startup."""
    initial_chefs = [
        {"id": "c1", "name": "Chef Gordon", "isAvailable": True},
        {"id": "c2", "name": "Chef Jamie", "isAvailable": True},
    ]
    for c in initial_chefs:
        db.collection("chefs").document(c["id"]).set(c, merge=True)

def _sync_system_config():
    """Ensure maintenance_mode exists."""
    cfg_ref = db.collection("config").document("kitchen")
    if not cfg_ref.get().exists:
        cfg_ref.set({"maintenance_mode": False})

# ---------------------------------------------------------------------------
# GADK Tools (Staging & Human-in-the-loop Version)
# ---------------------------------------------------------------------------
orchestrator_agent = None 

def is_system_active() -> bool:
    """Returns True if the kitchen is currently accepting orders. If False, the agent must inform the user the kitchen is in maintenance."""
    cfg = db.collection("config").document("kitchen").get().to_dict()
    return not cfg.get("maintenance_mode", False)

def get_available_chefs_v2() -> list[ChefAvailability]:
    """Retrieves all available chefs and calculates their live workloads from Firestore."""
    chefs_ref = db.collection("chefs").where("isAvailable", "==", True).stream()
    results = []
    for doc in chefs_ref:
        c = doc.to_dict()
        tasks = db.collection("tasks").where("assigned_chef_id", "==", c["id"]).where("status", "in", ["PENDING", "COOKING"]).stream()
        load = sum(t.to_dict().get("prep_time_secs", 0) for t in tasks)
        results.append(ChefAvailability(id=c["id"], name=c["name"], current_load_secs=load))
    return results

def assign_task_staged(order_id: str, item_name: str, prep_time_secs: int, chef_id: str, instruction: str) -> AssignmentResult:
    """Saves a 'Draft' assignment to the staging area to prevent partial commit failures."""
    chef = db.collection("chefs").document(chef_id).get()
    if not chef.exists:
        raise ValueError(f"Chef ID {chef_id} does not exist!")

    task_id = f"t{int(time.time()*1000)}_{random.randint(100,999)}"
    staged_data = {
        "id": task_id,
        "order_id": order_id,
        "item_name": item_name,
        "assigned_chef_id": chef_id,
        "agent_instruction": instruction,
        "prep_time_secs": prep_time_secs,
        "status": "STAGED", 
        "created_at": time.time()
    }
    db.collection("staged_tasks").document(task_id).set(staged_data)
    
    return AssignmentResult(task_id=task_id, status="staged", message=f"Task {task_id} staged for atomic commit.")

def commit_staged_tasks(order_id: str) -> str:
    """Moves all STAGED tasks for an order into the live tasks collection. Only call this after all order items are staged."""
    staged_ref = db.collection("staged_tasks").where("order_id", "==", order_id).stream()
    count = 0
    for doc in staged_ref:
        task_data = doc.to_dict()
        task_data["status"] = "PENDING"
        db.collection("tasks").document(task_data["id"]).set(task_data)
        db.collection("staged_tasks").document(task_data["id"]).delete()
        count += 1
    return f"Successfully committed {count} tasks to the live queue for Order {order_id}."

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
    
    # -------------------------------------------------------------------------
    # REAL GADK ARCHITECTURE FOR AGENT ASSIGNMENT
    # -------------------------------------------------------------------------
    prompt = f"New Order ID: {order_id}\nItems to assign:\n"
    for item in resolved_items:
        prompt += f"- {item['name']} (prep time: {item['prep_time_secs']}s)\n"

    if orchestrator_agent:
        print(f"[Atomic Swarm] Handing off Order {order_id}...")
        try:
            await orchestrator_agent.run_async(prompt)
        except Exception as e:
            print(f"[Swarm Error] Distributed workflow failed: {e}. Order {order_id} remains uncommitted.")
            # Fallback (Manual cleanup of staged tasks could happen here)
    else:
        # Fallback if Swarm not ready
        fallback_chef = MOCK_CHEFS[0]["id"] if MOCK_CHEFS else "c1"
        for item in resolved_items:
            assign_task_to_chef(order_id, item["name"], item["prep_time_secs"], fallback_chef, "Manual Routing")

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


@app.post("/api/login")
def login(creds: LoginRequest):
    # Hardcoded credentials for the Kitchen Staff
    if creds.username == "chef" and creds.password == "kitchen123":
        expire = datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        token = jwt.encode({"sub": creds.username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": token}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@app.get("/api/kds")
def get_kds_data(user: str = Depends(verify_token)):
    return {
        "chefs": MOCK_CHEFS,
        "tasks": [t for t in MOCK_TASKS if t["status"] != "DONE"]
    }

@app.post("/api/chefs")
def add_chef(payload: ChefInput, user: str = Depends(verify_token)):
    new_chef = {"id": f"c{int(time.time()*1000)}", "name": payload.name, "isAvailable": True}
    MOCK_CHEFS.append(new_chef)
    return new_chef

@app.delete("/api/chefs/{chef_id}")
async def remove_chef(chef_id: str, user: str = Depends(verify_token)):
    # 1. Remove the chef
    for chef in MOCK_CHEFS:
        if chef["id"] == chef_id:
            MOCK_CHEFS.remove(chef)
            break
            
    # 2. Extract tasks that belonged to this chef that are not done
    orphaned_tasks = []
    global MOCK_TASKS
    filtered_tasks = []
    for task in MOCK_TASKS:
        if task["assigned_chef_id"] == chef_id and task["status"] != "DONE":
            orphaned_tasks.append(task)
        else:
            filtered_tasks.append(task)
    
    MOCK_TASKS[:] = filtered_tasks  # clear them out for re-assignment
    
    reassigned_count = len(orphaned_tasks)
    
    if reassigned_count > 0 and kitchen_manager_agent:
        # Prompt the GADK LLM Agent to act as the re-assignment router!
        prompt = f"Chef {chef_id} just logged out. The following items lost their chef and need IMMEDIATE reassignment to active chefs:\n"
        for tk in orphaned_tasks:
            prompt += f"- {tk['item_name']} (from order {tk['order_id']}, prep time {tk['prep_time_secs']}s)\n"
            
        print("[Agent Orchestration] Dispatching Chef Walk-out Recovery to KitchenManagerAgent...")
        try:
            await kitchen_manager_agent.run_async(prompt)
        except Exception as e:
            print(f"[Agent Error] Reassignment failed: {e}. Falling back to default assignment.")
            fallback_chef = MOCK_CHEFS[0]["id"] if MOCK_CHEFS else "c1"
            for tk in orphaned_tasks:
                assign_task_to_chef(tk["order_id"], tk["item_name"], tk["prep_time_secs"], fallback_chef, "API Error Fallback")
    else:
        # Fallback if Agent wasn't initialized
        fallback_chef = MOCK_CHEFS[0]["id"] if MOCK_CHEFS else "c1"
        for tk in orphaned_tasks:
            assign_task_to_chef(tk["order_id"], tk["item_name"], tk["prep_time_secs"], fallback_chef, "Manual fallback")

    return {"status": "success", "reassigned_tasks": reassigned_count}

@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: str, user: str = Depends(verify_token)):
    for t in MOCK_TASKS:
        if t["id"] == task_id:
            t["status"] = "DONE"
            return {"status": "success"}
    return {"status": "error", "message": "Task not found"}




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
    # Cloud Run provides a PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
