import { LegacyResponse } from './data-contracts';

interface BuildLegacyResponseArgs {
  status: number;
  description: string;
  data?: any;
}

function buildLegacyResponse({
  description,
  data,
  status,
}: BuildLegacyResponseArgs): LegacyResponse {
  return {
    status,
    description,
    data,
  };
}

export default buildLegacyResponse;
