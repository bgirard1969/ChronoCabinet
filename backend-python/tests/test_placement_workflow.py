"""
Test suite for PO/Placement workflow refactoring
Tests:
1. GET /api/batches/pending-placement - returns batches with 'en_attente_placement' status
2. POST /api/batches/scan-for-placement - identifies scenarios A (collected), B (from PO), C (unknown)
3. POST /api/batches/confirm-placement - validates product type against location type
4. POST /api/purchase-orders/{po_id}/receive-item - creates batch with 'en_attente_placement' status
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "benoit.girard@atmshealth.com"
ADMIN_PASSWORD = "Salut123"


class TestPlacementWorkflow:
    """Test the new placement workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = response.json().get("user")
        print(f"✓ Logged in as {ADMIN_EMAIL}")
    
    def test_01_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json().get("status") == "ok"
        print("✓ Health check passed")
    
    def test_02_get_pending_placement_batches(self):
        """Test GET /api/batches/pending-placement returns batches with correct status"""
        response = self.session.get(f"{BASE_URL}/api/batches/pending-placement")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        batches = response.json()
        assert isinstance(batches, list), "Response should be a list"
        
        print(f"✓ Found {len(batches)} batches pending placement")
        
        # Verify each batch has correct status and product info
        for batch in batches:
            assert batch.get('statut') == 'en_attente_placement', f"Batch {batch.get('id')} has wrong status: {batch.get('statut')}"
            
            # Check product info is included
            if batch.get('product'):
                product = batch['product']
                print(f"  - Batch {batch.get('numero_serie')}: Product '{product.get('nom')}', Type: '{product.get('type')}'")
                assert 'type' in product, "Product should include type field"
        
        return batches
    
    def test_03_scan_for_placement_existing_pending(self):
        """Test POST /api/batches/scan-for-placement with existing pending batch (Case B)"""
        # First get pending batches
        pending_response = self.session.get(f"{BASE_URL}/api/batches/pending-placement")
        pending_batches = pending_response.json()
        
        if not pending_batches:
            pytest.skip("No pending batches to test with")
        
        # Use first pending batch
        test_batch = pending_batches[0]
        serial = test_batch.get('numero_serie')
        
        response = self.session.post(f"{BASE_URL}/api/batches/scan-for-placement", json={
            "code": serial
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get('action') == 'place_from_po', f"Expected 'place_from_po' action, got: {result.get('action')}"
        assert 'batch' in result, "Response should include batch info"
        assert result['batch'].get('numero_serie') == serial
        
        # Check product info is included
        if result['batch'].get('product'):
            assert 'type' in result['batch']['product'], "Product should include type"
        
        print(f"✓ Scan for placement (Case B - from PO) works for serial: {serial}")
        print(f"  Action: {result.get('action')}, Message: {result.get('message')}")
    
    def test_04_scan_for_placement_unknown_serial(self):
        """Test POST /api/batches/scan-for-placement with unknown serial (Case C)"""
        unknown_serial = f"UNKNOWN-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        response = self.session.post(f"{BASE_URL}/api/batches/scan-for-placement", json={
            "code": unknown_serial
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get('action') == 'create_new_order', f"Expected 'create_new_order' action, got: {result.get('action')}"
        assert result.get('serial_number') == unknown_serial
        
        print(f"✓ Scan for placement (Case C - unknown) works for serial: {unknown_serial}")
        print(f"  Action: {result.get('action')}, Message: {result.get('message')}")
    
    def test_05_scan_for_placement_collected_item(self):
        """Test POST /api/batches/scan-for-placement with collected item (Case A)"""
        # Get all batches and find one with 'sorti' or 'collecte' status
        all_batches_response = self.session.get(f"{BASE_URL}/api/batches")
        all_batches = all_batches_response.json()
        
        collected_batch = None
        for batch in all_batches:
            if batch.get('statut') in ['sorti', 'collecte', 'utilisé_partiel']:
                collected_batch = batch
                break
        
        if not collected_batch:
            print("⚠ No collected batches found to test Case A (return to stock)")
            pytest.skip("No collected batches available for testing")
        
        serial = collected_batch.get('numero_serie')
        response = self.session.post(f"{BASE_URL}/api/batches/scan-for-placement", json={
            "code": serial
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get('action') == 'return_to_stock', f"Expected 'return_to_stock' action, got: {result.get('action')}"
        
        print(f"✓ Scan for placement (Case A - collected) works for serial: {serial}")
        print(f"  Action: {result.get('action')}, Message: {result.get('message')}")
    
    def test_06_scan_for_placement_already_in_stock(self):
        """Test POST /api/batches/scan-for-placement with item already in stock"""
        # Get all batches and find one with 'disponible' status
        all_batches_response = self.session.get(f"{BASE_URL}/api/batches")
        all_batches = all_batches_response.json()
        
        available_batch = None
        for batch in all_batches:
            if batch.get('statut') == 'disponible' and batch.get('localisation'):
                available_batch = batch
                break
        
        if not available_batch:
            print("⚠ No available batches found to test 'already in stock' scenario")
            pytest.skip("No available batches with location for testing")
        
        serial = available_batch.get('numero_serie')
        response = self.session.post(f"{BASE_URL}/api/batches/scan-for-placement", json={
            "code": serial
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get('action') == 'already_in_stock', f"Expected 'already_in_stock' action, got: {result.get('action')}"
        
        print(f"✓ Scan for placement (already in stock) works for serial: {serial}")
        print(f"  Action: {result.get('action')}, Message: {result.get('message')}")
    
    def test_07_confirm_placement_missing_batch_id(self):
        """Test POST /api/batches/confirm-placement with missing batch_id"""
        response = self.session.post(f"{BASE_URL}/api/batches/confirm-placement", json={
            "location_qr_code": "A-R01-C01"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "batch_id" in response.json().get('detail', '').lower()
        print("✓ Confirm placement correctly rejects missing batch_id")
    
    def test_08_confirm_placement_missing_location(self):
        """Test POST /api/batches/confirm-placement with missing location"""
        # Get a pending batch
        pending_response = self.session.get(f"{BASE_URL}/api/batches/pending-placement")
        pending_batches = pending_response.json()
        
        if not pending_batches:
            pytest.skip("No pending batches to test with")
        
        batch_id = pending_batches[0].get('id')
        
        response = self.session.post(f"{BASE_URL}/api/batches/confirm-placement", json={
            "batch_id": batch_id
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Confirm placement correctly rejects missing location")
    
    def test_09_confirm_placement_invalid_location(self):
        """Test POST /api/batches/confirm-placement with invalid location"""
        # Get a pending batch
        pending_response = self.session.get(f"{BASE_URL}/api/batches/pending-placement")
        pending_batches = pending_response.json()
        
        if not pending_batches:
            pytest.skip("No pending batches to test with")
        
        batch_id = pending_batches[0].get('id')
        
        response = self.session.post(f"{BASE_URL}/api/batches/confirm-placement", json={
            "batch_id": batch_id,
            "location_qr_code": "INVALID-LOCATION-XYZ"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Confirm placement correctly rejects invalid location")
    
    def test_10_get_locations_for_type_validation(self):
        """Test that locations have allowed_product_type field"""
        response = self.session.get(f"{BASE_URL}/api/locations")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        locations = response.json()
        assert isinstance(locations, list), "Response should be a list"
        
        # Check if any locations have type restrictions
        locations_with_type = [loc for loc in locations if loc.get('allowed_product_type')]
        print(f"✓ Found {len(locations)} locations, {len(locations_with_type)} with type restrictions")
        
        for loc in locations_with_type[:3]:  # Show first 3
            print(f"  - {loc.get('code')}: allows '{loc.get('allowed_product_type')}'")
    
    def test_11_receive_item_creates_pending_batch(self):
        """Test POST /api/purchase-orders/{po_id}/receive-item creates batch with 'en_attente_placement' status"""
        # Get existing POs
        po_response = self.session.get(f"{BASE_URL}/api/purchase-orders")
        
        if po_response.status_code != 200:
            pytest.skip("Could not get purchase orders")
        
        pos = po_response.json()
        
        # Find a PO that's not fully received
        test_po = None
        for po in pos:
            if po.get('statut') not in ['recu_complet', 'reçue']:
                test_po = po
                break
        
        if not test_po:
            print("⚠ No POs available for receiving - skipping receive-item test")
            pytest.skip("No POs available for receiving")
        
        # Get a product from the PO items
        items = test_po.get('items', [])
        if not items:
            pytest.skip("PO has no items")
        
        product_id = items[0].get('product_id')
        
        # Create a unique serial number
        test_serial = f"TEST-RECEIVE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        response = self.session.post(f"{BASE_URL}/api/purchase-orders/{test_po['id']}/receive-item", json={
            "product_id": product_id,
            "numero_serie": test_serial,
            "date_expiration": (datetime.now() + timedelta(days=365)).isoformat()
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert 'batch_id' in result, "Response should include batch_id"
        
        # Verify the batch was created with correct status
        batch_response = self.session.get(f"{BASE_URL}/api/batches/{result['batch_id']}")
        assert batch_response.status_code == 200
        
        batch = batch_response.json()
        assert batch.get('statut') == 'en_attente_placement', f"Batch should have 'en_attente_placement' status, got: {batch.get('statut')}"
        assert batch.get('localisation') is None, "Batch should not have location assigned"
        
        print(f"✓ Receive item creates batch with 'en_attente_placement' status")
        print(f"  Batch ID: {result['batch_id']}, Serial: {test_serial}")
        
        # Clean up - delete the test batch
        # Note: We don't delete to keep test data for frontend testing


class TestProductTypeValidation:
    """Test product type validation in placement"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_product_type_in_pending_batches(self):
        """Verify product type is included in pending placement response"""
        response = self.session.get(f"{BASE_URL}/api/batches/pending-placement")
        
        assert response.status_code == 200
        batches = response.json()
        
        for batch in batches:
            if batch.get('product'):
                product = batch['product']
                assert 'type' in product, f"Product for batch {batch.get('id')} missing 'type' field"
                print(f"✓ Batch {batch.get('numero_serie')}: Product type = '{product.get('type')}'")
    
    def test_product_type_in_scan_response(self):
        """Verify product type is included in scan-for-placement response"""
        # Get a pending batch
        pending_response = self.session.get(f"{BASE_URL}/api/batches/pending-placement")
        pending_batches = pending_response.json()
        
        if not pending_batches:
            pytest.skip("No pending batches to test with")
        
        serial = pending_batches[0].get('numero_serie')
        
        response = self.session.post(f"{BASE_URL}/api/batches/scan-for-placement", json={
            "code": serial
        })
        
        assert response.status_code == 200
        result = response.json()
        
        if result.get('batch', {}).get('product'):
            product = result['batch']['product']
            assert 'type' in product, "Product in scan response missing 'type' field"
            print(f"✓ Scan response includes product type: '{product.get('type')}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
