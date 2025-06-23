const kbbb = (() => {
    let audioContext = null;
    let audioEnabled = false;
    let enableButton = null;

    // Audio initialization
    function handleAudioInitialization() {
        enableButton = document.createElement('button');
        enableButton.id = 'kbbb-audio-enable-btn';
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
            pointer-events: auto !important;
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

        const section = document.getElementById('kbbb-buy-alert').closest('.token-section');
        section.appendChild(enableButton);
    }

    // Sound alert function with volume control
    async function playAlertSound(volume = 0.15) {
        if (!audioEnabled || !audioContext) return;

        try {
            // Ensure audio context is active
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            const osc = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioContext.destination);

            osc.type = 'sine'; // Softer sound than square
            osc.frequency.setValueAtTime(523.25, audioContext.currentTime);
            gainNode.gain.value = volume; // Direct volume control

            osc.start();
            osc.stop(audioContext.currentTime + 0.2); // Shorter duration
        } catch (error) {
            console.log('Sound playback error:', error);
            // Show error on button if exists
            if (enableButton) {
                enableButton.innerHTML = '❌ Sound Error';
                enableButton.style.background = '#f44336';
            }
        }
    }

    // JUP swap function
    async function fetchJupSwapPrice(inputMint, outputMint, amount, decimals) {
        try {
            const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
            const response = await fetch(url);
        
            if (!response.ok) {
                throw new Error(`JUP API error: ${response.status}`);
            }
        
            const data = await response.json();
            return data.outAmount / 10 ** decimals;
        } catch (error) {
            console.error('Error fetching JUP swap price:', error);
            return null;
        }
    }

    // MEXC price fetch with orderbook average
    async function fetchMexcPrice() {
        try {
            const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=';
            const apiUrl = 'https://contract.mexc.com/api/v1/contract/depth/KBBB_USDT';
            const response = await fetch(proxyUrl + apiUrl);
            const data = await response.json();
            
            const calculateBidPrice = (bids, targetKBBB) => {
                let totalKBBB = 0;
                let totalUSDT = 0;
                
                for (const [priceStr, usdtAvailableStr] of bids) {
                    const price = parseFloat(priceStr);
                    const usdtAvailable = parseFloat(usdtAvailableStr);
                    const kbbbAvailable = usdtAvailable / price;
                    const remaining = targetKBBB - totalKBBB;
                    const fillAmount = Math.min(remaining, kbbbAvailable);
                    
                    totalUSDT += fillAmount * price;
                    totalKBBB += fillAmount;
                    
                    if (totalKBBB >= targetKBBB) break;
                }
                if (totalKBBB < targetKBBB) throw new Error('Insufficient bid liquidity');
                return totalUSDT / targetKBBB;
            };

            const calculateAskPrice = (asks, targetKBBB) => {
                let totalKBBB = 0;
                let totalUSDT = 0;
                
                for (const [priceStr, usdtAvailableStr] of asks) {
                    const price = parseFloat(priceStr);
                    const usdtAvailable = parseFloat(usdtAvailableStr);
                    const kbbbAvailable = usdtAvailable / price;
                    const remaining = targetKBBB - totalKBBB;
                    const fillAmount = Math.min(remaining, kbbbAvailable);
                    
                    totalUSDT += fillAmount * price;
                    totalKBBB += fillAmount;
                    
                    if (totalKBBB >= targetKBBB) break;
                }
                if (totalKBBB < targetKBBB) throw new Error('Insufficient ask liquidity');
                return totalUSDT / targetKBBB;
            };

            const targetKBBB = 676498; // Matches JUP's sell amount
            const bidPrice = calculateBidPrice(data.data.bids, targetKBBB);
            const askPrice = calculateAskPrice(data.data.asks, targetKBBB);

            return {
                bid: bidPrice,
                ask: askPrice
            };
        } catch (error) {
            console.error('MEXC Error:', error);
            return null;
        }
    }

    // JUP price calculation
    async function fetchJupPrice() {
        const inputMintUSDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const outputMintkbbb = 'npB9cxTzwUiGt7jk2dXZa52xZve8SgVD6Et9Bpipump';
    
        const [kbbbAmount, usdcAmount] = await Promise.all([
            fetchJupSwapPrice(inputMintUSDC, outputMintkbbb, 298 * 1e6, 6),
            fetchJupSwapPrice(outputMintkbbb, inputMintUSDC, 676498 * 1e6, 6)
        ]);
    
        return {
            buyPrice: kbbbAmount ? 298 / kbbbAmount : null,
            sellPrice: usdcAmount ? usdcAmount / 676498 : null
        };
    }

    // Alert update
    async function updateAlerts() {
        const elements = {
            buy: document.getElementById('kbbb-buy-alert'),
            sell: document.getElementById('kbbb-sell-alert')
        };

        try {
            const [mexcData, jupData] = await Promise.all([
                fetchMexcPrice(),
                fetchJupPrice()
            ]);

            if (!mexcData || !jupData) {
                elements.buy.textContent = elements.sell.textContent = 'Error';
                return;
            }

            // Formatting functions
            const formatPrice = (val) => isNaN(val) ? 'N/A' : val.toFixed(7);
            const formatDiff = (val) => isNaN(val) ? 'N/A' : val.toFixed(7);

            // Format prices
            const jupBuy = formatPrice(jupData.buyPrice);
            const jupSell = formatPrice(jupData.sellPrice);
            const mexcBid = formatPrice(mexcData.bid);
            const mexcAsk = formatPrice(mexcData.ask);

            // Calculate differences
            const buyDiff = mexcData.bid - jupData.buyPrice;
            const sellDiff = jupData.sellPrice - mexcData.ask;

            // Update display with price comparison
            elements.buy.innerHTML = `$${jupBuy} - $${mexcBid} `
                + `<span class="difference">$${formatDiff(buyDiff)}</span>`;
            
            elements.sell.innerHTML = `$${jupSell} - $${mexcAsk} `
                + `<span class="difference">$${formatDiff(sellDiff)}</span>`;

            // Apply styles to difference spans
            applyAlertStyles(elements.buy.querySelector('.difference'), buyDiff, true);
            applyAlertStyles(elements.sell.querySelector('.difference'), sellDiff, false);
            
        } catch (error) {
            console.error('Update error:', error);
            elements.buy.innerHTML = elements.sell.innerHTML = 'Error';
        }
    }

    // Alert styling with separate buy/sell logic
    function applyAlertStyles(element, value, isBuy) {
        element.className = '';
        let shouldPlaySound = false;
        let volume = 0.15; // Default volume

        if (isBuy) {
            // Buy alert conditions
            if (value > 0.000009) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
                volume = 0.15; // Normal volume
            } else if (value > 0.000006) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
                volume = 0.05; // Lower volume
            } else if (value > 0.000003) {
                element.classList.add('alert-large-green');
            } else if (value > 0) {
                element.classList.add('alert-positive');
            } else {
                element.classList.add('alert-negative');
            }
        } else {
            // Sell alert conditions
            if (value > 0.000006) {
                element.classList.add('alert-flashing-2');
                shouldPlaySound = true;
                volume = 0.15; // Normal volume
            } else if (value > 0.000004) {
                element.classList.add('alert-flashing-1');
                shouldPlaySound = true;
                volume = 0.05; // Lower volume
            } else if (value > 0.000002) {
                element.classList.add('alert-large-green');
            } else if (value > 0) {
                element.classList.add('alert-positive');
            } else {
                element.classList.add('alert-negative');
            }
        }

        if (shouldPlaySound && audioEnabled) {
            playAlertSound(volume);
        }
    }

    // Initialization
    (function init() {
        updateAlerts();
        setInterval(updateAlerts, 5700);
        setTimeout(() => {
            if (!audioEnabled && !enableButton) handleAudioInitialization();
        }, 5000);
    })();

    return { updateAlerts };
})();