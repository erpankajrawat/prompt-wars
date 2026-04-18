import unittest
from fastapi.testclient import TestClient
import sys
import os
import time

# Ensure we can import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import app, MOCK_CHEFS, MOCK_TASKS, commit_staged_tasks, assign_task_staged

class TestKDSPersistence(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Setup dummy chef if needed
        if not any(c["id"] == "c1" for c in MOCK_CHEFS):
            MOCK_CHEFS.append({"id": "c1", "name": "Chef Gordon", "isAvailable": True})

    def test_task_assignment_visibility(self):
        """
        FAILING TEST: Verify that tasks assigned via agents are immediately 
        visible in the KDS data without needing a server restart.
        """
        order_id = f"TEST-{int(time.time())}"
        
        # 1. Simulate Agent tool calls (Staging + Commit)
        assign_task_staged(order_id, "Fries", 10, "c1", "Cook fries crispy")
        commit_staged_tasks(order_id)
        
        # 2. Check if the task is visible in the API response
        response = self.client.get("/api/kds")
        data = response.json()
        
        tasks = data.get("tasks", [])
        self.assertTrue(
            any(t["order_id"] == order_id for t in tasks), 
            f"Order {order_id} should be visible in KDS tasks immediately after commit"
        )

if __name__ == '__main__':
    unittest.main()
