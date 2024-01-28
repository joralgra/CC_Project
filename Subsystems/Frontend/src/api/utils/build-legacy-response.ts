import { LegacyResponse } from './data-contracts';

interface BuildLegacyResponseArgs {
  status: number;
  description: string;
  data?: any;
  jobs?: any;
}

function buildLegacyResponse({
  description,
  data,
  status,
  jobs,
}: BuildLegacyResponseArgs): LegacyResponse {
  return {
    status,
    description,
    data,
    jobs,
  };
}

export default buildLegacyResponse;
