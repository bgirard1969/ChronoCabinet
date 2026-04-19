"""
Test Socket.IO integration and Intervention CRUD with real-time events.
Features tested:
1. Socket.IO endpoint accessibility
2. Intervention CRUD operations (create, read, update, delete)
3. Intervention fields: operating_room, surgeon, patient_file_number
4. Delete intervention with confirmation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "benoit.girard@atmshealth.com"
ADMIN_PASSWORD = "Salut123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestSocketIOEndpoint:
    """Test Socket.IO endpoint accessibility"""
    
    def test_socketio_polling_endpoint_returns_200(self):
        """Socket.IO polling endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/socket.io/?EIO=4&transport=polling")
        assert response.status_code == 200, f"Socket.IO endpoint returned {response.status_code}"
        print(f"Socket.IO endpoint accessible: {response.status_code}")


class TestHealthEndpoint:
    """Test backend health check"""
    
    def test_health_endpoint_returns_ok(self):
        """Health endpoint should return status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"Health check passed: {data}")


class TestInterventionCRUD:
    """Test Intervention CRUD operations with Salle/Chirurgien/Patient fields"""
    
    def test_create_intervention_with_all_fields(self, auth_headers):
        """Create intervention with operating_room, surgeon, patient_file_number"""
        from datetime import datetime, timedelta
        
        # Create intervention for today
        planned_dt = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M")
        
        payload = {
            "planned_datetime": planned_dt,
            "operating_room": "Salle TEST-A1",
            "surgeon": "Dr. Test Chirurgien",
            "patient_file_number": "PAT-TEST-001",
            "products": []
        }
        
        response = requests.post(f"{BASE_URL}/api/interventions", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("operating_room") == "Salle TEST-A1"
        assert data.get("surgeon") == "Dr. Test Chirurgien"
        assert data.get("patient_file_number") == "PAT-TEST-001"
        
        # Store ID for cleanup
        TestInterventionCRUD.created_intervention_id = data.get("id")
        print(f"Created intervention with all fields: {data.get('id')}")
        return data
    
    def test_create_intervention_with_null_fields(self, auth_headers):
        """Create intervention with null operating_room, surgeon, patient_file_number"""
        from datetime import datetime, timedelta
        
        planned_dt = (datetime.now() + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M")
        
        payload = {
            "planned_datetime": planned_dt,
            "operating_room": None,
            "surgeon": None,
            "patient_file_number": None,
            "products": []
        }
        
        response = requests.post(f"{BASE_URL}/api/interventions", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Null fields should be stored as null
        assert data.get("operating_room") is None or data.get("operating_room") == ""
        assert data.get("surgeon") is None or data.get("surgeon") == ""
        assert data.get("patient_file_number") is None or data.get("patient_file_number") == ""
        
        TestInterventionCRUD.null_intervention_id = data.get("id")
        print(f"Created intervention with null fields: {data.get('id')}")
        return data
    
    def test_get_intervention_returns_fields(self, auth_headers):
        """GET intervention should return operating_room, surgeon, patient_file_number"""
        intv_id = getattr(TestInterventionCRUD, 'created_intervention_id', None)
        if not intv_id:
            pytest.skip("No intervention created")
        
        response = requests.get(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "operating_room" in data
        assert "surgeon" in data
        assert "patient_file_number" in data
        assert data.get("operating_room") == "Salle TEST-A1"
        assert data.get("surgeon") == "Dr. Test Chirurgien"
        print(f"GET intervention returned all fields correctly")
    
    def test_list_interventions_today_returns_fields(self, auth_headers):
        """List today's interventions should include operating_room, surgeon, patient_file_number"""
        response = requests.get(f"{BASE_URL}/api/interventions?filter=today", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check that interventions have the required fields
        for intv in data:
            assert "operating_room" in intv
            assert "surgeon" in intv
            assert "patient_file_number" in intv
        
        print(f"Listed {len(data)} interventions for today, all have required fields")
    
    def test_update_intervention_fields(self, auth_headers):
        """Update intervention operating_room, surgeon, patient_file_number"""
        intv_id = getattr(TestInterventionCRUD, 'created_intervention_id', None)
        if not intv_id:
            pytest.skip("No intervention created")
        
        payload = {
            "operating_room": "Salle TEST-B2",
            "surgeon": "Dr. Updated Surgeon",
            "patient_file_number": "PAT-UPDATED-002"
        }
        
        response = requests.put(f"{BASE_URL}/api/interventions/{intv_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("operating_room") == "Salle TEST-B2"
        assert data.get("surgeon") == "Dr. Updated Surgeon"
        print(f"Updated intervention fields successfully")
    
    def test_delete_intervention(self, auth_headers):
        """Delete intervention should return success"""
        intv_id = getattr(TestInterventionCRUD, 'created_intervention_id', None)
        if not intv_id:
            pytest.skip("No intervention created")
        
        response = requests.delete(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("deleted") == True
        print(f"Deleted intervention: {intv_id}")
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
        assert get_response.status_code == 404
        print(f"Verified intervention no longer exists")
    
    def test_delete_null_intervention(self, auth_headers):
        """Cleanup: Delete the null fields intervention"""
        intv_id = getattr(TestInterventionCRUD, 'null_intervention_id', None)
        if not intv_id:
            pytest.skip("No null intervention created")
        
        response = requests.delete(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"Cleaned up null intervention: {intv_id}")


class TestInterventionProductsWithEmit:
    """Test that intervention product operations work (emit_event is called internally)"""
    
    def test_create_intervention_and_add_product(self, auth_headers):
        """Create intervention and add product - backend emits socket event"""
        from datetime import datetime, timedelta
        
        planned_dt = (datetime.now() + timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M")
        
        # Create intervention
        payload = {
            "planned_datetime": planned_dt,
            "operating_room": "Salle EMIT-TEST",
            "surgeon": "Dr. Socket Test",
            "patient_file_number": "PAT-SOCKET-001",
            "products": []
        }
        
        response = requests.post(f"{BASE_URL}/api/interventions", json=payload, headers=auth_headers)
        assert response.status_code == 200
        intv_id = response.json().get("id")
        TestInterventionProductsWithEmit.test_intv_id = intv_id
        print(f"Created intervention for emit test: {intv_id}")
        
        # Get products to find one to add
        products_response = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        if products_response.status_code == 200:
            products = products_response.json()
            if products:
                product_id = products[0].get("id")
                
                # Add product to intervention
                add_response = requests.post(
                    f"{BASE_URL}/api/interventions/{intv_id}/products",
                    json={"product_id": product_id, "required_quantity": 1},
                    headers=auth_headers
                )
                assert add_response.status_code == 200
                print(f"Added product to intervention - emit_event should have been called")
    
    def test_cleanup_emit_test_intervention(self, auth_headers):
        """Cleanup emit test intervention"""
        intv_id = getattr(TestInterventionProductsWithEmit, 'test_intv_id', None)
        if intv_id:
            response = requests.delete(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
            assert response.status_code == 200
            print(f"Cleaned up emit test intervention: {intv_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
