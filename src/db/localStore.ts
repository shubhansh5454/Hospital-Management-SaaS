import fs from 'fs';
import path from 'path';

// Define TS Interfaces for Extended Pharmacy Entities
export interface Vendor {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  drugLicense: string;
  paymentTerms: string;
}

export interface MedicineExtended {
  medicineId: number;
  barcode: string;
  isControlled: boolean;
  dosage: string;
  vendorId: number | null;
}

export interface MedicineBatch {
  id: number;
  medicineId: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  initialQty: number;
  currentQty: number;
  createdAt: string;
}

export interface MedicineReturn {
  id: number;
  medicineId: number;
  quantity: number;
  returnDate: string; // YYYY-MM-DD
  type: 'PATIENT' | 'VENDOR';
  reason: string;
  batchNumber: string | null;
  createdAt: string;
}

export interface BIScheduledReport {
  id: number;
  title: string;
  type: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipientEmail: string;
  active: boolean;
  createdAt: string;
}

// Global Store Schema
interface StoreSchema {
  vendors: Vendor[];
  extendedMedicines: MedicineExtended[];
  batches: MedicineBatch[];
  returns: MedicineReturn[];
  scheduledReports: BIScheduledReport[];
}

const STORE_FILE_PATH = path.join(process.cwd(), 'src/db/pharmacy_bi_store.json');

// Default initial seed data to make the app look rich and fully featured right away!
const defaultStore: StoreSchema = {
  vendors: [
    {
      id: 1,
      name: 'Global Pharma Distributors Inc.',
      phone: '+1 (555) 234-5678',
      email: 'orders@globalpharma.com',
      address: '742 Evergreen Terrace, Medical District',
      drugLicense: 'DL-GLOBAL-998822',
      paymentTerms: 'Net 30'
    },
    {
      id: 2,
      name: 'Apex Lifesciences Wholesale',
      phone: '+1 (555) 987-6543',
      email: 'sales@apexwholesale.com',
      address: '908 Tech Parkway, Warehouse 4B',
      drugLicense: 'DL-APEX-441122',
      paymentTerms: 'Net 15'
    },
    {
      id: 3,
      name: 'Beacon Biotech Laboratories',
      phone: '+1 (555) 321-0987',
      email: 'fulfillment@beaconlabs.com',
      address: '12 Science Blvd, Biotech Valley',
      drugLicense: 'DL-BEACON-556677',
      paymentTerms: 'COD'
    }
  ],
  extendedMedicines: [
    { medicineId: 1, barcode: '8901234567890', isControlled: false, dosage: '500mg', vendorId: 1 },
    { medicineId: 2, barcode: '8901234567891', isControlled: true, dosage: '2mg', vendorId: 2 },
    { medicineId: 3, barcode: '8901234567892', isControlled: false, dosage: '100mg', vendorId: 1 },
    { medicineId: 4, barcode: '8901234567893', isControlled: true, dosage: '5mg', vendorId: 3 }
  ],
  batches: [
    {
      id: 101,
      medicineId: 1,
      batchNumber: 'BT-PAR-4022',
      expiryDate: '2026-08-10', // Expiring in less than a month! (Perfect for testing Expiry Prediction)
      initialQty: 100,
      currentQty: 42,
      createdAt: '2026-01-10T08:00:00Z'
    },
    {
      id: 102,
      medicineId: 1,
      batchNumber: 'BT-PAR-4023',
      expiryDate: '2027-02-15',
      initialQty: 200,
      currentQty: 150,
      createdAt: '2026-04-10T10:30:00Z'
    },
    {
      id: 103,
      medicineId: 2,
      batchNumber: 'BT-XAN-9901',
      expiryDate: '2026-07-28', // Extremely close expiry (Controlled medicine)
      initialQty: 50,
      currentQty: 12,
      createdAt: '2026-02-01T09:15:00Z'
    },
    {
      id: 104,
      medicineId: 3,
      batchNumber: 'BT-AMO-7721',
      expiryDate: '2026-11-30',
      initialQty: 150,
      currentQty: 85,
      createdAt: '2026-03-12T14:00:00Z'
    },
    {
      id: 105,
      medicineId: 4,
      batchNumber: 'BT-VAL-8833',
      expiryDate: '2026-09-05',
      initialQty: 80,
      currentQty: 25,
      createdAt: '2026-03-20T11:00:00Z'
    }
  ],
  returns: [
    {
      id: 201,
      medicineId: 1,
      quantity: 5,
      returnDate: '2026-07-01',
      type: 'PATIENT',
      reason: 'Patient experienced allergic response, unopened blister pack returned.',
      batchNumber: 'BT-PAR-4022',
      createdAt: '2026-07-01T15:20:00Z'
    },
    {
      id: 202,
      medicineId: 3,
      quantity: 20,
      returnDate: '2026-07-10',
      type: 'VENDOR',
      reason: 'Damaged foil packaging upon receipt.',
      batchNumber: 'BT-AMO-7721',
      createdAt: '2026-07-10T11:45:00Z'
    }
  ],
  scheduledReports: [
    {
      id: 301,
      title: 'Executive Financial KPIs Summary',
      type: 'revenue',
      frequency: 'weekly',
      recipientEmail: 'hospital_executive@caresync.com',
      active: true,
      createdAt: '2026-07-01T08:00:00Z'
    },
    {
      id: 302,
      title: 'Pharmacy High-Risk Controlled Drug Logs',
      type: 'pharmacy',
      frequency: 'daily',
      recipientEmail: 'chief_pharmacist@caresync.com',
      active: true,
      createdAt: '2026-07-05T12:00:00Z'
    },
    {
      id: 303,
      title: 'Monthly Inventory Velocity & Stock forecasts',
      type: 'inventory',
      frequency: 'monthly',
      recipientEmail: 'supply_chain@caresync.com',
      active: false,
      createdAt: '2026-07-10T17:30:00Z'
    }
  ]
};

// Load storage from JSON file
export function readStore(): StoreSchema {
  try {
    if (!fs.existsSync(STORE_FILE_PATH)) {
      // Ensure the parent directory exists
      const dir = path.dirname(STORE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(defaultStore, null, 2), 'utf-8');
      return defaultStore;
    }
    const data = fs.readFileSync(STORE_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading pharmacy_bi_store.json, returning defaults:', err);
    return defaultStore;
  }
}

// Write storage to JSON file
export function writeStore(data: StoreSchema): void {
  try {
    const dir = path.dirname(STORE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing pharmacy_bi_store.json:', err);
  }
}

// Helper query/mutation handlers
export class LocalStoreService {
  // --- VENDORS ---
  public static getVendors(): Vendor[] {
    return readStore().vendors;
  }

  public static addVendor(vendor: Omit<Vendor, 'id'>): Vendor {
    const store = readStore();
    const newId = store.vendors.reduce((max, v) => v.id > max ? v.id : max, 0) + 1;
    const newVendor = { ...vendor, id: newId };
    store.vendors.push(newVendor);
    writeStore(store);
    return newVendor;
  }

  public static updateVendor(id: number, fields: Partial<Omit<Vendor, 'id'>>): Vendor | null {
    const store = readStore();
    const idx = store.vendors.findIndex(v => v.id === id);
    if (idx === -1) return null;
    store.vendors[idx] = { ...store.vendors[idx], ...fields };
    writeStore(store);
    return store.vendors[idx];
  }

  public static deleteVendor(id: number): boolean {
    const store = readStore();
    const initialLen = store.vendors.length;
    store.vendors = store.vendors.filter(v => v.id !== id);
    writeStore(store);
    return store.vendors.length < initialLen;
  }

  // --- MEDICINE EXTENDED ---
  public static getExtendedMedicine(medId: number): MedicineExtended | null {
    const store = readStore();
    return store.extendedMedicines.find(em => em.medicineId === medId) || null;
  }

  public static getAllExtendedMedicines(): MedicineExtended[] {
    return readStore().extendedMedicines;
  }

  public static upsertExtendedMedicine(medId: number, fields: Partial<Omit<MedicineExtended, 'medicineId'>>): MedicineExtended {
    const store = readStore();
    const idx = store.extendedMedicines.findIndex(em => em.medicineId === medId);
    if (idx > -1) {
      store.extendedMedicines[idx] = { ...store.extendedMedicines[idx], ...fields };
    } else {
      store.extendedMedicines.push({
        medicineId: medId,
        barcode: fields.barcode || `BAR-${medId}-${Math.floor(1000 + Math.random() * 9000)}`,
        isControlled: fields.isControlled || false,
        dosage: fields.dosage || '500mg',
        vendorId: fields.vendorId !== undefined ? fields.vendorId : null
      });
    }
    writeStore(store);
    return store.extendedMedicines.find(em => em.medicineId === medId)!;
  }

  // --- BATCHES ---
  public static getBatches(): MedicineBatch[] {
    return readStore().batches;
  }

  public static getBatchesByMedicine(medId: number): MedicineBatch[] {
    return readStore().batches.filter(b => b.medicineId === medId);
  }

  public static addBatch(batch: Omit<MedicineBatch, 'id' | 'createdAt'>): MedicineBatch {
    const store = readStore();
    const newId = store.batches.reduce((max, b) => b.id > max ? b.id : max, 0) + 1;
    const newBatch: MedicineBatch = {
      ...batch,
      id: newId,
      createdAt: new Date().toISOString()
    };
    store.batches.push(newBatch);
    writeStore(store);
    return newBatch;
  }

  public static updateBatchQty(batchId: number, deductQty: number): MedicineBatch | null {
    const store = readStore();
    const idx = store.batches.findIndex(b => b.id === batchId);
    if (idx === -1) return null;
    store.batches[idx].currentQty = Math.max(0, store.batches[idx].currentQty - deductQty);
    writeStore(store);
    return store.batches[idx];
  }

  public static updateBatch(batchId: number, fields: Partial<Omit<MedicineBatch, 'id'>>): MedicineBatch | null {
    const store = readStore();
    const idx = store.batches.findIndex(b => b.id === batchId);
    if (idx === -1) return null;
    store.batches[idx] = { ...store.batches[idx], ...fields };
    writeStore(store);
    return store.batches[idx];
  }

  // --- RETURNS ---
  public static getReturns(): MedicineReturn[] {
    return readStore().returns;
  }

  public static addReturn(ret: Omit<MedicineReturn, 'id' | 'createdAt'>): MedicineReturn {
    const store = readStore();
    const newId = store.returns.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
    const newReturn: MedicineReturn = {
      ...ret,
      id: newId,
      createdAt: new Date().toISOString()
    };
    store.returns.push(newReturn);

    // Adjust quantities accordingly
    if (ret.type === 'PATIENT') {
      // Patient return: Increase medicine master stock + increase specific batch stock (if provided)
      if (ret.batchNumber) {
        const bIdx = store.batches.findIndex(b => b.medicineId === ret.medicineId && b.batchNumber === ret.batchNumber);
        if (bIdx > -1) {
          store.batches[bIdx].currentQty += ret.quantity;
        }
      }
    } else {
      // Vendor return: Decrease medicine master stock + decrease specific batch stock
      if (ret.batchNumber) {
        const bIdx = store.batches.findIndex(b => b.medicineId === ret.medicineId && b.batchNumber === ret.batchNumber);
        if (bIdx > -1) {
          store.batches[bIdx].currentQty = Math.max(0, store.batches[bIdx].currentQty - ret.quantity);
        }
      }
    }
    writeStore(store);
    return newReturn;
  }

  // --- SCHEDULED REPORTS ---
  public static getScheduledReports(): BIScheduledReport[] {
    return readStore().scheduledReports;
  }

  public static addScheduledReport(report: Omit<BIScheduledReport, 'id' | 'createdAt'>): BIScheduledReport {
    const store = readStore();
    const newId = store.scheduledReports.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
    const newReport: BIScheduledReport = {
      ...report,
      id: newId,
      createdAt: new Date().toISOString()
    };
    store.scheduledReports.push(newReport);
    writeStore(store);
    return newReport;
  }

  public static toggleScheduledReport(id: number): BIScheduledReport | null {
    const store = readStore();
    const idx = store.scheduledReports.findIndex(r => r.id === id);
    if (idx === -1) return null;
    store.scheduledReports[idx].active = !store.scheduledReports[idx].active;
    writeStore(store);
    return store.scheduledReports[idx];
  }

  public static deleteScheduledReport(id: number): boolean {
    const store = readStore();
    const initialLen = store.scheduledReports.length;
    store.scheduledReports = store.scheduledReports.filter(r => r.id !== id);
    writeStore(store);
    return store.scheduledReports.length < initialLen;
  }
}
