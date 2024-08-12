const axios = require('axios');
require('dotenv').config();

// Validate environment variables
const requiredEnvVars = ['DATADOG_API_KEY', 'DATADOG_APP_KEY', 'PAGERDUTY_API_TOKEN', 'ROOTLY_API_TOKEN'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing environment variable: ${envVar}`);
    process.exit(1);
  }
});

const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const PAGERDUTY_API_TOKEN = process.env.PAGERDUTY_API_TOKEN;
const ROOTLY_API_TOKEN = process.env.ROOTLY_API_TOKEN;

const DATADOG_API_URL = 'https://api.datadoghq.com/api/v1';
const PAGERDUTY_API_URL = 'https://api.pagerduty.com';
const ROOTLY_API_URL = process.env.ROOTLY_API_URL || 'https://api.rootly.com/v1';
const TIMEOUT = 5000; // 5 seconds timeout for requests

const axiosInstance = axios.create({ timeout: TIMEOUT });

let pagerdutyServicesCache = [];

async function main() {
  try {
    console.log('Starting process...');

    // Fetch and cache PagerDuty services
    await fetchAndCachePagerdutyServices();

    const monitors = await fetchDatadogMonitors();
    
    console.log(`Found ${monitors.length} monitors.`);
    for (const monitor of monitors) {
      await processMonitor(monitor);
    }

    console.log('Process completed.');
  } catch (err) {
    console.error('An error occurred:', err);
  }
}

main();

async function fetchAndCachePagerdutyServices() {
  console.log('Fetching and caching PagerDuty services...');
  let services = [];
  let offset = 0;
  const limit = 25; // Number of services to fetch per page

  while (true) {
    try {
      const response = await axiosInstance.get(`${PAGERDUTY_API_URL}/services`, {
        headers: {
          'Authorization': `Token token=${PAGERDUTY_API_TOKEN}`,
          'Accept': 'application/json'
        },
        params: {
          limit,
          offset
        }
      });

      const fetchedServices = response.data.services;
      if (fetchedServices.length === 0) {
        console.log('No more PagerDuty services found.');
        break;
      }

      console.log(`Fetched ${fetchedServices.length} PagerDuty services from offset ${offset}.`);
      services.push(...fetchedServices);
      offset += limit;
    } catch (error) {
      console.error('Error fetching PagerDuty services:', error);
      break;
    }
  }

  pagerdutyServicesCache = services;
  console.log(`Cached ${pagerdutyServicesCache.length} PagerDuty services.`);
}

async function fetchDatadogMonitors() {
  console.log('Fetching Datadog monitors...');
  const monitors = [];
  let start = 1;
  const count = 25; // Number of monitors to fetch per page

  while (true) {
    try {
      const response = await axiosInstance.get(`${DATADOG_API_URL}/monitor`, {
        headers: {
          'DD-API-KEY': DATADOG_API_KEY,
          'DD-APPLICATION-KEY': DATADOG_APP_KEY
        },
        params: {
          page: start,
          page_size: count
        }
      });

      const fetchedMonitors = response.data;
      if (fetchedMonitors.length === 0) {
        console.log('No more monitors found.');
        break;
      }

      console.log(`Fetched ${fetchedMonitors.length} monitors from offset ${start}.`);
      monitors.push(...fetchedMonitors);
      start += 1;
    } catch (error) {
      console.error('Error fetching Datadog monitors:', error);
      break;
    }
  }

  return monitors;
}

function normalizedServiceName(serviceName) {
  return serviceName.replace(/[^\w_-]+/g, "_").toLowerCase().replace(/^[_-]/, "")
}

function getPagerdutyServiceId(serviceName) {
  console.log(`Looking up PagerDuty service ID for service name: ${serviceName}`);
  const service = pagerdutyServicesCache.find(s => normalizedServiceName(s.name) === normalizedServiceName(serviceName));
  const serviceId = service ? service.id : null;
  if (serviceId) {
    console.log(`Found PagerDuty service ID: ${serviceId}`);
  } else {
    console.log(`PagerDuty service ID not found for service name: ${serviceName}`);
  }
  return serviceId;
}

async function fetchRootlyServiceId(pagerdutyId) {
  console.log(`Fetching Rootly service ID for PagerDuty ID: ${pagerdutyId}`);
  try {
    const response = await axiosInstance.get(`${ROOTLY_API_URL}/services`, {
      headers: {
        'Authorization': `Bearer ${ROOTLY_API_TOKEN}`
      },
      params: {
        filter: {
          pagerduty_id: pagerdutyId
        }
      }
    });
    if (response.data.data.length === 0) {
      throw new Error(`No Rootly service found with pagerduty ID: ${pagerdutyId}`)
    }
    const rootlyId = response.data.data[0].id;
    console.log(`Found Rootly service ID: ${rootlyId}`);
    return rootlyId;
  } catch (error) {
    console.error('Error fetching Rootly service ID:', error);
  }
}

async function createDatadogWebhook(serviceName, serviceId) {
  console.log(`Creating Datadog webhook for service: ${serviceName} with ID: ${serviceId}`);
  try {
    await axiosInstance.post(`${DATADOG_API_URL}/integration/webhooks/configuration/webhooks`, {
      name: `rootly-${normalizedServiceName(serviceName)}`,
      url: `https://webhooks.rootly.com/webhooks/incoming/datadog_webhooks/notify/service/${serviceId}`
    }, {
      headers: {
        'DD-API-KEY': DATADOG_API_KEY,
        'DD-APPLICATION-KEY': DATADOG_APP_KEY
      }
    });
    console.log(`Datadog webhook created for service: ${serviceName}`);
  } catch (error) {
    if (error.response.data.errors[0] === "Webhook already exists") {
      console.log(`Webhook already exists: @webhooks-rootly-${normalizedServiceName(serviceName)}`)
    } else {
      console.error('Error creating Datadog webhook:', error, error.response.data);
    }
  }
}

async function updateDatadogMonitor(monitorId, oldNotification, newNotification) {
  console.log(`Updating Datadog monitor ID: ${monitorId}`);
  try {
    const response = await axiosInstance.get(`${DATADOG_API_URL}/monitor/${monitorId}`, {
      headers: {
        'DD-API-KEY': DATADOG_API_KEY,
        'DD-APPLICATION-KEY': DATADOG_APP_KEY
      }
    });
    const monitor = response.data;
    if (monitor) {
      monitor.message = monitor.message.replace(oldNotification, `${oldNotification} ${newNotification}`);
      // Synthetics monitors have to be updated using Synthetics API
      if (monitor.type === 'synthetics alert' && monitor.options.synthetics_check_id) {
        await axiosInstance.patch(`${DATADOG_API_URL}/synthetics/tests/${monitor.options.synthetics_check_id}`, {data: [{path: "/message", op: "replace", value: monitor.message}]}, {
          headers: {
            'DD-API-KEY': DATADOG_API_KEY,
            'DD-APPLICATION-KEY': DATADOG_APP_KEY
          }
        });
      } else {
        await axiosInstance.put(`${DATADOG_API_URL}/monitor/${monitorId}`, monitor, {
          headers: {
            'DD-API-KEY': DATADOG_API_KEY,
            'DD-APPLICATION-KEY': DATADOG_APP_KEY
          }
        });
      }
      console.log(`Updated monitor ID: ${monitorId} appending ${newNotification} alongside ${oldNotification}`);
    } else {
      console.log(`Monitor ID: ${monitorId} not found.`);
    }
  } catch (error) {
    console.error('Error updating Datadog monitor:', error, error.response.data);
  }
}

async function processMonitor(monitor) {
  try {
    if (monitor.message.match(/@webhooks-rootly-[^\s]+/)) {
      console.log(`Skipping monitor ID: ${monitor.id} as it already contains @webhooks-rootly.`);
      return;
    }

    const notifications = monitor.message.match(/@pagerduty-([^\s]+)/g);
    if (notifications) {
      console.log(`Processing monitor ID: ${monitor.id} with ${notifications.length} PagerDuty notifications.`);
      
      for (const notification of notifications) {
        const serviceName = notification.split('@pagerduty-')[1];
        const pagerdutyId = getPagerdutyServiceId(serviceName);

        if (pagerdutyId) {
          const rootlyId = await fetchRootlyServiceId(pagerdutyId);
          if (rootlyId) {
            await createDatadogWebhook(serviceName, rootlyId);
            const newNotification = `@webhooks-rootly-${serviceName}`;
            await updateDatadogMonitor(monitor.id, notification, newNotification);
          } else {
            console.error(`Rootly ID not found for PagerDuty ID: ${pagerdutyId}`);
          }
        } else {
          console.error(`PagerDuty ID not found for service name: ${serviceName}`);
        }
      }
    } else {
      console.log(`No PagerDuty notifications found in monitor ID: ${monitor.id}`);
    }
  } catch (error) {
    console.error(`Error processing monitor ID: ${monitor.id}`, error);
  }
}

