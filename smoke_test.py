#!/usr/bin/env python3
"""
Focused smoke tests for replenishment exports and placement flow
as requested in the review.
"""

import requests
import sys
from datetime import datetime, timedelta
import json

class SmokeTestRunner:
    def __init__(self, base_url="https://restocking-flow.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def authenticate(self):
        """Get authentication token"""
        print("🔐 Authenticating...")
        
        # Try registration first
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"smoke_test_{timestamp}@hopital.fr",
            "password": "SmokeTest123!",
            "nom": "Smoke",
            "prenom": "Tester",
            "role": "utilisateur"
        }
        
        try:
            response = requests.post(f"{self.api_url}/auth/register", json=user_data)
            if response.status_code == 200:
                data = response.json()
                self.token = data['access_token']
                self.user_id = data['user']['id']
                print(f"✅ Authentication successful")
                return True
        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            return False

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 {name}")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response
            else:
                print(f"❌ Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return False, {}

    def test_replenishment_exports(self):
        """Test replenishment PDF and Excel exports"""
        print("\n📋 TESTING REPLENISHMENT EXPORTS")
        print("-" * 50)
        
        # First create some test products
        print("\n🔧 Creating test products...")
        
        product1_data = {
            "nom": "Stent Test Export",
            "type": "Stent",
            "fabricant": "ExportTech",
            "reference": "ST-EXP-001",
            "numero_grm": "GRM-EXP-001",
            "stock_minimum": 2,
            "stock_maximum": 10
        }
        
        success1, response1 = self.run_test(
            "Create Test Product 1",
            "POST",
            "products",
            200,
            data=product1_data
        )
        
        product2_data = {
            "nom": "Catheter Test Export",
            "type": "Catheter", 
            "fabricant": "ExportTech",
            "reference": "CAT-EXP-002",
            "stock_minimum": 1,
            "stock_maximum": 8
        }
        
        success2, response2 = self.run_test(
            "Create Test Product 2",
            "POST",
            "products",
            200,
            data=product2_data
        )
        
        product_ids = []
        if success1 and 'id' in response1:
            product_ids.append(response1['id'])
        if success2 and 'id' in response2:
            product_ids.append(response2['id'])
        
        if not product_ids:
            print("❌ No products created for export testing")
            return False
        
        print(f"✅ Created {len(product_ids)} test products")
        
        # Test PDF export
        export_data = {"product_ids": product_ids}
        
        print(f"\n🔍 Testing PDF Export with product IDs: {product_ids}")
        url = f"{self.api_url}/replenishment/export/pdf"
        headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.post(url, json=export_data, headers=headers)
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    print(f"✅ PDF Content-Type: {content_type}")
                else:
                    print(f"❌ Wrong PDF Content-Type: {content_type}")
                    return False
                
                # Check filename
                content_disp = response.headers.get('content-disposition', '')
                if 'Commande_CathLab' in content_disp and '.pdf' in content_disp:
                    print(f"✅ PDF Filename: {content_disp}")
                else:
                    print(f"❌ Wrong PDF filename: {content_disp}")
                    return False
                
                # Check size
                size = len(response.content)
                if size > 1000:
                    print(f"✅ PDF Size: {size} bytes")
                    self.tests_passed += 1
                else:
                    print(f"❌ PDF too small: {size} bytes")
                    return False
            else:
                print(f"❌ PDF Export failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ PDF Export error: {e}")
            return False
        
        # Test Excel export
        print(f"\n🔍 Testing Excel Export with product IDs: {product_ids}")
        url = f"{self.api_url}/replenishment/export/excel"
        
        try:
            response = requests.post(url, json=export_data, headers=headers)
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'openxmlformats' in content_type:
                    print(f"✅ Excel Content-Type: {content_type}")
                else:
                    print(f"❌ Wrong Excel Content-Type: {content_type}")
                    return False
                
                # Check filename
                content_disp = response.headers.get('content-disposition', '')
                if 'Commande_CathLab' in content_disp and '.xlsx' in content_disp:
                    print(f"✅ Excel Filename: {content_disp}")
                else:
                    print(f"❌ Wrong Excel filename: {content_disp}")
                    return False
                
                # Check size
                size = len(response.content)
                if size > 1000:
                    print(f"✅ Excel Size: {size} bytes")
                    self.tests_passed += 1
                else:
                    print(f"❌ Excel too small: {size} bytes")
                    return False
            else:
                print(f"❌ Excel Export failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Excel Export error: {e}")
            return False
        
        self.tests_run += 2  # Account for manual tests
        return True

    def test_placement_flow(self):
        """Test placement request -> confirm flow"""
        print("\n📍 TESTING PLACEMENT FLOW")
        print("-" * 50)
        
        # Create test locations first
        print("\n🔧 Creating test locations...")
        for i in range(5):
            timestamp = datetime.now().strftime('%H%M%S')
            microseconds = datetime.now().microsecond
            unique_id = f"{timestamp}{microseconds}{i}"[-6:]
            
            location_data = {
                "code": f"SMOKE-TEST-R1-C{unique_id}",
                "armoire": "SMOKE",
                "rangee": 1,
                "colonne": int(unique_id[-3:]),
                "qr_code": f"QR-SMOKE-R1-C{unique_id}"
            }
            
            self.run_test(
                f"Create Location {i+1}",
                "POST",
                "locations",
                200,
                data=location_data
            )
        
        # Create test product
        product_data = {
            "nom": "Placement Test Product",
            "type": "Stent",
            "fabricant": "PlacementTech",
            "reference": "PLC-TEST-001",
            "numero_grm": "GRM-PLC-001",
            "stock_minimum": 3,
            "stock_maximum": 15
        }
        
        success, response = self.run_test(
            "Create Placement Test Product",
            "POST",
            "products",
            200,
            data=product_data
        )
        
        if not success or 'id' not in response:
            print("❌ Failed to create test product for placement")
            return False
        
        product_id = response['id']
        
        # Test placement request
        placement_data = {
            "product_id": product_id,
            "numero_lot": f"LOT-SMOKE-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "numero_serie": f"SER-SMOKE-{datetime.now().strftime('%H%M%S')}",
            "date_fabrication": (datetime.now() - timedelta(days=30)).isoformat(),
            "date_expiration": (datetime.now() + timedelta(days=365)).isoformat()
        }
        
        success, response = self.run_test(
            "Placement Request",
            "POST",
            "placement/request",
            200,
            data=placement_data
        )
        
        if not success:
            print("❌ Placement request failed")
            return False
        
        # Verify response structure
        required_fields = ['batch_id', 'suggested_location', 'product', 'numero_serie']
        missing_fields = [field for field in required_fields if field not in response]
        
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return False
        
        # Check product fields are not empty (should be values or '—')
        product = response.get('product', {})
        product_fields = ['nom', 'reference', 'numero_grm']
        
        for field in product_fields:
            value = product.get(field, '')
            if value == '':
                print(f"❌ Product field '{field}' is empty, should have value or '—'")
                return False
            else:
                print(f"✅ Product field '{field}': {value}")
        
        # Check numero_serie
        numero_serie = response.get('numero_serie')
        if not numero_serie:
            print(f"❌ numero_serie missing from response")
            return False
        else:
            print(f"✅ numero_serie: {numero_serie}")
        
        # Check suggested_location structure
        location = response.get('suggested_location', {})
        location_fields = ['code', 'qr_code', 'armoire', 'rangee', 'colonne']
        missing_location_fields = [field for field in location_fields if field not in location]
        
        if missing_location_fields:
            print(f"❌ Missing location fields: {missing_location_fields}")
            return False
        
        print(f"✅ Suggested location: {location['code']} (QR: {location['qr_code']})")
        
        # Test placement confirm
        batch_id = response['batch_id']
        location_qr_code = location['qr_code']
        
        confirm_data = {
            "batch_id": batch_id,
            "location_qr_code": location_qr_code
        }
        
        success, response = self.run_test(
            "Placement Confirm",
            "POST",
            "placement/confirm",
            200,
            data=confirm_data
        )
        
        if not success:
            print("❌ Placement confirm failed")
            return False
        
        # Verify confirm response
        if not response.get('success'):
            print(f"❌ Placement confirm success field is not true")
            return False
        
        print(f"✅ Placement confirmed: {response.get('message')}")
        
        # Verify movement was created
        success, movements = self.run_test(
            "Get Batch Movements",
            "GET",
            f"movements/batch/{batch_id}",
            200
        )
        
        if success and movements:
            entree_movements = [m for m in movements if m.get('type') == 'entrée']
            if entree_movements:
                print(f"✅ Movement entry created: {entree_movements[0].get('type')} - {entree_movements[0].get('quantite')} unit(s)")
            else:
                print(f"❌ No 'entrée' movement found")
                return False
        else:
            print(f"❌ Failed to verify movement creation")
            return False
        
        return True

def main():
    print("🚀 Running Smoke Tests for Replenishment Exports & Placement Flow")
    print("=" * 70)
    
    tester = SmokeTestRunner()
    
    # Authenticate
    if not tester.authenticate():
        print("❌ Authentication failed, cannot proceed")
        return 1
    
    # Run focused tests
    export_success = tester.test_replenishment_exports()
    placement_success = tester.test_placement_flow()
    
    # Results
    print("\n" + "=" * 70)
    print("📊 SMOKE TEST RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    print("\n🎯 SPECIFIC TEST RESULTS:")
    print(f"   Replenishment Exports: {'✅ PASS' if export_success else '❌ FAIL'}")
    print(f"   Placement Flow: {'✅ PASS' if placement_success else '❌ FAIL'}")
    
    if export_success and placement_success:
        print("\n✅ All smoke tests PASSED - No regressions detected")
        return 0
    else:
        print("\n❌ Some smoke tests FAILED - Regressions detected")
        return 1

if __name__ == "__main__":
    sys.exit(main())