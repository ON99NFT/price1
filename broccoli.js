const BROCCOLI = (() => {
    // Function to fetch MEXC bid-ask prices for BROCCOLI_USDT
    async function fetchMexcPrice() {
      try {
        const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
        const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/BROCCOLI_USDT';
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
    
        if (!data?.data?.bids?.[0]?.[0] || !data?.data?.asks?.[0]?.[0]) {
          throw new Error('Invalid MEXC API response');
        }
    
        return {
          bid: parseFloat(data.data.bids[0][0]),
          ask: parseFloat(data.data.asks[0][0])
        };
      } catch (error) {
        console.error('MEXC Error:', error);
        return null;
      }
    }
  
    // Function to fetch KyberSwap price
    async function fetchKyberSwapPrice(inputToken, outputToken, amount) {
      try {
        const amountIn = amount.toLocaleString('fullwide', { useGrouping: false });
        const url = `https://aggregator-api.kyberswap.com/bsc/api/v1/routes?tokenIn=${inputToken}&tokenOut=${outputToken}&amountIn=${amountIn}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API ${response.status}: ${errorData?.message || 'Unknown error'}`);
        }
    
        const data = await response.json();
        return data.data?.routeSummary?.amountOut || data.data?.outAmount;
      } catch (error) {
        console.error('KyberSwap Error:', error);
        return null;
      }
    }
  
    // Main price calculation function
    async function fetchKyberPrice() {
      const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
      const BROCCOLI_ADDRESS = '0x6d5AD1592ed9D6D1dF9b93c793AB759573Ed6714';
    
      try {
        const [broccoliAmount, usdtAmount] = await Promise.all([
          fetchKyberSwapPrice(USDT_ADDRESS, BROCCOLI_ADDRESS, 4000 * 1e18),
          fetchKyberSwapPrice(BROCCOLI_ADDRESS, USDT_ADDRESS, 27500 * 1e18)
        ]);
    
        if (!broccoliAmount || !usdtAmount) return null;
    
        return {
          buyPrice: 4000 / (broccoliAmount / 1e18),
          sellPrice: (usdtAmount / 1e18) / 27500
        };
      } catch (error) {
        console.error('Price Calculation Error:', error);
        return null;
      }
    }
  
    // Alert update function
    async function updateAlerts() {
      const buyAlert = document.getElementById('broccoli-buy-alert');
      const sellAlert = document.getElementById('broccoli-sell-alert');
    
      try {
        const [mexcData, kyberData] = await Promise.all([
          fetchMexcPrice(),
          fetchKyberPrice()
        ]);
    
        if (!mexcData || !kyberData) {
          buyAlert.textContent = sellAlert.textContent = 'Error';
          return;
        }
    
        const buyDifference = (mexcData.bid - kyberData.buyPrice).toFixed(5);
        const sellDifference = (kyberData.sellPrice - mexcData.ask).toFixed(5);
    
        buyAlert.textContent = buyDifference;
        sellAlert.textContent = sellDifference;
        
        applyAlertStyles(buyAlert, parseFloat(buyDifference));
        applyAlertStyles(sellAlert, parseFloat(sellDifference));
        
      } catch (error) {
        console.error('Update Error:', error);
        buyAlert.textContent = sellAlert.textContent = 'Error';
      }
    }
  
    // Style application function
    function applyAlertStyles(element, value) {
      element.className = '';
      if (value > 0.009) {
        element.classList.add('alert-flashing-2');
      } else if (value > 0.006) {
        element.classList.add('alert-flashing-1');
      } else if (value > 0.003) {
        element.classList.add('alert-large-green');
      } else if (value > 0) {
        element.classList.add('alert-positive');
      } else if (value < -0.009) {
        element.classList.add('alert-flashing-negative-2');
      } else if (value < -0.006) {
        element.classList.add('alert-flashing-negative-1');
      } else if (value < -0.003) {
        element.classList.add('alert-large-red');
      } else {
        element.classList.add(value >= 0 ? 'alert-positive' : 'alert-negative');
      }
    }
  
    // Initialize
    (function init() {
      updateAlerts();
      setInterval(updateAlerts, 2000);
    })();
  
    return { updateAlerts };
  })();