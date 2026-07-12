import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { FileController } from '../controllers/file.ts';

const router = Router();

// Retrieve list of documents/folders
router.get('/', requireAuth, FileController.getFiles);

// Retrieve individual document metadata and binary base64 content
router.get('/:id', requireAuth, FileController.getFile);

// Create folder or upload new document
router.post('/', requireAuth, FileController.createFile);

// Rename or move folder/file
router.put('/:id', requireAuth, FileController.updateFile);

// Delete file/folder cleanly
router.delete('/:id', requireAuth, FileController.deleteFile);

export const filesRouter = router;
