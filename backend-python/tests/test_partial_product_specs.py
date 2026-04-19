"""
Test suite for Partial Product Specification feature:
- Create interventions with partial specs (category_id only, category_id+type_id, etc.)
- GET /api/interventions/{id} enriches products with category/type_obj/specification_obj and 'resolution' level
- PUT /api/interventions/{id}/products/{ip_id} refines partial products
- GET /api/interventions/{id}/fifo-suggestions works for partial products
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


@pytest.fixture(scope="module")
def test_data(api_client):
    """Get test data: category_id, type_id, specification_id, product_id from available stock"""
    response = api_client.get(f"{BASE_URL}/api/instances/available-stock")
    assert response.status_code == 200
    data = response.json()
    
    # Get filter options
    categories = data.get("filter_options", {}).get("categories", [])
    types = data.get("filter_options", {}).get("types", [])
    specifications = data.get("filter_options", {}).get("specifications", [])
    results = data.get("results", [])
    
    if not categories or not results:
        pytest.skip("No stock data available for testing")
    
    # Find a product with all fields populated
    product_with_all = None
    for r in results:
        if r.get("category_id") and r.get("type_id"):
            product_with_all = r
            break
    
    if not product_with_all:
        product_with_all = results[0]
    
    return {
        "category_id": categories[0]["id"] if categories else None,
        "category_name": categories[0].get("description") if categories else None,
        "type_id": types[0]["id"] if types else None,
        "type_name": types[0].get("description") if types else None,
        "specification_id": specifications[0]["id"] if specifications else None,
        "specification_name": specifications[0].get("description") if specifications else None,
        "product_id": product_with_all.get("product_id"),
        "product_category_id": product_with_all.get("category_id"),
        "product_type_id": product_with_all.get("type_id"),
        "product_specification_id": product_with_all.get("specification_id"),
    }


class TestCreateInterventionWithPartialProducts:
    """Test POST /api/interventions with partial product specifications"""
    
    def test_create_with_category_only(self, api_client, test_data):
        """Create intervention with product specified by category_id only"""
        if not test_data.get("category_id"):
            pytest.skip("No category available for testing")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": [
                {"category_id": test_data["category_id"], "required_quantity": 1}
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        intervention_id = data["id"]
        
        # Verify via GET
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        assert detail_response.status_code == 200
        detail = detail_response.json()
        
        assert len(detail.get("products", [])) == 1
        product = detail["products"][0]
        
        # Check resolution is 'category'
        assert product.get("resolution") == "category", f"Expected resolution='category', got '{product.get('resolution')}'"
        assert product.get("category_id") == test_data["category_id"]
        assert product.get("product_id") is None
        
        # Check enrichment - category object should be present
        assert "category" in product, "Missing 'category' enrichment"
        assert product["category"].get("description") is not None
        
        print(f"✓ Created intervention with category-only product: resolution={product.get('resolution')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_create_with_category_and_type(self, api_client, test_data):
        """Create intervention with product specified by category_id + type_id"""
        if not test_data.get("category_id") or not test_data.get("type_id"):
            pytest.skip("No category or type available for testing")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": [
                {
                    "category_id": test_data["category_id"],
                    "type_id": test_data["type_id"],
                    "required_quantity": 2
                }
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        intervention_id = data["id"]
        
        # Verify via GET
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        detail = detail_response.json()
        
        product = detail["products"][0]
        
        # Check resolution is 'type'
        assert product.get("resolution") == "type", f"Expected resolution='type', got '{product.get('resolution')}'"
        assert product.get("category_id") == test_data["category_id"]
        assert product.get("type_id") == test_data["type_id"]
        assert product.get("product_id") is None
        
        # Check enrichment
        assert "category" in product
        assert "type_obj" in product
        
        print(f"✓ Created intervention with category+type product: resolution={product.get('resolution')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_create_with_full_product_id(self, api_client, test_data):
        """Create intervention with complete product_id"""
        if not test_data.get("product_id"):
            pytest.skip("No product available for testing")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": [
                {"product_id": test_data["product_id"], "required_quantity": 1}
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        intervention_id = data["id"]
        
        # Verify via GET
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        detail = detail_response.json()
        
        product = detail["products"][0]
        
        # Check resolution is 'product'
        assert product.get("resolution") == "product", f"Expected resolution='product', got '{product.get('resolution')}'"
        assert product.get("product_id") == test_data["product_id"]
        
        # Check enrichment - product object should be present
        assert "product" in product
        assert product["product"].get("description") is not None
        
        print(f"✓ Created intervention with full product: resolution={product.get('resolution')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_create_with_mixed_products(self, api_client, test_data):
        """Create intervention with mix of partial and complete products"""
        if not test_data.get("category_id") or not test_data.get("product_id"):
            pytest.skip("Insufficient test data")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": [
                {"category_id": test_data["category_id"], "required_quantity": 1},
                {"product_id": test_data["product_id"], "required_quantity": 2}
            ]
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        intervention_id = data["id"]
        
        # Verify via GET
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        detail = detail_response.json()
        
        assert len(detail.get("products", [])) == 2
        
        resolutions = [p.get("resolution") for p in detail["products"]]
        assert "category" in resolutions or "type" in resolutions, "Expected at least one partial product"
        assert "product" in resolutions, "Expected at least one complete product"
        
        print(f"✓ Created intervention with mixed products: resolutions={resolutions}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


class TestRefinePartialProduct:
    """Test PUT /api/interventions/{id}/products/{ip_id} to refine partial products"""
    
    def test_refine_category_to_type(self, api_client, test_data):
        """Refine a category-only product by adding type_id"""
        if not test_data.get("category_id") or not test_data.get("type_id"):
            pytest.skip("Insufficient test data")
        
        # Create intervention with category-only product
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"category_id": test_data["category_id"], "required_quantity": 1}]
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Get the intervention product ID
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        ip_id = detail_response.json()["products"][0]["id"]
        
        # Refine by adding type_id
        refine_response = api_client.put(
            f"{BASE_URL}/api/interventions/{intervention_id}/products/{ip_id}",
            json={"type_id": test_data["type_id"]}
        )
        assert refine_response.status_code == 200
        refined = refine_response.json()
        
        # Check resolution changed to 'type'
        assert refined.get("resolution") == "type", f"Expected resolution='type', got '{refined.get('resolution')}'"
        assert refined.get("type_id") == test_data["type_id"]
        
        print(f"✓ Refined category-only to category+type: resolution={refined.get('resolution')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_refine_partial_to_full_product(self, api_client, test_data):
        """Refine a partial product by setting product_id"""
        if not test_data.get("category_id") or not test_data.get("product_id"):
            pytest.skip("Insufficient test data")
        
        # Create intervention with category-only product
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"category_id": test_data["category_id"], "required_quantity": 1}]
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Get the intervention product ID
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        ip_id = detail_response.json()["products"][0]["id"]
        
        # Refine by setting product_id
        refine_response = api_client.put(
            f"{BASE_URL}/api/interventions/{intervention_id}/products/{ip_id}",
            json={"product_id": test_data["product_id"]}
        )
        assert refine_response.status_code == 200
        refined = refine_response.json()
        
        # Check resolution changed to 'product'
        assert refined.get("resolution") == "product", f"Expected resolution='product', got '{refined.get('resolution')}'"
        assert refined.get("product_id") == test_data["product_id"]
        
        # Auto-fill should have set category_id, type_id from product
        assert refined.get("category_id") is not None
        
        print(f"✓ Refined partial to full product: resolution={refined.get('resolution')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


class TestFifoSuggestionsForPartialProducts:
    """Test GET /api/interventions/{id}/fifo-suggestions with partial products"""
    
    def test_fifo_suggestions_for_category_only(self, api_client, test_data):
        """FIFO suggestions should find matching products by category"""
        if not test_data.get("category_id"):
            pytest.skip("No category available for testing")
        
        # Create intervention with category-only product
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"category_id": test_data["category_id"], "required_quantity": 1}]
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Get FIFO suggestions
        fifo_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}/fifo-suggestions")
        assert fifo_response.status_code == 200
        suggestions = fifo_response.json()
        
        assert len(suggestions) == 1
        suggestion = suggestions[0]
        
        # Check resolution is included
        assert "resolution" in suggestion
        assert suggestion.get("resolution") == "category"
        
        # Check category enrichment
        assert "category" in suggestion
        
        print(f"✓ FIFO suggestions for category-only: resolution={suggestion.get('resolution')}, available={suggestion.get('total_available')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_fifo_suggestions_for_full_product(self, api_client, test_data):
        """FIFO suggestions should work for complete products"""
        if not test_data.get("product_id"):
            pytest.skip("No product available for testing")
        
        # Create intervention with full product
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"product_id": test_data["product_id"], "required_quantity": 1}]
        })
        assert create_response.status_code == 200
        intervention_id = create_response.json()["id"]
        
        # Get FIFO suggestions
        fifo_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}/fifo-suggestions")
        assert fifo_response.status_code == 200
        suggestions = fifo_response.json()
        
        assert len(suggestions) == 1
        suggestion = suggestions[0]
        
        # Check resolution is 'product'
        assert suggestion.get("resolution") == "product"
        
        # Check product enrichment
        assert "product" in suggestion
        
        print(f"✓ FIFO suggestions for full product: resolution={suggestion.get('resolution')}, available={suggestion.get('total_available')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


class TestEnrichmentFields:
    """Test that GET /api/interventions/{id} properly enriches products"""
    
    def test_enrichment_includes_category_object(self, api_client, test_data):
        """Verify category object is included in enrichment"""
        if not test_data.get("category_id"):
            pytest.skip("No category available")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"category_id": test_data["category_id"], "required_quantity": 1}]
        })
        intervention_id = create_response.json()["id"]
        
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        product = detail_response.json()["products"][0]
        
        assert "category" in product
        assert "id" in product["category"]
        assert "description" in product["category"]
        
        print(f"✓ Category enrichment: {product['category'].get('description')}")
        
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_enrichment_includes_type_obj(self, api_client, test_data):
        """Verify type_obj is included when type_id is set"""
        if not test_data.get("category_id") or not test_data.get("type_id"):
            pytest.skip("Insufficient test data")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{
                "category_id": test_data["category_id"],
                "type_id": test_data["type_id"],
                "required_quantity": 1
            }]
        })
        intervention_id = create_response.json()["id"]
        
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        product = detail_response.json()["products"][0]
        
        assert "type_obj" in product
        assert "id" in product["type_obj"]
        assert "description" in product["type_obj"]
        
        print(f"✓ Type enrichment: {product['type_obj'].get('description')}")
        
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
    
    def test_enrichment_includes_product_with_nested_objects(self, api_client, test_data):
        """Verify full product enrichment includes nested category/type/spec"""
        if not test_data.get("product_id"):
            pytest.skip("No product available")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"product_id": test_data["product_id"], "required_quantity": 1}]
        })
        intervention_id = create_response.json()["id"]
        
        detail_response = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}")
        product = detail_response.json()["products"][0]
        
        assert "product" in product
        assert "description" in product["product"]
        
        # Product should have nested category if available
        if product["product"].get("category_id"):
            assert "category" in product["product"]
        
        print(f"✓ Full product enrichment: {product['product'].get('description')}")
        
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")


class TestResolutionLevels:
    """Test resolution level computation"""
    
    def test_resolution_hierarchy(self, api_client, test_data):
        """Test resolution levels: instance > product > specification > type > category"""
        if not test_data.get("category_id"):
            pytest.skip("No category available")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        
        # Test category resolution
        create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": tomorrow,
            "products": [{"category_id": test_data["category_id"], "required_quantity": 1}]
        })
        intervention_id = create_response.json()["id"]
        detail = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}").json()
        assert detail["products"][0]["resolution"] == "category"
        api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
        
        # Test type resolution (if type_id available)
        if test_data.get("type_id"):
            create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
                "planned_datetime": tomorrow,
                "products": [{
                    "category_id": test_data["category_id"],
                    "type_id": test_data["type_id"],
                    "required_quantity": 1
                }]
            })
            intervention_id = create_response.json()["id"]
            detail = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}").json()
            assert detail["products"][0]["resolution"] == "type"
            api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
        
        # Test product resolution
        if test_data.get("product_id"):
            create_response = api_client.post(f"{BASE_URL}/api/interventions", json={
                "planned_datetime": tomorrow,
                "products": [{"product_id": test_data["product_id"], "required_quantity": 1}]
            })
            intervention_id = create_response.json()["id"]
            detail = api_client.get(f"{BASE_URL}/api/interventions/{intervention_id}").json()
            assert detail["products"][0]["resolution"] == "product"
            api_client.delete(f"{BASE_URL}/api/interventions/{intervention_id}")
        
        print("✓ Resolution hierarchy verified: category < type < product")


class TestOptionalSurgeonAndRoom:
    """Test that surgeon and operating_room remain optional"""
    
    def test_create_without_surgeon_and_room(self, api_client, test_data):
        """Create intervention without surgeon and room"""
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": []
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("surgeon") is None or data.get("surgeon") == ""
        assert data.get("operating_room") is None or data.get("operating_room") == ""
        
        print("✓ Created intervention without surgeon/room")
        
        api_client.delete(f"{BASE_URL}/api/interventions/{data['id']}")
    
    def test_create_with_partial_products_no_surgeon(self, api_client, test_data):
        """Create intervention with partial products but no surgeon/room"""
        if not test_data.get("category_id"):
            pytest.skip("No category available")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "planned_datetime": tomorrow,
            "products": [{"category_id": test_data["category_id"], "required_quantity": 1}]
        }
        response = api_client.post(f"{BASE_URL}/api/interventions", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify products were added
        detail = api_client.get(f"{BASE_URL}/api/interventions/{data['id']}").json()
        assert len(detail.get("products", [])) == 1
        assert detail.get("surgeon") is None or detail.get("surgeon") == ""
        
        print("✓ Created intervention with partial products, no surgeon/room")
        
        api_client.delete(f"{BASE_URL}/api/interventions/{data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
