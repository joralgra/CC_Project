import { Router } from 'express';
import { createJob } from './controllers/create-job';

const router = Router();

router.post('/create-job', createJob);

export default router;
