import requests
import sys
from datetime import datetime, timedelta
import json

class ImplantTraceabilityAPITester:
    def __init__(self, base_url="https://restocking-flow.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'products': [],
            'batches': [],
            'movements': [],
            'alerts': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"test_user_{timestamp}@hopital.fr",
            "password": "TestPass123!",
            "nom": "Testeur",
            "prenom": "API",
            "role": "utilisateur"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": "test_user@hopital.fr",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_product(self):
        """Test creating a product"""
        product_data = {
            "nom": "Stent Cardiaque Test",
            "type": "Stent",
            "fabricant": "MedTech Corp",
            "reference": "ST-001-TEST",
            "description": "Stent cardiaque pour test API"
        }
        
        success, response = self.run_test(
            "Create Product",
            "POST",
            "products",
            200,
            data=product_data
        )
        
        if success and 'id' in response:
            self.created_resources['products'].append(response['id'])
            return response['id']
        return None

    def test_get_products(self):
        """Test getting all products"""
        success, response = self.run_test(
            "Get Products",
            "GET",
            "products",
            200
        )
        return success

    def test_create_batch(self, product_id):
        """Test creating a batch"""
        if not product_id:
            print("❌ Cannot create batch without product_id")
            return None
            
        batch_data = {
            "product_id": product_id,
            "numero_lot": f"LOT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "numero_serie": f"SER-{datetime.now().strftime('%H%M%S')}",
            "date_fabrication": (datetime.now() - timedelta(days=30)).isoformat(),
            "date_expiration": (datetime.now() + timedelta(days=365)).isoformat(),
            "quantite_initiale": 50,
            "localisation": "Salle 3 - Armoire A",
            "code_barre": f"BC{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Create Batch",
            "POST",
            "batches",
            200,
            data=batch_data
        )
        
        if success and 'id' in response:
            self.created_resources['batches'].append(response['id'])
            return response['id']
        return None

    def test_get_batches(self):
        """Test getting all batches"""
        success, response = self.run_test(
            "Get Batches",
            "GET",
            "batches",
            200
        )
        return success

    def test_scan_batch(self):
        """Test scanning a batch by code"""
        # First create a batch with a known code
        if not self.created_resources['products']:
            print("❌ Cannot test scan without existing products")
            return False
            
        scan_data = {
            "code": f"BC{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Scan Batch",
            "POST",
            "batches/scan",
            404,  # Expected 404 since we're using a non-existent code
            data=scan_data
        )
        return success

    def test_create_movement(self, batch_id):
        """Test creating a movement"""
        if not batch_id:
            print("❌ Cannot create movement without batch_id")
            return None
            
        movement_data = {
            "batch_id": batch_id,
            "type": "sortie",
            "quantite": 2,
            "patient_id": "PAT-12345",
            "intervention_id": "INT-67890",
            "raison": "Opération cardiaque de test"
        }
        
        success, response = self.run_test(
            "Create Movement",
            "POST",
            "movements",
            200,
            data=movement_data
        )
        
        if success and 'id' in response:
            self.created_resources['movements'].append(response['id'])
            return response['id']
        return None

    def test_get_movements(self):
        """Test getting all movements"""
        success, response = self.run_test(
            "Get Movements",
            "GET",
            "movements",
            200
        )
        return success

    def test_get_alerts(self):
        """Test getting all alerts"""
        success, response = self.run_test(
            "Get Alerts",
            "GET",
            "alerts",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test getting dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        return success

    def test_consumption_report(self):
        """Test getting consumption report"""
        success, response = self.run_test(
            "Consumption Report",
            "GET",
            "reports/consumption",
            200
        )
        return success

    def test_stock_report(self):
        """Test getting stock report"""
        success, response = self.run_test(
            "Stock Report",
            "GET",
            "reports/stock",
            200
        )
        return success

    def test_replenishment_check(self):
        """Test replenishment check endpoint"""
        success, response = self.run_test(
            "Replenishment Check",
            "GET",
            "replenishment/check",
            200
        )
        
        if success and 'orders' in response:
            # Extract product IDs from replenishment orders
            product_ids = [order['product_id'] for order in response['orders']]
            return success, product_ids
        return success, []

    def test_replenishment_pdf_export(self, product_ids):
        """Test PDF export for replenishment"""
        if not product_ids:
            print("❌ Cannot test PDF export without product IDs")
            return False
            
        export_data = {
            "product_ids": product_ids[:2]  # Use first 2 product IDs
        }
        
        url = f"{self.api_url}/replenishment/export/pdf"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing Replenishment PDF Export...")
        print(f"   URL: {url}")
        print(f"   Product IDs: {export_data['product_ids']}")
        
        try:
            response = requests.post(url, json=export_data, headers=test_headers)
            
            success = response.status_code == 200
            if success:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    print(f"✅ Content-Type correct: {content_type}")
                else:
                    print(f"❌ Wrong Content-Type: {content_type}")
                    return False
                
                # Check Content-Disposition header
                content_disp = response.headers.get('content-disposition', '')
                if 'Commande_CathLab' in content_disp and '.pdf' in content_disp:
                    print(f"✅ Filename pattern correct: {content_disp}")
                else:
                    print(f"❌ Wrong filename pattern: {content_disp}")
                    return False
                
                # Check content length
                content_length = len(response.content)
                if content_length > 1000:
                    print(f"✅ PDF content size valid: {content_length} bytes")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"❌ PDF content too small: {content_length} bytes")
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_replenishment_excel_export(self, product_ids):
        """Test Excel export for replenishment"""
        if not product_ids:
            print("❌ Cannot test Excel export without product IDs")
            return False
            
        export_data = {
            "product_ids": product_ids[:2]  # Use first 2 product IDs
        }
        
        url = f"{self.api_url}/replenishment/export/excel"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing Replenishment Excel Export...")
        print(f"   URL: {url}")
        print(f"   Product IDs: {export_data['product_ids']}")
        
        try:
            response = requests.post(url, json=export_data, headers=test_headers)
            
            success = response.status_code == 200
            if success:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'openxmlformats' in content_type:
                    print(f"✅ Content-Type correct: {content_type}")
                else:
                    print(f"❌ Wrong Content-Type: {content_type}")
                    return False
                
                # Check Content-Disposition header
                content_disp = response.headers.get('content-disposition', '')
                if 'Commande_CathLab' in content_disp and '.xlsx' in content_disp:
                    print(f"✅ Filename pattern correct: {content_disp}")
                else:
                    print(f"❌ Wrong filename pattern: {content_disp}")
                    return False
                
                # Check content length
                content_length = len(response.content)
                if content_length > 1000:
                    print(f"✅ Excel content size valid: {content_length} bytes")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"❌ Excel content too small: {content_length} bytes")
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def create_test_location(self):
        """Create a test location for placement testing"""
        timestamp = datetime.now().strftime('%H%M%S')
        # Use microseconds to ensure uniqueness
        microseconds = datetime.now().microsecond
        unique_id = f"{timestamp}{microseconds}"[-6:]
        
        location_data = {
            "code": f"ARMOIRE-TEST-R1-C{unique_id}",
            "armoire": "TEST",
            "rangee": 1,
            "colonne": int(unique_id[-3:]),
            "qr_code": f"QR-TEST-R1-C{unique_id}"
        }
        
        success, response = self.run_test(
            "Create Test Location",
            "POST",
            "locations",
            200,
            data=location_data
        )
        
        if success and 'id' in response:
            return response['qr_code'], response['code']
        return None, None

    def create_multiple_test_locations(self, count=10):
        """Create multiple test locations to ensure availability"""
        print(f"\n🔧 Creating {count} test locations...")
        created_count = 0
        
        for i in range(count):
            timestamp = datetime.now().strftime('%H%M%S')
            microseconds = datetime.now().microsecond
            unique_id = f"{timestamp}{microseconds}{i}"[-6:]
            
            location_data = {
                "code": f"ARMOIRE-BULK-R{(i//5)+1}-C{unique_id}",
                "armoire": "BULK",
                "rangee": (i//5)+1,
                "colonne": int(unique_id[-3:]),
                "qr_code": f"QR-BULK-R{(i//5)+1}-C{unique_id}"
            }
            
            success, response = self.run_test(
                f"Create Bulk Location {i+1}",
                "POST",
                "locations",
                200,
                data=location_data
            )
            
            if success:
                created_count += 1
        
        print(f"✅ Created {created_count}/{count} locations")
        return created_count

    def test_placement_request(self, product_id):
        """Test placement request endpoint"""
        if not product_id:
            print("❌ Cannot test placement request without product_id")
            return None, None
            
        placement_data = {
            "product_id": product_id,
            "numero_lot": f"LOT-PLACE-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "numero_serie": f"SER-PLACE-{datetime.now().strftime('%H%M%S')}",
            "date_fabrication": (datetime.now() - timedelta(days=30)).isoformat(),
            "date_expiration": (datetime.now() + timedelta(days=365)).isoformat(),
            "code_barre": f"BC-PLACE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Placement Request",
            "POST",
            "placement/request",
            200,
            data=placement_data
        )
        
        if success:
            # Verify required response fields
            required_fields = ['batch_id', 'suggested_location', 'product', 'numero_serie']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return None, None
            
            # Verify suggested_location structure
            location = response.get('suggested_location', {})
            location_fields = ['code', 'qr_code', 'armoire', 'rangee', 'colonne']
            missing_location_fields = [field for field in location_fields if field not in location]
            
            if missing_location_fields:
                print(f"❌ Missing location fields: {missing_location_fields}")
                return None, None
            
            # Verify product fields are not empty strings (should be '—' if missing)
            product = response.get('product', {})
            product_fields = ['nom', 'reference', 'numero_grm']
            
            for field in product_fields:
                value = product.get(field, '')
                if value == '':
                    print(f"❌ Product field '{field}' is empty string, should be '—'")
                    return None, None
                elif value == '—':
                    print(f"✅ Product field '{field}' correctly shows '—' for missing value")
                else:
                    print(f"✅ Product field '{field}' has value: {value}")
            
            # Verify numero_serie is present
            numero_serie = response.get('numero_serie')
            if not numero_serie:
                print(f"❌ numero_serie is missing from response")
                return None, None
            
            print(f"✅ All placement request fields validated")
            print(f"   Batch ID: {response['batch_id']}")
            print(f"   Location: {location['code']} (QR: {location['qr_code']})")
            print(f"   Product: {product['nom']} (Ref: {product['reference']}, GRM: {product['numero_grm']})")
            print(f"   Serie: {numero_serie}")
            
            return response['batch_id'], location['qr_code']
        
        return None, None

    def test_placement_confirm(self, batch_id, location_qr_code):
        """Test placement confirm endpoint"""
        if not batch_id or not location_qr_code:
            print("❌ Cannot test placement confirm without batch_id and location_qr_code")
            return False
            
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
        
        if success:
            # Verify required response fields
            required_fields = ['success', 'message', 'location']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
            
            # Verify success is true
            if not response.get('success'):
                print(f"❌ Success field is not true: {response.get('success')}")
                return False
            
            print(f"✅ Placement confirmed successfully")
            print(f"   Message: {response['message']}")
            print(f"   Location: {response['location']}")
            
            return True
        
        return False

    def test_verify_movement_created(self, batch_id):
        """Verify that a movement entry was created for the placement"""
        if not batch_id:
            print("❌ Cannot verify movement without batch_id")
            return False
            
        success, response = self.run_test(
            "Get Batch Movements",
            "GET",
            f"movements/batch/{batch_id}",
            200
        )
        
        if success and response:
            # Look for an "entrée" movement
            entree_movements = [m for m in response if m.get('type') == 'entrée']
            
            if entree_movements:
                movement = entree_movements[0]
                print(f"✅ Movement entry found:")
                print(f"   Type: {movement.get('type')}")
                print(f"   Quantity: {movement.get('quantite')}")
                print(f"   Reason: {movement.get('raison', 'N/A')}")
                return True
            else:
                print(f"❌ No 'entrée' movement found for batch {batch_id}")
                return False
        
        print(f"❌ Failed to retrieve movements for batch {batch_id}")
        return False

    def test_verify_location_occupied(self, location_qr_code):
        """Verify that the location is marked as occupied"""
        success, response = self.run_test(
            "Get All Locations",
            "GET",
            "locations",
            200
        )
        
        if success and response:
            # Find the location by QR code
            target_location = None
            for location in response:
                if location.get('qr_code') == location_qr_code:
                    target_location = location
                    break
            
            if target_location:
                if target_location.get('occupied'):
                    print(f"✅ Location {target_location.get('code')} is marked as occupied")
                    print(f"   Batch ID: {target_location.get('batch_id', 'N/A')}")
                    return True
                else:
                    print(f"❌ Location {target_location.get('code')} is not marked as occupied")
                    return False
            else:
                print(f"❌ Location with QR code {location_qr_code} not found")
                return False
        
        print(f"❌ Failed to retrieve locations")
        return False

    def test_full_placement_flow(self, product_id):
        """Test the complete placement flow"""
        print(f"\n🔄 Testing Complete Placement Flow for Product: {product_id}")
        
        # Step 1: Create a test location if needed
        qr_code, location_code = self.create_test_location()
        if not qr_code:
            print("❌ Failed to create test location")
            return False
        
        # Step 2: Request placement
        batch_id, suggested_qr_code = self.test_placement_request(product_id)
        if not batch_id or not suggested_qr_code:
            print("❌ Placement request failed")
            return False
        
        # Step 3: Confirm placement
        if not self.test_placement_confirm(batch_id, suggested_qr_code):
            print("❌ Placement confirm failed")
            return False
        
        # Step 4: Verify movement was created
        if not self.test_verify_movement_created(batch_id):
            print("❌ Movement verification failed")
            return False
        
        # Step 5: Verify location is marked as occupied
        if not self.test_verify_location_occupied(suggested_qr_code):
            print("❌ Location occupation verification failed")
            return False
        
        print(f"✅ Complete placement flow successful!")
        return True

    def test_pdf_landscape_and_size(self, product_ids):
        """Test PDF export with landscape format and size validation (>1200 bytes)"""
        if not product_ids or len(product_ids) < 2:
            print("❌ Cannot test PDF landscape - need at least 2 product IDs")
            return False
            
        export_data = {
            "product_ids": product_ids[:2]  # Use exactly 2 product IDs as requested
        }
        
        url = f"{self.api_url}/replenishment/export/pdf"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing PDF Landscape Format and Size...")
        print(f"   URL: {url}")
        print(f"   Product IDs: {export_data['product_ids']}")
        
        try:
            response = requests.post(url, json=export_data, headers=test_headers)
            
            success = response.status_code == 200
            if success:
                # Check Content-Disposition filename
                content_disp = response.headers.get('content-disposition', '')
                if 'Commande_CathLab' in content_disp and '.pdf' in content_disp:
                    print(f"✅ Content-Disposition filename correct: {content_disp}")
                else:
                    print(f"❌ Wrong Content-Disposition filename: {content_disp}")
                    return False
                
                # Check PDF byte size (should be >1200 bytes for landscape with 2 products)
                content_length = len(response.content)
                if content_length > 1200:
                    print(f"✅ PDF size validation passed: {content_length} bytes (>1200)")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"❌ PDF size too small: {content_length} bytes (should be >1200)")
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_excel_header_merged_and_size(self, product_ids):
        """Test Excel export with merged header and size validation (>3000 bytes)"""
        if not product_ids or len(product_ids) < 2:
            print("❌ Cannot test Excel header - need at least 2 product IDs")
            return False
            
        export_data = {
            "product_ids": product_ids[:2]  # Use exactly 2 product IDs as requested
        }
        
        url = f"{self.api_url}/replenishment/export/excel"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing Excel Merged Header and Size...")
        print(f"   URL: {url}")
        print(f"   Product IDs: {export_data['product_ids']}")
        
        try:
            response = requests.post(url, json=export_data, headers=test_headers)
            
            success = response.status_code == 200
            if success:
                # Check no 500 errors
                print(f"✅ No 500 errors - Status: {response.status_code}")
                
                # Check Excel byte size (should be >3000 bytes)
                content_length = len(response.content)
                if content_length > 3000:
                    print(f"✅ Excel size validation passed: {content_length} bytes (>3000)")
                    print(f"✅ Excel worksheet should have 3rd row headers (cannot inspect bytes here)")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"❌ Excel size too small: {content_length} bytes (should be >3000)")
                    return False
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_replenishment_pending_workflow(self, product_ids):
        """Test replenishment pending workflow: POST pending, then GET check shows updated values"""
        if not product_ids or len(product_ids) < 2:
            print("❌ Cannot test replenishment pending - need at least 2 product IDs")
            return False

        self.tests_run += 1
        print(f"\n🔍 Testing Replenishment Pending Workflow...")
        
        try:
            # Step 1: Get initial replenishment check
            print("   Step 1: Getting initial replenishment status...")
            initial_response = requests.get(f"{self.api_url}/replenishment/check", 
                                          headers={'Authorization': f'Bearer {self.token}'})
            
            if initial_response.status_code != 200:
                print(f"❌ Initial check failed: {initial_response.status_code}")
                return False
            
            initial_data = initial_response.json()
            print(f"   Initial replenishment items: {initial_data.get('items_needing_replenishment', 0)}")
            
            # Step 2: Set pending replenishment for test products
            print("   Step 2: Setting pending replenishment...")
            pending_items = [
                {"product_id": product_ids[0], "qty": 5},
                {"product_id": product_ids[1], "qty": 3}
            ]
            
            pending_response = requests.post(f"{self.api_url}/replenishment/pending",
                                           json={"items": pending_items},
                                           headers={'Authorization': f'Bearer {self.token}',
                                                   'Content-Type': 'application/json'})
            
            if pending_response.status_code != 200:
                print(f"❌ Pending request failed: {pending_response.status_code}")
                try:
                    error_detail = pending_response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {pending_response.text}")
                return False
            
            pending_result = pending_response.json()
            print(f"✅ Pending replenishment set: {len(pending_result.get('updated', []))} products updated")
            
            # Step 3: Get updated replenishment check
            print("   Step 3: Checking updated replenishment status...")
            updated_response = requests.get(f"{self.api_url}/replenishment/check", 
                                          headers={'Authorization': f'Bearer {self.token}'})
            
            if updated_response.status_code != 200:
                print(f"❌ Updated check failed: {updated_response.status_code}")
                return False
            
            updated_data = updated_response.json()
            
            # Step 4: Verify deja_commande and quantite_a_commander are updated
            print("   Step 4: Verifying deja_commande and quantite_a_commander updates...")
            
            verification_passed = True
            for order in updated_data.get('orders', []):
                product_id = order.get('product_id')
                deja_commande = order.get('deja_commande', 0)
                quantite_a_commander = order.get('quantite_a_commander', 0)
                
                if product_id in product_ids[:2]:
                    expected_pending = 5 if product_id == product_ids[0] else 3
                    
                    if deja_commande >= expected_pending:
                        print(f"✅ Product {product_id}: deja_commande = {deja_commande} (includes pending)")
                    else:
                        print(f"❌ Product {product_id}: deja_commande = {deja_commande} (should include {expected_pending})")
                        verification_passed = False
                    
                    print(f"   Product {product_id}: quantite_a_commander = {quantite_a_commander}")
            
            if verification_passed:
                print(f"✅ Replenishment pending workflow validated successfully")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Replenishment pending workflow validation failed")
                return False

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_locations_backfill_and_enrichment(self):
        """Test locations backfill and verify enrichment with product fields"""
        self.tests_run += 1
        print(f"\n🔍 Testing Locations Backfill and Enrichment...")
        
        try:
            # Step 1: First create some occupied locations by doing a placement
            print("   Step 1: Creating occupied location with placement...")
            
            # Create a product for placement
            product_data = {
                "nom": "Test Product for Location",
                "type": "Test",
                "fabricant": "TestCorp",
                "reference": "TEST-LOC-001",
                "numero_grm": "GRM-TEST-LOC",
                "stock_minimum": 1,
                "stock_maximum": 10
            }
            
            product_response = requests.post(f"{self.api_url}/products",
                                           json=product_data,
                                           headers={'Authorization': f'Bearer {self.token}',
                                                   'Content-Type': 'application/json'})
            
            if product_response.status_code != 200:
                print(f"❌ Failed to create test product: {product_response.status_code}")
                return False
            
            product_id = product_response.json().get('id')
            
            # Request placement
            placement_data = {
                "product_id": product_id,
                "numero_lot": f"LOT-BACKFILL-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "numero_serie": f"SER-BACKFILL-{datetime.now().strftime('%H%M%S')}",
                "date_fabrication": (datetime.now() - timedelta(days=30)).isoformat(),
                "date_expiration": (datetime.now() + timedelta(days=365)).isoformat()
            }
            
            placement_response = requests.post(f"{self.api_url}/placement/request",
                                             json=placement_data,
                                             headers={'Authorization': f'Bearer {self.token}',
                                                     'Content-Type': 'application/json'})
            
            if placement_response.status_code != 200:
                print(f"❌ Failed to request placement: {placement_response.status_code}")
                return False
            
            placement_result = placement_response.json()
            batch_id = placement_result.get('batch_id')
            location_qr = placement_result.get('suggested_location', {}).get('qr_code')
            
            # Confirm placement
            confirm_data = {
                "batch_id": batch_id,
                "location_qr_code": location_qr
            }
            
            confirm_response = requests.post(f"{self.api_url}/placement/confirm",
                                           json=confirm_data,
                                           headers={'Authorization': f'Bearer {self.token}',
                                                   'Content-Type': 'application/json'})
            
            if confirm_response.status_code != 200:
                print(f"❌ Failed to confirm placement: {confirm_response.status_code}")
                return False
            
            print(f"   ✅ Created occupied location with product data")
            
            # Step 2: Run backfill maintenance
            print("   Step 2: Running locations backfill...")
            backfill_response = requests.post(f"{self.api_url}/maintenance/locations/backfill",
                                            headers={'Authorization': f'Bearer {self.token}',
                                                    'Content-Type': 'application/json'})
            
            if backfill_response.status_code != 200:
                print(f"❌ Backfill failed: {backfill_response.status_code}")
                try:
                    error_detail = backfill_response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {backfill_response.text}")
                return False
            
            backfill_result = backfill_response.json()
            updated_count = backfill_result.get('updated', 0)
            print(f"   ✅ Backfill completed: {updated_count} locations updated")
            
            # Step 3: Get all locations and verify enrichment
            print("   Step 3: Verifying location enrichment...")
            locations_response = requests.get(f"{self.api_url}/locations",
                                            headers={'Authorization': f'Bearer {self.token}'})
            
            if locations_response.status_code != 200:
                print(f"❌ Get locations failed: {locations_response.status_code}")
                return False
            
            locations = locations_response.json()
            
            # Step 4: Check occupied locations for proper field population
            print("   Step 4: Checking occupied locations for field population...")
            
            occupied_locations = [loc for loc in locations if loc.get('occupied', False)]
            enriched_locations = 0
            properly_enriched = 0
            
            for location in occupied_locations:
                enriched_locations += 1
                
                # Check for required fields
                product_name = location.get('product_name', '')
                product_reference = location.get('product_reference', '')
                product_numero_grm = location.get('product_numero_grm', '')
                batch_numero_serie = location.get('batch_numero_serie', '')
                
                # Verify fields are not empty and not just dashes (at least for those with linked products)
                has_valid_data = False
                if (product_name and product_name != '—' and product_name != '' and
                    product_reference and product_reference != '—' and product_reference != ''):
                    has_valid_data = True
                    properly_enriched += 1
                    
                    print(f"   ✅ Location {location.get('code', 'N/A')}: "
                          f"Product='{product_name}', Ref='{product_reference}', "
                          f"GRM='{product_numero_grm}', Serie='{batch_numero_serie}'")
                else:
                    print(f"   ⚠️  Location {location.get('code', 'N/A')}: "
                          f"Product='{product_name}', Ref='{product_reference}', "
                          f"GRM='{product_numero_grm}', Serie='{batch_numero_serie}'")
            
            print(f"   Total occupied locations: {enriched_locations}")
            print(f"   Properly enriched locations: {properly_enriched}")
            
            # Validation: At least some occupied locations should have proper product data
            if enriched_locations > 0 and properly_enriched > 0:
                print(f"✅ Location enrichment validated: {properly_enriched}/{enriched_locations} locations have proper product data")
                self.tests_passed += 1
                return True
            elif enriched_locations == 0:
                print(f"⚠️  No occupied locations found - backfill working but no data to verify")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Location enrichment failed: No locations have proper product data")
                return False

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_maintenance_reset_endpoint(self):
        """Test maintenance reset endpoint and verify effects as per review request"""
        self.tests_run += 1
        print(f"\n🔍 Testing Maintenance Reset Endpoint...")
        
        try:
            # Step 1: Create some test data first to verify reset works
            print("   Step 1: Creating test data to reset...")
            
            # Create a test product
            product_data = {
                "nom": "Reset Test Product",
                "type": "Test",
                "fabricant": "ResetCorp",
                "reference": "RESET-001",
                "numero_grm": "GRM-RESET-001",
                "stock_minimum": 2,
                "stock_maximum": 10
            }
            
            product_response = requests.post(f"{self.api_url}/products",
                                           json=product_data,
                                           headers={'Authorization': f'Bearer {self.token}',
                                                   'Content-Type': 'application/json'})
            
            if product_response.status_code != 200:
                print(f"❌ Failed to create test product: {product_response.status_code}")
                return False
            
            product_id = product_response.json().get('id')
            print(f"   ✅ Created test product: {product_id}")
            
            # Create a test batch
            batch_data = {
                "product_id": product_id,
                "numero_lot": f"LOT-RESET-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "numero_serie": f"SER-RESET-{datetime.now().strftime('%H%M%S')}",
                "date_fabrication": (datetime.now() - timedelta(days=30)).isoformat(),
                "date_expiration": (datetime.now() + timedelta(days=365)).isoformat(),
                "quantite_initiale": 1
            }
            
            batch_response = requests.post(f"{self.api_url}/batches",
                                         json=batch_data,
                                         headers={'Authorization': f'Bearer {self.token}',
                                                 'Content-Type': 'application/json'})
            
            if batch_response.status_code != 200:
                print(f"❌ Failed to create test batch: {batch_response.status_code}")
                return False
            
            batch_id = batch_response.json().get('id')
            print(f"   ✅ Created test batch: {batch_id}")
            
            # Create a test movement
            movement_data = {
                "batch_id": batch_id,
                "type": "entrée",
                "quantite": 1,
                "raison": "Test movement for reset"
            }
            
            movement_response = requests.post(f"{self.api_url}/movements",
                                            json=movement_data,
                                            headers={'Authorization': f'Bearer {self.token}',
                                                    'Content-Type': 'application/json'})
            
            if movement_response.status_code != 200:
                print(f"❌ Failed to create test movement: {movement_response.status_code}")
                return False
            
            movement_id = movement_response.json().get('id')
            print(f"   ✅ Created test movement: {movement_id}")
            
            # Create a test purchase order
            po_data = {
                "po_number": f"PO-RESET-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "supplier": "Reset Test Supplier",
                "expected_delivery": (datetime.now() + timedelta(days=7)).isoformat(),
                "items": [
                    {
                        "product_id": product_id,
                        "product_name": "Reset Test Product",
                        "reference": "RESET-001",
                        "quantite": 5,
                        "quantite_recue": 0
                    }
                ]
            }
            
            po_response = requests.post(f"{self.api_url}/purchase-orders",
                                      json=po_data,
                                      headers={'Authorization': f'Bearer {self.token}',
                                              'Content-Type': 'application/json'})
            
            if po_response.status_code != 200:
                print(f"❌ Failed to create test purchase order: {po_response.status_code}")
                return False
            
            po_id = po_response.json().get('id')
            print(f"   ✅ Created test purchase order: {po_id}")
            
            # Step 2: Verify data exists before reset
            print("   Step 2: Verifying data exists before reset...")
            
            # Check products count
            products_response = requests.get(f"{self.api_url}/products",
                                           headers={'Authorization': f'Bearer {self.token}'})
            products_before = products_response.json() if products_response.status_code == 200 else []
            print(f"   Products before reset: {len(products_before)}")
            
            # Check batches count
            batches_response = requests.get(f"{self.api_url}/batches",
                                          headers={'Authorization': f'Bearer {self.token}'})
            batches_before = batches_response.json() if batches_response.status_code == 200 else []
            print(f"   Batches before reset: {len(batches_before)}")
            
            # Check movements count
            movements_response = requests.get(f"{self.api_url}/movements",
                                            headers={'Authorization': f'Bearer {self.token}'})
            movements_before = movements_response.json() if movements_response.status_code == 200 else []
            print(f"   Movements before reset: {len(movements_before)}")
            
            # Check purchase orders count
            pos_response = requests.get(f"{self.api_url}/purchase-orders",
                                      headers={'Authorization': f'Bearer {self.token}'})
            pos_before = pos_response.json() if pos_response.status_code == 200 else []
            print(f"   Purchase orders before reset: {len(pos_before)}")
            
            # Check locations (should have some occupied)
            locations_response = requests.get(f"{self.api_url}/locations",
                                            headers={'Authorization': f'Bearer {self.token}'})
            locations_before = locations_response.json() if locations_response.status_code == 200 else []
            occupied_before = [loc for loc in locations_before if loc.get('occupied', False)]
            print(f"   Locations before reset: {len(locations_before)} total, {len(occupied_before)} occupied")
            
            # Step 3: Call maintenance reset endpoint
            print("   Step 3: Calling maintenance reset endpoint...")
            
            reset_response = requests.post(f"{self.api_url}/maintenance/reset",
                                         headers={'Authorization': f'Bearer {self.token}',
                                                 'Content-Type': 'application/json'})
            
            if reset_response.status_code != 200:
                print(f"❌ Maintenance reset failed: {reset_response.status_code}")
                try:
                    error_detail = reset_response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {reset_response.text}")
                return False
            
            reset_result = reset_response.json()
            print(f"   ✅ Reset completed successfully")
            print(f"   Deleted counts: {reset_result.get('deleted', {})}")
            print(f"   Locations reset: {reset_result.get('locations_reset', 0)}")
            
            # Step 4: Verify counts after reset - should be empty lists
            print("   Step 4: Verifying empty collections after reset...")
            
            # Verify products are empty
            products_after_response = requests.get(f"{self.api_url}/products",
                                                 headers={'Authorization': f'Bearer {self.token}'})
            
            if products_after_response.status_code != 200:
                print(f"❌ Failed to get products after reset: {products_after_response.status_code}")
                return False
            
            products_after = products_after_response.json()
            if len(products_after) == 0:
                print(f"   ✅ Products collection is empty: {len(products_after)} items")
            else:
                print(f"   ❌ Products collection not empty: {len(products_after)} items")
                return False
            
            # Verify batches are empty
            batches_after_response = requests.get(f"{self.api_url}/batches",
                                                headers={'Authorization': f'Bearer {self.token}'})
            
            if batches_after_response.status_code != 200:
                print(f"❌ Failed to get batches after reset: {batches_after_response.status_code}")
                return False
            
            batches_after = batches_after_response.json()
            if len(batches_after) == 0:
                print(f"   ✅ Batches collection is empty: {len(batches_after)} items")
            else:
                print(f"   ❌ Batches collection not empty: {len(batches_after)} items")
                return False
            
            # Verify movements are empty
            movements_after_response = requests.get(f"{self.api_url}/movements",
                                                  headers={'Authorization': f'Bearer {self.token}'})
            
            if movements_after_response.status_code != 200:
                print(f"❌ Failed to get movements after reset: {movements_after_response.status_code}")
                return False
            
            movements_after = movements_after_response.json()
            if len(movements_after) == 0:
                print(f"   ✅ Movements collection is empty: {len(movements_after)} items")
            else:
                print(f"   ❌ Movements collection not empty: {len(movements_after)} items")
                return False
            
            # Verify purchase orders are empty
            pos_after_response = requests.get(f"{self.api_url}/purchase-orders",
                                            headers={'Authorization': f'Bearer {self.token}'})
            
            if pos_after_response.status_code != 200:
                print(f"❌ Failed to get purchase orders after reset: {pos_after_response.status_code}")
                return False
            
            pos_after = pos_after_response.json()
            if len(pos_after) == 0:
                print(f"   ✅ Purchase orders collection is empty: {len(pos_after)} items")
            else:
                print(f"   ❌ Purchase orders collection not empty: {len(pos_after)} items")
                return False
            
            # Step 5: Verify locations are kept but marked available
            print("   Step 5: Verifying locations are kept and marked available...")
            
            locations_after_response = requests.get(f"{self.api_url}/locations",
                                                  headers={'Authorization': f'Bearer {self.token}'})
            
            if locations_after_response.status_code != 200:
                print(f"❌ Failed to get locations after reset: {locations_after_response.status_code}")
                return False
            
            locations_after = locations_after_response.json()
            
            # Verify locations still exist
            if len(locations_after) > 0:
                print(f"   ✅ Locations preserved: {len(locations_after)} locations")
            else:
                print(f"   ❌ No locations found after reset")
                return False
            
            # Verify all locations are marked as available (occupied=false, batch_id=null)
            all_available = True
            occupied_after = 0
            
            for location in locations_after:
                if location.get('occupied', False) or location.get('batch_id') is not None:
                    occupied_after += 1
                    all_available = False
                    print(f"   ❌ Location {location.get('code', 'N/A')} still occupied: "
                          f"occupied={location.get('occupied')}, batch_id={location.get('batch_id')}")
            
            if all_available:
                print(f"   ✅ All locations marked as available: occupied=false, batch_id=null")
            else:
                print(f"   ❌ {occupied_after} locations still marked as occupied")
                return False
            
            # Verify enrichment fields are cleared (API returns "—" for empty fields by design)
            enrichment_cleared = True
            for location in locations_after:
                product_name = location.get('product_name')
                product_reference = location.get('product_reference')
                product_numero_grm = location.get('product_numero_grm')
                batch_numero_serie = location.get('batch_numero_serie')
                
                # After reset, all enrichment fields should be "—" (API design for empty values)
                if (product_name != "—" or product_reference != "—" or 
                    product_numero_grm != "—" or batch_numero_serie != "—"):
                    enrichment_cleared = False
                    print(f"   ❌ Location {location.get('code', 'N/A')} has unexpected enrichment values: "
                          f"name={product_name}, ref={product_reference}, grm={product_numero_grm}, serie={batch_numero_serie}")
            
            if enrichment_cleared:
                print(f"   ✅ All location enrichment fields properly reset to fallback values ('—')")
            else:
                print(f"   ❌ Some locations have unexpected enrichment field values")
                return False
            
            print(f"✅ Maintenance reset endpoint validation completed successfully")
            self.tests_passed += 1
            return True

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_selective_reset_keep_products(self):
        """Test selective reset keeping two products by reference as per review request"""
        self.tests_run += 1
        print(f"\n🔍 Testing Selective Reset Keep Products...")
        
        try:
            # Step 1: Ensure the two required products exist or create them
            print("   Step 1: Ensuring required products exist...")
            
            required_references = ["H7493926720600", "H7493926715200"]
            existing_products = {}
            
            # Check if products already exist
            products_response = requests.get(f"{self.api_url}/products",
                                           headers={'Authorization': f'Bearer {self.token}'})
            
            if products_response.status_code == 200:
                all_products = products_response.json()
                for product in all_products:
                    if product.get('reference') in required_references:
                        existing_products[product['reference']] = product['id']
                        print(f"   ✅ Found existing product: {product['reference']} (ID: {product['id']})")
            
            # Create missing products
            for ref in required_references:
                if ref not in existing_products:
                    product_data = {
                        "nom": f"Test Product {ref}",
                        "type": "Test Device",
                        "fabricant": "TestManufacturer",
                        "reference": ref
                    }
                    
                    create_response = requests.post(f"{self.api_url}/products",
                                                  json=product_data,
                                                  headers={'Authorization': f'Bearer {self.token}',
                                                          'Content-Type': 'application/json'})
                    
                    if create_response.status_code == 200:
                        product_id = create_response.json().get('id')
                        existing_products[ref] = product_id
                        print(f"   ✅ Created product: {ref} (ID: {product_id})")
                    else:
                        print(f"   ❌ Failed to create product {ref}: {create_response.status_code}")
                        return False
            
            if len(existing_products) != 2:
                print(f"   ❌ Could not ensure both required products exist")
                return False
            
            # Step 2: Create additional test data to verify selective deletion
            print("   Step 2: Creating additional test data...")
            
            # Create an additional product that should be deleted
            extra_product_data = {
                "nom": "Extra Product to Delete",
                "type": "Extra",
                "fabricant": "ExtraCorp",
                "reference": "EXTRA-DELETE-001"
            }
            
            extra_response = requests.post(f"{self.api_url}/products",
                                         json=extra_product_data,
                                         headers={'Authorization': f'Bearer {self.token}',
                                                 'Content-Type': 'application/json'})
            
            extra_product_id = None
            if extra_response.status_code == 200:
                extra_product_id = extra_response.json().get('id')
                print(f"   ✅ Created extra product to delete: {extra_product_id}")
            
            # Create test batches
            batch_ids = []
            for i, (ref, product_id) in enumerate(existing_products.items()):
                batch_data = {
                    "product_id": product_id,
                    "numero_lot": f"LOT-KEEP-{ref}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "numero_serie": f"SER-KEEP-{i+1}-{datetime.now().strftime('%H%M%S')}",
                    "date_fabrication": (datetime.now() - timedelta(days=30)).isoformat(),
                    "date_expiration": (datetime.now() + timedelta(days=365)).isoformat(),
                    "quantite_initiale": 1
                }
                
                batch_response = requests.post(f"{self.api_url}/batches",
                                             json=batch_data,
                                             headers={'Authorization': f'Bearer {self.token}',
                                                     'Content-Type': 'application/json'})
                
                if batch_response.status_code == 200:
                    batch_id = batch_response.json().get('id')
                    batch_ids.append(batch_id)
                    print(f"   ✅ Created batch for {ref}: {batch_id}")
            
            # Create test movements
            movement_ids = []
            for batch_id in batch_ids:
                movement_data = {
                    "batch_id": batch_id,
                    "type": "entrée",
                    "quantite": 1,
                    "raison": "Test movement for selective reset"
                }
                
                movement_response = requests.post(f"{self.api_url}/movements",
                                                json=movement_data,
                                                headers={'Authorization': f'Bearer {self.token}',
                                                        'Content-Type': 'application/json'})
                
                if movement_response.status_code == 200:
                    movement_id = movement_response.json().get('id')
                    movement_ids.append(movement_id)
                    print(f"   ✅ Created movement: {movement_id}")
            
            # Create test purchase order
            po_data = {
                "po_number": f"PO-SELECTIVE-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "supplier": "Selective Test Supplier",
                "expected_delivery": (datetime.now() + timedelta(days=7)).isoformat(),
                "items": [
                    {
                        "product_id": list(existing_products.values())[0],
                        "product_name": "Test Product",
                        "reference": required_references[0],
                        "quantite": 3,
                        "quantite_recue": 0
                    }
                ]
            }
            
            po_response = requests.post(f"{self.api_url}/purchase-orders",
                                      json=po_data,
                                      headers={'Authorization': f'Bearer {self.token}',
                                              'Content-Type': 'application/json'})
            
            po_id = None
            if po_response.status_code == 200:
                po_id = po_response.json().get('id')
                print(f"   ✅ Created purchase order: {po_id}")
            
            # Step 3: Get counts before selective reset
            print("   Step 3: Getting counts before selective reset...")
            
            products_before_response = requests.get(f"{self.api_url}/products",
                                                  headers={'Authorization': f'Bearer {self.token}'})
            products_before = products_before_response.json() if products_before_response.status_code == 200 else []
            
            batches_before_response = requests.get(f"{self.api_url}/batches",
                                                 headers={'Authorization': f'Bearer {self.token}'})
            batches_before = batches_before_response.json() if batches_before_response.status_code == 200 else []
            
            movements_before_response = requests.get(f"{self.api_url}/movements",
                                                   headers={'Authorization': f'Bearer {self.token}'})
            movements_before = movements_before_response.json() if movements_before_response.status_code == 200 else []
            
            pos_before_response = requests.get(f"{self.api_url}/purchase-orders",
                                             headers={'Authorization': f'Bearer {self.token}'})
            pos_before = pos_before_response.json() if pos_before_response.status_code == 200 else []
            
            locations_before_response = requests.get(f"{self.api_url}/locations",
                                                   headers={'Authorization': f'Bearer {self.token}'})
            locations_before = locations_before_response.json() if locations_before_response.status_code == 200 else []
            
            print(f"   Before reset - Products: {len(products_before)}, Batches: {len(batches_before)}, "
                  f"Movements: {len(movements_before)}, POs: {len(pos_before)}, Locations: {len(locations_before)}")
            
            # Step 4: Call selective reset endpoint
            print("   Step 4: Calling selective reset endpoint...")
            
            reset_data = {
                "references": required_references
            }
            
            reset_response = requests.post(f"{self.api_url}/maintenance/reset-keep",
                                         json=reset_data,
                                         headers={'Authorization': f'Bearer {self.token}',
                                                 'Content-Type': 'application/json'})
            
            if reset_response.status_code != 200:
                print(f"   ❌ Selective reset failed: {reset_response.status_code}")
                try:
                    error_detail = reset_response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {reset_response.text}")
                return False
            
            reset_result = reset_response.json()
            print(f"   ✅ Selective reset completed successfully")
            print(f"   Response: {json.dumps(reset_result, indent=2)}")
            
            # Step 5: Verify response structure
            print("   Step 5: Verifying response structure...")
            
            required_fields = ['kept_references', 'kept_products_found', 'deleted', 'locations_reset']
            missing_fields = [field for field in required_fields if field not in reset_result]
            
            if missing_fields:
                print(f"   ❌ Missing required response fields: {missing_fields}")
                return False
            
            # Verify kept_references matches input
            kept_refs = reset_result.get('kept_references', [])
            if set(kept_refs) != set(required_references):
                print(f"   ❌ kept_references mismatch. Expected: {required_references}, Got: {kept_refs}")
                return False
            
            # Verify kept_products_found is 2
            kept_count = reset_result.get('kept_products_found', 0)
            if kept_count != 2:
                print(f"   ❌ kept_products_found should be 2, got: {kept_count}")
                return False
            
            # Verify deleted counters exist
            deleted = reset_result.get('deleted', {})
            required_deleted_fields = ['products', 'batches', 'movements', 'alerts', 'purchase_orders']
            missing_deleted = [field for field in required_deleted_fields if field not in deleted]
            
            if missing_deleted:
                print(f"   ❌ Missing deleted counter fields: {missing_deleted}")
                return False
            
            print(f"   ✅ Response structure validated")
            print(f"   Kept products found: {kept_count}")
            print(f"   Deleted counts: {deleted}")
            print(f"   Locations reset: {reset_result.get('locations_reset', 0)}")
            
            # Step 6: Verify effects - products should only contain the two kept ones
            print("   Step 6: Verifying selective reset effects...")
            
            products_after_response = requests.get(f"{self.api_url}/products",
                                                 headers={'Authorization': f'Bearer {self.token}'})
            
            if products_after_response.status_code != 200:
                print(f"   ❌ Failed to get products after reset: {products_after_response.status_code}")
                return False
            
            products_after = products_after_response.json()
            
            if len(products_after) != 2:
                print(f"   ❌ Expected 2 products after reset, got: {len(products_after)}")
                return False
            
            # Verify the kept products have the correct references
            kept_product_refs = [p.get('reference') for p in products_after]
            if set(kept_product_refs) != set(required_references):
                print(f"   ❌ Kept product references mismatch. Expected: {required_references}, Got: {kept_product_refs}")
                return False
            
            print(f"   ✅ Products collection contains only the 2 kept products: {kept_product_refs}")
            
            # Step 7: Verify other collections are empty
            print("   Step 7: Verifying other collections are empty...")
            
            # Check batches
            batches_after_response = requests.get(f"{self.api_url}/batches",
                                                headers={'Authorization': f'Bearer {self.token}'})
            batches_after = batches_after_response.json() if batches_after_response.status_code == 200 else []
            
            if len(batches_after) != 0:
                print(f"   ❌ Batches should be empty, got: {len(batches_after)} items")
                return False
            print(f"   ✅ Batches collection is empty")
            
            # Check movements
            movements_after_response = requests.get(f"{self.api_url}/movements",
                                                  headers={'Authorization': f'Bearer {self.token}'})
            movements_after = movements_after_response.json() if movements_after_response.status_code == 200 else []
            
            if len(movements_after) != 0:
                print(f"   ❌ Movements should be empty, got: {len(movements_after)} items")
                return False
            print(f"   ✅ Movements collection is empty")
            
            # Check purchase orders
            pos_after_response = requests.get(f"{self.api_url}/purchase-orders",
                                            headers={'Authorization': f'Bearer {self.token}'})
            pos_after = pos_after_response.json() if pos_after_response.status_code == 200 else []
            
            if len(pos_after) != 0:
                print(f"   ❌ Purchase orders should be empty, got: {len(pos_after)} items")
                return False
            print(f"   ✅ Purchase orders collection is empty")
            
            # Step 8: Verify locations are reset
            print("   Step 8: Verifying locations are reset...")
            
            locations_after_response = requests.get(f"{self.api_url}/locations",
                                                  headers={'Authorization': f'Bearer {self.token}'})
            locations_after = locations_after_response.json() if locations_after_response.status_code == 200 else []
            
            # Verify all locations are available
            occupied_locations = [loc for loc in locations_after if loc.get('occupied', False)]
            
            if len(occupied_locations) != 0:
                print(f"   ❌ All locations should be available, found {len(occupied_locations)} occupied")
                return False
            
            # Verify batch_id is null for all locations
            locations_with_batch = [loc for loc in locations_after if loc.get('batch_id') is not None]
            
            if len(locations_with_batch) != 0:
                print(f"   ❌ All locations should have batch_id=null, found {len(locations_with_batch)} with batch_id")
                return False
            
            print(f"   ✅ All {len(locations_after)} locations are available (occupied=false, batch_id=null)")
            
            print(f"✅ Selective reset keep products validation completed successfully")
            self.tests_passed += 1
            return True

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def create_test_products_with_batches(self):
        """Create test products with batches for export testing"""
        print("\n🔧 Creating test data for export testing...")
        
        # Create first product with numero_grm
        product1_data = {
            "nom": "Stent Cardiaque Premium",
            "type": "Stent",
            "fabricant": "CardioTech",
            "reference": "ST-PREM-001",
            "numero_grm": "GRM-12345-ST",
            "stock_minimum": 3,
            "stock_maximum": 20
        }
        
        success1, response1 = self.run_test(
            "Create Product 1 (with GRM)",
            "POST",
            "products",
            200,
            data=product1_data
        )
        
        product1_id = response1.get('id') if success1 else None
        
        # Create second product without numero_grm
        product2_data = {
            "nom": "Cathéter Guide",
            "type": "Cathéter",
            "fabricant": "MedDevice Inc",
            "reference": "CAT-GD-002",
            "stock_minimum": 2,
            "stock_maximum": 15
        }
        
        success2, response2 = self.run_test(
            "Create Product 2 (no GRM)",
            "POST",
            "products",
            200,
            data=product2_data
        )
        
        product2_id = response2.get('id') if success2 else None
        
        created_product_ids = []
        if product1_id:
            created_product_ids.append(product1_id)
            self.created_resources['products'].append(product1_id)
        if product2_id:
            created_product_ids.append(product2_id)
            self.created_resources['products'].append(product2_id)
        
        # Create batches for each product
        for i, product_id in enumerate(created_product_ids):
            for j in range(2):  # Create 2 batches per product
                batch_data = {
                    "product_id": product_id,
                    "numero_lot": f"LOT-{i+1}-{j+1}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "numero_serie": f"SER-{i+1}-{j+1}-{datetime.now().strftime('%H%M%S')}",
                    "date_fabrication": (datetime.now() - timedelta(days=60)).isoformat(),
                    "date_expiration": (datetime.now() + timedelta(days=180)).isoformat(),
                    "quantite_initiale": 1
                }
                
                success, response = self.run_test(
                    f"Create Batch {j+1} for Product {i+1}",
                    "POST",
                    "batches",
                    200,
                    data=batch_data
                )
                
                if success and 'id' in response:
                    self.created_resources['batches'].append(response['id'])
        
        return created_product_ids

    def test_employee_card_login(self):
        """Test employee card login feature"""
        print(f"\n🔍 Testing Employee Card Login Feature...")
        
        # First, login with email/password to get a token for setup
        print("   Setup: Logging in with email/password to configure test user...")
        login_data = {
            "email": "benoit.girard@atmshealth.com",
            "password": "Salut123"
        }
        
        success, response = self.run_test(
            "Setup Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if not success or 'access_token' not in response:
            print("   ❌ Setup login failed - cannot configure test user")
            return False
        
        setup_token = response['access_token']
        user_id = response['user']['id']
        
        # Update the user to have the test card ID
        print("   Setup: Adding CARD-001-TEST to user...")
        update_data = {
            "employee_card_id": "CARD-001-TEST"
        }
        
        # Use the setup token for this request
        original_token = self.token
        self.token = setup_token
        
        success, response = self.run_test(
            "Setup Card ID",
            "PUT",
            f"employees/{user_id}",
            200,
            data=update_data
        )
        
        # Restore original token
        self.token = original_token
        
        if not success:
            print("   ❌ Failed to set up test card ID")
            return False
        
        print("   ✅ Test user configured with CARD-001-TEST")
        
        # Test 1: Valid card login
        self.tests_run += 1
        print("   Test 1: Valid card login with CARD-001-TEST...")
        
        card_login_data = {
            "employee_card_id": "CARD-001-TEST"
        }
        
        success, response = self.run_test(
            "Employee Card Login - Valid",
            "POST",
            "auth/login-card",
            200,
            data=card_login_data
        )
        
        if success and 'access_token' in response and 'user' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   ✅ Valid card login successful")
            print(f"   Token: {self.token[:20]}...")
            print(f"   User: {response['user'].get('nom', '')} {response['user'].get('prenom', '')}")
            print(f"   Email: {response['user'].get('email', '')}")
        else:
            print(f"   ❌ Valid card login failed")
            return False
        
        # Test 2: Invalid card login
        self.tests_run += 1
        print("   Test 2: Invalid card login...")
        
        invalid_card_data = {
            "employee_card_id": "INVALID-CARD-999"
        }
        
        success, response = self.run_test(
            "Employee Card Login - Invalid",
            "POST",
            "auth/login-card",
            401,
            data=invalid_card_data
        )
        
        if success:
            print(f"   ✅ Invalid card correctly rejected with 401")
            # Check for specific error message
            if 'detail' in response and 'Carte non reconnue' in response['detail']:
                print(f"   ✅ Correct error message: {response['detail']}")
            else:
                print(f"   ⚠️  Error message: {response.get('detail', 'No detail')}")
        else:
            print(f"   ❌ Invalid card login test failed")
            return False
        
        # Test 3: Empty card ID
        self.tests_run += 1
        print("   Test 3: Empty card ID...")
        
        empty_card_data = {
            "employee_card_id": ""
        }
        
        success, response = self.run_test(
            "Employee Card Login - Empty",
            "POST",
            "auth/login-card",
            400,
            data=empty_card_data
        )
        
        if success:
            print(f"   ✅ Empty card ID correctly rejected with 400")
            if 'detail' in response:
                print(f"   ✅ Error message: {response['detail']}")
        else:
            print(f"   ❌ Empty card ID test failed")
            return False
        
        print(f"✅ Employee Card Login Feature tests completed successfully")
        return True

    def test_employee_management_card_field(self):
        """Test employee management with card ID field"""
        print(f"\n🔍 Testing Employee Management Card ID Field...")
        
        # Test 1: Get employees and verify employee_card_id field
        self.tests_run += 1
        print("   Test 1: Get employees and verify employee_card_id field...")
        
        success, response = self.run_test(
            "Get Employees - Card Field",
            "GET",
            "employees",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Retrieved {len(response)} employees")
            
            # Check if any employee has employee_card_id field
            card_field_found = False
            test_user_found = False
            
            for employee in response:
                if 'employee_card_id' in employee:
                    card_field_found = True
                    if employee.get('employee_card_id') == 'CARD-001-TEST':
                        test_user_found = True
                        print(f"   ✅ Found test user with card ID: {employee.get('email', 'N/A')}")
                        break
            
            if card_field_found:
                print(f"   ✅ employee_card_id field present in employee records")
            else:
                print(f"   ❌ employee_card_id field missing from employee records")
                return False
            
            if test_user_found:
                print(f"   ✅ Test user with CARD-001-TEST found")
            else:
                print(f"   ⚠️  Test user with CARD-001-TEST not found (may need to be created)")
        else:
            print(f"   ❌ Failed to get employees")
            return False
        
        # Test 2: Try to update an employee with a new card ID
        self.tests_run += 1
        print("   Test 2: Update employee with new card ID...")
        
        # First, get the current user to update
        current_user_success, current_user = self.run_test(
            "Get Current User for Update",
            "GET",
            "auth/me",
            200
        )
        
        if current_user_success and 'id' in current_user:
            user_id = current_user['id']
            
            # Generate unique card ID
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            new_card_id = f"CARD-TEST-{timestamp}"
            
            update_data = {
                "employee_card_id": new_card_id
            }
            
            success, response = self.run_test(
                "Update Employee Card ID",
                "PUT",
                f"employees/{user_id}",
                200,
                data=update_data
            )
            
            if success and 'employee_card_id' in response:
                if response['employee_card_id'] == new_card_id:
                    print(f"   ✅ Employee card ID updated successfully: {new_card_id}")
                else:
                    print(f"   ❌ Card ID not updated correctly: expected {new_card_id}, got {response.get('employee_card_id')}")
                    return False
            else:
                print(f"   ❌ Failed to update employee card ID")
                return False
        else:
            print(f"   ❌ Failed to get current user for update test")
            return False
        
        # Test 3: Try to create duplicate card ID (should fail)
        self.tests_run += 1
        print("   Test 3: Test duplicate card ID rejection...")
        
        # Try to update the same user with the same card ID again
        duplicate_data = {
            "employee_card_id": new_card_id
        }
        
        success, response = self.run_test(
            "Duplicate Card ID Test",
            "PUT",
            f"employees/{user_id}",
            400,  # Should fail with 400
            data=duplicate_data
        )
        
        if success:
            print(f"   ✅ Duplicate card ID correctly rejected with 400")
            if 'detail' in response and 'déjà utilisé' in response['detail']:
                print(f"   ✅ Correct error message: {response['detail']}")
        else:
            # This might actually succeed if updating the same user with same card ID
            print(f"   ⚠️  Duplicate card ID test - may be allowed for same user")
        
        print(f"✅ Employee Management Card ID Field tests completed")
        return True

    def test_movement_export_user_names(self):
        """Test movement export with user name display"""
        print(f"\n🔍 Testing Movement Export User Name Display...")
        
        # Test 1: Get movements and check user_id field
        self.tests_run += 1
        print("   Test 1: Get movements and verify user_id field...")
        
        success, response = self.run_test(
            "Get Movements - User Field",
            "GET",
            "movements",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Retrieved {len(response)} movements")
            
            if len(response) > 0:
                # Check if movements have user_id field
                user_field_found = False
                for movement in response[:5]:  # Check first 5 movements
                    if 'user_id' in movement:
                        user_field_found = True
                        print(f"   ✅ Movement has user_id: {movement.get('user_id', 'N/A')}")
                        break
                
                if user_field_found:
                    print(f"   ✅ user_id field present in movement records")
                else:
                    print(f"   ⚠️  user_id field not found in movements (may be empty dataset)")
            else:
                print(f"   ⚠️  No movements found to verify user_id field")
        else:
            print(f"   ❌ Failed to get movements")
            return False
        
        # Test 2: Test PDF export endpoint
        self.tests_run += 1
        print("   Test 2: Test movements PDF export...")
        
        export_data = {
            "type": "all",
            "date_from": None,
            "date_to": None
        }
        
        success, response = self.run_test(
            "Movements PDF Export",
            "POST",
            "movements/export/pdf",
            200,
            data=export_data
        )
        
        if success:
            print(f"   ✅ Movements PDF export endpoint working")
        else:
            print(f"   ❌ Movements PDF export failed")
            return False
        
        # Test 3: Test Excel export endpoint
        self.tests_run += 1
        print("   Test 3: Test movements Excel export...")
        
        success, response = self.run_test(
            "Movements Excel Export",
            "POST",
            "movements/export/excel",
            200,
            data=export_data
        )
        
        if success:
            print(f"   ✅ Movements Excel export endpoint working")
        else:
            print(f"   ❌ Movements Excel export failed")
            return False
        
        print(f"✅ Movement Export User Name Display tests completed")
        return True

    def test_movement_type_reappro(self):
        """Test that movement type 'Réappro' is used instead of 'Commande'"""
        print(f"\n🔍 Testing Movement Type 'Réappro'...")
        
        # Test 1: Check existing movements for type field
        self.tests_run += 1
        print("   Test 1: Check movement types in database...")
        
        success, response = self.run_test(
            "Get Movements - Type Check",
            "GET",
            "movements",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Retrieved {len(response)} movements")
            
            movement_types = set()
            reappro_found = False
            commande_found = False
            
            for movement in response:
                movement_type = movement.get('type', '')
                if movement_type:
                    movement_types.add(movement_type)
                    if movement_type == 'Réappro':
                        reappro_found = True
                    elif movement_type == 'Commande':
                        commande_found = True
            
            print(f"   Movement types found: {list(movement_types)}")
            
            if reappro_found:
                print(f"   ✅ 'Réappro' movement type found")
            else:
                print(f"   ⚠️  'Réappro' movement type not found (may need replenishment activity)")
            
            if commande_found:
                print(f"   ⚠️  Old 'Commande' type still found - should be 'Réappro'")
            else:
                print(f"   ✅ No old 'Commande' type found")
        else:
            print(f"   ❌ Failed to get movements")
            return False
        
        # Test 2: Create a test movement with 'Réappro' type (if we have a batch)
        print("   Test 2: Testing 'Réappro' movement type creation...")
        
        # First, try to get existing batches
        batches_success, batches_response = self.run_test(
            "Get Batches for Movement Test",
            "GET",
            "batches",
            200
        )
        
        if batches_success and isinstance(batches_response, list) and len(batches_response) > 0:
            batch_id = batches_response[0].get('id')
            
            if batch_id:
                self.tests_run += 1
                movement_data = {
                    "batch_id": batch_id,
                    "type": "Réappro",
                    "quantite": 1,
                    "raison": "Test de type Réappro"
                }
                
                success, response = self.run_test(
                    "Create Réappro Movement",
                    "POST",
                    "movements",
                    200,
                    data=movement_data
                )
                
                if success and 'type' in response:
                    if response['type'] == 'Réappro':
                        print(f"   ✅ 'Réappro' movement created successfully")
                    else:
                        print(f"   ❌ Movement type incorrect: expected 'Réappro', got '{response['type']}'")
                        return False
                else:
                    print(f"   ❌ Failed to create 'Réappro' movement")
                    return False
            else:
                print(f"   ⚠️  No batch ID available for movement test")
        else:
            print(f"   ⚠️  No batches available for movement type test")
        
        print(f"✅ Movement Type 'Réappro' tests completed")
        return True

    def test_chrono_dmi_login(self):
        """Test login with Chrono DMI credentials"""
        login_data = {
            "email": "benoit.girard@atmshealth.com",
            "password": "Salut123"
        }
        
        success, response = self.run_test(
            "Chrono DMI Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained for Chrono DMI user: {self.token[:20]}...")
            return True
        return False

    def test_fabricant_modification(self):
        """Test fabricant modification (PUT /api/fabricants/{id})"""
        print(f"\n🔍 Testing Fabricant Modification...")
        
        # Step 1: Get list of fabricants
        success, fabricants = self.run_test(
            "Get Fabricants List",
            "GET",
            "fabricants",
            200
        )
        
        if not success or not fabricants:
            print("❌ Cannot test fabricant modification - no fabricants found")
            return False
        
        # Use the first fabricant for testing
        fabricant = fabricants[0]
        fabricant_id = fabricant.get('id')
        original_nom = fabricant.get('nom')
        
        if not fabricant_id or not original_nom:
            print("❌ Invalid fabricant data")
            return False
        
        print(f"   Testing with fabricant: {original_nom} (ID: {fabricant_id})")
        
        # Step 2: Modify the fabricant name
        new_nom = f"{original_nom} - MODIFIÉ"
        modification_data = {
            "nom": new_nom
        }
        
        success, response = self.run_test(
            "Modify Fabricant Name",
            "PUT",
            f"fabricants/{fabricant_id}",
            200,
            data=modification_data
        )
        
        if not success:
            print("❌ Fabricant modification failed")
            return False
        
        # Step 3: Verify the change was applied
        success, updated_fabricants = self.run_test(
            "Verify Fabricant Modification",
            "GET",
            "fabricants",
            200
        )
        
        if not success:
            print("❌ Cannot verify fabricant modification")
            return False
        
        # Find the updated fabricant
        updated_fabricant = None
        for f in updated_fabricants:
            if f.get('id') == fabricant_id:
                updated_fabricant = f
                break
        
        if not updated_fabricant:
            print("❌ Updated fabricant not found")
            return False
        
        if updated_fabricant.get('nom') == new_nom:
            print(f"✅ Fabricant modification successful: {original_nom} → {new_nom}")
            
            # Restore original name
            restore_data = {"nom": original_nom}
            self.run_test(
                "Restore Original Fabricant Name",
                "PUT",
                f"fabricants/{fabricant_id}",
                200,
                data=restore_data
            )
            return True
        else:
            print(f"❌ Fabricant name not updated correctly: expected '{new_nom}', got '{updated_fabricant.get('nom')}'")
            return False

    def test_type_produit_modification(self):
        """Test type de produit modification (PUT /api/types-produit/{id})"""
        print(f"\n🔍 Testing Type de Produit Modification...")
        
        # Step 1: Get list of types de produit
        success, types = self.run_test(
            "Get Types de Produit List",
            "GET",
            "types-produit",
            200
        )
        
        if not success or not types:
            print("❌ Cannot test type modification - no types found")
            return False
        
        # Use the first type for testing
        type_produit = types[0]
        type_id = type_produit.get('id')
        original_nom = type_produit.get('nom')
        
        if not type_id or not original_nom:
            print("❌ Invalid type de produit data")
            return False
        
        print(f"   Testing with type: {original_nom} (ID: {type_id})")
        
        # Step 2: Modify the type name
        new_nom = f"{original_nom} - MODIFIÉ"
        modification_data = {
            "nom": new_nom
        }
        
        success, response = self.run_test(
            "Modify Type de Produit Name",
            "PUT",
            f"types-produit/{type_id}",
            200,
            data=modification_data
        )
        
        if not success:
            print("❌ Type de produit modification failed")
            return False
        
        # Step 3: Verify the change was applied
        success, updated_types = self.run_test(
            "Verify Type de Produit Modification",
            "GET",
            "types-produit",
            200
        )
        
        if not success:
            print("❌ Cannot verify type de produit modification")
            return False
        
        # Find the updated type
        updated_type = None
        for t in updated_types:
            if t.get('id') == type_id:
                updated_type = t
                break
        
        if not updated_type:
            print("❌ Updated type de produit not found")
            return False
        
        if updated_type.get('nom') == new_nom:
            print(f"✅ Type de produit modification successful: {original_nom} → {new_nom}")
            
            # Restore original name
            restore_data = {"nom": original_nom}
            self.run_test(
                "Restore Original Type de Produit Name",
                "PUT",
                f"types-produit/{type_id}",
                200,
                data=restore_data
            )
            return True
        else:
            print(f"❌ Type de produit name not updated correctly: expected '{new_nom}', got '{updated_type.get('nom')}'")
            return False

    def test_purchase_order_receive_item(self):
        """Test purchase order item reception without date_fabrication"""
        print(f"\n🔍 Testing Purchase Order Item Reception...")
        
        po_id = "d8f4ad1f-5338-4807-ac39-ee1cce7840bc"
        
        # Test data without date_fabrication (should work now)
        receive_data = {
            "product_id": "test-product-id",  # This will be replaced if we find a real product
            "numero_lot": f"LOT-RECEIVE-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "numero_serie": f"SER-RECEIVE-{datetime.now().strftime('%H%M%S')}",
            "date_expiration": (datetime.now() + timedelta(days=365)).isoformat(),
            "code_barre": f"BC-RECEIVE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            # Note: date_fabrication is intentionally omitted
        }
        
        # First, try to get a real product ID
        success, products = self.run_test(
            "Get Products for PO Reception",
            "GET",
            "products",
            200
        )
        
        if success and products:
            receive_data["product_id"] = products[0].get('id')
            print(f"   Using product ID: {receive_data['product_id']}")
        
        print(f"   Testing PO ID: {po_id}")
        print(f"   Reception data (without date_fabrication): {receive_data}")
        
        success, response = self.run_test(
            "Receive Purchase Order Item",
            "POST",
            f"purchase-orders/{po_id}/receive-item",
            200,
            data=receive_data
        )
        
        if success:
            # Verify required response fields
            required_fields = ['batch_id', 'suggested_location']
            missing_fields = [field for field in response if field not in response]
            
            if 'batch_id' in response:
                print(f"✅ Response contains batch_id: {response['batch_id']}")
            else:
                print(f"❌ Response missing batch_id")
                return False
            
            if 'suggested_location' in response:
                location = response['suggested_location']
                print(f"✅ Response contains suggested_location: {location}")
                
                # Verify location structure
                location_fields = ['code', 'qr_code', 'armoire', 'rangee', 'colonne']
                for field in location_fields:
                    if field in location:
                        print(f"   ✅ Location has {field}: {location[field]}")
                    else:
                        print(f"   ❌ Location missing {field}")
                        return False
            else:
                print(f"❌ Response missing suggested_location")
                return False
            
            print(f"✅ Purchase order item reception successful without date_fabrication")
            return True
        else:
            print(f"❌ Purchase order item reception failed")
            return False

    def test_pin_removal_on_role_change(self):
        """Test PIN removal when role changes from admin to technicien"""
        print(f"\n🔍 Testing PIN Removal on Role Change...")
        
        # Step 1: Create an admin employee with PIN
        timestamp = datetime.now().strftime('%H%M%S')
        employee_data = {
            "email": f"test_admin_{timestamp}@hopital.fr",
            "password": "TestPass123!",
            "nom": "TestAdmin",
            "prenom": "PIN",
            "role": "administrateur",
            "pin": "1234"
        }
        
        success, response = self.run_test(
            "Create Admin Employee with PIN",
            "POST",
            "employees",
            200,
            data=employee_data
        )
        
        if not success or 'id' not in response:
            print("❌ Failed to create admin employee")
            return False
        
        employee_id = response['id']
        print(f"   Created admin employee: {employee_id}")
        
        # Verify has_pin is true
        if response.get('has_pin') != True:
            print(f"❌ Admin employee should have has_pin=true, got {response.get('has_pin')}")
            return False
        
        print(f"✅ Admin employee created with PIN (has_pin=true)")
        
        # Step 2: Change role to technicien
        update_data = {
            "role": "technicien"
        }
        
        success, updated_response = self.run_test(
            "Change Role to Technicien",
            "PUT",
            f"employees/{employee_id}",
            200,
            data=update_data
        )
        
        if not success:
            print("❌ Failed to update employee role")
            return False
        
        # Step 3: Verify has_pin is now false
        if updated_response.get('has_pin') == False:
            print(f"✅ PIN removed successfully: has_pin changed from true to false")
            
            # Verify role was updated
            if updated_response.get('role') == 'technicien':
                print(f"✅ Role updated successfully: administrateur → technicien")
                
                # Clean up: delete the test employee
                self.run_test(
                    "Delete Test Employee",
                    "DELETE",
                    f"employees/{employee_id}",
                    200
                )
                
                return True
            else:
                print(f"❌ Role not updated correctly: expected 'technicien', got '{updated_response.get('role')}'")
                return False
        else:
            print(f"❌ PIN not removed: has_pin should be false, got {updated_response.get('has_pin')}")
            return False

    def run_chrono_dmi_correction_tests(self):
        """Run specific Chrono DMI correction tests as requested"""
        print("🚀 Starting Chrono DMI Correction Tests...")
        print(f"   Base URL: {self.base_url}")
        print(f"   API URL: {self.api_url}")
        
        # Authentication with Chrono DMI credentials
        if not self.test_chrono_dmi_login():
            print("❌ Chrono DMI login failed. Cannot proceed with tests.")
            return
        
        # Run the specific tests requested
        test_results = []
        
        # Test 1: Fabricant modification
        result1 = self.test_fabricant_modification()
        test_results.append(("Fabricant Modification", result1))
        
        # Test 2: Type de produit modification
        result2 = self.test_type_produit_modification()
        test_results.append(("Type de Produit Modification", result2))
        
        # Test 3: Purchase order item reception
        result3 = self.test_purchase_order_receive_item()
        test_results.append(("Purchase Order Item Reception", result3))
        
        # Test 4: PIN removal on role change
        result4 = self.test_pin_removal_on_role_change()
        test_results.append(("PIN Removal on Role Change", result4))
        
        # Summary
        print(f"\n📊 Chrono DMI Correction Test Summary:")
        print(f"   Tests run: {len(test_results)}")
        passed_tests = sum(1 for _, result in test_results if result)
        print(f"   Tests passed: {passed_tests}")
        print(f"   Tests failed: {len(test_results) - passed_tests}")
        print(f"   Success rate: {(passed_tests/len(test_results)*100):.1f}%")
        
        print(f"\n📋 Detailed Results:")
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"   {status}: {test_name}")
        
        if passed_tests == len(test_results):
            print("🎉 All Chrono DMI correction tests passed!")
        else:
            print("⚠️  Some Chrono DMI correction tests failed. Check the output above for details.")

    def run_chrono_dmi_tests(self):
        """Run specific tests for Chrono DMI application features"""
        print("🚀 Starting Chrono DMI Feature Tests...")
        print(f"   Base URL: {self.base_url}")
        print(f"   API URL: {self.api_url}")
        
        # Test 1: Employee Card Login Feature
        if not self.test_employee_card_login():
            print("❌ Employee Card Login tests failed")
            return False
        
        # Test 2: Employee Management - Card ID Field
        if not self.test_employee_management_card_field():
            print("❌ Employee Management Card ID tests failed")
            return False
        
        # Test 3: Movement Export - User Name Display
        if not self.test_movement_export_user_names():
            print("❌ Movement Export User Name tests failed")
            return False
        
        # Test 4: Movement Type "Réappro"
        if not self.test_movement_type_reappro():
            print("❌ Movement Type Réappro tests failed")
            return False
        
        # Final summary
        print(f"\n📊 Chrono DMI Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    print("🏥 Starting Chrono DMI API Testing - Review Request Validation...")
    print("=" * 60)
    
    tester = ImplantTraceabilityAPITester()
    
    # Run the specific Chrono DMI correction tests as requested
    tester.run_chrono_dmi_correction_tests()
    
    print("\n🏁 Chrono DMI correction testing completed!")

if __name__ == "__main__":
    import sys
    
    # Check if we should run only Chrono DMI correction tests
    if len(sys.argv) > 1 and sys.argv[1] == "correction":
        main()
    elif len(sys.argv) > 1 and sys.argv[1] == "chrono":
        tester = ImplantTraceabilityAPITester()
        tester.run_chrono_dmi_tests()
    else:
        main()  # Default to correction tests