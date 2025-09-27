// xpl.js - Updated with Kyber vs Future comparison (Hyperliquid removed)
const XPL = (() => {
  let audioEnabled = false;
  let fundingRateInterval = null;
  let nextFundingTime = null;

  // Fetch MEXC Funding Rate for XPL (XPL_USDT)
  async function fetchMexcFundingRate() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://contract.mexc.com/api/v1/contract/funding_rate/XPL_USDT';
    
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
    
    document.getElementById('xpl-next-funding').textContent = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Also update the spot vs future funding timer if it exists
    const spotFutureTimer = document.getElementById('xpl-mexc-next-funding');
    if (spotFutureTimer) {
      spotFutureTimer.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Update funding rate display
  async function updateFundingRate() {
    const fundingElement = document.getElementById('xpl-funding-rate');
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
      
      // Also update the spot vs future funding rate display
      const spotFutureFundingElement = document.getElementById('xpl-mexc-funding-rate');
      if (spotFutureFundingElement) {
        const spotFutureRateValue = spotFutureFundingElement.querySelector('.funding-rate-value');
        spotFutureRateValue.textContent = `${ratePercent}%`;
        spotFutureFundingElement.className = fundingElement.className;
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

  // Fetch MEXC Futures prices for XPL
  async function fetchMexcFuturePrice() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://contract.mexc.com/api/v1/contract/depth/XPL_USDT';
    
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

  // Fetch MEXC Spot prices for XPL
  async function fetchMexcSpotPrice() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const apiUrl = 'https://api.mexc.com/api/v3/depth?symbol=XPLUSDT&limit=5';
    
    try {
      const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
      const data = await response.json();
      
      if (!data.bids || !data.asks || data.bids.length === 0 || data.asks.length === 0) {
        throw new Error('Invalid spot order book');
      }
      
      // Get best bid and ask
      const bestBid = parseFloat(data.bids[0][0]);
      const bestAsk = parseFloat(data.asks[0][0]);
      
      return {
        bid: bestBid,
        ask: bestAsk
      };
    } catch (error) {
      console.error('MEXC Spot XPL Error:', error);
      return null;
    }
  }

  // Fetch KyberSwap prices for WXPL on Plasma - CORRECTED VERSION
  async function fetchKyberXPLPrice() {
    // First, let's verify the token addresses and get correct decimals
    const addresses = {
      // Use correct token addresses for Plasma chain
      USDT: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb', // USDT on Plasma
      WXPL: '0x6100E367285b01F48D07953803A2d8dCA5D19873'  // WXPL on Plasma
    };

    try {
      // Use more reasonable amounts
      const buyAmount = "1000000000"; // 1000 USDT (assuming 6 decimals)
      const sellAmount = "1000000000000000000000"; // 1 WXPL (assuming 18 decimals)
      
      // KyberSwap API for Plasma chain
      const [buyResponse, sellResponse] = await Promise.all([
        fetch(`https://aggregator-api.kyberswap.com/plasma/api/v1/routes?tokenIn=${addresses.USDT}&tokenOut=${addresses.WXPL}&amountIn=${buyAmount}`),
        fetch(`https://aggregator-api.kyberswap.com/plasma/api/v1/routes?tokenIn=${addresses.WXPL}&tokenOut=${addresses.USDT}&amountIn=${sellAmount}`)
      ]);

      if (!buyResponse.ok || !sellResponse.ok) {
        throw new Error('Kyber API request failed');
      }

      const buyData = await buyResponse.json();
      const sellData = await sellResponse.json();
      
      console.log('Kyber Buy Response:', buyData); // Debug log
      console.log('Kyber Sell Response:', sellData); // Debug log
      
      // Extract prices safely
      const buyPrice = buyData.data?.routeSummary?.amountOut 
        ? parseFloat(buyData.data.routeSummary.amountOut) / 1e18  // Adjust based on actual WXPL decimals
        : null;
      
      const sellPrice = sellData.data?.routeSummary?.amountOut 
        ? parseFloat(sellData.data.routeSummary.amountOut) / 1e6   // Adjust based on actual USDT decimals  
        : null;

      return {
        buyPrice: buyPrice ? 1000 / buyPrice : null, // Price per WXPL in USDT
        sellPrice: sellPrice ? sellPrice / 1000 : null  // Price per WXPL in USDT (selling 1 WXPL)
      };
    } catch (error) {
      console.error('Kyber XPL Error:', error);
      return { buyPrice: null, sellPrice: null };
    }
  }

  // Update alerts with comparisons (Hyperliquid removed)
  async function updateAlerts() {
    const elements = {
      mexcSpotFutureBuy: document.getElementById('xpl-mexc-spot-future-buy-alert'),
      mexcSpotFutureSell: document.getElementById('xpl-mexc-spot-future-sell-alert'),
      kyberMexcBuy: document.getElementById('xpl-kyber-mexc-buy-alert'),
      kyberMexcSell: document.getElementById('xpl-kyber-mexc-sell-alert')
    };

    try {
      // Fetch data from exchanges (Hyperliquid removed)
      const [mexcData, mexcSpotData, kyberData] = await Promise.all([
        fetchMexcFuturePrice(),
        fetchMexcSpotPrice().catch(error => {
          console.error('MEXC Spot XPL Error:', error);
          return null;
        }),
        fetchKyberXPLPrice().catch(error => {
          console.error('Kyber XPL Error:', error);
          return null;
        })
      ]);
      
      // Formatting helper
      const format = (val) => {
        if (val === null || isNaN(val)) return 'N/A';
        return val.toFixed(4);
      };
      
      // MEXC Spot vs MEXC Future
      if (mexcSpotData && mexcData) {
        const buyOpportunity = mexcData.bid - mexcSpotData.ask;
        const sellOpportunity = mexcSpotData.bid - mexcData.ask;
        
        elements.mexcSpotFutureBuy.innerHTML = 
          `Spot: $${format(mexcSpotData.ask)} | Future: $${format(mexcData.bid)} ` +
          `<span class="difference">$${format(buyOpportunity)}</span>`;
        
        elements.mexcSpotFutureSell.innerHTML = 
          `Spot: $${format(mexcSpotData.bid)} | Future: $${format(mexcData.ask)} ` +
          `<span class="difference">$${format(sellOpportunity)}</span>`;
        
        applyAlertStyles(
          elements.mexcSpotFutureBuy.querySelector('.difference'), 
          buyOpportunity,
          'mexc_spot_future_buy'
        );
        applyAlertStyles(
          elements.mexcSpotFutureSell.querySelector('.difference'), 
          sellOpportunity,
          'mexc_spot_future_sell'
        );
      } else {
        if (!mexcSpotData) {
          elements.mexcSpotFutureBuy.textContent = 'MEXC Spot data error';
          elements.mexcSpotFutureSell.textContent = 'MEXC Spot data error';
        }
        if (!mexcData) {
          elements.mexcSpotFutureBuy.textContent = 'MEXC Future data error';
          elements.mexcSpotFutureSell.textContent = 'MEXC Future data error';
        }
      }

      // Kyber vs MEXC Future
      if (kyberData && mexcData) {
        const buyOpportunity = mexcData.bid - kyberData.buyPrice;
        const sellOpportunity = kyberData.sellPrice - mexcData.ask;
        
        elements.kyberMexcBuy.innerHTML = 
          `K: $${format(kyberData.buyPrice)} | M: $${format(mexcData.bid)} ` +
          `<span class="difference">$${format(buyOpportunity)}</span>`;
        
        elements.kyberMexcSell.innerHTML = 
          `K: $${format(kyberData.sellPrice)} | M: $${format(mexcData.ask)} ` +
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
      console.error('Update Error:', error);
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
      case 'mexc_spot_future_buy':
        // Buy opportunity: MEXC Future bid > MEXC Spot ask
        if (value > 0.9) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 1046; // C6
        } else if (value > 0.0079) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 880; // A5
        }
        break;
        
      case 'mexc_spot_future_sell':
        // Sell opportunity: MEXC Spot bid > MEXC Future ask
        if (value > 0.9) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 523; // C5
        } else if (value > 0.01) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 587; // D5
        }
        break;

      case 'kyber_mexc_buy':
        // Buy opportunity: MEXC bid > Kyber buy price
        if (value > 0.01) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 1046; // C6
        } else if (value > 0.003) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 880; // A5
        }
        break;
        
      case 'kyber_mexc_sell':
        // Sell opportunity: Kyber sell price > MEXC ask
        if (value > 0.005) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 523; // C5
        } else if (value > 0.001) {
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
  setInterval(updateAlerts, 2000);
  setInterval(updateFundingRate, 60000); // Update funding rate every minute
  
  return { updateAlerts, enableAudio };
})();