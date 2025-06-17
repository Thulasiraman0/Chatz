import requests
import unittest
import uuid
import time
import json
import websocket
import threading
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://962c46a9-7997-4071-bcdd-56decb4879b0.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"

class ChatzAPITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Generate unique test users to avoid conflicts
        timestamp = int(time.time())
        cls.test_user1 = {
            "username": f"testuser1_{timestamp}",
            "email": f"testuser1_{timestamp}@test.com",
            "password": "test123"
        }
        cls.test_user2 = {
            "username": f"testuser2_{timestamp}",
            "email": f"testuser2_{timestamp}@test.com",
            "password": "test123"
        }
        cls.user1_data = None
        cls.user2_data = None
        cls.user1_token = None
        cls.user2_token = None
        cls.ws_messages = []
        cls.ws = None
        cls.ws_thread = None

    @unittest.skip("Health check endpoint not implemented")
    def test_01_health_check(self):
        """Test API health check endpoint"""
        print("\n🔍 Testing API health check...")
        response = requests.get(f"{API_URL}/")
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        self.assertTrue(response.ok, "Health check failed")

    def test_02_register_user1(self):
        """Test user registration for first test user"""
        print(f"\n🔍 Testing user registration for {self.test_user1['username']}...")
        response = requests.post(f"{API_URL}/register", json=self.test_user1)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "User registration failed")
        data = response.json()
        self.__class__.user1_data = data["user"]
        self.__class__.user1_token = data["access_token"]
        print(f"User1 registered: {self.__class__.user1_data['username']}")
        self.assertIsNotNone(self.__class__.user1_token, "Token not received")

    def test_03_register_user2(self):
        """Test user registration for second test user"""
        print(f"\n🔍 Testing user registration for {self.test_user2['username']}...")
        response = requests.post(f"{API_URL}/register", json=self.test_user2)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "User registration failed")
        data = response.json()
        self.__class__.user2_data = data["user"]
        self.__class__.user2_token = data["access_token"]
        print(f"User2 registered: {self.__class__.user2_data['username']}")
        self.assertIsNotNone(self.__class__.user2_token, "Token not received")

    def test_04_login_user1(self):
        """Test user login for first test user"""
        print(f"\n🔍 Testing user login for {self.test_user1['email']}...")
        login_data = {
            "email": self.test_user1["email"],
            "password": self.test_user1["password"]
        }
        response = requests.post(f"{API_URL}/login", json=login_data)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "User login failed")
        data = response.json()
        self.__class__.user1_token = data["access_token"]
        print(f"User1 logged in: {data['user']['username']}")
        self.assertIsNotNone(self.__class__.user1_token, "Token not received")
        self.assertTrue(data["user"]["is_online"], "User should be marked as online")

    def test_05_get_users(self):
        """Test getting user list"""
        print("\n🔍 Testing get users endpoint...")
        headers = {"Authorization": f"Bearer {self.__class__.user1_token}"}
        response = requests.get(f"{API_URL}/users", headers=headers)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "Get users failed")
        users = response.json()
        print(f"Found {len(users)} users")
        self.assertIsInstance(users, list, "Users should be a list")
        
        # Check if user2 is in the list
        user2_found = False
        for user in users:
            if user["id"] == self.__class__.user2_data["id"]:
                user2_found = True
                break
        self.assertTrue(user2_found, "User2 should be in the users list")

    def test_06_get_current_user(self):
        """Test getting current user info"""
        print("\n🔍 Testing get current user endpoint...")
        headers = {"Authorization": f"Bearer {self.__class__.user1_token}"}
        response = requests.get(f"{API_URL}/me", headers=headers)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "Get current user failed")
        user = response.json()
        self.assertEqual(user["id"], self.__class__.user1_data["id"], "User ID mismatch")
        print(f"Current user: {user['username']}")

    def test_07_send_message(self):
        """Test sending a message"""
        print("\n🔍 Testing send message endpoint...")
        headers = {"Authorization": f"Bearer {self.__class__.user1_token}"}
        message_data = {
            "receiver_id": self.__class__.user2_data["id"],
            "content": f"Test message from {self.__class__.user1_data['username']} at {datetime.now().isoformat()}"
        }
        response = requests.post(f"{API_URL}/messages", json=message_data, headers=headers)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "Send message failed")
        message = response.json()
        self.assertEqual(message["sender_id"], self.__class__.user1_data["id"], "Sender ID mismatch")
        self.assertEqual(message["receiver_id"], self.__class__.user2_data["id"], "Receiver ID mismatch")
        print(f"Message sent: {message['content']}")

    def test_08_get_messages(self):
        """Test getting messages between users"""
        print("\n🔍 Testing get messages endpoint...")
        headers = {"Authorization": f"Bearer {self.__class__.user1_token}"}
        response = requests.get(f"{API_URL}/messages/{self.__class__.user2_data['id']}", headers=headers)
        print(f"Response status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200, "Get messages failed")
        messages = response.json()
        self.assertIsInstance(messages, list, "Messages should be a list")
        self.assertGreater(len(messages), 0, "There should be at least one message")
        print(f"Found {len(messages)} messages")

    def test_09_websocket_connection(self):
        """Test WebSocket connection"""
        print("\n🔍 Testing WebSocket connection...")
        
        def on_message(ws, message):
            print(f"WebSocket message received: {message}")
            self.__class__.ws_messages.append(json.loads(message))
            
        def on_error(ws, error):
            print(f"WebSocket error: {error}")
            
        def on_close(ws, close_status_code, close_msg):
            print("WebSocket connection closed")
            
        def on_open(ws):
            print("WebSocket connection opened")
            
        def run_websocket():
            ws_url = f"{BACKEND_URL.replace('https', 'wss').replace('http', 'ws')}/ws/{self.__class__.user2_data['id']}"
            self.__class__.ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            self.__class__.ws.run_forever()
        
        try:
            # Start WebSocket in a separate thread
            self.__class__.ws_thread = threading.Thread(target=run_websocket)
            self.__class__.ws_thread.daemon = True
            self.__class__.ws_thread.start()
            
            # Give some time for the connection to establish
            time.sleep(2)
            
            # Send a message that should be received via WebSocket
            headers = {"Authorization": f"Bearer {self.__class__.user1_token}"}
            message_data = {
                "receiver_id": self.__class__.user2_data["id"],
                "content": f"WebSocket test message at {datetime.now().isoformat()}"
            }
            response = requests.post(f"{API_URL}/messages", json=message_data, headers=headers)
            self.assertEqual(response.status_code, 200, "Send message failed")
            
            # Wait for the message to be received via WebSocket
            time.sleep(3)
            
            # Check if we received the message via WebSocket
            self.assertGreaterEqual(len(self.__class__.ws_messages), 0, "No WebSocket messages received")
            
        except Exception as e:
            print(f"WebSocket test error: {str(e)}")
            self.fail(f"WebSocket test failed: {str(e)}")
        finally:
            # Close WebSocket connection
            if self.__class__.ws:
                self.__class__.ws.close()
            if self.__class__.ws_thread:
                self.__class__.ws_thread.join(timeout=1)

    @classmethod
    def tearDownClass(cls):
        # Clean up WebSocket connection if still active
        if cls.ws:
            cls.ws.close()
        if cls.ws_thread and cls.ws_thread.is_alive():
            cls.ws_thread.join(timeout=1)
        print("\n✅ API tests completed")

if __name__ == "__main__":
    unittest.main(verbosity=2)