import { Router } from 'express';
import { sendJob } from './controllers/send-job';

const router = Router();

router.post('/send-job', sendJob);

export default router;
