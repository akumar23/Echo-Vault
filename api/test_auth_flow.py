#!/usr/bin/env python3
"""
Test script to verify authentication flow
Run this to test if JWT authentication is working correctly
"""
import requests
import sys

API_URL = "http://localhost:8000"

def test_auth_flow():
    print("=" * 60)
    print("Testing EchoVault Authentication Flow")
    print("=" * 60)

    # Step 1: Health check
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{API_URL}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ERROR: {e}")
        return False

    # Step 2: Use test user
    print("\n2. Using test user...")
    test_email = "dev@test.com"
    test_username = "devuser"
    test_password = "password123"

    try:
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": test_email,
                "username": test_username,
                "password": test_password
            }
        )
        if response.status_code == 201:
            print(f"   Status: {response.status_code} - User registered successfully")
            print(f"   User: {response.json()}")
        elif response.status_code == 400:
            print(f"   Status: {response.status_code} - User already exists (expected)")
        else:
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ERROR: {e}")

    # Step 3: Login
    print("\n3. Logging in...")
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={
                "email": test_email,
                "password": test_password
            }
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"   Token received: {token[:50]}...")
            print(f"   Token type: {data.get('token_type')}")
        else:
            print(f"   Response: {response.json()}")
            return False
    except Exception as e:
        print(f"   ERROR: {e}")
        return False

    # Step 4: Test authenticated endpoint WITHOUT token
    print("\n4. Testing POST /entries WITHOUT token (should fail)...")
    try:
        response = requests.post(
            f"{API_URL}/entries",
            json={
                "title": "Test Entry",
                "content": "This is a test entry",
                "tags": ["test"]
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        if response.status_code in [401, 403]:
            print("   ✓ Correctly rejected unauthenticated request")
        else:
            print("   ✗ Should have been rejected!")
    except Exception as e:
        print(f"   ERROR: {e}")

    # Step 5: Test authenticated endpoint WITH token
    print("\n5. Testing POST /entries WITH token (should succeed)...")
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{API_URL}/entries",
            json={
                "title": "Test Entry",
                "content": "This is a test entry with authentication",
                "tags": ["test", "auth"]
            },
            headers=headers
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 201:
            print(f"   ✓ Entry created successfully!")
            print(f"   Entry ID: {response.json().get('id')}")
        else:
            print(f"   Response: {response.json()}")
            return False
    except Exception as e:
        print(f"   ERROR: {e}")
        return False

    # Step 6: Test GET /auth/me
    print("\n6. Testing GET /auth/me WITH token...")
    try:
        headers = {
            "Authorization": f"Bearer {token}",
        }
        response = requests.get(
            f"{API_URL}/auth/me",
            headers=headers
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            user = response.json()
            print(f"   ✓ User info retrieved!")
            print(f"   Email: {user.get('email')}")
            print(f"   Username: {user.get('username')}")
        else:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ERROR: {e}")

    print("\n" + "=" * 60)
    print("Authentication flow test completed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_auth_flow()
    sys.exit(0 if success else 1)
