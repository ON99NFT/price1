const AVNT = (() => {
  let audioEnabled = false;

  // Fetch MEXC Futures prices for AVNT
  async function fetchMexcFuturePrice() {
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
    const url = 'https://contract.mexc.com/api/v1/contract/depth/AVNT_USDT';
    
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

  // Fetch KyberSwap prices for AVNT on Base
  async function fetchKyberPrice() {
    const addresses = {
      USDC: '0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913',
      AVNT: '0x696F9436B67233384889472Cd7cD58A6fB5DF4f1'
    };

    try {
      // Format amounts properly without scientific notation
      const buyAmount = "1000000000"; // 1000 USDC with 6 decimals (USDC has 6, but API expects 18 decimals?)
      const sellAmount = "4444000000000000000000"; // 1 AVNT with 18 decimals
      
      // We need to adjust for the fact that Kyber API might expect values in wei (18 decimals)
      // But USDC has 6 decimals, so we need to adjust the amount
      const [buyResponse, sellResponse] = await Promise.all([
        fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.USDC}&tokenOut=${addresses.AVNT}&amountIn=${buyAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`),
        fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${addresses.AVNT}&tokenOut=${addresses.USDC}&amountIn=${sellAmount}&excludedSources=lo1inch,kyberswap-limit-order-v2`)
      ]);

      const buyData = await buyResponse.json();
      const sellData = await sellResponse.json();
      
      // Calculate prices based on the amounts
      // For buy: How much AVNT do we get for 1000 USDC?
      // For sell: How much USDC do we get for 4444 AVNT?
      return {
        buyPrice: buyData.data?.routeSummary?.amountOut ? 
          1000 / (parseFloat(buyData.data.routeSummary.amountOut) / 1e18) : null,
        sellPrice: sellData.data?.routeSummary?.amountOut ? 
          (parseFloat(sellData.data.routeSummary.amountOut) / 1e6) / 4444 : null  // USDC has 6 decimals
      };
    } catch (error) {
      console.error('Kyber Error:', error);
      return { buyPrice: null, sellPrice: null };
    }
  }

  // Update alerts with KyberSwap vs MEXC comparison
  async function updateAlerts() {
    const elements = {
      kyberMexcBuy: document.getElementById('avnt-kyber-mexc-buy-alert'),
      kyberMexcSell: document.getElementById('avnt-kyber-mexc-sell-alert')
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
        return val.toFixed(4);
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
      console.error('AVNT Update Error:', error);
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
        } else if (value > -0.0051) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 880; // A5
        }
        break;
        
      case 'kyber_mexc_sell':
        // Sell opportunity: Kyber buy price > MEXC ask
        if (value > 0.1) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 523; // C5
        } else if (value > 0.039) {
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

  updateAlerts();
  setInterval(updateAlerts, 2500);
  
  return { updateAlerts, enableAudio };
})();