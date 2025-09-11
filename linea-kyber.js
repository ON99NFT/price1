const LINEAKyber = (() => {
  let audioEnabled = false;
  let fundingRateInterval = null;
  let nextFundingTime = null;

  // Fetch MEXC Funding Rate for LINEA (LINEA_USDT)
  async function fetchMexcFundingRate() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://contract.mexc.com/api/v1/contract/funding_rate/LINEA_USDT';
    
    try {
      const response = await fetch(proxyUrl + url);
      const data = await response.json();
      
      if (!data?.data?.fundingRate) {
        throw new Error('Invalid MEXC funding rate response');
      }
      
      return {
        rate: parseFloat(data.data.fundingRate),
        nextTime: data.data.nextSettleTime
      };
    } catch (error) {
      console.error('MEXC Funding Rate Error:', error);
      return null;
    }
  }

  // Update funding rate countdown timer
  function updateFundingCountdown() {
    if (!nextFundingTime) return;
    
    const now = new Date().getTime();
    const diff = nextFundingTime - now;
    
    if (diff <= 0) {
      // Time's up, refresh funding rate
      updateFundingRate();
      return;
    }
    
    // Format the time difference
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    document.getElementById('linea-next-funding').textContent = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Update funding rate display
  async function updateFundingRate() {
    const fundingElement = document.getElementById('linea-funding-rate');
    const rateValueElement = fundingElement.querySelector('.funding-rate-value');
    
    try {
      const fundingData = await fetchMexcFundingRate();
      
      if (!fundingData) {
        rateValueElement.textContent = 'Error';
        fundingElement.className = 'funding-rate';
        return;
      }
      
      const rate = fundingData.rate;
      const ratePercent = (rate * 100).toFixed(4);
      
      rateValueElement.textContent = `${ratePercent}%`;
      
      // Set appropriate styling based on rate value
      if (rate > 0.0005) {
        fundingElement.className = 'funding-rate positive';
      } else if (rate < -0.0005) {
        fundingElement.className = 'funding-rate negative';
      } else {
        fundingElement.className = 'funding-rate neutral';
      }
      
      // Set next funding time
      nextFundingTime = parseInt(fundingData.nextTime);
      
      // Start countdown if not already running
      if (!fundingRateInterval) {
        fundingRateInterval = setInterval(updateFundingCountdown, 1000);
      }
      
    } catch (error) {
      console.error('Funding Rate Update Error:', error);
      rateValueElement.textContent = 'Error';
      fundingElement.className = 'funding-rate';
    }
  }

  // Fetch MEXC Futures prices for LINEA
  async function fetchMexcFuturePrice() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://contract.mexc.com/api/v1/contract/depth/LINEA_USDT';
    
    try {
      const response = await fetch(proxyUrl + url);
      const data = await response.json();
      
      if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
        throw new Error('Invalid MEXC response');
      }
      
      return {
        bid: parseFloat(data.data.bids[0][0]),
        ask: parseFloat(data.data.asks[0][0])
      };
    } catch (error) {
      console.error('MEXC Futures Error:', error);
      return null;
    }
  }

  // Fetch KyberSwap prices for LINEA on Linea
  async function fetchKyberPrice() {
    const addresses = {
      USDC: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', // USDC on Linea
      LINEA: '0x1789e0043623282d5dcc7f213d703c6d8bafbb04' // LINEA on Linea
    };

    try {
      // Format amounts properly
      const buyAmount = "1000000000"; // 1000 USDC with 6 decimals
      const sellAmount = "44444000000000000000000"; // 44444 LINEA with 18 decimals
      
      const [buyResponse, sellResponse] = await Promise.all([
        fetch(`https://aggregator-api.kyberswap.com/linea/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.LINEA}&amountIn=${buyAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`),
        fetch(`https://aggregator-api.kyberswap.com/linea/api/v1/routes?tokenIn=${addresses.LINEA}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`)
      ]);

      const buyData = await buyResponse.json();
      const sellData = await sellResponse.json();
      
      // Calculate prices
      return {
        buyPrice: buyData.data?.routeSummary?.amountOut ? 
          1000 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e18) : null, // Price per LINEA when buying with USDC
        sellPrice: sellData.data?.routeSummary?.amountOut ? 
          (parseFloat(sellData.data.routeSummary.amountOut) / 1e6) / 44444 : null  // Price per LINEA when selling for USDC
      };
    } catch (error) {
      console.error('Kyber Error:', error);
      return { buyPrice: null, sellPrice: null };
    }
  }

  // Update alerts with KyberSwap vs MEXC comparison
  async function updateAlerts() {
    const elements = {
      kyberMexcBuy: document.getElementById('linea-kyber-mexc-buy-alert'),
      kyberMexcSell: document.getElementById('linea-kyber-mexc-sell-alert')
    };

    try {
      // Fetch data from both sources
      const [kyberData, mexcData] = await Promise.all([
        fetchKyberPrice(),
        fetchMexcFuturePrice()
      ]);
      
      // Formatting helper
      const format = (val) => {
        if (val === null || isNaN(val)) return 'N/A';
        return val.toFixed(5);
      };
      
      // KyberSwap vs MEXC Future
      if (kyberData && mexcData) {
        // Buy opportunity: MEXC bid vs Kyber sell price (what you'd get selling on Kyber)
        const buyOpportunity = mexcData.bid - kyberData.sellPrice;
        // Sell opportunity: Kyber buy price (what you'd pay on Kyber) vs MEXC ask
        const sellOpportunity = kyberData.buyPrice - mexcData.ask;
        
        elements.kyberMexcBuy.innerHTML = 
          `M: $${format(mexcData.bid)} | K: $${format(kyberData.sellPrice)} ` +
          `<span class="difference">$${format(buyOpportunity)}</span>`;
        
        elements.kyberMexcSell.innerHTML = 
          `K: $${format(kyberData.buyPrice)} | M: $${format(mexcData.ask)} ` +
          `<span class="difference">$${format(sellOpportunity)}</span>`;
        
        applyAlertStyles(
          elements.kyberMexcBuy.querySelector('.difference'), 
          buyOpportunity,
          'kyber_mexc_buy'
        );
        applyAlertStyles(
          elements.kyberMexcSell.querySelector('.difference'), 
          sellOpportunity,
          'kyber_mexc_sell'
        );
      } else {
        if (!kyberData) {
          elements.kyberMexcBuy.textContent = 'Kyber data error';
          elements.kyberMexcSell.textContent = 'Kyber data error';
        }
        if (!mexcData) {
          elements.kyberMexcBuy.textContent = 'MEXC data error';
          elements.kyberMexcSell.textContent = 'MEXC data error';
        }
      }
      
    } catch (error) {
      console.error('LINEA Kyber Update Error:', error);
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
    
    // Different thresholds and sounds for each comparison type
    switch(type) {
      case 'kyber_mexc_buy':
        // Buy opportunity: MEXC bid > Kyber sell price
        if (value > 0.01) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 1046; // C6
        } else if (value > 0.0002) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 880; // A5
        }
        break;
        
      case 'kyber_mexc_sell':
        // Sell opportunity: Kyber buy price > MEXC ask
        if (value > 0.01) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 523; // C5
        } else if (value > 0.0002) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 587; // D5
        }
        break;
    }

    if (shouldPlaySound && audioEnabled) {
      window.playSystemAlert(volume, frequency);
    }
  }

  function enableAudio() {
    audioEnabled = true;
  }

  // Initialize
  updateAlerts();
  updateFundingRate(); // Initial funding rate fetch
  setInterval(updateAlerts, 2500);
  setInterval(updateFundingRate, 300000); // Update funding rate every 5 minutes
  
  return { updateAlerts, enableAudio };
})();