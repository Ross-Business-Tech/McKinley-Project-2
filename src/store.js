import { define, connect } from './shared.js'
import { TEST_ORDERS } from './triage/testOrders.js'
import { TECHS, DEFAULT_SITES, DEFAULT_SUPERVISORS } from './triage/config.js'
import { DEFAULT_VENDORS } from './vendorsData.js'

// Everything below is shared with the whole team when the app runs on the team's here.now site
// (see shared.js); on a test link it is saved in this browser only.
define('orders', 'list', TEST_ORDERS)
define('state', 'map', {})
define('assign', 'map', {})
define('approved', 'map', {})
define('contacted', 'map', {})
define('handled', 'map', {})
define('techDone', 'map', {})
define('ai', 'map', {})
define('parts', 'map', {})
define('timeoff', 'map', {})
define('teams', 'list', TECHS)
define('sups', 'list', DEFAULT_SUPERVISORS)
define('sites', 'list', DEFAULT_SITES, 'name')
define('vendors', 'list', DEFAULT_VENDORS)
define('sitemaps', 'map', {})
define('feedback', 'map', {})
define('progress', 'map', {})
define('pmHashes', 'map', {})
define('turns', 'map', {})
define('pm', 'map', {})
define('vendorjobs', 'map', {})
define('rescodes', 'map', {})
define('photometa', 'map', {})
define('photochunks', 'map', {}, 'id', { persist: false })
define('replies', 'map', {})
define('mapchunks', 'map', {})
connect()
