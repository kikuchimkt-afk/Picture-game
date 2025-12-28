
const GACHA_COST = 100;
const REWARD_PER_GAME = 20; // コイン獲得量アップ
const PERFECT_BONUS = 50;   // ボーナスアップ

// --- State Management ---
let state = {
    coins: parseInt(localStorage.getItem('kids_eng_coins_dx')) || 100, // 最初から1回引けるように
    collection: JSON.parse(localStorage.getItem('kids_eng_collection_dx')) || [],
    screen: 'menu',
    gameData: null,
    gachaState: 'idle',
    gachaResult: null
};

// --- Helpers ---
function saveState() {
    localStorage.setItem('kids_eng_coins_dx', state.coins);
    localStorage.setItem('kids_eng_collection_dx', JSON.stringify(state.collection));
    render();
}

function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9; // 少しゆっくり
    window.speechSynthesis.speak(u);
}

function playSfx(type) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'pop') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start();
        osc.stop(now + 0.1);
    } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.setValueAtTime(1500, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start();
        osc.stop(now + 0.3);
    } else if (type === 'gacha') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.5);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start();
        osc.stop(now + 0.5);
    } else if (type === 'fanfare') {
        // 簡易ファンファーレ
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(784, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start();
        osc.stop(now + 1.0);
    }
}

// --- Game Logic ---
function startGame() {
    const questions = [];
    for (let i = 0; i < 5; i++) {
        const target = VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)];
        const distractors = [];
        while (distractors.length < 2) {
            const d = VOCABULARY[Math.floor(Math.random() * VOCABULARY.length)];
            if (d.id !== target.id && !distractors.find(x => x.id === d.id)) distractors.push(d);
        }
        const options = [target, ...distractors].sort(() => 0.5 - Math.random());
        questions.push({ target, options });
    }

    state.gameData = {
        questions,
        currentIdx: 0,
        score: 0,
        answered: false
    };
    state.screen = 'game';
    render();

    setTimeout(() => speak(questions[0].target.word), 600);
}

function handleBalloonClick(itemId) {
    if (state.gameData.answered) return;

    const currentQ = state.gameData.questions[state.gameData.currentIdx];
    const isCorrect = itemId === currentQ.target.id;
    const clickedItem = currentQ.options.find(o => o.id === itemId);

    state.gameData.answered = true;
    render();

    if (isCorrect) {
        playSfx('pop');
        speak("Good!");
        state.gameData.score++;
    } else {
        speak(clickedItem.word);
    }

    setTimeout(() => {
        if (state.gameData.currentIdx < 4) {
            state.gameData.currentIdx++;
            state.gameData.answered = false;
            render();
            speak(state.gameData.questions[state.gameData.currentIdx].target.word);
        } else {
            // End Game
            const finalScore = isCorrect ? state.gameData.score : state.gameData.score;
            const reward = (finalScore * REWARD_PER_GAME) + (finalScore === 5 ? PERFECT_BONUS : 0);

            state.coins += reward;
            if (finalScore >= 3) playSfx('fanfare');

            state.gameData.finalReward = reward;
            state.gameData.finalScore = finalScore;
            state.screen = 'result';
            saveState();
        }
    }, 1500);
}

// --- Gacha Logic ---
function spinGacha() {
    if (state.coins < GACHA_COST || state.gachaState !== 'idle') return;

    state.coins -= GACHA_COST;
    state.gachaState = 'spinning';
    playSfx('gacha');
    saveState();

    setTimeout(() => {
        // Rarity Logic
        const rand = Math.random();
        let rarity = 1;

        if (rand < 0.50) rarity = 1; // 50% Common
        else if (rand < 0.80) rarity = 2; // 30% Rare
        else if (rand < 0.95) rarity = 3; // 15% Super Rare
        else rarity = 4; // 5% Ultra Rare

        const pool = VOCABULARY.filter(v => v.rarity === rarity);
        const result = pool[Math.floor(Math.random() * pool.length)];

        state.gachaResult = result;
        state.gachaState = 'open';

        if (!state.collection.includes(result.id)) {
            state.collection.push(result.id);
        }
        if (rarity >= 3) playSfx('fanfare');
        saveState();
    }, 2000);
}

function closeGacha() {
    state.gachaState = 'idle';
    state.gachaResult = null;
    render();
}

function resetData() {
    if (confirm('Are you sure you want to reset all data? (Coins and Collection will be lost)')) {
        state.coins = 100;
        state.collection = [];
        state.screen = 'menu';
        saveState();
    }
}

// --- Rendering ---
const app = document.getElementById('app');

function render() {
    app.innerHTML = '';

    if (state.screen === 'menu') renderMenu();
    else if (state.screen === 'game') renderGame();
    else if (state.screen === 'result') renderResult();
    else if (state.screen === 'gacha') renderGacha();
    else if (state.screen === 'collection') renderCollection();

    lucide.createIcons();
}

function renderMenu() {
    app.innerHTML = `
            <div class="flex flex-col h-full bg-white sm:bg-indigo-50">
                <!-- Header -->
                <div class="bg-white p-4 shadow-sm flex justify-between items-center z-10 sticky top-0">
                    <h1 class="text-xl font-bold text-indigo-600 flex items-center gap-2">
                        <i data-lucide="gift" class="text-pink-500"></i> Gacha DX
                    </h1>
                    <div class="bg-yellow-100 px-4 py-1 rounded-full flex items-center gap-2 text-yellow-700 font-bold border border-yellow-300">
                        <i data-lucide="coins" class="fill-yellow-400 text-yellow-600 w-5 h-5"></i>
                        ${state.coins}
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
                    <div class="text-center mb-4">
                        <p class="text-gray-500 mb-2 font-bold">Collect all 100 words!</p>
                        <span class="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 font-mono">
                            ${state.collection.length} / ${VOCABULARY.length}
                        </span>
                    </div>

                    <button onclick="startGame()" class="w-full max-w-sm bg-gradient-to-r from-blue-400 to-blue-500 text-white p-6 rounded-3xl shadow-lg transform active:scale-95 transition-all flex items-center justify-between group">
                        <div class="flex items-center gap-4">
                            <div class="bg-white/20 p-3 rounded-2xl">
                                <i data-lucide="play" class="w-8 h-8 fill-current"></i>
                            </div>
                            <div class="text-left">
                                <div class="text-2xl font-bold">Play Game</div>
                                <div class="text-blue-100 text-sm">Get Coins!</div>
                            </div>
                        </div>
                        <div class="text-4xl group-hover:rotate-12 transition-transform">🎈</div>
                    </button>

                    <button onclick="state.screen='gacha'; render()" class="w-full max-w-sm bg-gradient-to-r from-pink-400 to-pink-500 text-white p-6 rounded-3xl shadow-lg transform active:scale-95 transition-all flex items-center justify-between group">
                        <div class="flex items-center gap-4">
                            <div class="bg-white/20 p-3 rounded-2xl">
                                <i data-lucide="shopping-bag" class="w-8 h-8"></i>
                            </div>
                            <div class="text-left">
                                <div class="text-2xl font-bold">Gacha Shop</div>
                                <div class="text-pink-100 text-sm">${GACHA_COST} coins</div>
                            </div>
                        </div>
                        <div class="text-4xl group-hover:rotate-12 transition-transform">💊</div>
                    </button>

                    <button onclick="state.screen='collection'; render()" class="w-full max-w-sm bg-white text-indigo-600 p-6 rounded-3xl shadow-md border-2 border-indigo-100 transform active:scale-95 transition-all flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="bg-indigo-50 p-3 rounded-2xl">
                                <i data-lucide="book-open" class="w-8 h-8"></i>
                            </div>
                            <div class="text-left">
                                <div class="text-2xl font-bold">Collection</div>
                                <div class="text-gray-400 text-sm">Check items</div>
                            </div>
                        </div>
                        <div class="text-4xl">📖</div>
                    </button>
                </div>

                <div class="p-4 flex justify-center bg-white sm:bg-transparent">
                    <button onclick="resetData()" class="text-gray-300 hover:text-red-400 flex gap-1 text-xs items-center">
                        <i data-lucide="settings" class="w-3 h-3"></i> Reset Data
                    </button>
                </div>
            </div>
        `;
}

function renderGame() {
    const q = state.gameData.questions[state.gameData.currentIdx];

    let balloonsHtml = q.options.map((opt, idx) => {
        const isTarget = opt.id === q.target.id;
        const isVisible = !state.gameData.answered || (state.gameData.answered && isTarget);
        const styleOpacity = state.gameData.answered && !isTarget ? 'opacity: 0;' : 'opacity: 1;';
        // Randomize position slightly for visual variety
        const leftPos = 10 + (idx * 30);
        const styleAnim = state.gameData.answered ? '' : `animation: float 3s infinite ease-in-out ${idx * 0.5}s alternate;`;

        return `
                <button
                    onclick="handleBalloonClick('${opt.id}')"
                    class="absolute transition-all duration-500 ease-in-out transform hover:scale-110 active:scale-90 flex flex-col items-center justify-center w-28 h-32 z-20"
                    style="left: ${leftPos}%; top: ${state.gameData.answered ? '15%' : '35%'}; ${styleAnim} ${styleOpacity}"
                >
                    <div class="w-24 h-28 rounded-[50%] rounded-b-[45%] ${opt.bg} border-b-4 border-black/5 shadow-xl relative flex items-center justify-center text-5xl">
                        ${opt.icon}
                        <div class="absolute -bottom-6 w-0.5 h-8 bg-gray-400/50"></div>
                        <div class="absolute top-4 right-4 w-4 h-8 bg-white/40 rounded-full rotate-[-15deg]"></div>
                    </div>
                </button>
            `;
    }).join('');

    app.innerHTML = `
            <div class="min-h-screen bg-sky-100 relative overflow-hidden flex flex-col h-full">
                <!-- Clouds -->
                <i data-lucide="cloud" class="absolute top-10 left-10 text-white/60 w-24 h-24"></i>
                <i data-lucide="cloud" class="absolute top-20 right-20 text-white/40 w-32 h-32"></i>
                <i data-lucide="cloud" class="absolute top-60 left-1/3 text-white/30 w-16 h-16"></i>

                <!-- Header -->
                <div class="p-4 flex justify-between items-center z-10">
                    <div class="flex gap-1">
                        ${[...Array(5)].map((_, i) => `
                            <div class="h-2 w-8 rounded-full ${i < state.gameData.currentIdx ? 'bg-green-400' : 'bg-gray-300'}"></div>
                        `).join('')}
                    </div>
                    <button onclick="speak('${q.target.word}')" class="bg-white p-3 rounded-full shadow-lg text-blue-500 active:scale-90 transition-transform">
                        <i data-lucide="volume-2" class="w-6 h-6"></i>
                    </button>
                </div>

                <!-- Prompt -->
                <div class="text-center mt-4 z-10 pointer-events-none">
                    <h2 class="text-gray-500 font-bold">Find:</h2>
                    <div class="text-4xl font-extrabold text-blue-900 drop-shadow-sm tracking-wide animate-pulse">${q.target.word}</div>
                </div>

                <!-- Balloons -->
                <div class="flex-1 relative mt-4">
                    ${balloonsHtml}
                </div>
            </div>
        `;
}

function renderResult() {
    app.innerHTML = `
            <div class="min-h-screen bg-yellow-50 flex flex-col items-center justify-center p-6">
                <div class="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center border-4 border-yellow-200">
                    <div class="flex justify-center mb-4">
                        <i data-lucide="trophy" class="w-16 h-16 text-yellow-500"></i>
                    </div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-2">Finish!</h2>
                    <div class="text-gray-500 mb-6">Score: ${state.gameData.finalScore} / 5</div>
                    
                    <div class="bg-yellow-100 p-4 rounded-xl mb-8 flex flex-col items-center animate-bounce">
                        <span class="text-sm text-yellow-700 font-bold">GET COINS</span>
                        <div class="flex items-center gap-2 text-4xl font-extrabold text-yellow-600">
                            <i data-lucide="coins" class="w-8 h-8 fill-current"></i> +${state.gameData.finalReward}
                        </div>
                    </div>

                    <div class="space-y-3">
                        <button onclick="startGame()" class="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold shadow-md active:scale-95 transition-transform">
                            Play Again
                        </button>
                        <button onclick="state.screen='menu'; render()" class="w-full bg-white text-gray-500 border-2 border-gray-200 py-3 rounded-2xl font-bold active:scale-95 transition-transform">
                            Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
}

function renderGacha() {
    let modalHtml = '';
    if (state.gachaState === 'open' && state.gachaResult) {
        const r = state.gachaResult;
        let rarityText = "Common";
        let rarityColor = "text-gray-400";
        let bgEffect = "bg-yellow-100 opacity-20";

        if (r.rarity === 2) { rarityText = "Rare!"; rarityColor = "text-blue-500"; }
        if (r.rarity === 3) { rarityText = "Super Rare!"; rarityColor = "text-pink-500"; }
        if (r.rarity === 4) { rarityText = "ULTRA RARE!!"; rarityColor = "text-yellow-600 font-black"; bgEffect = "bg-gradient-to-r from-yellow-200 to-pink-200 opacity-50"; }

        modalHtml = `
                <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div class="bg-white w-full max-w-sm rounded-3xl p-8 text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
                         <div class="absolute inset-0 ${bgEffect} animate-spin-slow" style="z-index:-1"></div>
                        <div class="${rarityColor} font-bold mb-4 uppercase tracking-widest text-lg">${rarityText}</div>
                        <div class="text-8xl mb-6 transform hover:scale-110 transition-transform">${r.icon}</div>
                        <h3 class="text-4xl font-extrabold text-gray-800 mb-2">${r.word}</h3>
                        <p class="text-gray-500 text-xl mb-8">${r.jp}</p>
                        <button onclick="speak('${r.word}'); closeGacha()" class="w-full bg-pink-500 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95">Close</button>
                    </div>
                </div>
            `;
    }

    const btnClass = state.gachaState === 'spinning' ? 'rotate-180 bg-pink-700' : 'bg-pink-400 hover:bg-pink-300';
    const btnDisabled = state.coins < GACHA_COST || state.gachaState !== 'idle';
    const btnOpacity = btnDisabled ? 'opacity-50 grayscale cursor-not-allowed' : 'active:scale-95 cursor-pointer';

    app.innerHTML = `
            <div class="min-h-screen bg-pink-50 flex flex-col items-center p-4">
                <div class="w-full flex justify-between items-center mb-4">
                    <button onclick="state.screen='menu'; render()" class="bg-white p-2 rounded-full shadow text-gray-500">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                    <div class="bg-yellow-100 px-4 py-1 rounded-full flex items-center gap-2 text-yellow-700 font-bold border border-yellow-300">
                        <i data-lucide="coins" class="fill-yellow-400 w-4 h-4"></i> ${state.coins}
                    </div>
                </div>

                <div class="flex-1 flex flex-col justify-center w-full max-w-sm">
                    <div class="bg-white p-6 rounded-3xl shadow-2xl border-4 border-pink-200 w-full flex flex-col items-center relative">
                        <div class="w-56 h-56 rounded-full bg-blue-100 border-4 border-black/10 flex items-center justify-center relative overflow-hidden mb-6">
                            <div class="absolute top-10 left-10 text-3xl animate-pulse">💊</div>
                            <div class="absolute bottom-10 right-10 text-3xl animate-pulse delay-75">🔮</div>
                            <div class="absolute top-1/2 left-1/2 text-3xl animate-pulse delay-150">🔴</div>
                            ${state.gachaState === 'spinning' ? `
                                <div class="absolute inset-0 bg-white/50 flex items-center justify-center">
                                    <i data-lucide="refresh-cw" class="animate-spin text-blue-500 w-16 h-16"></i>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="w-full bg-pink-500 h-28 rounded-2xl flex items-center justify-center relative shadow-inner">
                            <button 
                                onclick="spinGacha()"
                                ${btnDisabled ? 'disabled' : ''}
                                class="h-20 w-20 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all duration-500 ${btnClass} ${btnOpacity}"
                            >
                                <i data-lucide="rotate-cw" class="text-white w-10 h-10"></i>
                            </button>
                        </div>
                        <div class="mt-4 text-gray-400 text-sm font-bold">Cost: ${GACHA_COST} coins</div>
                    </div>
                </div>
                ${modalHtml}
            </div>
        `;
}

function renderCollection() {
    // Sort by Rarity (descending) then by ID
    const sortedVocab = [...VOCABULARY].sort((a, b) => b.rarity - a.rarity);

    const gridHtml = sortedVocab.map(item => {
        const isUnlocked = state.collection.includes(item.id);
        const clickHandler = isUnlocked ? `onclick="speak('${item.word}')"` : '';

        // Style logic based on rarity/unlock
        let cardBg = isUnlocked ? 'bg-white' : 'bg-gray-200 opacity-50';
        if (isUnlocked && item.rarity === 4) cardBg = 'bg-yellow-50 border-2 border-yellow-200';

        const icon = isUnlocked ? item.icon : '🔒';

        let stars = '';
        if (isUnlocked) {
            // Gold stars for normal, Rainbowish for Ultra Rare? Just standard gold for clean look
            stars = `<div class="flex gap-0.5 mt-1">${[...Array(item.rarity)].map(() => '<span class="text-[8px] text-yellow-500">★</span>').join('')}</div>`;
        }

        return `
                <div ${clickHandler} class="aspect-square rounded-2xl flex flex-col items-center justify-center p-1 transition-all shadow-sm ${cardBg} ${isUnlocked ? 'active:scale-95 cursor-pointer' : ''}">
                    <div class="text-3xl sm:text-4xl mb-1 filter">${icon}</div>
                    ${isUnlocked ? `
                        <div class="text-[10px] sm:text-xs font-bold text-gray-700 truncate w-full text-center">${item.word}</div>
                        <div class="text-[8px] sm:text-[10px] text-gray-400 truncate">${item.jp}</div>
                    ` : ''}
                    ${stars}
                </div>
            `;
    }).join('');

    app.innerHTML = `
            <div class="h-screen bg-indigo-50 flex flex-col overflow-hidden">
                <div class="bg-white p-4 shadow-sm flex justify-between items-center z-10 sticky top-0">
                    <button onclick="state.screen='menu'; render()" class="bg-gray-100 p-2 rounded-full">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                    <h1 class="text-lg font-bold text-gray-700">Collection</h1>
                    <div class="w-8"></div>
                </div>
                
                <div class="flex-1 p-4 grid grid-cols-4 sm:grid-cols-5 gap-2 overflow-y-auto collection-scroll content-start pb-20">
                    ${gridHtml}
                </div>
            </div>
        `;
}

// --- Init ---
render();
