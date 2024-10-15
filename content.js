// Fetch BTC prices from storage and convert the prices on the page
function getBTCPrices(callback) {
  chrome.storage.local.get('btcPrices', (result) => {
    if (result.btcPrices) {
      callback(result.btcPrices);
    } else {
      console.error('BTC prices not found in storage.');
    }
  });
}

// Helper functions to convert to BTC or Satoshis based on the currency
function convertToBTC(price, rates, currency) {
  const rate = rates[currency.toLowerCase()];
  if (!rate) return ''; // Return empty or default if the rate isn't available
  return (price / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BTC';
}

function convertToSatoshis(price, rates, currency) {
  const rate = rates[currency.toLowerCase()];
  if (!rate) return ''; // Return empty or default if the rate isn't available
  return Math.round((price / rate) * 100000000).toLocaleString() + ' sats';
}

// Expand abbreviated and full-word numbers but keep the original format (e.g., £20bn stays as £20bn)
function expandAbbreviation(priceString) {
  const abbreviationRegex = /([0-9,.]+)\s?(k|m|bn|tn|thousand|million|billion|trillion)/i;
  const match = abbreviationRegex.exec(priceString);

  if (match) {
    let number = parseFloat(match[1].replace(/,/g, '')); // Extract number
    const abbreviation = match[2].toLowerCase();

    // Multiply based on abbreviation or full word
    if (abbreviation === 'k' || abbreviation === 'thousand') {
      number *= 1_000; // Thousand
    } else if (abbreviation === 'm' || abbreviation === 'million') {
      number *= 1_000_000; // Million
    } else if (abbreviation === 'bn' || abbreviation === 'billion') {
      number *= 1_000_000_000; // Billion
    } else if (abbreviation === 'tn' || abbreviation === 'trillion') {
      number *= 1_000_000_000_000; // Trillion
    }

    return number; // Return expanded number for BTC conversion
  }

  return parseFloat(priceString.replace(/,/g, '')); // Return as is if no abbreviation
}

// Traverse and replace prices in text nodes, ignoring input fields, textareas, and editable content
function replacePricesInText(node, unit, rates) {
  // Detect prices in various formats, including abbreviations like 'k', 'm', 'bn', 'tn', and full words like 'million', 'trillion'
  const currencyRegex = /([£€$¥₹]|AUD|CAD|CNY|JPY|INR|BRL|ZAR|TRY|MXN|RUB)([0-9,.]+(?:\s?(k|m|bn|tn|thousand|million|billion|trillion))?)/gi;

  if (node.nodeType === Node.TEXT_NODE && !isEditable(node)) {
    let text = node.textContent;

    // Step 1: Remove any existing BTC or satoshi conversions to avoid stacking
    text = text.replace(/\s*\([0-9,.]+\s(BTC|sats)\)/g, '');

    const convertFn = unit === 'btc' ? convertToBTC : convertToSatoshis;

    // Step 2: Replace detected prices with converted values, but keep the original format (e.g., £20bn stays £20bn)
    text = text.replace(currencyRegex, (match, symbol, price) => {
      const expandedPrice = expandAbbreviation(price); // Expand "k", "m", "bn", "tn", or full-word abbreviations
      if (isNaN(expandedPrice) || expandedPrice === 0) {
        return match; // Skip if it's not a valid number or zero
      }

      // Determine the correct currency based on the symbol
      let currency = 'usd'; // Default to USD
      if (symbol === '£') currency = 'gbp';
      else if (symbol === '€') currency = 'eur';
      else if (symbol === '$') currency = 'usd';
      else if (symbol === '¥') currency = 'jpy'; // Add more symbols as needed

      // Use expanded price for BTC conversion but keep the original abbreviation (e.g., £20bn)
      return `${match} (${convertFn(expandedPrice, rates, currency)})`; 
    });

    node.textContent = text;
  } else {
    // Recursively process child nodes
    node.childNodes.forEach((child) => replacePricesInText(child, unit, rates));
  }
}

// Function to check if a node or its parent is editable (input, textarea, contenteditable)
function isEditable(node) {
  const parent = node.parentElement;
  if (!parent) return false;
  const tagName = parent.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || parent.isContentEditable;
}

// Apply conversions based on the selected unit
function convertPrices(unit) {
  getBTCPrices((rates) => {
    replacePricesInText(document.body, unit, rates); // Pass the BTC rates object for conversion
  });
}

// Initialize the observer to detect changes in the DOM
let observer = null;

function observeDOMChanges(unit) {
  if (observer) {
    observer.disconnect(); // Disconnect any existing observer
  }

  observer = new MutationObserver(() => {
    convertPrices(unit); // Reapply the conversion when changes are detected
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Get the unit and apply the conversion when the page loads, and start observing for changes
chrome.storage.local.get('unit', (result) => {
  const unit = result.unit || 'btc';
  convertPrices(unit); // Initial conversion
  observeDOMChanges(unit); // Start observing for changes
});

// Listen for messages from popup.js to toggle between BTC and Satoshis
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'changeUnit') {
    convertPrices(message.unit);
    observeDOMChanges(message.unit); // Reinitialize the observer with the new unit
  }
});
