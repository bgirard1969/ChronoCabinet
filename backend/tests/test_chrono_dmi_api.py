"""
Chrono DMI v2 Backend API Tests
Tests auth, interventions, cabinets, products, orders, consumption, employees, movements
"""
import pytest
import requests
import os

BASE_URL = "http://localhost:8001"

# Test credentials
ADMIN_EMAIL = "benoit.girard@atmshealth.com"
ADMIN_PASSWORD = "Salut123"
ADMIN_PIN = "1234"
CLINICIAN_EMAIL = "clinicien@atmshealth.com"
CLINICIAN_PASSWORD = "Clinicien123"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_admin_success(self):
        """Test admin login with email/password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code in [200, 201]
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "administrateur"
        print("✓ Admin login passed")
    
    def test_login_pin_success(self):
        """Test production login with PIN"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "pin": ADMIN_PIN
        })
        assert response.status_code in [200, 201]
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print("✓ PIN login passed")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected")
    
    def test_login_invalid_pin(self):
        """Test login with wrong PIN"""
        response = requests.post(f"{BASE_URL}/api/auth/login-pin", json={
            "pin": "9999"
        })
        assert response.status_code == 401
        print("✓ Invalid PIN rejected")
    
    def test_get_me_authenticated(self):
        """Test /me endpoint with valid token"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Get me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print("✓ Get me endpoint passed")


@pytest.fixture
def auth_token():
    """Get authentication token for protected endpoints"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code in [200, 201]:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


class TestInterventions:
    """Interventions CRUD tests"""
    
    def test_get_interventions(self, auth_token):
        """Test listing interventions"""
        response = requests.get(f"{BASE_URL}/api/interventions", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get interventions passed ({len(data)} items)")
    
    def test_create_intervention(self, auth_token):
        """Test creating an intervention"""
        response = requests.post(f"{BASE_URL}/api/interventions", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "planned_datetime": "2026-04-15T10:00:00",
                "operating_room": "01",
                "patient_file_number": "TEST-MRN-002",
                "birth_date": "1990-01-15"
            }
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        print(f"✓ Create intervention passed (id: {data['id']})")
        return data["id"]


class TestCabinets:
    """Cabinets CRUD tests"""
    
    def test_get_cabinets(self, auth_token):
        """Test listing cabinets"""
        response = requests.get(f"{BASE_URL}/api/cabinets", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get cabinets passed ({len(data)} items)")


class TestProducts:
    """Products CRUD tests"""
    
    def test_get_products(self, auth_token):
        """Test listing products"""
        response = requests.get(f"{BASE_URL}/api/products", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get products passed ({len(data)} items)")


class TestOrders:
    """Orders CRUD tests"""
    
    def test_get_orders(self, auth_token):
        """Test listing orders"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get orders passed ({len(data)} items)")


class TestConsumption:
    """Consumption CRUD tests"""
    
    def test_get_consumption_imports(self, auth_token):
        """Test listing consumption import history"""
        response = requests.get(f"{BASE_URL}/api/consumption/imports", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get consumption imports passed ({len(data)} items)")


class TestEmployees:
    """Employees CRUD tests"""
    
    def test_get_employees(self, auth_token):
        """Test listing employees"""
        response = requests.get(f"{BASE_URL}/api/employees", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get employees passed ({len(data)} items)")


class TestMovements:
    """Movements CRUD tests"""
    
    def test_get_movements(self, auth_token):
        """Test listing movements"""
        response = requests.get(f"{BASE_URL}/api/movements", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get movements passed ({len(data)} items)")


class TestCategories:
    """Categories CRUD tests"""
    
    def test_get_product_categories(self, auth_token):
        """Test listing product categories"""
        response = requests.get(f"{BASE_URL}/api/product-categories", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get product categories passed ({len(data)} items)")
    
    def test_get_product_types(self, auth_token):
        """Test listing product types"""
        response = requests.get(f"{BASE_URL}/api/product-types", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get product types passed ({len(data)} items)")
    
    def test_get_product_specifications(self, auth_token):
        """Test listing product specifications"""
        response = requests.get(f"{BASE_URL}/api/product-specifications", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get product specifications passed ({len(data)} items)")


class TestSuppliers:
    """Suppliers CRUD tests"""
    
    def test_get_suppliers(self, auth_token):
        """Test listing suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get suppliers passed ({len(data)} items)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
