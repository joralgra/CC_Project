import jobListByUser from './actions/get-job-list';
import statusJobById from './actions/get-status-job';
import setParametersObserver from './actions/set-parameters-observer';

const QueryService = {
  statusJobById,
  jobListByUser,
  setParametersObserver,
};

export default QueryService;
