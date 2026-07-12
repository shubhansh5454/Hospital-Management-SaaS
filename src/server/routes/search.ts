import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { SearchController } from '../controllers/search.ts';

const router = Router();

// Apply auth globally for search
router.use(requireAuth);

router.get('/', SearchController.search);

export const searchRouter = router;
