const layer = (() => {
    // Function to fetch MEXC bid-ask prices for layer
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
        console.error('Error fetching MEXC bid-ask prices:', error);
        return null;
      }
    }
  
    // Function to fetch JUP price for a given swap
    async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
      try {
        const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
        const response = await fetch(url);
    
        if (!response.ok) {
          throw new Error(`JUP API error: ${response.status} ${response.statusText}`);
        }
    
        const data = await response.json();
        return data.outAmount / 10 ** decimals;
      } catch (error) {
        console.error('Error fetching JUP swap price:', error);
        return null;
      }
    }
  
    // Function to fetch JUP prices for layer
    async function fetchJupPrice() {
      const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const outputMintlayer = 'LAYER4xPpTCb3QL8S9u41EAhAX7mhBn8Q6xMTwY2Yzc';
  
      const [layerAmountFor2000USDC, usdcAmountFor2000layer] = await Promise.all([
        fetchJupSwapPrice(inputMintUSDC, outputMintlayer, 2000 * 1e6, 9),
        fetchJupSwapPrice(outputMintlayer, inputMintUSDC, 2000 * 1e9, 6),
      ]);
    
      if (layerAmountFor2000USDC === null || usdcAmountFor2000layer === null) {
        return null;
      }
    
      // Calculate rates
      const jupRateFor2000USDC = 2000 / layerAmountFor2000USDC;
      const jupRateFor2000layer = usdcAmountFor2000layer / 2000;
    
      return {
        rateFor2000USDC: jupRateFor2000USDC,
        rateFor2000layer: jupRateFor2000layer,
      };
    }
  
    // Function to update alerts
    async function updateAlerts() {
      const buyAlertElement = document.getElementById('layer-buy-alert');
      const sellAlertElement = document.getElementById('layer-sell-alert');
    
      const mexcPrices = await fetchMexcPrice();
      const jupPrices = await fetchJupPrice();
    
      if (mexcPrices !== null && jupPrices !== null) {
        const buyDifference = mexcPrices.bid - jupPrices.rateFor2000USDC;
        buyAlertElement.textContent = buyDifference.toFixed(5);
        applyAlertStyles(buyAlertElement, buyDifference);
    
        const sellDifference = jupPrices.rateFor2000layer - mexcPrices.ask;
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
      setInterval(updateAlerts, 4700);
    })();
  
    return { updateAlerts };
  })();