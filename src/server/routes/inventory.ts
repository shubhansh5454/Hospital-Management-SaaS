import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { InventoryController } from '../controllers/inventory.ts';

const router = Router();

const staffRoles = requireRoles(['admin', 'doctor', 'receptionist']);

// Dashboard KPI metrics
router.get('/metrics', requireAuth, staffRoles, InventoryController.getMetrics);

// Categories
router.get('/categories', requireAuth, InventoryController.listCategories);
router.get('/categories/:id', requireAuth, InventoryController.getCategory);
router.post('/categories', requireAuth, staffRoles, InventoryController.createCategory);
router.put('/categories/:id', requireAuth, staffRoles, InventoryController.updateCategory);
router.delete('/categories/:id', requireAuth, staffRoles, InventoryController.deleteCategory);

// Vendors
router.get('/vendors', requireAuth, staffRoles, InventoryController.listVendors);
router.get('/vendors/:id', requireAuth, staffRoles, InventoryController.getVendor);
router.post('/vendors', requireAuth, staffRoles, InventoryController.createVendor);
router.put('/vendors/:id', requireAuth, staffRoles, InventoryController.updateVendor);
router.delete('/vendors/:id', requireAuth, staffRoles, InventoryController.deleteVendor);

// Products / Catalog items
router.get('/products', requireAuth, InventoryController.listProducts);
router.get('/products/:id', requireAuth, InventoryController.getProduct);
router.post('/products', requireAuth, staffRoles, InventoryController.createProduct);
router.put('/products/:id', requireAuth, staffRoles, InventoryController.updateProduct);
router.delete('/products/:id', requireAuth, staffRoles, InventoryController.deleteProduct);

// Purchase Orders (POs)
router.get('/purchase-orders', requireAuth, staffRoles, InventoryController.listPOs);
router.get('/purchase-orders/:id', requireAuth, staffRoles, InventoryController.getPO);
router.post('/purchase-orders', requireAuth, staffRoles, InventoryController.createPO);
router.put('/purchase-orders/:id/status', requireAuth, staffRoles, InventoryController.updatePOStatus);
router.post('/purchase-orders/:id/receive', requireAuth, staffRoles, InventoryController.receivePO);

// Stock movements / Transfers
router.get('/movements', requireAuth, staffRoles, InventoryController.listStockMovements);
router.post('/movements', requireAuth, staffRoles, InventoryController.recordStockMovement);

export const inventoryRouter = router;
