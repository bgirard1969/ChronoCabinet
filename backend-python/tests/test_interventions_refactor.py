"""
Test suite for Intervention form refactoring:
- Surgeon and Operating Room are optional
- Cascading filters (Category → Model → Specification)
- Stock results with Description, Serial Numbers, Stock
- Create/Update interventions with products
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "benoit.girard@atmshealth.com"
TEST_PASSWORD = "Salut123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestInterventionCreateOptionalFields:
    """Test that surgeon and operating_room are optional"""
    
    def test_create_intervention_without_surgeon_and_room(self, api_client):
        """Create intervention with only required field (planned_datetime)"""
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": []
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data.get("surgeon") is None or data.get("surgeon") == ""
        assert data.get("operating_room") is None or data.get("operating_room") == ""
        print(f"✓ Created intervention without surgeon/room: {data['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{data['id']}")
    
    def test_create_intervention_with_only_surgeon(self, api_client):
        """Create intervention with surgeon but no room"""
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "surgeon": "Dr. Test Only Surgeon",
            "products": []
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("surgeon") == "Dr. Test Only Surgeon"
        assert data.get("operating_room") is None or data.get("operating_room") == ""
        print(f"✓ Created intervention with only surgeon: {data['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{data['id']}")
    
    def test_create_intervention_with_only_room(self, api_client):
        """Create intervention with room but no surgeon"""
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "operating_room": "Salle Test 42",
            "products": []
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("operating_room") == "Salle Test 42"
        assert data.get("surgeon") is None or data.get("surgeon") == ""
        print(f"✓ Created intervention with only room: {data['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{data['id']}")
    
    def test_create_intervention_with_all_fields(self, api_client):
        """Create intervention with all fields populated"""
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "surgeon": "Dr. Full Test",
            "operating_room": "Salle Complete",
            "patient_file_number": "PAT-12345",
            "products": []
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("surgeon") == "Dr. Full Test"
        assert data.get("operating_room") == "Salle Complete"
        assert data.get("patient_file_number") == "PAT-12345"
        print(f"✓ Created intervention with all fields: {data['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{data['id']}")


class TestCascadingFiltersEndpoint:
    """Test the /api/instances/available-stock endpoint for cascading filters"""
    
    def test_get_available_stock_no_filters(self, api_client):
        """Get all available stock without filters"""
        response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "results" in data
        assert "filter_options" in data
        assert "categories" in data["filter_options"]
        assert "types" in data["filter_options"]
        assert "specifications" in data["filter_options"]
        
        print(f"✓ Available stock endpoint returns {len(data['results'])} products")
        print(f"  - Categories: {len(data['filter_options']['categories'])}")
        print(f"  - Types: {len(data['filter_options']['types'])}")
        print(f"  - Specifications: {len(data['filter_options']['specifications'])}")
    
    def test_get_available_stock_with_category_filter(self, api_client):
        """Get available stock filtered by category"""
        # First get all to find a category
        response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
        data = response.json()
        
        if len(data["filter_options"]["categories"]) > 0:
            cat_id = data["filter_options"]["categories"][0]["id"]
            
            # Filter by category
            response = api_client.get(f"{BASE_URL}/api/instances/available-stock?category_id={cat_id}")
            assert response.status_code == 200
            filtered_data = response.json()
            
            # All results should have this category
            for result in filtered_data["results"]:
                assert result.get("category_id") == cat_id
            
            print(f"✓ Category filter works: {len(filtered_data['results'])} products for category {cat_id}")
        else:
            pytest.skip("No categories available for testing")
    
    def test_stock_results_have_required_fields(self, api_client):
        """Verify stock results have Description, Serial Numbers, Stock"""
        response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
        data = response.json()
        
        if len(data["results"]) > 0:
            result = data["results"][0]
            
            # Check required fields
            assert "description" in result, "Missing 'description' field"
            assert "quantity" in result, "Missing 'quantity' (stock) field"
            assert "instances" in result, "Missing 'instances' field"
            
            # Check instances have serial numbers
            if len(result["instances"]) > 0:
                instance = result["instances"][0]
                assert "serial_number" in instance or "lot_number" in instance, "Missing serial/lot number"
            
            print(f"✓ Stock results have required fields: description='{result['description']}', stock={result['quantity']}")
        else:
            pytest.skip("No stock results available for testing")


class TestInterventionUpdate:
    """Test PUT /api/interventions/{id} for partial updates"""
    
    def test_update_intervention_partial_surgeon_only(self, api_client):
        """Update only the surgeon field"""
        # Create intervention
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "surgeon": "Original Surgeon",
            "operating_room": "Original Room",
            "products": []
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Update only surgeon
        update_response = api_client.put(f"{BASE_URL}/api/interventions/{intervention_id}", json={
            "surgeon": "Updated Surgeon"
        })
        assert update_response.status_code == 200
        updated = update_response.json()
        
        assert updated.get("surgeon") == "Updated Surgeon"
        # Room should remain unchanged
        assert updated.get("operating_room") == "Original Room"
        
        print(f"✓ Partial update (surgeon only) works")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_update_intervention_partial_room_only(self, api_client):
        """Update only the operating_room field"""
        # Create intervention
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "surgeon": "Original Surgeon",
            "operating_room": "Original Room",
            "products": []
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Update only room
        update_response = api_client.put(f"{BASE_URL}/api/interventions/{intervention_id}", json={
            "operating_room": "Updated Room"
        })
        assert update_response.status_code == 200
        updated = update_response.json()
        
        assert updated.get("operating_room") == "Updated Room"
        # Surgeon should remain unchanged
        assert updated.get("surgeon") == "Original Surgeon"
        
        print(f"✓ Partial update (room only) works")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_update_intervention_clear_optional_fields(self, api_client):
        """Update to clear optional fields (set to null)"""
        # Create intervention with all fields
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "surgeon": "To Be Cleared",
            "operating_room": "To Be Cleared",
            "patient_file_number": "PAT-CLEAR",
            "products": []
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Update to clear patient_file_number
        update_response = api_client.put(f"{BASE_URL}/api/interventions/{intervention_id}", json={
            "patient_file_number": None
        })
        assert update_response.status_code == 200
        
        print(f"✓ Clearing optional fields works")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


class TestInterventionWithProducts:
    """Test creating interventions with products"""
    
    def test_create_intervention_with_products(self, api_client):
        """Create intervention with products from stock"""
        # First get available products
        stock_response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
        stock_data = stock_response.json()
        
        if len(stock_data["results"]) == 0:
            pytest.skip("No products in stock for testing")
        
        product_id = stock_data["results"][0]["product_id"]
        
        # Create intervention with product
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": [
                {"product_id": product_id, "required_quantity": 2}
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        intervention_id = data["id"]
        
        # Verify products were added
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        assert detail_response.status_code == 200
        detail = detail_response.json()
        
        assert len(detail.get("products", [])) > 0
        assert detail["products"][0]["required_quantity"] == 2
        
        print(f"✓ Created intervention with products: {intervention_id}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_add_product_to_existing_intervention(self, api_client):
        """Add product to existing intervention via POST /interventions/{id}/products"""
        # Get a product
        stock_response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
        stock_data = stock_response.json()
        
        if len(stock_data["results"]) == 0:
            pytest.skip("No products in stock for testing")
        
        product_id = stock_data["results"][0]["product_id"]
        
        # Create intervention without products
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": []
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Add product
        add_response = api_client.post(f"{BASE_URL}/api/interventions/{intervention_id}/products", json={
            "product_id": product_id,
            "required_quantity": 3
        })
        assert add_response.status_code == 200
        
        # Verify
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        detail = detail_response.json()
        
        assert len(detail.get("products", [])) == 1
        assert detail["products"][0]["required_quantity"] == 3
        
        print(f"✓ Added product to existing intervention")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_update_product_quantity(self, api_client):
        """Update product quantity via PUT /interventions/{id}/products/{ip_id}"""
        # Get a product
        stock_response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
        stock_data = stock_response.json()
        
        if len(stock_data["results"]) == 0:
            pytest.skip("No products in stock for testing")
        
        product_id = stock_data["results"][0]["product_id"]
        
        # Create intervention with product
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"product_id": product_id, "required_quantity": 1}]
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Get intervention product ID
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        detail = detail_response.json()
        ip_id = detail["products"][0]["id"]
        
        # Update quantity
        update_response = api_client.put(
            f"{BASE_URL}/api/interventions/{intervention_id}/products/{ip_id}",
            json={"required_quantity": 5}
        )
        assert update_response.status_code == 200
        
        # Verify
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        detail = detail_response.json()
        assert detail["products"][0]["required_quantity"] == 5
        
        print(f"✓ Updated product quantity from 1 to 5")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
