"""
Test Light Client Picking Refine Feature
Tests the ability to refine partial products (category-only) to specific products
in the Light Client Picking page.

Key features tested:
1. Create intervention with partial product (category_id only)
2. PUT /api/interventions/{id}/products/{ip_id} with product_id auto-fills category/type/spec
3. Resolution changes from 'category' to 'product' after refinement
4. FIFO suggestions work for partial products
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "benoit.girard@atmshealth.com"
TEST_PASSWORD = "Salut123"

# Known category ID for 'Lentille biconvexe'
LENTILLE_CATEGORY_ID = "d6057cb9-c781-4ed9-bb7a-b50495431afd"


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


@pytest.fixture
def test_intervention_with_partial_product(api_client):
    """Create a test intervention with a partial product (category only)"""
    # Create intervention with partial product
    planned_dt = (datetime.now() + timedelta(hours=2)).isoformat()
    payload = {
        "planned_datetime": planned_dt,
        "operating_room": "TEST-REFINE-ROOM",
        "surgeon": "Dr. Test Refine",
        "patient_file_number": f"TEST-REFINE-{uuid.uuid4().hex[:8]}",
        "products": [
            {
                "category_id": LENTILLE_CATEGORY_ID,
                "required_quantity": 1
            }
        ]
    }
    
    response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
    assert response.status_code == 200, f"Failed to create intervention: {response.text}"
    intervention = response.json()
    
    yield intervention
    
    # Cleanup
    api_client.delete(f"{BASE_URL}/api/interventions/{intervention['id']}")


class TestLightPickingRefineBackend:
    """Backend tests for Light Client Picking refine feature"""
    
    def test_create_intervention_with_partial_product(self, api_client, test_intervention_with_partial_product):
        """Test creating intervention with category-only product"""
        intervention_id = test_intervention_with_partial_product["id"]
        
        # Get intervention details
        response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "products" in data
        assert len(data["products"]) >= 1
        
        # Find the partial product
        partial_product = None
        for p in data["products"]:
            if p.get("category_id") == LENTILLE_CATEGORY_ID and not p.get("product_id"):
                partial_product = p
                break
        
        assert partial_product is not None, "Partial product not found"
        assert partial_product["resolution"] == "category", f"Expected resolution='category', got '{partial_product.get('resolution')}'"
        assert partial_product.get("category") is not None, "Category enrichment missing"
        print(f"✓ Partial product created with resolution='category'")
    
    def test_fifo_suggestions_for_partial_product(self, api_client, test_intervention_with_partial_product):
        """Test FIFO suggestions work for partial products"""
        intervention_id = test_intervention_with_partial_product["id"]
        
        response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}/fifo-suggestions")
        assert response.status_code == 200
        
        suggestions = response.json()
        assert len(suggestions) >= 1
        
        # Find suggestion for our partial product
        partial_suggestion = None
        for s in suggestions:
            if s.get("resolution") == "category":
                partial_suggestion = s
                break
        
        assert partial_suggestion is not None, "No suggestion for partial product"
        assert partial_suggestion.get("category") is not None, "Category info missing in suggestion"
        print(f"✓ FIFO suggestions work for partial products, resolution={partial_suggestion['resolution']}")
        print(f"  Total available instances: {partial_suggestion.get('total_available', 0)}")
    
    def test_get_available_stock_for_category(self, api_client):
        """Test getting available stock filtered by category"""
        response = api_client.get(f"{BASE_URL}/api/instances/available-stock?category_id={LENTILLE_CATEGORY_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert "filter_options" in data
        
        # Should have filter options
        filter_options = data["filter_options"]
        assert "categories" in filter_options
        assert "types" in filter_options
        assert "specifications" in filter_options
        
        print(f"✓ Available stock endpoint works for category filter")
        print(f"  Results: {len(data['results'])} products")
        print(f"  Categories: {len(filter_options['categories'])}")
        print(f"  Types: {len(filter_options['types'])}")
        print(f"  Specifications: {len(filter_options['specifications'])}")
        
        return data
    
    def test_refine_partial_product_with_product_id(self, api_client, test_intervention_with_partial_product):
        """Test refining a partial product by setting product_id"""
        intervention_id = test_intervention_with_partial_product["id"]
        
        # Get intervention to find the partial product
        response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        assert response.status_code == 200
        intervention = response.json()
        
        # Find partial product
        partial_product = None
        for p in intervention["products"]:
            if p.get("resolution") == "category":
                partial_product = p
                break
        
        if not partial_product:
            pytest.skip("No partial product found to refine")
        
        ip_id = partial_product["id"]
        
        # Get available stock to find a product to refine to
        stock_response = api_client.get(f"{BASE_URL}/api/instances/available-stock?category_id={LENTILLE_CATEGORY_ID}")
        assert stock_response.status_code == 200
        stock_data = stock_response.json()
        
        if not stock_data["results"]:
            pytest.skip("No products available in stock for this category")
        
        # Pick first available product
        target_product = stock_data["results"][0]
        target_product_id = target_product["product_id"]
        
        print(f"  Refining to product: {target_product.get('description', target_product_id)}")
        
        # Refine the partial product
        refine_response = api_client.put(
            f"{BASE_URL}/api/interventions/{intervention_id}/products/{ip_id}",
            json={"product_id": target_product_id}
        )
        assert refine_response.status_code == 200, f"Refine failed: {refine_response.text}"
        
        refined = refine_response.json()
        
        # Verify refinement
        assert refined["product_id"] == target_product_id, "product_id not set"
        assert refined["resolution"] == "product", f"Expected resolution='product', got '{refined.get('resolution')}'"
        
        # Verify auto-fill of category/type/spec
        assert refined.get("category_id") is not None, "category_id should be auto-filled"
        
        print(f"✓ Partial product refined successfully")
        print(f"  Resolution changed: category → product")
        print(f"  product_id: {refined['product_id']}")
        print(f"  category_id: {refined.get('category_id')}")
        print(f"  type_id: {refined.get('type_id')}")
        print(f"  specification_id: {refined.get('specification_id')}")
    
    def test_refine_with_filter_level_confirmation(self, api_client):
        """Test refining at filter level (category + type, no specific product)"""
        # Create a new intervention with partial product
        planned_dt = (datetime.now() + timedelta(hours=3)).isoformat()
        payload = {
            "planned_datetime": planned_dt,
            "operating_room": "TEST-FILTER-ROOM",
            "surgeon": "Dr. Filter Test",
            "patient_file_number": f"TEST-FILTER-{uuid.uuid4().hex[:8]}",
            "products": [
                {
                    "category_id": LENTILLE_CATEGORY_ID,
                    "required_quantity": 1
                }
            ]
        }
        
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        assert response.status_code == 200
        intervention = response.json()
        intervention_id = intervention["id"]
        
        try:
            # Get intervention to find partial product
            get_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
            assert get_response.status_code == 200
            intervention_data = get_response.json()
            
            partial_product = None
            for p in intervention_data["products"]:
                if p.get("resolution") == "category":
                    partial_product = p
                    break
            
            if not partial_product:
                pytest.skip("No partial product found")
            
            ip_id = partial_product["id"]
            
            # Get available types for this category
            stock_response = api_client.get(f"{BASE_URL}/api/instances/available-stock?category_id={LENTILLE_CATEGORY_ID}")
            assert stock_response.status_code == 200
            stock_data = stock_response.json()
            
            types = stock_data["filter_options"].get("types", [])
            if not types:
                pytest.skip("No types available for this category")
            
            target_type_id = types[0]["id"]
            
            # Refine to category + type level (not full product)
            refine_response = api_client.put(
                f"{BASE_URL}/api/interventions/{intervention_id}/products/{ip_id}",
                json={
                    "category_id": LENTILLE_CATEGORY_ID,
                    "type_id": target_type_id
                }
            )
            assert refine_response.status_code == 200, f"Refine failed: {refine_response.text}"
            
            refined = refine_response.json()
            
            # Should now be at 'type' resolution level
            assert refined["type_id"] == target_type_id, "type_id not set"
            assert refined["resolution"] == "type", f"Expected resolution='type', got '{refined.get('resolution')}'"
            
            print(f"✓ Filter-level refinement works")
            print(f"  Resolution changed: category → type")
            print(f"  type_id: {refined['type_id']}")
            
        finally:
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_intervention_product_enrichment(self, api_client, test_intervention_with_partial_product):
        """Test that intervention products are properly enriched with category/type/spec objects"""
        intervention_id = test_intervention_with_partial_product["id"]
        
        response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        for product in data["products"]:
            # Should have resolution
            assert "resolution" in product, "resolution field missing"
            
            # If has category_id, should have category object
            if product.get("category_id"):
                assert product.get("category") is not None, "category object missing for category_id"
                assert "description" in product["category"], "category.description missing"
            
            # If has type_id, should have type_obj
            if product.get("type_id"):
                assert product.get("type_obj") is not None, "type_obj missing for type_id"
            
            # If has specification_id, should have specification_obj
            if product.get("specification_id"):
                assert product.get("specification_obj") is not None, "specification_obj missing for specification_id"
            
            # If has product_id, should have product object
            if product.get("product_id"):
                assert product.get("product") is not None, "product object missing for product_id"
        
        print(f"✓ Intervention products properly enriched")


class TestLightPickingRefineIntegration:
    """Integration tests simulating the Light Client Picking refine flow"""
    
    def test_full_refine_flow(self, api_client):
        """Test complete flow: create partial → view → refine → verify"""
        # Step 1: Create intervention with partial product
        planned_dt = (datetime.now() + timedelta(hours=4)).isoformat()
        payload = {
            "planned_datetime": planned_dt,
            "operating_room": "TEST-FULL-FLOW",
            "surgeon": "Dr. Full Flow",
            "patient_file_number": f"TEST-FLOW-{uuid.uuid4().hex[:8]}",
            "products": [
                {
                    "category_id": LENTILLE_CATEGORY_ID,
                    "required_quantity": 1
                }
            ]
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        assert create_response.status_code == 200
        intervention = create_response.json()
        intervention_id = intervention["id"]
        
        try:
            # Step 2: Get intervention (simulates Light Client loading)
            get_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
            assert get_response.status_code == 200
            intervention_data = get_response.json()
            
            # Verify partial product exists with correct resolution
            partial_product = None
            for p in intervention_data["products"]:
                if p.get("resolution") == "category":
                    partial_product = p
                    break
            
            assert partial_product is not None, "Partial product not found"
            ip_id = partial_product["id"]
            
            print(f"Step 1-2: Created intervention with partial product (resolution=category)")
            
            # Step 3: Get FIFO suggestions (simulates Light Client)
            fifo_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}/fifo-suggestions")
            assert fifo_response.status_code == 200
            
            print(f"Step 3: FIFO suggestions retrieved")
            
            # Step 4: Get available stock for refine panel
            stock_response = api_client.get(f"{BASE_URL}/api/instances/available-stock?category_id={LENTILLE_CATEGORY_ID}")
            assert stock_response.status_code == 200
            stock_data = stock_response.json()
            
            if not stock_data["results"]:
                pytest.skip("No products available for refinement")
            
            target_product = stock_data["results"][0]
            target_product_id = target_product["product_id"]
            
            print(f"Step 4: Available stock retrieved, selecting product: {target_product.get('description', 'N/A')}")
            
            # Step 5: Refine the partial product
            refine_response = api_client.put(
                f"{BASE_URL}/api/interventions/{intervention_id}/products/{ip_id}",
                json={"product_id": target_product_id}
            )
            assert refine_response.status_code == 200
            refined = refine_response.json()
            
            assert refined["resolution"] == "product"
            print(f"Step 5: Product refined (resolution=product)")
            
            # Step 6: Verify intervention updated
            verify_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
            assert verify_response.status_code == 200
            verified_data = verify_response.json()
            
            # Find the refined product
            refined_product = None
            for p in verified_data["products"]:
                if p["id"] == ip_id:
                    refined_product = p
                    break
            
            assert refined_product is not None
            assert refined_product["resolution"] == "product"
            assert refined_product["product_id"] == target_product_id
            
            print(f"Step 6: Verified intervention updated correctly")
            print(f"✓ Full refine flow completed successfully")
            
        finally:
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
