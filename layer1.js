const layer1 = (() => {
    // Function to fetch MEXC bid-ask prices for layer1
    async function fetchMexcPrice() {
      try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/LAYER_USDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
    
        if (!data || !data.data || !data.data.bids || !data.data.asks) {
          throw new Error('Invalid MEXC API response');
        }
    
        // Extract the best bid and ask prices
        const bestBid = parseFloat(data.data.bids[0][0]);
        const bestAsk = parseFloat(data.data.asks[0][0]);
    
        return { bid: bestBid, ask: bestAsk };
      } catch (error) {
        console.error('MEXC API Error:', error);
        return null;
      }
    }
  
    // Fixed Hyperliquid price fetch function
    async function fetchHyperliquidPrice() {
        try {
            const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
            const apiUrl = 'https://api.hyperliquid.xyz/info';
            
            const requestBody = {
                type: "orderbook",
                coin: "LAYER",
                user: "",
                isCross: false,  // Revert to boolean
                limit: 1         // Revert to number
            };

            console.log('Sending to Hyperliquid:', JSON.stringify(requestBody, null, 2));

            const response = await fetch(proxyUrl + apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'  // Required by some proxies
                },
                body: JSON.stringify(requestBody)
            });

            const responseText = await response.text();
            console.log('Hyperliquid Raw Response:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            const data = JSON.parse(responseText);
            
            if (!data?.bids?.[0]?.px || !data?.asks?.[0]?.px) {
                throw new Error('Invalid order book structure');
            }

            return {
                bid: parseFloat(data.bids[0].px),
                ask: parseFloat(data.asks[0].px)
            };
            
        } catch (error) {
            console.error('Hyperliquid API Failure:', error);
            return null;
        }
    }
    
    // Function to update alerts
    async function updateAlerts() {
      const buyAlertElement = document.getElementById('layer1-buy-alert');
      const sellAlertElement = document.getElementById('layer1-sell-alert');
    
      const mexcPrices = await fetchMexcPrice();
      const hyperliquidPrices = await fetchHyperliquidPrice();
    
      if (mexcPrices !== null && hyperliquidPrices !== null) {
        // Calculate price differences
        const buyDifference = mexcPrices.bid - hyperliquidPrices.ask;
        buyAlertElement.textContent = buyDifference.toFixed(5);
        applyAlertStyles(buyAlertElement, buyDifference);
    
        const sellDifference = hyperliquidPrices.bid - mexcPrices.ask;
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
  
    // Initialize with error retry logic
    (function init() {
      let retryCount = 0;
      const maxRetries = 3;

      async function initUpdate() {
        try {
          await updateAlerts();
          retryCount = 0; // Reset retry counter on success
        } catch (error) {
          console.error('Update failed:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying... (${retryCount}/${maxRetries})`);
            setTimeout(initUpdate, 2000);
          }
        }
      }

      initUpdate();
      setInterval(initUpdate, 10000); // Update every 10 seconds
    })();
  
    return { updateAlerts };
  })();