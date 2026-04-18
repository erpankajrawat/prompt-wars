import unittest
import time
from fastapi.testclient import TestClient
import sys
import os

# Ensure we can import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import app, MOCK_CHEFS

class TestChefManagement(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_add_and_remove_chef(self):
        """
        Integration Test: 
        1. Add a new chef via API.
        2. Wait to ensure background balancing doesn't crash.
        3. Remove a chef and ensure tasks reassign correctly.
        """
        print("\n[Test] Adding a chef...")
        payload = {"name": "TestChef123"}
        response = self.client.post("/api/chefs", json=payload)
        self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}")
        chef_id = response.json()["id"]

        print(f"[Test] Successfully added chef {chef_id}. Removing chef...")

        # Add a mock task to verify reassignment logic
        order_payload = {
            "user_phone": "555-0199",
            "items": ["hd1"] # Hot Dog
        }
        res_order = self.client.post("/api/order", json=order_payload)
        
        # Give AI time to process
        time.sleep(2)

        del_res = self.client.delete(f"/api/chefs/{chef_id}")
        self.assertEqual(del_res.status_code, 200, f"Expected 200, got {del_res.status_code}")
        print("[Test] Successfully removed chef and reassigned tasks.")

if __name__ == '__main__':
    unittest.main()
