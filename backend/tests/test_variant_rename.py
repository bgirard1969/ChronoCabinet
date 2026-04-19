"""
Test suite for specification -> variant rename in Chrono DMI v2
Tests all backend endpoints that were updated for the variant rename
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVariantRename:
    """Tests for the specification -> variant rename"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "benoit.girard@atmshealth.com",
            "password": "Salut123"
        })
        assert login_resp.status_code == 201, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        self.session.close()
    
    # === Product Variants Endpoint Tests ===
    
    def test_get_product_variants_returns_list(self):
        """GET /api/product-variants should return variants list"""
        resp = self.session.get(f"{BASE_URL}/api/product-variants")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check structure
        variant = data[0]
        assert "id" in variant
        assert "description" in variant
        assert "created_at" in variant
    
    def test_old_specifications_endpoint_returns_404(self):
        """GET /api/product-specifications should return 404"""
        resp = self.session.get(f"{BASE_URL}/api/product-specifications")
        assert resp.status_code == 404
    
    # === Products Endpoint Tests ===
    
    def test_products_have_variant_id_field(self):
        """GET /api/products should return products with variant_id field"""
        resp = self.session.get(f"{BASE_URL}/api/products")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check that products have variant_id (not specification_id)
        product = data[0]
        assert "variant_id" in product
        assert "specification_id" not in product
    
    def test_products_have_variant_relation(self):
        """GET /api/products should return products with variant relation"""
        resp = self.session.get(f"{BASE_URL}/api/products")
        assert resp.status_code == 200
        data = resp.json()
        product = data[0]
        # Should have variant relation (not specification)
        assert "variant" in product
        assert "specification" not in product
    
    # === Filter Options Endpoint Tests ===
    
    def test_filter_options_returns_variants(self):
        """GET /api/products/filter-options should return variants (not specifications)"""
        resp = self.session.get(f"{BASE_URL}/api/products/filter-options")
        assert resp.status_code == 200
        data = resp.json()
        assert "filter_options" in data
        filter_options = data["filter_options"]
        # Should have variants (not specifications)
        assert "variants" in filter_options
        assert "specifications" not in filter_options
        assert isinstance(filter_options["variants"], list)
    
    def test_filter_options_supports_variant_id_param(self):
        """GET /api/products/filter-options?variant_id=... should work"""
        # Get a variant ID first
        variants_resp = self.session.get(f"{BASE_URL}/api/product-variants")
        variant_id = variants_resp.json()[0]["id"]
        
        resp = self.session.get(f"{BASE_URL}/api/products/filter-options?variant_id={variant_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "filter_options" in data
    
    # === Instances Endpoint Tests ===
    
    def test_fifo_suggestion_supports_variant_id(self):
        """GET /api/instances/fifo-suggestion?variant_id=... should work"""
        variants_resp = self.session.get(f"{BASE_URL}/api/product-variants")
        variant_id = variants_resp.json()[0]["id"]
        
        resp = self.session.get(f"{BASE_URL}/api/instances/fifo-suggestion?variant_id={variant_id}")
        assert resp.status_code == 200
        data = resp.json()
        # Should have suggestion and total_available fields
        assert "suggestion" in data
        assert "total_available" in data
    
    def test_available_stock_supports_variant_id(self):
        """GET /api/instances/available-stock?variant_id=... should work"""
        variants_resp = self.session.get(f"{BASE_URL}/api/product-variants")
        variant_id = variants_resp.json()[0]["id"]
        
        resp = self.session.get(f"{BASE_URL}/api/instances/available-stock?variant_id={variant_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    # === Interventions Endpoint Tests ===
    
    def test_intervention_detail_returns_variant_relation(self):
        """GET /api/interventions/:id should return products with variant relation"""
        # Get an intervention
        interventions_resp = self.session.get(f"{BASE_URL}/api/interventions")
        assert interventions_resp.status_code == 200
        interventions = interventions_resp.json()
        
        if not interventions:
            pytest.skip("No interventions available for testing")
        
        intervention_id = interventions[0]["id"]
        resp = self.session.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        assert resp.status_code == 200
        data = resp.json()
        
        # Check products have variant relation
        if data.get("products"):
            product = data["products"][0]
            assert "variant_id" in product
            assert "variant" in product
            assert "specification_id" not in product
            assert "specification" not in product
    
    def test_intervention_detail_returns_resolution_variant(self):
        """GET /api/interventions/:id should return resolution='variant' when only variant_id is set"""
        interventions_resp = self.session.get(f"{BASE_URL}/api/interventions")
        interventions = interventions_resp.json()
        
        if not interventions:
            pytest.skip("No interventions available for testing")
        
        # Find an intervention with products that have variant_id but no product_id
        for intervention in interventions:
            intervention_id = intervention["id"]
            resp = self.session.get(f"{BASE_URL}/api/interventions/{intervention_id}")
            data = resp.json()
            
            for product in data.get("products", []):
                if product.get("variant_id") and not product.get("product_id"):
                    assert product.get("resolution") == "variant"
                    return
        
        pytest.skip("No intervention products with variant_id only found")
    
    def test_intervention_fifo_suggestions_returns_variant(self):
        """GET /api/interventions/:id/fifo-suggestions should return items with variant field"""
        interventions_resp = self.session.get(f"{BASE_URL}/api/interventions")
        interventions = interventions_resp.json()
        
        if not interventions:
            pytest.skip("No interventions available for testing")
        
        intervention_id = interventions[0]["id"]
        resp = self.session.get(f"{BASE_URL}/api/interventions/{intervention_id}/fifo-suggestions")
        assert resp.status_code == 200
        data = resp.json()
        
        if data:
            suggestion = data[0]
            # Should have variant field (not specification)
            assert "variant" in suggestion
            assert "specification" not in suggestion
    
    def test_add_intervention_product_with_variant_id(self):
        """POST /api/interventions/:id/products should accept variant_id"""
        # Get IDs for testing
        categories_resp = self.session.get(f"{BASE_URL}/api/product-categories")
        category_id = categories_resp.json()[0]["id"]
        
        types_resp = self.session.get(f"{BASE_URL}/api/product-types")
        type_id = types_resp.json()[0]["id"]
        
        variants_resp = self.session.get(f"{BASE_URL}/api/product-variants")
        variant_id = variants_resp.json()[0]["id"]
        
        # Create test intervention
        create_resp = self.session.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": "2026-04-25T10:00:00.000Z",
            "operating_room": "TEST",
            "patient_file_number": "TEST-VARIANT-API-001",
            "birth_date": "1990-01-01"
        })
        assert create_resp.status_code == 201
        intervention_id = create_resp.json()["id"]
        
        try:
            # Add product with variant_id
            add_resp = self.session.post(f"{BASE_URL}/api/interventions/{intervention_id}/products", json={
                "category_id": category_id,
                "type_id": type_id,
                "variant_id": variant_id,
                "required_quantity": 1
            })
            assert add_resp.status_code in [200, 201]
            data = add_resp.json()
            
            # Verify the product was added with variant_id
            products = data.get("products", [])
            assert len(products) > 0
            added_product = products[-1]
            assert added_product.get("variant_id") == variant_id
            assert added_product.get("variant") is not None
            assert added_product.get("resolution") == "variant"
        finally:
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    # === Variant CRUD Tests ===
    
    def test_create_variant(self):
        """POST /api/product-variants should create a new variant"""
        resp = self.session.post(f"{BASE_URL}/api/product-variants", json={
            "description": "TEST-VARIANT-001"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data.get("description") == "TEST-VARIANT-001"
        variant_id = data.get("id")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/product-variants/{variant_id}")
    
    def test_update_variant(self):
        """PUT /api/product-variants/:id should update a variant"""
        # Create
        create_resp = self.session.post(f"{BASE_URL}/api/product-variants", json={
            "description": "TEST-VARIANT-UPDATE-001"
        })
        variant_id = create_resp.json()["id"]
        
        try:
            # Update
            update_resp = self.session.put(f"{BASE_URL}/api/product-variants/{variant_id}", json={
                "description": "TEST-VARIANT-UPDATED"
            })
            assert update_resp.status_code == 200
            data = update_resp.json()
            assert data.get("description") == "TEST-VARIANT-UPDATED"
        finally:
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/product-variants/{variant_id}")
    
    def test_delete_variant(self):
        """DELETE /api/product-variants/:id should delete a variant"""
        # Create
        create_resp = self.session.post(f"{BASE_URL}/api/product-variants", json={
            "description": "TEST-VARIANT-DELETE-001"
        })
        variant_id = create_resp.json()["id"]
        
        # Delete
        delete_resp = self.session.delete(f"{BASE_URL}/api/product-variants/{variant_id}")
        assert delete_resp.status_code == 200
        
        # Verify deleted
        get_resp = self.session.get(f"{BASE_URL}/api/product-variants")
        variants = get_resp.json()
        assert not any(v["id"] == variant_id for v in variants)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
