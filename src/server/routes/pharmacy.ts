import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { MedicineController } from '../controllers/medicine.ts';
import { MedicineService } from '../services/medicine.ts';
import { LocalStoreService, Vendor, MedicineExtended, MedicineBatch, MedicineReturn } from '../../db/localStore.ts';
import { prisma } from '../../db/prisma.ts';

const router = Router();

// --- BARCODE DISCOVERY ---
router.get('/scan', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barcode } = req.query;
    if (!barcode || typeof barcode !== 'string') {
      res.status(400).json({ error: 'Barcode parameter is required' });
      return;
    }

    const extendedList = LocalStoreService.getAllExtendedMedicines();
    const matched = extendedList.find(em => em.barcode === barcode);
    if (!matched) {
      res.status(404).json({ error: 'Medicine with this barcode not found in registry' });
      return;
    }

    const medicine = await MedicineService.getMedicineById(matched.medicineId);
    // Enrich with extended details
    const enriched = {
      ...medicine,
      barcode: matched.barcode,
      isControlled: matched.isControlled,
      dosage: matched.dosage,
      vendorId: matched.vendorId
    };

    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// --- VENDOR ENDPOINTS ---
router.get('/vendors', requireAuth, (req: Request, res: Response) => {
  const vendors = LocalStoreService.getVendors();
  res.json(vendors);
});

router.post('/vendors', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), (req: Request, res: Response) => {
  const { name, phone, email, address, drugLicense, paymentTerms } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Vendor name is required' });
    return;
  }
  const vendor = LocalStoreService.addVendor({ name, phone, email, address, drugLicense, paymentTerms });
  res.status(201).json(vendor);
});

router.put('/vendors/:id', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const updated = LocalStoreService.updateVendor(id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Vendor not found' });
    return;
  }
  res.json(updated);
});

router.delete('/vendors/:id', requireAuth, requireRoles(['admin']), (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const deleted = LocalStoreService.deleteVendor(id);
  if (!deleted) {
    res.status(404).json({ error: 'Vendor not found' });
    return;
  }
  res.json({ success: true, message: 'Vendor deleted successfully' });
});

// --- BATCH ENDPOINTS ---
router.get('/batches', requireAuth, (req: Request, res: Response) => {
  const { medicineId } = req.query;
  if (medicineId) {
    const batches = LocalStoreService.getBatchesByMedicine(parseInt(medicineId as string));
    res.json(batches);
  } else {
    const batches = LocalStoreService.getBatches();
    res.json(batches);
  }
});

router.post('/batches', requireAuth, requireRoles(['admin', 'receptionist']), (req: Request, res: Response) => {
  const { medicineId, batchNumber, expiryDate, initialQty, currentQty } = req.body;
  if (!medicineId || !batchNumber || !expiryDate) {
    res.status(400).json({ error: 'Missing batch tracking variables' });
    return;
  }
  const batch = LocalStoreService.addBatch({
    medicineId: parseInt(medicineId),
    batchNumber,
    expiryDate,
    initialQty: parseInt(initialQty),
    currentQty: parseInt(currentQty)
  });
  res.status(201).json(batch);
});

// --- RETURNS ENDPOINTS ---
router.get('/returns', requireAuth, (req: Request, res: Response) => {
  const returns = LocalStoreService.getReturns();
  res.json(returns);
});

router.post('/returns', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medicineId, quantity, returnDate, type, reason, batchNumber } = req.body;
    if (!medicineId || !quantity || !returnDate || !type) {
      res.status(400).json({ error: 'Missing return log variables' });
      return;
    }

    const medId = parseInt(medicineId);
    const qty = parseInt(quantity);

    // Fetch master medicine to verify and modify master stock
    const medicine = await MedicineService.getMedicineById(medId);
    if (!medicine) {
      res.status(404).json({ error: 'Medicine not found in Master List' });
      return;
    }

    const ret = LocalStoreService.addReturn({
      medicineId: medId,
      quantity: qty,
      returnDate,
      type,
      reason: reason || '',
      batchNumber: batchNumber || null
    });

    // Update Master Inventory Qty
    const newStock = type === 'PATIENT' ? medicine.stock + qty : Math.max(0, medicine.stock - qty);
    await prisma.medicine.update({
      where: { id: medId },
      data: { stock: newStock }
    });

    res.status(201).json(ret);
  } catch (error) {
    next(error);
  }
});

// --- EXTENDED INFO ENDPOINTS ---
router.get('/extended', requireAuth, (req: Request, res: Response) => {
  const extended = LocalStoreService.getAllExtendedMedicines();
  res.json(extended);
});

router.post('/extended', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), (req: Request, res: Response) => {
  const { medicineId, barcode, isControlled, dosage, vendorId } = req.body;
  if (!medicineId) {
    res.status(400).json({ error: 'Medicine ID is required' });
    return;
  }
  const ext = LocalStoreService.upsertExtendedMedicine(parseInt(medicineId), {
    barcode,
    isControlled: !!isControlled,
    dosage,
    vendorId: vendorId ? parseInt(vendorId) : null
  });
  res.json(ext);
});

// --- FORECASTING & PREDICTIONS ---
router.get('/forecast', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic machine learning moving-average velocity forecasting over past sales
    const medicines = await prisma.medicine.findMany({
      include: {
        sales: true
      }
    });

    const forecasts = medicines.map(med => {
      const sales = med.sales || [];
      // Calculate daily sales velocity over the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentSales = sales.filter(s => new Date(s.createdAt) >= thirtyDaysAgo);
      const totalUnitsSold = recentSales.reduce((acc, s) => acc + s.quantity, 0);
      const dailyVelocity = parseFloat((totalUnitsSold / 30).toFixed(2)); // avg units per day

      // Calculate Days Out of Stock (Days to depletion)
      const currentStock = med.stock;
      const daysToDepletion = dailyVelocity > 0 ? parseFloat((currentStock / dailyVelocity).toFixed(1)) : 999; // 999 represents high stock safety
      const status = daysToDepletion <= 7 ? 'CRITICAL' : daysToDepletion <= 30 ? 'REORDER' : 'SAFE';

      // Suggested Reorder Qty to cover next 60 days
      const suggestedReorder = dailyVelocity > 0 ? Math.ceil(dailyVelocity * 60) : 50;

      return {
        id: med.id,
        name: med.name,
        code: med.code,
        stock: currentStock,
        dailyVelocity,
        daysToDepletion,
        status,
        suggestedReorder
      };
    });

    res.json(forecasts);
  } catch (error) {
    next(error);
  }
});

router.get('/predict-expiry', requireAuth, async (req: Request, res: Response) => {
  const batches = LocalStoreService.getBatches();
  const today = new Date();
  
  const predictions = await Promise.all(batches.map(async (batch) => {
    let medicineName = 'Unknown Medicine';
    let medicineCode = 'UNK';
    try {
      const med = await prisma.medicine.findUnique({ where: { id: batch.medicineId } });
      if (med) {
        medicineName = med.name;
        medicineCode = med.code;
      }
    } catch (_) {}

    const expDate = new Date(batch.expiryDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let riskLevel: 'EXPIRED' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let recommendation = 'No action required';

    if (diffDays <= 0) {
      riskLevel = 'EXPIRED';
      recommendation = 'DO NOT SELL. Quarantine and register for vendor return or disposal immediately.';
    } else if (diffDays <= 45) {
      riskLevel = 'HIGH';
      recommendation = 'Critical Expiry Risk! Return to vendor or issue clear-out discounts immediately.';
    } else if (diffDays <= 90) {
      riskLevel = 'MEDIUM';
      recommendation = 'Approaching expiry. Shift stock to the front of racks; sell first (FEFO rule).';
    } else {
      riskLevel = 'LOW';
      recommendation = 'Stock is fresh and safe.';
    }

    return {
      batchId: batch.id,
      medicineId: batch.medicineId,
      medicineName,
      medicineCode,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      daysRemaining: diffDays,
      quantity: batch.currentQty,
      riskLevel,
      recommendation
    };
  }));

  res.json(predictions);
});


// --- ENRICHED MASTER LISTS AND DETAIL VIEWS ---

// GET /api/pharmacy (Replaces standard query with added metadata)
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, lowStock } = req.query;
    const filters = {
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      lowStock: lowStock === 'true',
    };

    const medicines = await MedicineService.getAllMedicines(filters);
    const extendedList = LocalStoreService.getAllExtendedMedicines();
    const batches = LocalStoreService.getBatches();

    // Enrich medicines with barcode, dosage, and controlled parameters
    const enriched = medicines.map(med => {
      const ext = extendedList.find(em => em.medicineId === med.id);
      const medBatches = batches.filter(b => b.medicineId === med.id);
      
      return {
        ...med,
        barcode: ext?.barcode || `890123456${1000 + med.id}`,
        isControlled: ext?.isControlled || false,
        dosage: ext?.dosage || '500mg',
        vendorId: ext?.vendorId || null,
        batches: medBatches
      };
    });

    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// GET /api/pharmacy/report
router.get('/report', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await MedicineService.generateStockReport();
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// GET /api/pharmacy/:id
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const medicine = await MedicineService.getMedicineById(id);
    const ext = LocalStoreService.getExtendedMedicine(id);
    const batches = LocalStoreService.getBatchesByMedicine(id);
    const returns = LocalStoreService.getReturns().filter(r => r.medicineId === id);

    res.json({
      ...medicine,
      barcode: ext?.barcode || `890123456${1000 + medicine.id}`,
      isControlled: ext?.isControlled || false,
      dosage: ext?.dosage || '500mg',
      vendorId: ext?.vendorId || null,
      batches,
      returns
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/pharmacy (Medicine registration)
router.post('/', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Destructure custom fields out of body
    const { barcode, isControlled, dosage, vendorId, ...masterFields } = req.body;
    
    // Create standard medicine in DB
    const medicine = await MedicineService.createMedicine(masterFields);

    // Save extended fields in file-based store
    const ext = LocalStoreService.upsertExtendedMedicine(medicine.id, {
      barcode: barcode || `890123456${1000 + medicine.id}`,
      isControlled: !!isControlled,
      dosage: dosage || '500mg',
      vendorId: vendorId ? parseInt(vendorId) : null
    });

    res.status(201).json({
      ...medicine,
      barcode: ext.barcode,
      isControlled: ext.isControlled,
      dosage: ext.dosage,
      vendorId: ext.vendorId
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/pharmacy/:id
router.put('/:id', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { barcode, isControlled, dosage, vendorId, ...masterFields } = req.body;

    const medicine = await MedicineService.updateMedicine(id, masterFields);

    // Update extended settings
    const ext = LocalStoreService.upsertExtendedMedicine(id, {
      barcode,
      isControlled: isControlled !== undefined ? !!isControlled : undefined,
      dosage,
      vendorId: vendorId !== undefined ? (vendorId ? parseInt(vendorId) : null) : undefined
    });

    res.json({
      ...medicine,
      barcode: ext.barcode,
      isControlled: ext.isControlled,
      dosage: ext.dosage,
      vendorId: ext.vendorId
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/pharmacy/:id
router.delete('/:id', requireAuth, requireRoles(['admin']), MedicineController.deleteMedicine);

// POST /api/pharmacy/purchase (Record purchase orders)
router.post('/purchase', requireAuth, requireRoles(['admin', 'receptionist']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medicineId, quantity, supplier, purchaseDate, batchNumber, expiryDate, totalCost } = req.body;
    
    // Proceed with standard SQL log
    const purchase = await MedicineService.purchaseStock({
      medicineId: parseInt(medicineId),
      quantity: parseInt(quantity),
      supplier,
      purchaseDate,
      batchNumber,
      expiryDate,
      totalCost: parseFloat(totalCost)
    });

    // Also automatically register a new tracking batch in localStore!
    LocalStoreService.addBatch({
      medicineId: parseInt(medicineId),
      batchNumber: batchNumber || `BT-PUR-${Math.floor(1000 + Math.random() * 9000)}`,
      expiryDate: expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      initialQty: parseInt(quantity),
      currentQty: parseInt(quantity)
    });

    res.status(201).json(purchase);
  } catch (error) {
    next(error);
  }
});

// POST /api/pharmacy/sale (Deduct stock from batch & sell)
router.post('/sale', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medicineId, quantity, patientId, saleDate, totalPrice, paymentMethod, notes, batchNumber, doctorName, rxId } = req.body;
    
    // Check if medicine is controlled
    const ext = LocalStoreService.getExtendedMedicine(parseInt(medicineId));
    if (ext?.isControlled) {
      if (!doctorName || !rxId) {
        res.status(400).json({ error: 'This is a controlled substance! Prescribing Doctor and RX ID are mandatory to proceed.' });
        return;
      }
    }

    // Deduct quantity from the specified batch (FEFO / FIFO fallback)
    const batches = LocalStoreService.getBatchesByMedicine(parseInt(medicineId));
    if (batches.length > 0) {
      let remainingToDeduct = parseInt(quantity);
      
      // If a specific batch was selected, deduct from it
      if (batchNumber) {
        const target = batches.find(b => b.batchNumber === batchNumber);
        if (target) {
          if (target.currentQty < remainingToDeduct) {
            res.status(400).json({ error: `Selected batch ${batchNumber} only has ${target.currentQty} units, but requested ${remainingToDeduct} units.` });
            return;
          }
          LocalStoreService.updateBatchQty(target.id, remainingToDeduct);
        }
      } else {
        // Auto FEFO (First Expired First Out)
        const sortedBatches = [...batches]
          .filter(b => b.currentQty > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        for (const b of sortedBatches) {
          if (remainingToDeduct <= 0) break;
          const toDeduct = Math.min(b.currentQty, remainingToDeduct);
          LocalStoreService.updateBatchQty(b.id, toDeduct);
          remainingToDeduct -= toDeduct;
        }

        if (remainingToDeduct > 0) {
          res.status(400).json({ error: 'Insufficient batch stock available to complete this transaction.' });
          return;
        }
      }
    }

    // Save standard sale database transaction
    const sale = await MedicineService.sellMedicine({
      medicineId: parseInt(medicineId),
      quantity: parseInt(quantity),
      patientId: patientId ? parseInt(patientId) : undefined,
      saleDate,
      totalPrice: parseFloat(totalPrice),
      paymentMethod,
      notes: notes || `Rx ID: ${rxId || 'N/A'}, Prescribed by: ${doctorName || 'N/A'}`
    });

    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
});

export const pharmacyRouter = router;
