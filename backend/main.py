from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

app = FastAPI(title="Concession Manager Agents")

# Allow all origins for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mocked state for the demonstration
class OrderRequest(BaseModel):
    user_phone: str
    items: list[str]

class OrderResponse(BaseModel):
    order_id: str
    otp: str
    wait_time_mins: int

MOCK_ORDERS = []
MOCK_QUEUE = []

@app.get("/")
def read_root():
    return {"status": "Agents are listening..."}

@app.post("/api/order", response_model=OrderResponse)
async def create_order(order: OrderRequest):
    # This simulates the Ordering Agent processing the order.
    # In a full Agent Development Kit setup, this endpoint would invoke the A2A protocol.
    
    order_id = f"ORDER-{len(MOCK_ORDERS) + 100}"
    # Mock OTP
    otp = "123456" 
    
    order_data = {
        "order_id": order_id,
        "phone": order.user_phone,
        "items": order.items,
        "status": "pending_kitchen",
        "otp": otp
    }
    MOCK_ORDERS.append(order_data)
    MOCK_QUEUE.append(order_data)
    print(f"[Ordering Agent] Received order {order_id} from {order.user_phone}. OTP generated (mocked): {otp}")
    
    # Trigger Kitchen Agent (simulated delay for agent routing)
    asyncio.create_task(trigger_kitchen_optimization_agent())
    
    # Calculate estimated wait_time (Optimization agent would normally calculate this)
    estimated_wait = len(MOCK_QUEUE) * 2 + 5
    
    return OrderResponse(order_id=order_id, otp=otp, wait_time_mins=estimated_wait)

@app.get("/api/kitchen-queue")
def get_queue():
    # Big screen dashboard data
    return {"queue": [q["order_id"] for q in MOCK_QUEUE]}

@app.post("/api/kiosk-pickup/{order_id}")
def pickup_order(order_id: str):
    # Kiosk scanner clears it out of the queue
    for q in MOCK_QUEUE:
        if q["order_id"] == order_id:
            MOCK_QUEUE.remove(q)
            return {"status": "success", "message": f"{order_id} collected!"}
    return {"status": "error", "message": "Order not found in queue"}

async def trigger_kitchen_optimization_agent():
    """ Simulating the internal A2A handshake between Ordering Agent and Kitchen Agent """
    await asyncio.sleep(1)
    print(f"[Kitchen Admin Agent] Queue optimized. Active tickets: {len(MOCK_QUEUE)}")
    
    # Set a background timer for the notification agent
    asyncio.create_task(trigger_notification_agent())

async def trigger_notification_agent():
    """ Simulates measuring time in kitchen, and sending an alert 5 mins out """
    # Let's pretend prep time is complete after 10 seconds for testing
    await asyncio.sleep(10)
    print(f"[Notification Agent] Dispatching 5-minute Mock SMS warning!")

@app.post("/api/vision-checkout")
async def vision_checkout_simulation():
    # In a live environment, an image payload is passed here and Gemini 1.5 Pro Vision returns detected items
    import random
    items_detected = ["Hot Dog", "Soda Can"]
    total = sum([5.00 for i in items_detected])
    return {
        "status": "success",
        "items": items_detected,
        "charged": f"${total}0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
