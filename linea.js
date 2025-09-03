const LINEA = (() => {
  let audioEnabled = false;

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

  // Fetch Hyperliquid Futures prices for LINEA
  function fetchHyperliquidFuturePrice() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
      let timeout;
      let receivedData = false;
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          method: "subscribe",
          subscription: { type: "l2Book", coin: "LINEA" }
        }));
        
        timeout = setTimeout(() => {
          if (!receivedData) {
            ws.close();
            reject(new Error('Hyperliquid connection timed out'));
          }
        }, 5000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.channel === "l2Book" && message.data) {
            receivedData = true;
            clearTimeout(timeout);
            ws.close();
            
            const orderbook = message.data;
            
            if (!orderbook.levels || orderbook.levels.length < 2) {
              reject(new Error('Invalid Hyperliquid response structure'));
              return;
            }
            
            const bids = orderbook.levels[0];
            const asks = orderbook.levels[1];
            
            if (!bids || bids.length === 0 || !asks || asks.length === 0) {
              reject(new Error('Empty bids or asks array'));
              return;
            }
            
            const bestBid = bids[0]?.px;
            const bestAsk = asks[0]?.px;
            
            if (bestBid === undefined || bestAsk === undefined) {
              reject(new Error('Missing bid/ask prices in level data'));
              return;
            }
            
            resolve({
              bid: parseFloat(bestBid),
              ask: parseFloat(bestAsk)
            });
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        ws.close();
        reject(error);
      };
      
      ws.onclose = () => {
        clearTimeout(timeout);
        if (!receivedData) {
          reject(new Error('WebSocket closed before receiving data'));
        }
      };
    });
  }

  // Update alerts with MEXC vs Hyperliquid comparison
  async function updateAlerts() {
    const elements = {
      mexcHyperBuy: document.getElementById('linea-mexc-hyper-buy-alert'),
      mexcHyperSell: document.getElementById('linea-mexc-hyper-sell-alert')
    };

    try {
      // Fetch data from both exchanges
      const [mexcData, hyperData] = await Promise.all([
        fetchMexcFuturePrice(),
        fetchHyperliquidFuturePrice().catch(error => {
          console.error('Hyperliquid Error:', error);
          return null;
        })
      ]);
      
      // Formatting helper
      const format = (val) => {
        if (val === null || isNaN(val)) return 'N/A';
        return val.toFixed(5);
      };
      
      // MEXC Future vs Hyperliquid Future
      if (mexcData && hyperData) {
        const buyOpportunity = mexcData.bid - hyperData.ask;
        const sellOpportunity = hyperData.bid - mexcData.ask;
        
        elements.mexcHyperBuy.innerHTML = 
          `M: $${format(mexcData.bid)} | H: $${format(hyperData.ask)} ` +
          `<span class="difference">$${format(buyOpportunity)}</span>`;
        
        elements.mexcHyperSell.innerHTML = 
          `H: $${format(hyperData.bid)} | M: $${format(mexcData.ask)} ` +
          `<span class="difference">$${format(sellOpportunity)}</span>`;
        
        applyAlertStyles(
          elements.mexcHyperBuy.querySelector('.difference'), 
          buyOpportunity,
          'mexc_hyper_buy'
        );
        applyAlertStyles(
          elements.mexcHyperSell.querySelector('.difference'), 
          sellOpportunity,
          'mexc_hyper_sell'
        );
      } else {
        if (!mexcData) {
          elements.mexcHyperBuy.textContent = 'MEXC data error';
          elements.mexcHyperSell.textContent = 'MEXC data error';
        }
        if (!hyperData) {
          elements.mexcHyperBuy.textContent = 'Hyperliquid data error';
          elements.mexcHyperSell.textContent = 'Hyperliquid data error';
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
      case 'mexc_hyper_buy':
        // Buy opportunity: MEXC bid > Hyperliquid ask
        if (value > 0.01) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 1046; // C6
        } else if (value > -0.00051) {
          element.classList.add('alert-medium-positive');
          shouldPlaySound = true;
          volume = 0.1;
          frequency = 880; // A5
        }
        break;
        
      case 'mexc_hyper_sell':
        // Sell opportunity: Hyperliquid bid > MEXC ask
        if (value > 0.05) {
          element.classList.add('alert-high-positive');
          shouldPlaySound = true;
          frequency = 523; // C5
        } else if (value > 0.00139) {
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
  setInterval(updateAlerts, 1500);
  
  return { updateAlerts, enableAudio };
})();