export interface OfficialWorkerDef {
  worker: string;
  label: string;
  officialApi: string;
  defaultIntervalSec: number;
  limitation: string | null;
}

/** Worker definitions mapped to official Avito OpenAPI operations only. */
export const OFFICIAL_AVITO_WORKERS: OfficialWorkerDef[] = [
  {
    worker: 'profile',
    label: 'Profile',
    officialApi: 'GET /core/v1/accounts/self',
    defaultIntervalSec: 3600,
    limitation: null,
  },
  {
    worker: 'items',
    label: 'Items',
    officialApi: 'GET /core/v1/items',
    defaultIntervalSec: 300,
    limitation: null,
  },
  {
    worker: 'categories',
    label: 'Categories',
    officialApi: 'GET /autoload/v1/user-docs/tree',
    defaultIntervalSec: 86400,
    limitation: 'Autoload category tree — requires autoload scope',
  },
  {
    worker: 'tariff',
    label: 'Tariff',
    officialApi: 'GET /tariff/info/1',
    defaultIntervalSec: 3600,
    limitation: null,
  },
  {
    worker: 'messenger',
    label: 'Messenger',
    officialApi: 'GET /messenger/v2/accounts/{user_id}/chats',
    defaultIntervalSec: 60,
    limitation: null,
  },
  {
    worker: 'stats',
    label: 'Statistics',
    officialApi: 'POST /stats/v1/accounts/{user_id}/items',
    defaultIntervalSec: 900,
    limitation: 'Requires item IDs from items sync',
  },
  {
    worker: 'promotion',
    label: 'Promotion',
    officialApi: 'POST /promotion/v1/items/services/dict',
    defaultIntervalSec: 3600,
    limitation: 'Promotion services require item context',
  },
  {
    worker: 'autoload',
    label: 'Autoload',
    officialApi: 'GET /autoload/v2/profile, GET /autoload/v4/uploads',
    defaultIntervalSec: 900,
    limitation: 'Publication via Autoload feed — not REST item CRUD',
  },
  {
    worker: 'hierarchy',
    label: 'Hierarchy',
    officialApi: 'GET /checkAhUserV2, GET /getAhInfoV1',
    defaultIntervalSec: 3600,
    limitation: 'Accounts hierarchy API — company keys only, not employee tokens',
  },
  {
    worker: 'phones',
    label: 'Phones',
    officialApi: 'GET /listCompanyPhonesV1',
    defaultIntervalSec: 3600,
    limitation: 'Company hierarchy phones only',
  },
  {
    worker: 'employees',
    label: 'Employees',
    officialApi: 'GET /getEmployeesV1',
    defaultIntervalSec: 3600,
    limitation: 'Company hierarchy — employee tokens not supported',
  },
  {
    worker: 'ratings',
    label: 'Ratings',
    officialApi: 'GET /ratings/v1/info',
    defaultIntervalSec: 3600,
    limitation: null,
  },
  {
    worker: 'reviews',
    label: 'Reviews',
    officialApi: 'GET /ratings/v1/reviews',
    defaultIntervalSec: 3600,
    limitation: null,
  },
  {
    worker: 'stock',
    label: 'Stock',
    officialApi: 'POST /stock-management/1/info',
    defaultIntervalSec: 900,
    limitation: 'Requires item IDs in request body',
  },
  {
    worker: 'call_tracking',
    label: 'Call Tracking',
    officialApi: 'POST /calltracking/v1/getCalls/',
    defaultIntervalSec: 3600,
    limitation: 'CallTracking product must be enabled on account',
  },
  {
    worker: 'delivery',
    label: 'Delivery',
    officialApi: 'delivery-sandbox API',
    defaultIntervalSec: 86400,
    limitation: 'Delivery sandbox only — not production logistics API',
  },
  {
    worker: 'jobs',
    label: 'Jobs (Avito.Rabota)',
    officialApi: 'job API section',
    defaultIntervalSec: 86400,
    limitation: 'Avito.Rabota — separate product scope',
  },
  {
    worker: 'api_catalog',
    label: 'Available API',
    officialApi: 'docs/avito-openapi/*.json',
    defaultIntervalSec: 86400,
    limitation: 'Local OpenAPI catalog — not a live Avito endpoint',
  },
];
