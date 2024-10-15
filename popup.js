// Load the initial state of the dropdown based on stored preferences
chrome.storage.local.get(['unit'], (result) => {
  document.getElementById('currencyUnit').value = result.unit || 'btc';
});

// When the user changes between BTC and Satoshis
document.getElementById('currencyUnit').addEventListener('change', (event) => {
  const unit = event.target.value;
  chrome.storage.local.set({ unit: unit }, () => {
    // Notify the content script to update the page without reloading
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'changeUnit', unit: unit });
    });
  });
});
