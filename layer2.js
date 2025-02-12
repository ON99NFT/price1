const layer2 = (() => {
    // Function to fetch MEXC Futures bid-ask prices
    async function fetchMexcPrice() {
      try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/LAYER_USDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
    
        if (!data || !data.data || !data.data.bids || !data.data.asks) {
          throw new Error('Invalid MEXC Futures API response');
        }
    
        const bestBid = parseFloat(data.data.bids[0][0]);
        const bestAsk = parseFloat(data.data.asks[0][0]);
    
        return { bid: bestBid, ask: bestAsk };
      } catch (error) {
        console.error('Error fetching MEXC Futures prices:', error);
        return null;
      }
    }

    // Function to fetch MEXC Spot bid-ask prices
    async function fetchMexcSpotPrice() {
      try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=LAYERUSDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
    
        if (!data || !data.bids || !data.asks) {
          throw new Error('Invalid MEXC Spot API response');
        }
    
        const bestBid = parseFloat(data.bids[0][0]);
        const bestAsk = parseFloat(data.asks[0][0]);
    
        return { 
          rateFor5000USDC: bestAsk,  // Use ask price for buy comparison
          rateFor5000layer2: bestBid   // Use bid price for sell comparison
        };
      } catch (error) {
        console.error('Error fetching MEXC Spot prices:', error);
        return null;
      }
    }

    // Function to update alerts
    async function updateAlerts() {
      const buyAlertElement = document.getElementById('layer2-buy-alert');
      const sellAlertElement = document.getElementById('layer2-sell-alert');
    
      const mexcPrices = await fetchMexcPrice();
      const mexcSpotPrices = await fetchMexcSpotPrice();
    
      if (mexcPrices !== null && mexcSpotPrices !== null) {
        const buyDifference = mexcPrices.bid - mexcSpotPrices.rateFor5000USDC;
        buyAlertElement.textContent = buyDifference.toFixed(5);
        applyAlertStyles(buyAlertElement, buyDifference);
    
        const sellDifference = mexcSpotPrices.rateFor5000layer2 - mexcPrices.ask;
        sellAlertElement.textContent = sellDifference.toFixed(5);
        applyAlertStyles(sellAlertElement, sellDifference);
      } else {
        buyAlertElement.textContent = 'Error';
        sellAlertElement.textContent = 'Error';
      }
    }

    // Style application function
    function applyAlertStyles(element, difference) {
      element.classList.remove(
        'alert-positive', 'alert-negative',
        'alert-flashing-1', 'alert-flashing-2',
        'alert-flashing-negative-1', 'alert-flashing-negative-2',
        'alert-large', 'alert-large-green', 'alert-large-red'
      );
      element.style.fontSize = '';
      element.style.backgroundColor = '';
      element.style.color = '';
  
      if (difference > 0.025) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-2');
      } else if (difference > 0.015) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-1');
      } else if (difference > 0.01) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-large', 'alert-large-green');
      } else if (difference > 0) {
        element.classList.add('alert-positive');
      } else if (difference < -0.025) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-negative-2');
      } else if (difference < -0.015) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-flashing-negative-1');
      } else if (difference < -0.01) {
        element.style.fontSize = '1.5em';
        element.classList.add('alert-large', 'alert-large-red');
      } else if (difference < 0) {
        element.classList.add('alert-negative');
      }
    }
  
    // Initialize
    (function init() {
      updateAlerts();
      setInterval(updateAlerts, 2500);
    })();
  
    return { updateAlerts };
  })();