import { Router } from 'express';
import { BackupService } from '../services/backup.ts';

export const backupRouter = Router();

// Get backup configuration (storage & auto settings)
backupRouter.get('/config', (req, res, next) => {
  try {
    const config = BackupService.getConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Update storage config
backupRouter.put('/config/storage', (req, res, next) => {
  try {
    const updated = BackupService.updateStorage(req.body);
    res.json({ message: 'Storage configuration updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
});

// Update auto backup config
backupRouter.put('/config/auto', (req, res, next) => {
  try {
    const updated = BackupService.updateAutoBackup(req.body);
    res.json({ message: 'Automated scheduler configuration updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
});

// Get backup history
backupRouter.get('/history', (req, res, next) => {
  try {
    const history = BackupService.getHistory();
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Trigger a backup manually
backupRouter.post('/create', (req, res, next) => {
  try {
    const { name, notes, creator, type } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Backup name is required' });
      return;
    }
    const record = BackupService.createBackup(name, notes, creator, type || 'manual');
    res.json({ message: 'Backup snapshot generated successfully', data: record });
  } catch (error) {
    next(error);
  }
});

// Restore backup
backupRouter.post('/restore', (req, res, next) => {
  try {
    const { id, operatorName } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Backup session ID is required' });
      return;
    }
    BackupService.restoreBackup(id, operatorName || 'Admin Operator');
    res.json({ message: 'System state restored successfully' });
  } catch (error) {
    next(error);
  }
});

// Verify backup
backupRouter.post('/verify', (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) {
      res.status(400).json({ error: 'Backup session ID is required' });
      return;
    }
    const updatedRecord = BackupService.verifyBackup(id);
    res.json({ message: 'Backup verified successfully', data: updatedRecord });
  } catch (error) {
    next(error);
  }
});

// Delete backup
backupRouter.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    BackupService.deleteBackup(id);
    res.json({ message: 'Backup deleted and storage freed successfully' });
  } catch (error) {
    next(error);
  }
});
