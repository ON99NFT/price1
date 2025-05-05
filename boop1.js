const boop = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;
    const PROXY_LIST = [
        'https://api.allorigins.win/get?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/',
        'https://corsproxy.io/?'
    ];
    let currentProxyIndex = 0;

    // Audio initialization
    function handleAudioInitialization() {
        enableButton = document.createElement('button');
        enableButton.id = 'boop-audio-enable-btn';
        enableButton.innerHTML = '🔇 Enable Alert Sounds';
        enableButton.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 8px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        `;

        enableButton.addEventListener('mouseover', () => {
            enableButton.style.transform = 'scale(1.03)';
            enableButton.style.background = '#45a049';
        });
        
        enableButton.addEventListener('mouseout', () => {
            enableButton.style.transform = 'scale(1)';
            enableButton.style.background = '#4CAF50';
        });

        enableButton.addEventListener('click', async () => {
            try {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                audioEnabled = true;
                enableButton.innerHTML = '🔊 Sounds Enabled!';
                setTimeout(() => {
                    enableButton.style.opacity = '0';
                    setTimeout(() => enableButton.remove(), 300);
                }, 1500);
            } catch (error) {
                console.error('Audio initialization failed:', error);
                enableButton.innerHTML = '❌ Error';
                enableButton.style.background = '#f44336';
            }
        });

        const section = document.getElementById('boop-buy-alert').closest('.token-section');
        section.appendChild(enableButton);
    }

    // Sound alert function
    function playAlertSound() {
        if (!audioEnabled || !audioContext) return;

        try {
            const osc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioContext.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

            osc.start();
            osc.stop(audioContext.currentTime + 0.4);
        } catch (error) {
            console.log('Sound playback error:', error);
        }
    }

    // Proxy rotation system
    async function fetchWithProxy(url, retries = 3) {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const proxy = PROXY_LIST[currentProxyIndex];
                const isCorsSh = proxy.includes('corsproxy.io');
                const proxyUrl = isCorsSh ? `${proxy}${url}` : `${proxy}${encodeURIComponent(url)}`;
                
                const headers = {
                    'Accept': 'application/json'
                };

                // Add CORS.sh key only for their proxy
                if (isCorsSh) {
                    headers['x-cors-api-key'] = 'temp_09a95a02b6b6b6b6b6b6b6b6b6b6b6b6';
                }

                const response = await fetch(proxyUrl, { headers });

                if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
                
                // Handle different proxy response formats
                let data;
                if (proxy.includes('allorigins')) {
                    data = JSON.parse((await response.json()).contents);
                } else {
                    data = await response.json();
                }

                return data;
            } catch (error) {
                console.warn(`Attempt ${attempt + 1} failed: ${error.message}`);
                currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
                await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
                
                // Final attempt: try direct with no-cors
                if (attempt === retries - 1) {
                    try {
                        return await (await fetch(url, { mode: 'no-cors' })).json();
                    } catch (finalError) {
                        showNetworkError();
                        throw new Error('All attempts failed');
                    }
                }
            }
        }
    }

    // Error display function
    function showNetworkError() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4444;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
        `;
        errorDiv.textContent = 'Network issues - Retrying...';
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // MEXC price fetch
    async function fetchMexcPrice() {
        try {
            const data = await fetchWithProxy('https://contract.mexc.com/api/v1/contract/depth/BOOP_USDT');
            if (!data?.data) throw new Error('Invalid response format');
            
            const calculateBidPrice = (bids, targetBOOP) => {
                let totalBOOP = 0;
                let totalUSDT = 0;
                
                for (const [priceStr, usdtAvailableStr] of bids) {
                    const price = parseFloat(priceStr);
                    const usdtAvailable = parseFloat(usdtAvailableStr);
                    const boopAvailable = usdtAvailable / price;
                    const remaining = targetBOOP - totalBOOP;
                    const fillAmount = Math.min(remaining, boopAvailable);
                    
                    totalUSDT += fillAmount * price;
                    totalBOOP += fillAmount;
                    
                    if (totalBOOP >= targetBOOP) break;
                }
                return totalUSDT / targetBOOP;
            };

            const calculateAskPrice = (asks, targetBOOP) => {
                let totalBOOP = 0;
                let totalUSDT = 0;
                
                for (const [priceStr, usdtAvailableStr] of asks) {
                    const price = parseFloat(priceStr);
                    const usdtAvailable = parseFloat(usdtAvailableStr);
                    const boopAvailable = usdtAvailable / price;
                    const remaining = targetBOOP - totalBOOP;
                    const fillAmount = Math.min(remaining, boopAvailable);
                    
                    totalUSDT += fillAmount * price;
                    totalBOOP += fillAmount;
                    
                    if (totalBOOP >= targetBOOP) break;
                }
                return totalUSDT / targetBOOP;
            };

            const targetFullsend = 3098;
            const bidPrice = calculateBidPrice(data.data.bids, targetFullsend);
            const askPrice = calculateAskPrice(data.data.asks, targetFullsend);

            if (!bidPrice || !askPrice) throw new Error('Insufficient liquidity');
            
            return {
                bid: bidPrice,
                ask: askPrice
            };
        } catch (error) {
            console.error('MEXC Error:', error);
            showNetworkError();
            return null;
        }
    }

    // Jupiter swap functions
    async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals, exactOut = false) {
        try {
            let url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
            if (exactOut) url += '&swapMode=ExactOut';
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`JUP API error: ${response.status}`);
            
            const data = await response.json();
            return exactOut 
                ? data.inAmount / 10 ** decimals
                : data.outAmount / 10 ** decimals;
        } catch (error) {
            console.error('JUP Error:', error);
            return null;
        }
    }

    async function fetchJupPrice() {
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const BOOP_MINT = 'boopkpWqe68MSxLqBGogs8ZbUDN4GXaLhFwNP7mpP1i';
        const BOOP_DECIMALS = 9;

        const [usdcNeeded, usdcReceived] = await Promise.all([
            fetchJupSwapPrice(USDC_MINT, BOOP_MINT, 3098 * 10 ** BOOP_DECIMALS, 6, true),
            fetchJupSwapPrice(BOOP_MINT, USDC_MINT, 3098 * 10 ** BOOP_DECIMALS, 6)
        ]);

        if (!usdcNeeded || !usdcReceived) return null;

        return {
            buyPrice: usdcNeeded / 3098,
            sellPrice: usdcReceived / 3098
        };
    }

    // Alert display
    async function updateAlerts() {
        const buyElement = document.getElementById('boop-buy-alert');
        const sellElement = document.getElementById('boop-sell-alert');

        try {
            const [mexcData, jupData] = await Promise.all([
                fetchMexcPrice(),
                fetchJupPrice()
            ]);

            if (!mexcData || !jupData) {
                buyElement.textContent = sellElement.textContent = 'Error';
                return;
            }

            // Format prices
            const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);
            const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(4);

            const jupBuy = formatPrice(jupData.buyPrice);
            const jupSell = formatPrice(jupData.sellPrice);
            const mexcBid = formatPrice(mexcData.bid);
            const mexcAsk = formatPrice(mexcData.ask);

            // Calculate differences
            const buyDiff = formatDiff(mexcData.bid - jupData.buyPrice);
            const sellDiff = formatDiff(jupData.sellPrice - mexcData.ask);

            // Update display
            buyElement.innerHTML = `$${mexcBid} - $${jupBuy}<span class="difference">$${buyDiff}</span>`;
            sellElement.innerHTML = `$${jupSell} - $${mexcAsk}<span class="difference">$${sellDiff}</span>`;

            // Apply styles
            applyAlertStyles(buyElement.querySelector('.difference'), parseFloat(buyDiff));
            applyAlertStyles(sellElement.querySelector('.difference'), parseFloat(sellDiff));

        } catch (error) {
            console.error('Update error:', error);
            buyElement.textContent = sellElement.textContent = 'Error';
        }
    }

    // Alert styling
    function applyAlertStyles(element, difference) {
        element.classList.remove(
            'alert-positive', 'alert-negative',
            'alert-flashing-1', 'alert-flashing-2',
            'alert-flashing-negative-1', 'alert-flashing-negative-2',
            'alert-large-green'
        );
        
        let playSound = false;
        if (difference > 0.006) {
            element.classList.add('alert-flashing-2');
            playSound = true;
        } else if (difference > 0.004) {
            element.classList.add('alert-flashing-1');
            playSound = true;
        } else if (difference > 0.002) {
            element.classList.add('alert-large-green');
        } else if (difference > 0) {
            element.classList.add('alert-positive');
        } else {
            element.classList.add('alert-negative');
            if (difference < -0.2) {
                element.classList.add('alert-flashing-negative-2');
                playSound = false;
            }
        }

        if (playSound && audioEnabled) {
            playAlertSound();
        }
    }

    // Initialize
    (function init() {
        // Start with a small timeout to allow DOM load
        setTimeout(() => {
            updateAlerts();
            setInterval(updateAlerts, 4400);
            
            if (!audioEnabled && !enableButton) {
                handleAudioInitialization();
            }
        }, 500);
    })();

    return { updateAlerts };
})();