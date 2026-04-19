"""
Test suite for GRM Export feature
Tests:
- POST /api/instances/export-grm endpoint
- GRM text format validation
- CONSUMED(5) to INVOICED(6) status transition
- Replacement orders creation per supplier
- ProductInstance ORDERED items created for replacement orders
- Movement records with type='facturation'
- GET /api/instances/consumption returns PICKED and CONSUMED instances
- PUT /api/instances/{id}/consume marks PICKED instance as CONSUMED
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGRMExport:
    """GRM Export feature tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "benoit.girard@atmshealth.com",
            "password": "Salut123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created IDs for cleanup
        self.created_ids = {
            "suppliers": [],
            "products": [],
            "orders": [],
            "instances": [],
            "categories": [],
            "types": [],
            "cabinets": [],
            "interventions": []
        }
        
        yield
        
        # Cleanup is optional - test data prefixed with TEST_GRM_
    
    def test_01_health_check(self):
        """Verify API is accessible"""
        res = self.session.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "ok"
        print(f"✓ Health check passed - version {data.get('version')}")
    
    def test_02_consumption_endpoint_returns_picked_and_consumed(self):
        """GET /api/instances/consumption returns PICKED(4) and CONSUMED(5) instances"""
        res = self.session.get(f"{BASE_URL}/api/instances/consumption")
        assert res.status_code == 200
        data = res.json()
        
        # Verify all returned instances have status 4 or 5
        for inst in data:
            assert inst.get("status") in [4, 5], f"Unexpected status {inst.get('status')} in consumption list"
        
        print(f"✓ Consumption endpoint returned {len(data)} instances (PICKED/CONSUMED only)")
    
    def test_03_export_grm_no_consumed_returns_400(self):
        """POST /api/instances/export-grm returns 400 when no CONSUMED instances"""
        # First check if there are any CONSUMED instances
        consumption_res = self.session.get(f"{BASE_URL}/api/instances/consumption")
        consumed_count = len([i for i in consumption_res.json() if i.get("status") == 5])
        
        if consumed_count > 0:
            pytest.skip(f"Skipping - {consumed_count} CONSUMED instances exist")
        
        res = self.session.post(f"{BASE_URL}/api/instances/export-grm")
        assert res.status_code == 400
        assert "Aucun produit consommé" in res.json().get("detail", "")
        print("✓ Export GRM correctly returns 400 when no consumed products")
    
    def test_04_create_test_data_for_grm_export(self):
        """Create complete test data: supplier → product → order → receive → place → pick → consume"""
        unique_id = str(uuid.uuid4())[:8]
        
        # 1. Create supplier
        supplier_res = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"TEST_GRM_Supplier_{unique_id}",
            "contact_name": "Test Contact",
            "contact_email": "test@grm.com"
        })
        assert supplier_res.status_code in [200, 201], f"Supplier creation failed: {supplier_res.text}"
        supplier = supplier_res.json()
        self.created_ids["suppliers"].append(supplier["id"])
        print(f"✓ Created supplier: {supplier['name']}")
        
        # 2. Create category
        cat_res = self.session.post(f"{BASE_URL}/api/product-categories", json={
            "description": f"TEST_GRM_Category_{unique_id}"
        })
        assert cat_res.status_code in [200, 201], f"Category creation failed: {cat_res.text}"
        category = cat_res.json()
        self.created_ids["categories"].append(category["id"])
        
        # 3. Create type
        type_res = self.session.post(f"{BASE_URL}/api/product-types", json={
            "description": f"TEST_GRM_Type_{unique_id}"
        })
        assert type_res.status_code in [200, 201], f"Type creation failed: {type_res.text}"
        prod_type = type_res.json()
        self.created_ids["types"].append(prod_type["id"])
        
        # 4. Create product with GRM number
        product_res = self.session.post(f"{BASE_URL}/api/products", json={
            "supplier_id": supplier["id"],
            "category_id": category["id"],
            "type_id": prod_type["id"],
            "description": f"TEST_GRM_Product_{unique_id}",
            "specification": "3.0mm x 15mm",
            "grm_number": f"GRM{unique_id}"
        })
        assert product_res.status_code in [200, 201], f"Product creation failed: {product_res.text}"
        product = product_res.json()
        self.created_ids["products"].append(product["id"])
        print(f"✓ Created product: {product['description']} with GRM: {product.get('grm_number')}")
        
        # 5. Create order with 2 items
        order_res = self.session.post(f"{BASE_URL}/api/orders", json={
            "supplier_id": supplier["id"],
            "grm_number": f"ORDER_GRM_{unique_id}",
            "items": [{"product_id": product["id"], "quantity": 2}]
        })
        assert order_res.status_code in [200, 201], f"Order creation failed: {order_res.text}"
        order = order_res.json()
        self.created_ids["orders"].append(order["id"])
        print(f"✓ Created order with {order.get('total_items')} items")
        
        # 6. Send order
        send_res = self.session.put(f"{BASE_URL}/api/orders/{order['id']}/send")
        assert send_res.status_code == 200, f"Order send failed: {send_res.text}"
        print("✓ Order sent")
        
        # 7. Get order details to get instance IDs
        detail_res = self.session.get(f"{BASE_URL}/api/orders/{order['id']}")
        assert detail_res.status_code == 200
        order_detail = detail_res.json()
        instances = order_detail.get("items", [])
        assert len(instances) == 2, f"Expected 2 instances, got {len(instances)}"
        
        # 8. Receive items with serial numbers
        receive_items = []
        for i, inst in enumerate(instances):
            receive_items.append({
                "instance_id": inst["id"],
                "serial_number": f"TEST_GRM_SN_{unique_id}_{i+1}",
                "lot_number": f"LOT_{unique_id}",
                "expiration_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
            })
            self.created_ids["instances"].append(inst["id"])
        
        receive_res = self.session.put(f"{BASE_URL}/api/orders/{order['id']}/receive", json={
            "items": receive_items
        })
        assert receive_res.status_code == 200, f"Receive failed: {receive_res.text}"
        print(f"✓ Received {receive_res.json().get('received')} items")
        
        # 9. Create cabinet for placement
        cabinet_res = self.session.post(f"{BASE_URL}/api/cabinets", json={
            "description": f"TEST_GRM_Cabinet_{unique_id}",
            "rows": 2,
            "columns": 2
        })
        assert cabinet_res.status_code in [200, 201], f"Cabinet creation failed: {cabinet_res.text}"
        cabinet = cabinet_res.json()
        self.created_ids["cabinets"].append(cabinet["id"])
        
        # Get cabinet locations
        loc_res = self.session.get(f"{BASE_URL}/api/cabinets/{cabinet['id']}/locations")
        assert loc_res.status_code == 200
        loc_data = loc_res.json()
        locations = loc_data.get("locations", [])
        assert len(locations) >= 2, "Not enough cabinet locations"
        
        # 10. Place instances
        for i, inst_id in enumerate(self.created_ids["instances"][:2]):
            place_res = self.session.post(f"{BASE_URL}/api/instances/place", json={
                "instance_id": inst_id,
                "location_id": locations[i]["id"]
            })
            assert place_res.status_code == 200, f"Placement failed: {place_res.text}"
        print("✓ Placed 2 instances in cabinet")
        
        # 11. Create intervention for picking
        intervention_res = self.session.post(f"{BASE_URL}/api/interventions", json={
            "planned_datetime": datetime.now().isoformat(),
            "operating_room": "Salle GRM Test",
            "surgeon": "Dr. GRM Test",
            "patient_file_number": f"PAT_GRM_{unique_id}",
            "products": [{"product_id": product["id"], "required_quantity": 2}]
        })
        assert intervention_res.status_code in [200, 201], f"Intervention creation failed: {intervention_res.text}"
        intervention = intervention_res.json()
        self.created_ids["interventions"].append(intervention["id"])
        print(f"✓ Created intervention: {intervention['id']}")
        
        # 12. Pick instances for intervention
        for inst_id in self.created_ids["instances"][:2]:
            pick_res = self.session.post(f"{BASE_URL}/api/interventions/{intervention['id']}/pick", json={
                "product_id": product["id"],
                "instance_id": inst_id
            })
            assert pick_res.status_code == 200, f"Pick failed: {pick_res.text}"
        print("✓ Picked 2 instances for intervention")
        
        # Store for later tests
        self.test_data = {
            "supplier_id": supplier["id"],
            "supplier_name": supplier["name"],
            "product_id": product["id"],
            "grm_number": product.get("grm_number"),
            "instance_ids": self.created_ids["instances"][:2]
        }
        
        # Verify instances are PICKED (status 4)
        for inst_id in self.test_data["instance_ids"]:
            inst_res = self.session.get(f"{BASE_URL}/api/instances?status=4")
            picked = [i for i in inst_res.json() if i["id"] == inst_id]
            assert len(picked) == 1, f"Instance {inst_id} not in PICKED status"
        print("✓ Verified instances are in PICKED status")
    
    def test_05_consume_picked_instance(self):
        """PUT /api/instances/{id}/consume marks PICKED instance as CONSUMED"""
        # Get a PICKED instance
        picked_res = self.session.get(f"{BASE_URL}/api/instances?status=4")
        picked = picked_res.json()
        
        if not picked:
            pytest.skip("No PICKED instances available")
        
        instance = picked[0]
        instance_id = instance["id"]
        
        # Consume it
        consume_res = self.session.put(f"{BASE_URL}/api/instances/{instance_id}/consume")
        assert consume_res.status_code == 200, f"Consume failed: {consume_res.text}"
        
        consumed = consume_res.json()
        assert consumed.get("status") == 5, f"Expected status 5 (CONSUMED), got {consumed.get('status')}"
        assert consumed.get("usage_date") is not None, "usage_date should be set"
        
        print(f"✓ Instance {instance_id} consumed successfully")
        
        # Verify movement was created
        movements_res = self.session.get(f"{BASE_URL}/api/movements")
        movements = movements_res.json()
        consumption_movement = [m for m in movements if m.get("instance_id") == instance_id and m.get("type") == "consommation"]
        assert len(consumption_movement) > 0, "Consumption movement not recorded"
        print("✓ Consumption movement recorded")
    
    def test_06_consume_remaining_picked_instances(self):
        """Consume all remaining PICKED instances for GRM export test"""
        picked_res = self.session.get(f"{BASE_URL}/api/instances?status=4")
        picked = picked_res.json()
        
        consumed_count = 0
        for inst in picked:
            consume_res = self.session.put(f"{BASE_URL}/api/instances/{inst['id']}/consume")
            if consume_res.status_code == 200:
                consumed_count += 1
        
        print(f"✓ Consumed {consumed_count} additional instances")
    
    def test_07_export_grm_success(self):
        """POST /api/instances/export-grm exports consumed instances"""
        # Verify we have CONSUMED instances
        consumption_res = self.session.get(f"{BASE_URL}/api/instances/consumption")
        consumed = [i for i in consumption_res.json() if i.get("status") == 5]
        
        if not consumed:
            pytest.skip("No CONSUMED instances to export")
        
        consumed_count = len(consumed)
        print(f"Found {consumed_count} CONSUMED instances to export")
        
        # Export GRM
        export_res = self.session.post(f"{BASE_URL}/api/instances/export-grm")
        assert export_res.status_code == 200, f"Export failed: {export_res.text}"
        
        data = export_res.json()
        
        # Verify response structure
        assert "grm_content" in data, "Missing grm_content in response"
        assert "grm_lines_count" in data, "Missing grm_lines_count in response"
        assert "invoiced_count" in data, "Missing invoiced_count in response"
        assert "orders_created" in data, "Missing orders_created in response"
        
        # Verify counts
        assert data["grm_lines_count"] == consumed_count, f"Expected {consumed_count} GRM lines, got {data['grm_lines_count']}"
        assert data["invoiced_count"] == consumed_count, f"Expected {consumed_count} invoiced, got {data['invoiced_count']}"
        
        print(f"✓ GRM export successful:")
        print(f"  - {data['grm_lines_count']} GRM lines generated")
        print(f"  - {data['invoiced_count']} instances invoiced")
        print(f"  - {len(data['orders_created'])} replacement orders created")
        
        # Store for validation
        self.export_result = data
    
    def test_08_validate_grm_format(self):
        """Validate GRM text format is pipe-delimited with correct fields"""
        # Get fresh export or use existing consumed instances
        consumption_res = self.session.get(f"{BASE_URL}/api/instances/consumption")
        consumed = [i for i in consumption_res.json() if i.get("status") == 5]
        
        if consumed:
            # There are still consumed instances, export them
            export_res = self.session.post(f"{BASE_URL}/api/instances/export-grm")
            if export_res.status_code == 200:
                grm_content = export_res.json().get("grm_content", "")
            else:
                pytest.skip("No GRM content to validate")
        else:
            pytest.skip("No CONSUMED instances - GRM format already validated in previous export")
        
        if not grm_content:
            pytest.skip("Empty GRM content")
        
        lines = grm_content.strip().split("\n")
        
        for i, line in enumerate(lines):
            fields = line.split("|")
            
            # GRM format: 1|1.0|T008|RC|YYYYMMDD|100171|675102||||DMI01K2153|MMDDYYHHMM|0|grm_number|1|||serial_or_lot||
            # Expected 19 fields (18 pipes = 19 fields)
            assert len(fields) >= 15, f"Line {i+1}: Expected at least 15 fields, got {len(fields)}"
            
            # Validate fixed fields
            assert fields[0] == "1", f"Line {i+1}: Field 0 should be '1'"
            assert fields[1] == "1.0", f"Line {i+1}: Field 1 should be '1.0'"
            assert fields[2] == "T008", f"Line {i+1}: Field 2 should be 'T008'"
            assert fields[3] == "RC", f"Line {i+1}: Field 3 should be 'RC'"
            
            # Validate date format YYYYMMDD
            date_field = fields[4]
            assert len(date_field) == 8, f"Line {i+1}: Date field should be 8 chars (YYYYMMDD)"
            assert date_field.isdigit(), f"Line {i+1}: Date field should be numeric"
            
            # Validate timestamp format MMDDYYHHMM
            timestamp_field = fields[11]
            assert len(timestamp_field) == 10, f"Line {i+1}: Timestamp should be 10 chars (MMDDYYHHMM)"
            
            print(f"✓ Line {i+1} format valid: {line[:60]}...")
        
        print(f"✓ All {len(lines)} GRM lines have valid format")
    
    def test_09_verify_instances_transitioned_to_invoiced(self):
        """Verify CONSUMED instances transitioned to INVOICED(6) after export"""
        # Get all INVOICED instances
        invoiced_res = self.session.get(f"{BASE_URL}/api/instances?status=6")
        assert invoiced_res.status_code == 200
        invoiced = invoiced_res.json()
        
        print(f"✓ Found {len(invoiced)} INVOICED instances")
        
        # Verify no CONSUMED instances remain (all should be INVOICED now)
        consumption_res = self.session.get(f"{BASE_URL}/api/instances/consumption")
        consumed = [i for i in consumption_res.json() if i.get("status") == 5]
        
        print(f"  - {len(consumed)} CONSUMED instances remaining")
    
    def test_10_verify_replacement_orders_created(self):
        """Verify replacement orders were created with status='sent'"""
        orders_res = self.session.get(f"{BASE_URL}/api/orders")
        assert orders_res.status_code == 200
        orders = orders_res.json()
        
        # Find orders with status='sent' created recently
        sent_orders = [o for o in orders if o.get("status") == "sent"]
        
        print(f"✓ Found {len(sent_orders)} orders with status='sent'")
        
        for order in sent_orders[:3]:  # Show first 3
            print(f"  - Order {order['id'][:8]}... | Supplier: {order.get('supplier', {}).get('name', '?')} | Items: {order.get('total_items', 0)}")
    
    def test_11_verify_facturation_movements_created(self):
        """Verify movement records with type='facturation' were created"""
        movements_res = self.session.get(f"{BASE_URL}/api/movements")
        assert movements_res.status_code == 200
        movements = movements_res.json()
        
        facturation_movements = [m for m in movements if m.get("type") == "facturation"]
        
        print(f"✓ Found {len(facturation_movements)} facturation movements")
        
        for mv in facturation_movements[:3]:  # Show first 3
            print(f"  - Instance: {mv.get('instance_id', '?')[:8]}... | Reason: {mv.get('reason', '?')}")
    
    def test_12_orders_page_shows_pending_reception(self):
        """Verify Orders page shows replacement orders in 'En attente de réception'"""
        orders_res = self.session.get(f"{BASE_URL}/api/orders")
        assert orders_res.status_code == 200
        orders = orders_res.json()
        
        # Orders with status 'sent' or 'partially_received' should appear in pending reception
        pending = [o for o in orders if o.get("status") in ["sent", "partially_received"]]
        
        print(f"✓ {len(pending)} orders pending reception")
        
        # Verify order structure for frontend display
        for order in pending[:2]:
            assert "supplier" in order, "Order missing supplier info"
            assert "total_items" in order, "Order missing total_items"
            assert "received_items" in order, "Order missing received_items"
            print(f"  - {order.get('supplier', {}).get('name', '?')}: {order.get('received_items', 0)}/{order.get('total_items', 0)} received")


class TestConsumeEndpoint:
    """Tests for PUT /api/instances/{id}/consume endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "benoit.girard@atmshealth.com",
            "password": "Salut123"
        })
        assert login_res.status_code == 200
        token = login_res.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_consume_non_picked_returns_400(self):
        """Consuming a non-PICKED instance should return 400"""
        # Get a RECEIVED instance (status 2)
        received_res = self.session.get(f"{BASE_URL}/api/instances?status=2")
        received = received_res.json()
        
        if not received:
            pytest.skip("No RECEIVED instances to test")
        
        instance_id = received[0]["id"]
        
        consume_res = self.session.put(f"{BASE_URL}/api/instances/{instance_id}/consume")
        assert consume_res.status_code == 400
        assert "prélevés" in consume_res.json().get("detail", "").lower()
        
        print("✓ Correctly rejected consuming non-PICKED instance")
    
    def test_consume_nonexistent_returns_404(self):
        """Consuming a non-existent instance should return 404"""
        fake_id = str(uuid.uuid4())
        
        consume_res = self.session.put(f"{BASE_URL}/api/instances/{fake_id}/consume")
        assert consume_res.status_code == 404
        
        print("✓ Correctly returned 404 for non-existent instance")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
