import unittest
import time
from fastapi.testclient import TestClient
import sys
import os

# Ensure we can import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import app, MOCK_CHEFS

class TestAgentIntegration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Ensure at least one chef is available for the Agent to find
        if not any(c["id"] == "c1" for c in MOCK_CHEFS):
            MOCK_CHEFS.append({"id": "c1", "name": "Chef Gordon", "isAvailable": True})

    def test_end_to_end_order_assignment(self):
        """
        Integration Test: 
        1. Create an order via API.
        2. Wait for the Native Agent Orchestrator to reason and assign.
        3. Verify the task appears in the KDS dashboard.
        """
        # Place an order for something that requires cooking
        # Burger (hd1 equivalent)
        order_payload = {
            "user_phone": "555-0199",
            "items": ["hd1", "nb1"]
        }
        
        print("\n[Test] Placing order and triggering AI Orchestrator...")
        response = self.client.post("/api/order", json=order_payload)
        self.assertEqual(response.status_code, 200)
        order_id = response.json()["order_id"]
        
        # Give the AI a few seconds to think and call the tools (commit_staged_tasks)
        # In the real app, this happens in-flight during the request.
        print(f"[Test] Order {order_id} placed. Verifying Agent commitment...")
        
        # Since our simplified Orchestrator in main.py is currently synchronous 
        # (send_message is blocking in the current implementation), the commit 
        # should have happened before the response returned.
        
        kds_response = self.client.get("/api/kds")
        tasks = kds_response.json().get("tasks", [])
        
        found = any(t["order_id"] == order_id for t in tasks)
        self.assertTrue(found, f"Order {order_id} was NOT assigned/committed to a chef by the AI.")
        print(f"[Test] Success! Agent successfully assigned {order_id} to a chef.")

if __name__ == '__main__':
    unittest.main()
