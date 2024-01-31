import { Router } from 'express';
import { configObserver } from './controllers/config-observer';
import { createJob } from './controllers/create-job';
import { jobList } from './controllers/job-list';
import { queryJob } from './controllers/query-job';

const router = Router();

router.post('/create-job', createJob);
router.post('/config-observer', configObserver);
router.get('/status-job/:id', queryJob);
router.get('/job-list', jobList);

export default router;
