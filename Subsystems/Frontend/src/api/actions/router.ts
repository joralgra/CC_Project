import { Router } from 'express';
import { createJob } from './controllers/create-job';
import { jobList } from './controllers/job-list';
import { queryJob } from './controllers/query-job';

const router = Router();

router.post('/create-job', createJob);
router.get('/status-job/:id', queryJob);
router.get('/job-list', jobList);

export default router;
