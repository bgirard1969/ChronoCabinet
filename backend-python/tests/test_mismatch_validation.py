"""
Test suite for Mismatch Validation feature in Light Picking
Tests the scenario where a scanned product doesn't match the intervention requirements.

Features tested:
- POST /api/interventions/{id}/pick returns mismatch warning when product doesn't match
- POST /api/interventions/{id}/pick returns picked:true when product matches
- POST /api/interventions/{id}/pick with force=true ignores mismatch and proceeds
- Validation works for partial products (category_id only) and complete products (product_id)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "benoit.girard@atmshealth.com"
ADMIN_PASSWORD = "Salut123"

# Category IDs from context
# For mismatch testing: require Lentille biconvexe but scan Lentille monofocal
BICONVEX_CATEGORY_ID = "d6057cb9-c781-4ed9-bb7a-b50495431afd"  # Lentille biconvexe (required, no stock)
MONOFOCAL_CATEGORY_ID = "3f8298c5-828e-4a2c-9c98-70fdc2d60c79"  # Lentille monofocal (has stock, will be scanned)


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture
def test_intervention(api_client):
    """Create a test intervention with a partial product (category_id only)"""
    # Create intervention requiring Lentille biconvexe (category only)
    planned_datetime = (datetime.now() + timedelta(hours=1)).isoformat()
    response = api_client.post(f"{BASE_URL}/api/interventions", json={
        "planned_datetime": planned_datetime,
        "operating_room": "MISMATCH-TEST",
        "surgeon": "Dr. Test Mismatch",
        "patient_file_number": "MISMATCH-001",
        "products": [
            {
                "category_id": BICONVEX_CATEGORY_ID,  # Lentille biconvexe
                "required_quantity": 1
            }
        ]
    })
    assert response.status_code == 200, f"Failed to create intervention: {response.text}"
    intervention = response.json()
    
    yield intervention
    
    # Cleanup: delete the intervention
    api_client.delete(f"{BASE_URL}/api/interventions/{intervention['id']}")


@pytest.fixture
def mismatched_instance(api_client):
    """Find an available instance from Lentille monofocal category (mismatched when biconvexe is required)"""
    response = api_client.get(f"{BASE_URL}/api/instances/available-stock", params={
        "category_id": MONOFOCAL_CATEGORY_ID
    })
    assert response.status_code == 200, f"Failed to get stock: {response.text}"
    data = response.json()
    results = data.get("results", [])
    
    # Find first product with available instances
    for product in results:
        instances = product.get("instances", [])
        if instances:
            return {
                "instance": instances[0],
                "product_id": product.get("product_id"),
                "description": product.get("description")
            }
    
    pytest.skip("No available instances in Lentille monofocal category for mismatch testing")


@pytest.fixture
def matching_instance(api_client):
    """Find an available instance from Lentille monofocal category (for matching test with monofocal requirement)"""
    response = api_client.get(f"{BASE_URL}/api/instances/available-stock", params={
        "category_id": MONOFOCAL_CATEGORY_ID
    })
    assert response.status_code == 200, f"Failed to get stock: {response.text}"
    data = response.json()
    results = data.get("results", [])
    
    # Find first product with available instances
    for product in results:
        instances = product.get("instances", [])
        if instances:
            return {
                "instance": instances[0],
                "product_id": product.get("product_id"),
                "description": product.get("description"),
                "category_id": product.get("category_id")
            }
    
    pytest.skip("No available instances in Lentille monofocal category for matching test")


class TestMismatchValidation:
    """Tests for mismatch validation in pick endpoint"""
    
    def test_pick_mismatched_product_returns_mismatch_warning(self, api_client, test_intervention, mismatched_instance):
        """
        When scanning a product that doesn't match the intervention requirement,
        the API should return mismatch=true with a warning message.
        """
        intervention_id = test_intervention["id"]
        instance = mismatched_instance["instance"]
        
        # Try to pick the mismatched instance
        response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/pick", json={
            "product_id": mismatched_instance["product_id"],
            "instance_id": instance["id"]
        })
        
        assert response.status_code == 200, f"Pick request failed: {response.text}"
        data = response.json()
        
        # Should return mismatch warning
        assert data.get("mismatch") == True, f"Expected mismatch=true, got: {data}"
        assert "message" in data, f"Expected message in response, got: {data}"
        assert "scanned_description" in data, f"Expected scanned_description in response, got: {data}"
        assert "expected_label" in data, f"Expected expected_label in response, got: {data}"
        
        # Message should mention the mismatch
        assert "ne correspond pas" in data["message"].lower() or "mismatch" in data["message"].lower(), \
            f"Message should indicate mismatch: {data['message']}"
        
        print(f"✓ Mismatch warning returned: {data['message']}")
        print(f"  Scanned: {data['scanned_description']}")
        print(f"  Expected: {data['expected_label']}")
    
    def test_pick_matching_product_returns_picked_true(self, api_client, matching_instance):
        """
        When scanning a product that matches the intervention requirement,
        the API should return picked=true and process the pick.
        """
        # Create a separate intervention that requires the matching category
        planned_datetime = (datetime.now() + timedelta(hours=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": planned_datetime,
            "operating_room": "MATCH-TEST",
            "surgeon": "Dr. Match Test",
            "patient_file_number": "MATCH-001",
            "products": [
                {
                    "category_id": matching_instance["category_id"],  # Same category as the instance
                    "required_quantity": 1
                }
            ]
        })
        assert create_response.status_code == 200, f"Failed to create intervention: {create_response.text}"
        intervention = create_response.json()
        intervention_id = intervention["id"]
        
        instance = matching_instance["instance"]
        original_instance_id = instance["id"]
        
        try:
            # Pick the matching instance
            response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/pick", json={
                "product_id": matching_instance["product_id"],
                "instance_id": instance["id"]
            })
            
            assert response.status_code == 200, f"Pick request failed: {response.text}"
            data = response.json()
            
            # Should return picked=true (not mismatch)
            assert data.get("picked") == True, f"Expected picked=true, got: {data}"
            assert data.get("mismatch") != True, f"Should not have mismatch for matching product: {data}"
            assert "instance_id" in data, f"Expected instance_id in response, got: {data}"
            
            print(f"✓ Matching product picked successfully")
            print(f"  Instance ID: {data.get('instance_id')}")
            print(f"  Serial: {data.get('serial_number')}")
            
            # Cleanup: restore instance status
            api_client.put(f"{BASE_URL}/api/instances/{original_instance_id}", json={
                "status": "placed"
            })
        finally:
            # Cleanup: delete the test intervention
            api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_pick_with_force_ignores_mismatch(self, api_client, test_intervention, mismatched_instance):
        """
        When force=true is passed, the API should ignore the mismatch
        and proceed with the pick.
        """
        intervention_id = test_intervention["id"]
        instance = mismatched_instance["instance"]
        original_instance_id = instance["id"]
        
        # First verify it would be a mismatch without force
        response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/pick", json={
            "product_id": mismatched_instance["product_id"],
            "instance_id": instance["id"]
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # If it's already picked (from previous test), skip
        if data.get("picked") == True:
            print("Instance already picked, skipping force test")
            return
        
        assert data.get("mismatch") == True, f"Expected mismatch without force: {data}"
        
        # Now try with force=true
        response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/pick", json={
            "product_id": mismatched_instance["product_id"],
            "instance_id": instance["id"],
            "force": True
        })
        
        assert response.status_code == 200, f"Force pick failed: {response.text}"
        data = response.json()
        
        # Should return picked=true despite mismatch
        assert data.get("picked") == True, f"Expected picked=true with force, got: {data}"
        assert data.get("mismatch") != True, f"Should not have mismatch with force=true: {data}"
        
        print(f"✓ Force pick succeeded despite mismatch")
        print(f"  Instance ID: {data.get('instance_id')}")
        
        # Cleanup: restore instance status
        api_client.put(f"{BASE_URL}/api/instances/{original_instance_id}", json={
            "status": "placed"
        })


class TestMismatchValidationWithFullProduct:
    """Tests for mismatch validation with full product_id requirements"""
    
    def test_mismatch_with_different_product_id(self, api_client, matching_instance):
        """
        When intervention requires specific product_id and we scan a different product,
        should return mismatch warning.
        """
        # Get a second different product from the same category
        response = api_client.get(f"{BASE_URL}/api/instances/available-stock", params={
            "category_id": MONOFOCAL_CATEGORY_ID
        })
        assert response.status_code == 200
        results = response.json().get("results", [])
        
        # Find a different product than matching_instance
        different_product = None
        different_instance = None
        for product in results:
            if product.get("product_id") != matching_instance["product_id"]:
                instances = product.get("instances", [])
                if instances:
                    different_product = product
                    different_instance = instances[0]
                    break
        
        if not different_product:
            pytest.skip("No different product available for mismatch test")
        
        # Create intervention requiring the matching_instance's specific product
        planned_datetime = (datetime.now() + timedelta(hours=2)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": planned_datetime,
            "operating_room": "FULL-PRODUCT-TEST",
            "surgeon": "Dr. Full Product",
            "patient_file_number": "FULL-001",
            "products": [
                {
                    "product_id": matching_instance["product_id"],
                    "required_quantity": 1
                }
            ]
        })
        assert create_response.status_code == 200, f"Failed to create intervention: {create_response.text}"
        intervention = create_response.json()
        intervention_id = intervention["id"]
        
        try:
            # Try to pick the different product
            response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/pick", json={
                "product_id": different_product["product_id"],
                "instance_id": different_instance["id"]
            })
            
            assert response.status_code == 200, f"Pick request failed: {response.text}"
            data = response.json()
            
            # Should return mismatch since product_id doesn't match
            assert data.get("mismatch") == True, f"Expected mismatch for different product_id: {data}"
            
            print(f"✓ Mismatch detected for different product_id")
            print(f"  Required: {matching_instance['product_id']}")
            print(f"  Scanned: {different_product['product_id']}")
        finally:
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


class TestEdgeCases:
    """Edge case tests for mismatch validation"""
    
    def test_pick_unavailable_instance_returns_error(self, api_client, test_intervention):
        """Trying to pick a non-existent or unavailable instance should return error"""
        intervention_id = test_intervention["id"]
        
        response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/pick", json={
            "product_id": "non-existent-product",
            "instance_id": "non-existent-instance"
        })
        
        # Should return 400 error
        assert response.status_code == 400, f"Expected 400 for unavailable instance, got: {response.status_code}"
        
        print("✓ Unavailable instance returns 400 error")
    
    def test_pick_for_nonexistent_intervention_returns_404(self, api_client):
        """Trying to pick for non-existent intervention should return 404"""
        response = api_client.post(f"{BASE_URL}/api/interventions/non-existent-id/pick", json={
            "product_id": "any-product",
            "instance_id": "any-instance"
        })
        
        assert response.status_code == 404, f"Expected 404 for non-existent intervention, got: {response.status_code}"
        
        print("✓ Non-existent intervention returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
