const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,gbp,eur';

// Set an alarm to fetch BTC price every 15 minutes
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('fetchBTCPrice', { periodInMinutes: 15 });
  fetchBTCPrice();  // Fetch once on install
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchBTCPrice') {
    fetchBTCPrice();
  }
});

// Fetch BTC prices for multiple currencies (USD, GBP, EUR) and store along with the last update time
async function fetchBTCPrice() {
  try {
    const response = await fetch(COINGECKO_URL);
    const data = await response.json();
    const lastUpdated = Date.now();
    chrome.storage.local.set({ btcPrices: data.bitcoin, lastUpdated: lastUpdated });
    console.log('Updated BTC prices:', data.bitcoin);
  } catch (error) {
    console.error('Error fetching BTC prices:', error);
  }
}
