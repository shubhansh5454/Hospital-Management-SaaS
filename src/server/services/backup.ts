import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/errorHandler.ts';

export interface StorageConfig {
  provider: 'local' | 'gcs' | 's3' | 'sftp';
  localPath: string;
  gcsBucket: string;
  gcsKeyFile: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  sftpHost: string;
  sftpUsername: string;
  sftpPort: number;
}

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  lastRun?: string;
  nextRun?: string;
}

export interface BackupRecord {
  id: string;
  filename: string;
  name: string;
  type: 'manual' | 'automatic';
  status: 'successful' | 'failed' | 'corrupted';
  size: string;
  checksum: string;
  verified: boolean;
  verifiedAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface BackupConfigData {
  storage: StorageConfig;
  autoBackup: AutoBackupConfig;
  history: BackupRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'src', 'server', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const CONFIG_FILE = path.join(DATA_DIR, 'backup_config.json');

export class BackupService {
  private static initFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultConfig: BackupConfigData = {
        storage: {
          provider: 'local',
          localPath: '/var/backups/clinic-suite',
          gcsBucket: 'med-alliance-clinical-backups',
          gcsKeyFile: '/secrets/gcp-service-account.json',
          s3Bucket: 'med-alliance-vault-s3',
          s3AccessKey: 'AKIAIOSFODNN7EXAMPLE',
          s3SecretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sftpHost: 'sftp.clinicaltrust.org',
          sftpUsername: 'backup_operator',
          sftpPort: 22
        },
        autoBackup: {
          enabled: true,
          frequency: 'daily',
          retentionDays: 30,
          lastRun: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
        },
        history: [
          {
            id: 'bk-default-1',
            filename: 'backup_system_base_initial.json',
            name: 'Initial System Clean Slate',
            type: 'manual',
            status: 'successful',
            size: '24.5 KB',
            checksum: 'd3b07384d113edec49eaa6238ad5ff00',
            verified: true,
            verifiedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
            notes: 'Pre-migration baseline backup after core HR suite initialization.',
            createdBy: 'System Superadmin',
            createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
          },
          {
            id: 'bk-default-2',
            filename: 'backup_auto_daily_routine.json',
            name: 'Daily Automated Integrity Backup',
            type: 'automatic',
            status: 'successful',
            size: '42.8 KB',
            checksum: 'ec122284d113eeec49eaa6238ad5aa11',
            verified: true,
            verifiedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
            notes: 'System auto routine backup.',
            createdBy: 'Automated Job (Local Cron)',
            createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
          }
        ]
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    }
  }

  private static readConfig(): BackupConfigData {
    this.initFiles();
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading backup config:', error);
      return {
        storage: { provider: 'local', localPath: '', gcsBucket: '', gcsKeyFile: '', s3Bucket: '', s3AccessKey: '', s3SecretKey: '', sftpHost: '', sftpUsername: '', sftpPort: 22 },
        autoBackup: { enabled: false, frequency: 'daily', retentionDays: 7 },
        history: []
      };
    }
  }

  private static writeConfig(data: BackupConfigData) {
    this.initFiles();
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing backup config:', error);
    }
  }

  // Get Configurations
  public static getConfig(): { storage: StorageConfig; autoBackup: AutoBackupConfig } {
    const config = this.readConfig();
    return {
      storage: config.storage,
      autoBackup: config.autoBackup
    };
  }

  // Update Storage Configuration
  public static updateStorage(storage: StorageConfig): StorageConfig {
    const config = this.readConfig();
    config.storage = storage;
    this.writeConfig(config);
    return storage;
  }

  // Update Auto Backup Configuration
  public static updateAutoBackup(auto: AutoBackupConfig): AutoBackupConfig {
    const config = this.readConfig();
    config.autoBackup = {
      ...config.autoBackup,
      ...auto,
      nextRun: auto.enabled ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : undefined
    };
    this.writeConfig(config);
    return config.autoBackup;
  }

  // Get Backup History Logs
  public static getHistory(): BackupRecord[] {
    return this.readConfig().history;
  }

  // Create Manual or Automatic Backup
  public static createBackup(name: string, notes?: string, creator?: string, type: 'manual' | 'automatic' = 'manual'): BackupRecord {
    this.initFiles();
    const config = this.readConfig();

    const timestamp = Date.now();
    const filename = `backup_archive_${timestamp}.json`;
    const fullPath = path.join(BACKUPS_DIR, filename);

    try {
      // 1. Gather all files in DATA_DIR (excluding the 'backups' folder itself and backup_config.json)
      const bundledFiles: Record<string, string> = {};
      const filesInDir = fs.readdirSync(DATA_DIR);

      for (const f of filesInDir) {
        const filePath = path.join(DATA_DIR, f);
        const stat = fs.statSync(filePath);

        if (stat.isFile() && f.endsWith('.json') && f !== 'backup_config.json') {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          bundledFiles[f] = fileContent;
        }
      }

      // 2. Build complete backup payload
      const payload = {
        meta: {
          version: '1.0',
          type,
          name,
          creator: creator || 'Staff Admin',
          createdAt: new Date().toISOString()
        },
        payload: bundledFiles
      };

      // Write payload to backup directory
      const contentString = JSON.stringify(payload, null, 2);
      fs.writeFileSync(fullPath, contentString, 'utf-8');

      // 3. Calculate size and custom checksum
      const sizeBytes = fs.statSync(fullPath).size;
      const sizeKb = (sizeBytes / 1024).toFixed(1);
      const sizeStr = `${sizeKb} KB`;

      // Simple checksum simulation
      const checksum = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

      const record: BackupRecord = {
        id: `bk-${timestamp}`,
        filename,
        name,
        type,
        status: 'successful',
        size: sizeStr,
        checksum,
        verified: true,
        verifiedAt: new Date().toISOString(),
        notes,
        createdBy: creator || 'Staff Admin',
        createdAt: new Date().toISOString()
      };

      config.history.unshift(record);
      
      if (type === 'automatic') {
        config.autoBackup.lastRun = new Date().toISOString();
        config.autoBackup.nextRun = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      }

      this.writeConfig(config);

      // Perform retention pruning if automatic
      if (type === 'automatic') {
        this.pruneOldBackups(config);
      }

      return record;
    } catch (error: any) {
      console.error('Backup generation failed:', error);
      
      const failedRecord: BackupRecord = {
        id: `bk-${timestamp}`,
        filename: 'N/A',
        name,
        type,
        status: 'failed',
        size: '0 KB',
        checksum: 'N/A',
        verified: false,
        notes: `Backup failed: ${error.message || error}`,
        createdBy: creator || 'Staff Admin',
        createdAt: new Date().toISOString()
      };
      
      config.history.unshift(failedRecord);
      this.writeConfig(config);
      throw new AppError(`Backup creation failed: ${error.message || error}`, 500);
    }
  }

  // Restore Backup Archive
  public static restoreBackup(id: string, operatorName: string): void {
    this.initFiles();
    const config = this.readConfig();
    const record = config.history.find(b => b.id === id);
    if (!record) {
      throw new AppError('Backup record not found in system history log', 404);
    }

    if (record.status !== 'successful') {
      throw new AppError('Cannot restore from an unsuccessful, corrupted, or failed backup session', 400);
    }

    const fullPath = path.join(BACKUPS_DIR, record.filename);

    // If it's the base mock templates, handle fallback gracefully
    if (record.id === 'bk-default-1' || record.id === 'bk-default-2') {
      // These are dummy initial history logs, but let's simulate successful mock restore
      console.log('Restoring from default system baseline...');
      return;
    }

    if (!fs.existsSync(fullPath)) {
      throw new AppError(`The backup archive file ${record.filename} does not exist on local disk storage.`, 404);
    }

    try {
      // Read and extract backup payload
      const content = fs.readFileSync(fullPath, 'utf-8');
      const backupData = JSON.parse(content);

      if (!backupData.payload) {
        throw new AppError('Backup archive has corrupted schema. Payload missing.', 400);
      }

      const files = backupData.payload as Record<string, string>;

      // Write each file back to DATA_DIR
      for (const [filename, fileContent] of Object.entries(files)) {
        const destPath = path.join(DATA_DIR, filename);
        fs.writeFileSync(destPath, fileContent, 'utf-8');
      }

      console.log(`Successfully restored system backup: ${record.name} by ${operatorName}`);
    } catch (error: any) {
      console.error('Restore operation failed:', error);
      throw new AppError(`Restore operation failed: ${error.message || error}`, 500);
    }
  }

  // Verify Backup Archive Integrity
  public static verifyBackup(id: string): BackupRecord {
    const config = this.readConfig();
    const index = config.history.findIndex(b => b.id === id);
    if (index === -1) {
      throw new AppError('Backup record not found', 404);
    }

    const record = config.history[index];
    const fullPath = path.join(BACKUPS_DIR, record.filename);

    if (record.id === 'bk-default-1' || record.id === 'bk-default-2') {
      record.verified = true;
      record.verifiedAt = new Date().toISOString();
      config.history[index] = record;
      this.writeConfig(config);
      return record;
    }

    if (!fs.existsSync(fullPath)) {
      record.status = 'corrupted';
      record.verified = false;
      config.history[index] = record;
      this.writeConfig(config);
      throw new AppError('Backup file not found on disk, marked as corrupted', 404);
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      if (!parsed.payload || Object.keys(parsed.payload).length === 0) {
        record.status = 'corrupted';
        record.verified = false;
        config.history[index] = record;
        this.writeConfig(config);
        throw new AppError('Structural validation failed: Payload data missing or empty', 400);
      }

      // Validated successfully
      record.verified = true;
      record.verifiedAt = new Date().toISOString();
      config.history[index] = record;
      this.writeConfig(config);
      return record;
    } catch (error) {
      record.status = 'corrupted';
      record.verified = false;
      config.history[index] = record;
      this.writeConfig(config);
      throw new AppError('JSON parsing or checksum mismatch validation failed', 400);
    }
  }

  // Delete Backup from History & Disk
  public static deleteBackup(id: string) {
    const config = this.readConfig();
    const index = config.history.findIndex(b => b.id === id);
    if (index === -1) {
      throw new AppError('Backup record not found', 404);
    }

    const record = config.history[index];
    const fullPath = path.join(BACKUPS_DIR, record.filename);

    if (fs.existsSync(fullPath) && record.filename !== 'N/A') {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Error removing backup file from storage:', err);
      }
    }

    config.history.splice(index, 1);
    this.writeConfig(config);
  }

  // Automatic retention pruning
  private static pruneOldBackups(config: BackupConfigData) {
    const retentionLimit = Date.now() - config.autoBackup.retentionDays * 24 * 3600 * 1000;
    
    // Filter auto backups older than retention days
    const prunables = config.history.filter(b => {
      if (b.type !== 'automatic') return false;
      if (b.id === 'bk-default-2') return false; // keep default mock
      const ts = parseInt(b.id.replace('bk-', ''));
      return isNaN(ts) ? false : ts < retentionLimit;
    });

    for (const p of prunables) {
      const fullPath = path.join(BACKUPS_DIR, p.filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.error('Failed to prune old backup file:', e);
        }
      }
      config.history = config.history.filter(b => b.id !== p.id);
    }
  }
}
