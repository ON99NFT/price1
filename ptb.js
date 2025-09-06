const PTB = (() => {
  let audioEnabled = false;

  // Fetch MEXC Spot bid/ask prices for PTB
  async function fetchMexcSpotPrices() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://api.mexc.com/api/v3/depth?symbol=PTBUSDT&limit=5';
    
    try {
      const response = await fetch(proxyUrl + url);
      const data = await response.json();
      
      if (!data?.bids?.[0]?.[0] || !data?.asks?.[0]?.[0]) {
        throw new Error('Invalid MEXC Spot depth response');
      }
      
      return {
        bid: parseFloat(data.bids[0][0]), // Best bid price
        ask: parseFloat(data.asks[0][0])  // Best ask price
      };
    } catch (error) {
      console.error('MEXC Spot Depth Error:', error);
      return null;
    }
  }

  // Fetch MEXC Futures bid/ask prices for PTB
  async function fetchMexcFuturePrices() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://contract.mexc.com/api/v1/contract/depth/PTB_USDT';
    
    try {
      const response = await fetch(proxyUrl + url);
      const data = await response.json();
      
      if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
        throw new Error('Invalid MEXC Futures response');
      }
      
      return {
        bid: parseFloat(data.data.bids[0][0]), // Best bid price
        ask: parseFloat(data.data.asks[0][0])  // Best ask price
      };
    } catch (error) {
      console.error('MEXC Futures Error:', error);
      return null;
    }
  }

  // Update alerts with MEXC Spot vs Futures comparison
  async function updateAlerts() {
    const elements = {
      spotFutureBuy: document.getElementById('ptb-spot-future-buy-alert'),
      spotFutureSell: document.getElementById('ptb-spot-future-sell-alert')
    };

    try {
      // Fetch data from both markets
      const [spotPrices, futurePrices] = await Promise.all([
        fetchMexcSpotPrices(),
        fetchMexcFuturePrices()
      ]);
      
      // Formatting helper
      const format = (val) => {
        if (val === null || isNaN(val)) return 'N/A';
        return val.toFixed(5);
      };
      
      // MEXC Spot vs Futures
      if (spotPrices && futurePrices) {
        // Calculate differences according to new requirements
        // Buy opportunity: Spot ask (price to buy) vs Future bid (price to sell)
        const buyOpportunity = futurePrices.bid - spotPrices.ask;
        const buyPercent = (buyOpportunity / spotPrices.ask) * 100;
        
        // Sell opportunity: Future ask (price to buy) vs Spot bid (price to sell)
        const sellOpportunity = spotPrices.bid - futurePrices.ask;
        const sellPercent = (sellOpportunity / spotPrices.ask) * 100;
        
        elements.spotFutureBuy.innerHTML = 
          `Spot: $${format(spotPrices.ask)} | Future: $${format(futurePrices.bid)} ` +
          `<span class="difference">$${format(buyOpportunity)} (${buyPercent.toFixed(2)}%)</span>`;
        
        elements.spotFutureSell.innerHTML = 
          `Future: $${format(futurePrices.ask)} | Spot: $${format(spotPrices.bid)} ` +
          `<span class="difference">$${format(sellOpportunity)} (${sellPercent.toFixed(2)}%)</span>`;
        
        applyAlertStyles(
          elements.spotFutureBuy.querySelector('.difference'), 
          buyOpportunity,
          'spot_future_buy'
        );
        applyAlertStyles(
          elements.spotFutureSell.querySelector('.difference'), 
          sellOpportunity,
          'spot_future_sell'
        );
      } else {
        if (!spotPrices) {
          elements.spotFutureBuy.textContent = 'Spot data error';
          elements.spotFutureSell.textContent = 'Spot data error';
        }
        if (!futurePrices) {
          elements.spotFutureBuy.textContent = 'Futures data error';
          elements.spotFutureSell.textContent = 'Futures data error';
        }
      }
      
    } catch (error) {
      console.error('PTB Update Error:', error);
      Object.values(elements).forEach(el => {
        if (el) el.textContent = 'Update Error';
      });
    }
  }

  function applyAlertStyles(element, value, type) {
    if (!element) return;
    
    element.className = 'difference';
    const existingIcon = element.querySelector('.direction-icon');
    if (existingIcon) existingIcon.remove();
    
    let shouldPlaySound = false;
    let volume = 0.2;
    let frequency = 784; // Default frequency (G5)
    
    // Add direction icon
    const direction = document.createElement('span');
    direction.className = 'direction-icon';
    direction.textContent = value > 0 ? ' ↑' : ' ↓';
    element.appendChild(direction);
    
    // Different thresholds for buy vs sell
    if (type === 'spot_future_buy') {
      // Buy opportunity: Future bid > Spot ask
      if (value > 0.01) {
        element.classList.add('alert-high-positive');
        shouldPlaySound = true;
        frequency = 1046; // C6
      } else if (value > 0.006) {
        element.classList.add('alert-medium-positive');
        shouldPlaySound = true;
        volume = 0.1;
        frequency = 880; // A5
      }
    } else if (type === 'spot_future_sell') {
      // Sell opportunity: Spot bid > Future ask
      if (value > -0.004) {
        element.classList.add('alert-high-positive');
        shouldPlaySound = true;
        frequency = 523; // C5
      } else if (value > -0.0055) {
        element.classList.add('alert-medium-positive');
        shouldPlaySound = true;
        volume = 0.1;
        frequency = 587; // D5
      }
    }

    if (shouldPlaySound && audioEnabled) {
      window.playSystemAlert(volume, frequency);
    }
  }

  function enableAudio() {
    audioEnabled = true;
  }

  updateAlerts();
  setInterval(updateAlerts, 1500);
  
  return { updateAlerts, enableAudio };
})();