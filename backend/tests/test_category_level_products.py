"""
Test category-level product addition for interventions
Tests the new feature where products can be added at category level without specifying model/variant
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://restocking-flow.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "benoit.girard@atmshealth.com"
ADMIN_PASSWORD = "Salut123"


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code in [200, 201]:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestCategoryLevelProducts:
    """Tests for category-level product addition in interventions"""
    
    def test_get_product_categories(self, auth_headers):
        """Test listing product categories"""
        response = requests.get(f"{BASE_URL}/api/product-categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check categories include expected ones
        cat_names = [c['description'] for c in data]
        print(f"✓ Found {len(data)} categories: {cat_names}")
        assert any('Pacemaker' in name for name in cat_names), "Pacemaker category should exist"
    
    def test_get_product_types(self, auth_headers):
        """Test listing product types (models)"""
        response = requests.get(f"{BASE_URL}/api/product-types", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} product types (models)")
    
    def test_get_product_specifications(self, auth_headers):
        """Test listing product specifications (variants)"""
        response = requests.get(f"{BASE_URL}/api/product-specifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Found {len(data)} product specifications (variants)")
    
    def test_create_intervention_with_category_level_product(self, auth_headers):
        """Test creating an intervention and adding a product at category level"""
        # First get a category ID
        cat_resp = requests.get(f"{BASE_URL}/api/product-categories", headers=auth_headers)
        categories = cat_resp.json()
        pacemaker_cat = next((c for c in categories if 'Pacemaker' in c['description']), None)
        assert pacemaker_cat, "Pacemaker category should exist"
        
        # Create a test intervention
        intv_resp = requests.post(f"{BASE_URL}/api/interventions", headers=auth_headers, json={
            "planned_datetime": "2026-04-20T10:00:00",
            "operating_room": "TEST",
            "patient_file_number": "TEST-CAT-LEVEL-001",
            "birth_date": "1985-06-15"
        })
        assert intv_resp.status_code in [200, 201]
        intv = intv_resp.json()
        intv_id = intv['id']
        print(f"✓ Created test intervention: {intv_id}")
        
        try:
            # Add product at category level (no product_id, only category_id)
            add_resp = requests.post(f"{BASE_URL}/api/interventions/{intv_id}/products", headers=auth_headers, json={
                "category_id": pacemaker_cat['id'],
                "type_id": None,
                "specification_id": None,
                "required_quantity": 1
            })
            assert add_resp.status_code in [200, 201]
            print(f"✓ Added product at category level")
            
            # Get intervention details and verify the product
            detail_resp = requests.get(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
            assert detail_resp.status_code == 200
            detail = detail_resp.json()
            
            # Verify products array
            assert 'products' in detail
            assert len(detail['products']) == 1
            
            product = detail['products'][0]
            # Verify category-level product has category info but no product_id
            assert product['category_id'] == pacemaker_cat['id']
            assert product['product_id'] is None
            assert product['type_id'] is None
            assert product['specification_id'] is None
            
            # Verify enriched category info is returned
            assert 'category' in product
            assert product['category'] is not None
            assert 'description' in product['category']
            print(f"✓ Category-level product verified: category={product['category']['description']}")
            
            # Verify resolution field
            assert product.get('resolution') == 'category'
            print(f"✓ Resolution field is 'category'")
            
        finally:
            # Cleanup: delete the test intervention
            requests.delete(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
            print(f"✓ Cleaned up test intervention")
    
    def test_add_product_at_type_level(self, auth_headers):
        """Test adding a product at type (model) level"""
        # Get categories and types
        cat_resp = requests.get(f"{BASE_URL}/api/product-categories", headers=auth_headers)
        categories = cat_resp.json()
        pacemaker_cat = next((c for c in categories if 'Pacemaker' in c['description']), None)
        
        type_resp = requests.get(f"{BASE_URL}/api/product-types", headers=auth_headers)
        types = type_resp.json()
        if not types:
            pytest.skip("No product types available")
        
        # Create test intervention
        intv_resp = requests.post(f"{BASE_URL}/api/interventions", headers=auth_headers, json={
            "planned_datetime": "2026-04-21T10:00:00",
            "operating_room": "TEST",
            "patient_file_number": "TEST-TYPE-LEVEL-001"
        })
        intv = intv_resp.json()
        intv_id = intv['id']
        
        try:
            # Add product at type level
            add_resp = requests.post(f"{BASE_URL}/api/interventions/{intv_id}/products", headers=auth_headers, json={
                "category_id": pacemaker_cat['id'] if pacemaker_cat else None,
                "type_id": types[0]['id'],
                "specification_id": None,
                "required_quantity": 2
            })
            assert add_resp.status_code in [200, 201]
            
            # Verify
            detail_resp = requests.get(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
            detail = detail_resp.json()
            product = detail['products'][0]
            
            assert product['type_id'] == types[0]['id']
            assert product['product_id'] is None
            assert 'type' in product
            print(f"✓ Type-level product verified: type={product['type']['description']}")
            
        finally:
            requests.delete(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
    
    def test_add_specific_product(self, auth_headers):
        """Test adding a specific product (with product_id)"""
        # Get a product
        prod_resp = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        products = prod_resp.json()
        if not products:
            pytest.skip("No products available")
        
        test_product = products[0]
        
        # Create test intervention
        intv_resp = requests.post(f"{BASE_URL}/api/interventions", headers=auth_headers, json={
            "planned_datetime": "2026-04-22T10:00:00",
            "operating_room": "TEST",
            "patient_file_number": "TEST-SPECIFIC-001"
        })
        intv = intv_resp.json()
        intv_id = intv['id']
        
        try:
            # Add specific product
            add_resp = requests.post(f"{BASE_URL}/api/interventions/{intv_id}/products", headers=auth_headers, json={
                "product_id": test_product['id'],
                "required_quantity": 1
            })
            assert add_resp.status_code in [200, 201]
            
            # Verify
            detail_resp = requests.get(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
            detail = detail_resp.json()
            product = detail['products'][0]
            
            assert product['product_id'] == test_product['id']
            assert 'product' in product
            assert product['product']['description'] == test_product['description']
            assert product.get('resolution') == 'product'
            print(f"✓ Specific product verified: {product['product']['description']}")
            
        finally:
            requests.delete(f"{BASE_URL}/api/interventions/{intv_id}", headers=auth_headers)
    
    def test_intervention_detail_enrichment(self, auth_headers):
        """Test that intervention detail returns enriched category/type/spec names"""
        # Get an existing intervention with products
        intv_resp = requests.get(f"{BASE_URL}/api/interventions?filter=all", headers=auth_headers)
        interventions = intv_resp.json()
        
        # Find one with products
        intv_with_products = next((i for i in interventions if i.get('products') and len(i['products']) > 0), None)
        if not intv_with_products:
            pytest.skip("No interventions with products found")
        
        # Get detail
        detail_resp = requests.get(f"{BASE_URL}/api/interventions/{intv_with_products['id']}", headers=auth_headers)
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        
        # Check enrichment
        for product in detail['products']:
            if product.get('category_id'):
                assert 'category' in product, "Category should be enriched"
                if product['category']:
                    assert 'description' in product['category'], "Category should have description"
            if product.get('type_id'):
                assert 'type' in product, "Type should be enriched"
            if product.get('specification_id'):
                assert 'specification' in product, "Specification should be enriched"
            
            # Check resolution field
            assert 'resolution' in product, "Resolution field should be present"
            print(f"  Product resolution: {product['resolution']}")
        
        print(f"✓ Intervention detail enrichment verified for {len(detail['products'])} products")


class TestProductsModule:
    """Tests for the Products module (regression tests after dead code cleanup)"""
    
    def test_get_products_with_relations(self, auth_headers):
        """Test that products are returned with category/type/spec relations"""
        response = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        assert response.status_code == 200
        products = response.json()
        
        if products:
            product = products[0]
            # Check relations are included
            assert 'category' in product or 'category_id' in product
            assert 'type' in product or 'type_id' in product
            assert 'specification' in product or 'specification_id' in product
            print(f"✓ Products returned with relations")
    
    def test_get_product_instances(self, auth_headers):
        """Test getting instances for a product"""
        # Get a product
        prod_resp = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
        products = prod_resp.json()
        if not products:
            pytest.skip("No products available")
        
        # Get instances
        inst_resp = requests.get(f"{BASE_URL}/api/products/{products[0]['id']}/instances", headers=auth_headers)
        assert inst_resp.status_code == 200
        instances = inst_resp.json()
        assert isinstance(instances, list)
        print(f"✓ Got {len(instances)} instances for product")
    
    def test_product_crud(self, auth_headers):
        """Test product CRUD operations"""
        # Get categories for the product
        cat_resp = requests.get(f"{BASE_URL}/api/product-categories", headers=auth_headers)
        categories = cat_resp.json()
        
        # Create product
        create_resp = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json={
            "description": "TEST_PRODUCT_CRUD",
            "grm_number": "TEST123",
            "category_id": categories[0]['id'] if categories else None
        })
        assert create_resp.status_code in [200, 201]
        product = create_resp.json()
        product_id = product['id']
        print(f"✓ Created test product: {product_id}")
        
        try:
            # Update product
            update_resp = requests.put(f"{BASE_URL}/api/products/{product_id}", headers=auth_headers, json={
                "description": "TEST_PRODUCT_CRUD_UPDATED"
            })
            assert update_resp.status_code == 200
            print(f"✓ Updated test product")
            
            # Verify update
            get_resp = requests.get(f"{BASE_URL}/api/products", headers=auth_headers)
            products = get_resp.json()
            updated = next((p for p in products if p['id'] == product_id), None)
            assert updated['description'] == "TEST_PRODUCT_CRUD_UPDATED"
            print(f"✓ Verified product update")
            
        finally:
            # Delete product
            del_resp = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=auth_headers)
            assert del_resp.status_code in [200, 204]
            print(f"✓ Deleted test product")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
