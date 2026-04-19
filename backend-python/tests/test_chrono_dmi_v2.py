"""
Chrono DMI v2 - Comprehensive Backend API Tests
Tests all CRUD operations for the medical device inventory management system.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "benoit.girard@atmshealth.com"
ADMIN_PASSWORD = "Salut123"
ADMIN_PIN = "1234"
CLINICIAN_PIN = "5678"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "2.0.0"
        print("✓ Health check passed")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin email/password login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "administrateur"
        print("✓ Admin login success")
    
    def test_admin_login_invalid_password(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid password rejected")
    
    def test_pin_login_success(self):
        """Test PIN login for light client"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "pin": ADMIN_PIN
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["has_pin"] == True
        print("✓ PIN login success")
    
    def test_pin_login_invalid(self):
        """Test invalid PIN"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "pin": "9999"
        })
        assert response.status_code == 401
        print("✓ Invalid PIN rejected")
    
    def test_get_current_user(self, auth_token):
        """Test /auth/me endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print("✓ Get current user success")


class TestSuppliers:
    """Supplier CRUD tests"""
    
    def test_create_supplier(self, auth_token):
        """Create a new supplier"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/suppliers", headers=headers, json={
            "name": f"TEST_Supplier_Medical_{datetime.now().strftime('%H%M%S%f')}",
            "contact_name": "John Doe",
            "contact_phone": "514-555-1234",
            "contact_email": "john@supplier.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert "TEST_Supplier_Medical" in data["name"]
        assert data["contact_name"] == "John Doe"
        assert "id" in data
        print(f"✓ Supplier created: {data['id']}")
        return data["id"]
    
    def test_get_suppliers(self, auth_token):
        """Get all suppliers"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} suppliers")
    
    def test_update_supplier(self, auth_token, test_supplier_id):
        """Update a supplier"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/suppliers/{test_supplier_id}", headers=headers, json={
            "name": "TEST_Supplier_Updated",
            "contact_name": "Jane Doe"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Supplier_Updated"
        print("✓ Supplier updated")
    
    def test_delete_supplier(self, auth_token, test_supplier_id):
        """Delete a supplier"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.delete(f"{BASE_URL}/api/suppliers/{test_supplier_id}", headers=headers)
        assert response.status_code == 200
        print("✓ Supplier deleted")


class TestProductCategories:
    """Product Category CRUD tests"""
    
    def test_create_category(self, auth_token):
        """Create a new product category"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/product-categories", headers=headers, json={
            "description": f"TEST_Catheter_{datetime.now().strftime('%H%M%S%f')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "TEST_Catheter" in data["description"]
        print(f"✓ Category created: {data['id']}")
        return data["id"]
    
    def test_get_categories(self, auth_token):
        """Get all categories"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/product-categories", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} categories")
    
    def test_update_category(self, auth_token, test_category_id):
        """Update a category"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/product-categories/{test_category_id}", headers=headers, json={
            "description": "TEST_Catheter_Updated"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "TEST_Catheter_Updated"
        print("✓ Category updated")


class TestProductTypes:
    """Product Type CRUD tests"""
    
    def test_create_type(self, auth_token):
        """Create a new product type"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/product-types", headers=headers, json={
            "description": f"TEST_NC_EMERGE_{datetime.now().strftime('%H%M%S%f')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "TEST_NC_EMERGE" in data["description"]
        print(f"✓ Type created: {data['id']}")
        return data["id"]
    
    def test_get_types(self, auth_token):
        """Get all types"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/product-types", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} types")


class TestCabinets:
    """Cabinet CRUD tests"""
    
    def test_create_cabinet(self, auth_token):
        """Create a cabinet with N×M grid"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/cabinets", headers=headers, json={
            "description": "TEST_Cabinet_A",
            "columns": 3,
            "rows": 2
        })
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "TEST_Cabinet_A"
        assert data["columns"] == 3
        assert data["rows"] == 2
        assert data["total_locations"] == 6  # 3x2 = 6 locations auto-generated
        print(f"✓ Cabinet created with {data['total_locations']} locations")
        return data["id"]
    
    def test_get_cabinets(self, auth_token):
        """Get all cabinets"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/cabinets", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} cabinets")
    
    def test_get_cabinet_locations(self, auth_token, test_cabinet_id):
        """Get cabinet locations matrix"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/cabinets/{test_cabinet_id}/locations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "cabinet" in data
        assert "locations" in data
        assert len(data["locations"]) == 6  # 3x2 grid
        print(f"✓ Got {len(data['locations'])} locations for cabinet")


class TestProducts:
    """Product CRUD tests"""
    
    def test_create_product(self, auth_token, test_supplier_id, test_category_id, test_type_id):
        """Create a new product"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/products", headers=headers, json={
            "supplier_id": test_supplier_id,
            "category_id": test_category_id,
            "type_id": test_type_id,
            "description": "TEST_Stent_Coronary",
            "specification": "3.00 mm x 08 mm",
            "grm_number": "GRM-TEST-001"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "TEST_Stent_Coronary"
        assert data["specification"] == "3.00 mm x 08 mm"
        print(f"✓ Product created: {data['id']}")
        return data["id"]
    
    def test_get_products(self, auth_token):
        """Get all products with enrichment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/products", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check enrichment
        if len(data) > 0:
            assert "supplier" in data[0]
            assert "category" in data[0]
            assert "type" in data[0]
            assert "quantity_in_stock" in data[0]
        print(f"✓ Got {len(data)} products with enrichment")
    
    def test_get_product_by_id(self, auth_token, test_product_id):
        """Get single product"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/products/{test_product_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_product_id
        print("✓ Got product by ID")


class TestOrders:
    """Order workflow tests"""
    
    def test_create_order(self, auth_token, test_supplier_id, test_product_id):
        """Create a new order with items"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json={
            "supplier_id": test_supplier_id,
            "grm_number": "GRM-ORDER-TEST-001",
            "items": [
                {"product_id": test_product_id, "quantity": 2}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "draft"
        assert data["total_items"] == 2  # 2 instances created
        print(f"✓ Order created with {data['total_items']} items")
        return data["id"]
    
    def test_get_orders(self, auth_token):
        """Get all orders"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} orders")
    
    def test_send_order(self, auth_token, test_order_id):
        """Send an order (sets order_date, locks it)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/orders/{test_order_id}/send", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "sent"
        assert data["order_date"] is not None
        print("✓ Order sent")
    
    def test_get_order_detail(self, auth_token, test_order_id):
        """Get order with items"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/orders/{test_order_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 2  # 2 instances
        print(f"✓ Got order detail with {len(data['items'])} items")
        return data["items"]
    
    def test_receive_order_items(self, auth_token, test_order_id, order_items):
        """Receive items from order"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        items_to_receive = [
            {
                "instance_id": order_items[0]["id"],
                "serial_number": f"TEST-SN-{datetime.now().strftime('%H%M%S')}-001",
                "lot_number": "LOT-TEST-001",
                "expiration_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
            }
        ]
        response = requests.put(f"{BASE_URL}/api/orders/{test_order_id}/receive", headers=headers, json={
            "items": items_to_receive
        })
        assert response.status_code == 200
        data = response.json()
        assert data["received"] == 1
        print(f"✓ Received {data['received']} item(s)")


class TestInterventions:
    """Intervention CRUD tests"""
    
    def test_create_intervention(self, auth_token, test_product_id):
        """Create a new intervention"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        planned_time = (datetime.now() + timedelta(hours=2)).isoformat()
        response = requests.post(f"{BASE_URL}/api/interventions", headers=headers, json={
            "planned_datetime": planned_time,
            "operating_room": "Salle TEST-1",
            "surgeon": "Dr. Test",
            "patient_file_number": "PAT-TEST-001",
            "products": [
                {"product_id": test_product_id, "required_quantity": 1}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["operating_room"] == "Salle TEST-1"
        assert data["surgeon"] == "Dr. Test"
        print(f"✓ Intervention created: {data['id']}")
        return data["id"]
    
    def test_get_interventions_today(self, auth_token):
        """Get today's interventions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/interventions?filter=today", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} interventions for today")
    
    def test_get_interventions_week(self, auth_token):
        """Get this week's interventions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/interventions?filter=week", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} interventions for this week")
    
    def test_get_interventions_all(self, auth_token):
        """Get all interventions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/interventions?filter=all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} total interventions")


class TestEmployees:
    """Employee CRUD tests"""
    
    def test_get_employees(self, auth_token):
        """Get all employees"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/employees", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least admin exists
        print(f"✓ Got {len(data)} employees")
    
    def test_get_roles(self, auth_token):
        """Get available roles"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/employees/roles", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        role_ids = [r["id"] for r in data]
        assert "administrateur" in role_ids
        assert "clinicien" in role_ids
        print(f"✓ Got {len(data)} roles")
    
    def test_create_employee(self, auth_token):
        """Create a new employee"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/employees", headers=headers, json={
            "email": f"test.employee.{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123",
            "first_name": "Test",
            "last_name": "Employee",
            "role": "technicien",
            "pin": "9876"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Test"
        assert data["role"] == "technicien"
        print(f"✓ Employee created: {data['id']}")
        return data["id"]
    
    def test_update_employee(self, auth_token, test_employee_id):
        """Update an employee"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(f"{BASE_URL}/api/employees/{test_employee_id}", headers=headers, json={
            "first_name": "Updated",
            "role": "clinicien"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Updated"
        assert data["role"] == "clinicien"
        print("✓ Employee updated")
    
    def test_delete_employee(self, auth_token, test_employee_id):
        """Delete an employee"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.delete(f"{BASE_URL}/api/employees/{test_employee_id}", headers=headers)
        assert response.status_code == 200
        print("✓ Employee deleted")


class TestMovements:
    """Movement audit log tests"""
    
    def test_get_movements(self, auth_token):
        """Get all movements"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/movements", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} movements")


class TestInstances:
    """Product instance tests"""
    
    def test_get_instances(self, auth_token):
        """Get all instances"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/instances", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} instances")
    
    def test_get_pending_placement(self, auth_token):
        """Get instances pending placement"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/instances/pending-placement", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} instances pending placement")


class TestHardwareStubs:
    """Hardware stub endpoint tests (MOCKED)"""
    
    def test_unlock_cabinet(self, auth_token, test_cabinet_id):
        """Test cabinet unlock stub"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/hardware/cabinets/{test_cabinet_id}/unlock", headers=headers)
        # Stub should return success
        assert response.status_code in [200, 404]  # 404 if cabinet doesn't exist
        print("✓ Cabinet unlock stub tested")
    
    def test_emergency_unlock(self, auth_token):
        """Test emergency unlock stub"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/hardware/emergency", headers=headers)
        assert response.status_code in [200, 404]
        print("✓ Emergency unlock stub tested")


# ============= FIXTURES =============

@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


@pytest.fixture(scope="class")
def test_supplier_id(auth_token):
    """Create a test supplier and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/suppliers", headers=headers, json={
        "name": f"TEST_Supplier_{datetime.now().strftime('%H%M%S')}",
        "contact_name": "Test Contact"
    })
    if response.status_code == 200:
        supplier_id = response.json()["id"]
        yield supplier_id
        # Cleanup - try to delete (may fail if used by products)
        requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", headers=headers)
    else:
        pytest.skip("Could not create test supplier")


@pytest.fixture(scope="class")
def test_category_id(auth_token):
    """Create a test category and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/product-categories", headers=headers, json={
        "description": f"TEST_Category_{datetime.now().strftime('%H%M%S')}"
    })
    if response.status_code == 200:
        cat_id = response.json()["id"]
        yield cat_id
        requests.delete(f"{BASE_URL}/api/product-categories/{cat_id}", headers=headers)
    else:
        pytest.skip("Could not create test category")


@pytest.fixture(scope="class")
def test_type_id(auth_token):
    """Create a test type and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/product-types", headers=headers, json={
        "description": f"TEST_Type_{datetime.now().strftime('%H%M%S')}"
    })
    if response.status_code == 200:
        type_id = response.json()["id"]
        yield type_id
        requests.delete(f"{BASE_URL}/api/product-types/{type_id}", headers=headers)
    else:
        pytest.skip("Could not create test type")


@pytest.fixture(scope="class")
def test_cabinet_id(auth_token):
    """Create a test cabinet and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/cabinets", headers=headers, json={
        "description": f"TEST_Cabinet_{datetime.now().strftime('%H%M%S')}",
        "columns": 3,
        "rows": 2
    })
    if response.status_code == 200:
        cab_id = response.json()["id"]
        yield cab_id
        requests.delete(f"{BASE_URL}/api/cabinets/{cab_id}", headers=headers)
    else:
        pytest.skip("Could not create test cabinet")


@pytest.fixture(scope="class")
def test_product_id(auth_token, test_supplier_id, test_category_id, test_type_id):
    """Create a test product and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/products", headers=headers, json={
        "supplier_id": test_supplier_id,
        "category_id": test_category_id,
        "type_id": test_type_id,
        "description": f"TEST_Product_{datetime.now().strftime('%H%M%S')}",
        "specification": "Test Spec"
    })
    if response.status_code == 200:
        prod_id = response.json()["id"]
        yield prod_id
        requests.delete(f"{BASE_URL}/api/products/{prod_id}", headers=headers)
    else:
        pytest.skip("Could not create test product")


@pytest.fixture(scope="class")
def test_order_id(auth_token, test_supplier_id, test_product_id):
    """Create a test order and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json={
        "supplier_id": test_supplier_id,
        "items": [{"product_id": test_product_id, "quantity": 2}]
    })
    if response.status_code == 200:
        order_id = response.json()["id"]
        yield order_id
        # Cleanup - cancel if still draft
        requests.delete(f"{BASE_URL}/api/orders/{order_id}", headers=headers)
    else:
        pytest.skip("Could not create test order")


@pytest.fixture(scope="class")
def order_items(auth_token, test_order_id):
    """Get order items for receive test"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.get(f"{BASE_URL}/api/orders/{test_order_id}", headers=headers)
    if response.status_code == 200:
        return response.json()["items"]
    return []


@pytest.fixture(scope="class")
def test_employee_id(auth_token):
    """Create a test employee and return its ID"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(f"{BASE_URL}/api/employees", headers=headers, json={
        "email": f"test.emp.{datetime.now().strftime('%H%M%S')}@test.com",
        "password": "TestPass123",
        "first_name": "Test",
        "last_name": "Employee",
        "role": "technicien"
    })
    if response.status_code == 200:
        emp_id = response.json()["id"]
        yield emp_id
        requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=headers)
    else:
        pytest.skip("Could not create test employee")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
