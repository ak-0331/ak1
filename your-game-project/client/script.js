// client/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- UI要素の取得 ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const coinsDisplay = document.getElementById('coins');
    const usernameDisplay = document.getElementById('username-display');
    const userIconDisplay = document.getElementById('user-icon-display');
    const playerTerritoriesDisplay = document.getElementById('player-territories');

    // スロット関連
    const reels = [
        document.getElementById('reel1'),
        document.getElementById('reel2'),
        document.getElementById('reel3')
    ];
    const betAmountInput = document.getElementById('bet-amount');
    const spinButton = document.getElementById('spin-button');
    const spinMessage = document.getElementById('spin-message');
    const spinDirectionNormal = document.getElementById('spin-direction-normal');
    const spinDirectionReverse = document.getElementById('spin-direction-reverse');

    // お仕事関連
    const typingInput = document.getElementById('typing-input');
    const currentWordDisplay = document.getElementById('current-word');
    const workMessage = document.getElementById('work-message');
    const nextTypingWordButton = document.getElementById('next-typing-word-button');
    const claimBonusButton = document.getElementById('claim-bonus-button');
    const bonusMessage = document.getElementById('daily-bonus-message');
    const dailyCoinsEarnedDisplay = document.getElementById('daily-coins-earned');
    const dailyCoinLimitDisplay = document.getElementById('daily-coin-limit');

    // 軍事基地関連
    const militaryMessage = document.getElementById('military-message');
    const buyTerritoryButton = document.getElementById('buy-territory-button');
    const buyUnitButtons = document.querySelectorAll('.buy-unit-button');

    // バトル関連
    const battleMessage = document.getElementById('battle-message');
    const unitSelectButtons = document.querySelectorAll('.unit-select-button');
    const selectedUnitDisplay = document.getElementById('selected-unit-display');
    const deployQuantityInput = document.getElementById('deploy-quantity-input');
    const playerList = document.getElementById('player-list');
    const selectedPlayerDisplay = document.getElementById('selected-player-display');
    const attackButton = document.getElementById('attack-button');
    let selectedUnitType = null;
    let selectedUnitGrade = null;
    let selectedPlayerId = null;

    // ランキング関連
    const rankingList = document.getElementById('ranking-list');
    const yourRankDisplay = document.getElementById('your-rank-display');

    // 設定関連
    const usernameInput = document.getElementById('username-input');
    const saveUsernameButton = document.getElementById('save-username-button');
    const usernameMessage = document.getElementById('username-message');
    const iconUploadInput = document.getElementById('icon-upload-input');
    const iconSelectors = document.querySelectorAll('.icon-selector .icon');

    // 警告モーダル
    const warningModal = document.getElementById('warning-modal');
    const closeWarningModalButton = document.getElementById('close-warning-modal');


    // --- ゲーム状態変数 (サーバーからロードされるため初期値は0またはnullでOK) ---
    let coins = 0;
    let playerTerritories = 0;
    let units = {}; // 例: { infantry: { 1: { count: 0, cooldowns: [] } } }
    let lastSpinTime = 0;
    let lastWorkTime = 0;
    let dailyCoinsEarned = 0;
    const dailyCoinLimit = 500; // 本来はサーバーで管理すべき
    let lastBonusClaimDate = null; // ISO文字列 'YYYY-MM-DD'
    let username = "ゲスト";
    let userIcon = "😀";
    let spinDirection = "normal";
    let lastTerritoryPurchaseTime = 0; // 領土購入のクールダウン用

    // --- 新しく追加する変数 ---
    let currentPlayerId = null; // ★重要: 現在のプレイヤーのIDをサーバーから取得して保持します

    // --- サーバーのURL (デプロイ後にここをRenderのWeb Serviceの公開URLに置き換える！) ---
    const SERVER_URL = 'https://ak-game-server.onrender.com';
    
    // --- プレイヤー以外のユーザーデータ (サーバーから取得する) ---
    let otherPlayers = [];

    // --- ゲーム定数 ---
    const slotSymbols = ['🍒', '🍋', '🔔', '💎', '⭐'];
    const typingWords = ["apple", "banana", "cherry", "grape", "lemon", "orange", "strawberry", "watermelon", "pineapple", "kiwi"];
    let currentWord = '';
    let typingIndex = 0;

    const unitCosts = {
        infantry: { 1: 100, 2: 200, 3: 400 },
        armored_car: { 1: 500, 2: 1000, 3: 2000 },
        tank: { 1: 2000, 2: 4000, 3: 8000 },
        fighter: { 1: 5000, 2: 10000, 3: 20000 }
    };
    const unitPowers = { // クライアント側での表示用 (バトルロジックはサーバーで実行)
        infantry: { 1: 10, 2: 20, 3: 40 },
        armored_car: { 1: 50, 2: 100, 3: 200 },
        tank: { 1: 200, 2: 400, 3: 800 },
        fighter: { 1: 500, 2: 1000, 3: 2000 }
    };
    const unitCooldownTimes = { // クライアント側での表示用 (バトルロジックはサーバーで実行)
        infantry: { 1: 30 * 60 * 1000, 2: 25 * 60 * 1000, 3: 20 * 60 * 1000 },
        armored_car: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
        tank: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
        fighter: { 1: 120 * 60 * 1000, 2: 100 * 60 * 1000, 3: 80 * 60 * 1000 }
    };


    // --- 補助関数 ---

    // UI更新関数
    function updateUI() {
        coinsDisplay.textContent = coins.toLocaleString();
        usernameDisplay.textContent = username;
        playerTerritoriesDisplay.textContent = playerTerritories.toLocaleString();

        // ユーザーアイコンの表示
        if (userIcon && userIcon.startsWith('data:image')) {
            userIconDisplay.innerHTML = `<img src="${userIcon}" alt="icon">`;
        } else {
            userIconDisplay.textContent = userIcon;
            userIconDisplay.innerHTML = `<span>${userIcon}</span>`; // 絵文字をspanで囲む
        }
        usernameInput.value = username; // 設定画面のユーザー名入力欄も更新

        // アイコン選択のハイライト
        document.querySelectorAll('.icon-selector .icon').forEach(iconElement => {
            if (iconElement.dataset.icon === userIcon) {
                iconElement.classList.add('selected');
            } else {
                iconElement.classList.remove('selected');
            }
        });

        // 軍事基地のユニット保有数とクールダウン表示
        ['infantry', 'armored_car', 'tank', 'fighter'].forEach(type => {
            [1, 2, 3].forEach(grade => {
                const countElem = document.getElementById(`${type}-count-${grade}`);
                const cooldownElem = document.getElementById(`${type}-cooldown-${grade}`);
                const availableElem = document.getElementById(`${type}-available-${grade}`);

                const currentUnitData = units[type]?.[grade] || { count: 0, cooldowns: [] };
                const now = new Date();
                // クールダウン中のユニット数を計算
                const cooldownCount = currentUnitData.cooldowns.filter(cooldownEnd => cooldownEnd > now).length;
                const availableCount = currentUnitData.count - cooldownCount;

                if (countElem) countElem.textContent = currentUnitData.count;
                if (cooldownElem) cooldownElem.textContent = cooldownCount;
                if (availableElem) availableElem.textContent = availableCount;

                // バトルセクションのボタンも更新
                const battleButton = document.querySelector(`.unit-select-button[data-unit-type="${type}"][data-unit-grade="${grade}"]`);
                if (battleButton) {
                    battleButton.disabled = availableCount <= 0; // 使用可能なユニットがなければ無効化
                    // バトルボタンの表示も更新
                    battleButton.querySelector('span').textContent = availableCount;
                }
            });
        });

        // スロット回転方向のラジオボタンの状態を更新
        if (spinDirection === "normal") {
            spinDirectionNormal.checked = true;
        } else {
            spinDirectionReverse.checked = true;
        }
    }

    // デイリーボーナスチェック
    function checkDailyBonus() {
        const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
        if (lastBonusClaimDate === today) {
            bonusMessage.textContent = "今日のボーナスは既に受け取り済みです。";
            claimBonusButton.disabled = true;
        } else {
            bonusMessage.textContent = "毎日ログインしてボーナスをゲット！";
            claimBonusButton.disabled = false;
        }
    }

    // デイリー獲得コイン更新
    function updateDailyCoinsEarned() {
        dailyCoinsEarnedDisplay.textContent = dailyCoinsEarned;
        dailyCoinLimitDisplay.textContent = dailyCoinLimit;
    }

    // スロットの勝利判定
    function calculateWinnings(results, bet) {
        if (results[0] === results[1] && results[1] === results[2]) {
            if (results[0] === '⭐') return bet * 50; // 全て星
            return bet * 10; // 3つ揃い
        } else if (results[0] === results[1] || results[1] === results[2]) {
            return bet * 2; // 2つ揃い
        }
        return 0; // 負け
    }

    // スロットリールのアニメーション
    function spinReel(reel, duration, finalSymbol) {
        return new Promise(resolve => {
            const startTime = Date.now();
            const intervalTime = 50; // スピンの速度
            const symbolsPerSpin = slotSymbols.length;
            const initialOffset = Math.floor(Math.random() * symbolsPerSpin); // 開始位置をランダムに

            let spinCount = 0;
            const interval = setInterval(() => {
                spinCount++;
                let currentIndex;
                if (spinDirection === "normal") {
                    currentIndex = (initialOffset + spinCount) % symbolsPerSpin;
                } else { // reverse
                    currentIndex = (initialOffset - spinCount + symbolsPerSpin * 100) % symbolsPerSpin; // 負の数を防ぐ
                }
                reel.textContent = slotSymbols[currentIndex];

                const elapsedTime = Date.now() - startTime;
                if (elapsedTime >= duration * 1000) {
                    clearInterval(interval);
                    reel.textContent = finalSymbol; // 最終結果を設定
                    resolve();
                }
            }, intervalTime);
        });
    }

    // 新しいお仕事単語
    function setNewTypingWord() {
        currentWord = typingWords[Math.floor(Math.random() * typingWords.length)];
        typingIndex = 0;
        currentWordDisplay.innerHTML = currentWord;
        typingInput.value = '';
        typingInput.focus();
        workMessage.textContent = "単語を正確にタイプしよう！";
    }

    // ユニット表示名を取得
    function getUnitDisplayName(type) {
        switch (type) {
            case 'infantry': return '歩兵';
            case 'armored_car': return '装甲車';
            case 'tank': return '戦車';
            case 'fighter': return '戦闘機';
            default: return '';
        }
    }

    // バトルUIの更新（選択状態とプレイヤーリスト）
    async function updateBattleUI() {
        // ユニット選択ボタンの更新
        unitSelectButtons.forEach(button => {
            const type = button.dataset.unitType;
            const grade = parseInt(button.dataset.unitGrade);
            const currentUnitData = units[type]?.[grade] || { count: 0, cooldowns: [] };
            const now = new Date();
            const cooldownCount = currentUnitData.cooldowns.filter(cooldownEnd => cooldownEnd > now).length;
            const availableCount = currentUnitData.count - cooldownCount;

            button.disabled = availableCount <= 0;
            button.classList.toggle('selected', selectedUnitType === type && selectedUnitGrade === grade);
            button.querySelector('span').textContent = availableCount; // 使用可能数をリアルタイム更新
        });

        // プレイヤーリストの更新
        await fetchOtherPlayers(); // 最新のプレイヤーデータを取得

        playerList.innerHTML = '';
        if (otherPlayers.length === 0) {
            playerList.innerHTML = '<li>現在攻撃可能なプレイヤーがいません。</li>';
        } else {
            otherPlayers.forEach(player => {
                const li = document.createElement('li');
                li.dataset.playerId = player.id;
                li.innerHTML = `<span class="player-detail">
                                    <span class="icon-in-list">
                                        ${player.icon && player.icon.startsWith('data:image') ? `<img src="${player.icon}" alt="icon">` : `<span>${player.icon || '👤'}</span>`}
                                    </span>
                                    ${player.username}
                                </span>
                                <span class="player-power">戦闘力: ${player.power || (player.territories * 50)}</span>`; // BOTのpowerがなければ領土から概算

                li.classList.toggle('selected', selectedPlayerId === player.id);
                li.addEventListener('click', () => {
                    selectedPlayerId = player.id;
                    selectedPlayerDisplay.textContent = player.username;
                    updateBattleUI(); // UIを再描画して選択状態を反映
                });
                playerList.appendChild(li);
            });
        }
        updateSelectedDisplay(); // 選択表示を更新
    }

    function updateSelectedDisplay() {
        const selectedUnitText = selectedUnitType && selectedUnitGrade ? `${getUnitDisplayName(selectedUnitType)} Lv.${selectedUnitGrade}` : "なし";
        selectedUnitDisplay.textContent = selectedUnitText;

        const selectedPlayerText = otherPlayers.find(p => p.id === selectedPlayerId)?.username || "なし";
        selectedPlayerDisplay.textContent = selectedPlayerText;

        // 攻撃ボタンの有効/無効
        attackButton.disabled = !(selectedUnitType && selectedUnitGrade && selectedPlayerId && deployQuantityInput.value > 0);
    }

    // 初回訪問時警告モーダル
    function showWarningModal() {
        warningModal.classList.add('active');
    }

    closeWarningModalButton.addEventListener('click', () => {
        warningModal.classList.remove('active');
    });

    // --- ゲーム初期化とデータ読み込み (大幅に変更) ---
    async function loadGameData() {
        try {
            // ローカルストレージからユーザー名とアイコンを試行的に取得
            let initialUsername = localStorage.getItem('localUsername') || "ゲスト";
            let initialUserIcon = localStorage.getItem('localUserIcon') || "😀";

            // サーバーにプレイヤーデータを要求 (初回アクセス時やID不明時は新規作成される)
            const response = await fetch(`${SERVER_URL}/api/player`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestedId: localStorage.getItem('currentPlayerId'), // 以前のセッションのIDがあれば送る
                    username: initialUsername,
                    userIcon: initialUserIcon
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to load player data: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Loaded player data from server:", data);

            // サーバーから受け取ったデータでゲーム状態を更新
            currentPlayerId = data.id;
            localStorage.setItem('currentPlayerId', currentPlayerId); // 次回のためにIDを保存
            localStorage.setItem('localUsername', data.username); // ユーザー名をローカルにも保存
            localStorage.setItem('localUserIcon', data.icon); // アイコンをローカルにも保存

            coins = data.coins;
            playerTerritories = data.playerTerritories;
            units = data.units;
            lastSpinTime = data.lastSpinTime || 0;
            lastWorkTime = data.lastWorkTime || 0;
            dailyCoinsEarned = data.dailyCoinsEarned || 0;
            lastBonusClaimDate = data.lastBonusClaimDate; // ISO文字列のまま
            username = data.username;
            userIcon = data.icon;
            spinDirection = data.spinDirection || "normal";
            lastTerritoryPurchaseTime = data.lastTerritoryPurchaseTime || 0;

            // クールダウン時刻のISO文字列をDateオブジェクトに変換 (クライアント側で利用するため)
            for (const type in units) {
                for (const grade in units[type]) {
                    if (units[type][grade] && Array.isArray(units[type][grade].cooldowns)) {
                        units[type][grade].cooldowns = units[type][grade].cooldowns.map(ts => new Date(ts));
                    } else {
                        // ユニットデータがない場合の初期化
                        units[type][grade] = { count: 0, cooldowns: [] };
                    }
                }
            }


            // 他のプレイヤーデータをサーバーから取得
            await fetchOtherPlayers();

            updateUI(); // UI更新
            checkDailyBonus(); // デイリーボーナスチェック
            updateDailyCoinsEarned(); // デイリー獲得コイン更新
            updateBattleUI(); // バトルUI更新

            // 初回ロード時に注意書き表示（初回のみ）
            if (!localStorage.getItem('hasVisitedBefore')) {
                showWarningModal();
                localStorage.setItem('hasVisitedBefore', 'true');
            }

        } catch (error) {
            console.error("Error loading game data:", error);
            alert("ゲームデータのロードに失敗しました。サーバーが起動しているか、URLが正しいか確認してください。\nエラー: " + error.message);
            // ここでゲームを終了させるか、オフラインモードに切り替えるなどのハンドリングが必要
        }
    }

    // ゲームデータをサーバーに保存 (大幅に変更)
    async function saveGameData() {
        if (!currentPlayerId) {
            console.warn("currentPlayerId is not set. Cannot save data.");
            return;
        }

        const dataToSave = {
            coins,
            playerTerritories,
            username,
            icon: userIcon, // サーバーのキー名に合わせる
            spinDirection,
            lastSpinTime,
            lastWorkTime,
            dailyCoinsEarned,
            lastBonusClaimDate, // ISO文字列のまま
            lastTerritoryPurchaseTime,
            // unitsはcooldownsをISO文字列に変換して送る
            units: JSON.parse(JSON.stringify(units)) // ディープコピーして元データを壊さないように
        };

        // DateオブジェクトをISO文字列に変換して保存
        for (const type in dataToSave.units) {
            for (const grade in dataToSave.units[type]) {
                if (dataToSave.units[type][grade] && Array.isArray(dataToSave.units[type][grade].cooldowns)) {
                    dataToSave.units[type][grade].cooldowns = dataToSave.units[type][grade].cooldowns.map(date => date.toISOString());
                }
            }
        }

        try {
            const response = await fetch(`${SERVER_URL}/api/player/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: currentPlayerId, data: dataToSave })
            });

            if (!response.ok) {
                throw new Error(`Failed to save player data: ${response.statusText}`);
            }

            const result = await response.json();
            // console.log("Game data saved successfully:", result.message);
        } catch (error) {
            console.error("Error saving game data:", error);
        }
    }

    // 他のプレイヤーデータをサーバーから取得する関数
    async function fetchOtherPlayers() {
        try {
            const response = await fetch(`${SERVER_URL}/api/players`);
            if (!response.ok) {
                throw new Error(`Failed to fetch other players: ${response.statusText}`);
            }
            const allPlayers = await response.json();
            // 自分以外のプレイヤーだけをフィルタリング
            otherPlayers = allPlayers.filter(p => p.id !== currentPlayerId);
            // console.log("Fetched other players:", otherPlayers);
        } catch (error) {
            console.error("Error fetching other players:", error);
            otherPlayers = []; // エラー時は空にする
        }
    }


    // --- イベントリスナー ---

    // タブ切り替え
    tabs.forEach(button => {
        button.addEventListener('click', () => {
            tabs.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');

            // タブ切り替え時に更新が必要なUIを呼ぶ
            if (button.dataset.tab === 'battle') {
                updateBattleUI();
            } else if (button.dataset.tab === 'ranking') {
                updateRanking();
            } else {
                updateUI(); // その他のタブでも基本UIは更新
            }
        });
    });


    // スロットゲーム
    spinButton.addEventListener('click', async () => {
        const bet = parseInt(betAmountInput.value);
        if (isNaN(bet) || bet <= 0 || coins < bet) {
            spinMessage.textContent = '有効な賭け金を入力してください。';
            return;
        }
        if (Date.now() - lastSpinTime < 3000) { // 3秒クールダウン
            spinMessage.textContent = "スピンは3秒に一度だけです。";
            return;
        }

        spinButton.disabled = true;
        coins -= bet; // クライアント側で先に減算し、UIに反映
        lastSpinTime = Date.now();
        updateUI();

        const results = [
            slotSymbols[Math.floor(Math.random() * slotSymbols.length)],
            slotSymbols[Math.floor(Math.random() * slotSymbols.length)],
            slotSymbols[Math.floor(Math.random() * slotSymbols.length)]
        ];

        const durations = [1.5, 2.0, 2.5]; // 各リールの停止時間
        await Promise.all(reels.map((reel, index) => spinReel(reel, durations[index], results[index])));

        const winnings = calculateWinnings(results, bet);
        coins += winnings; // クライアント側で加算
        spinMessage.textContent = `結果: ${results.join(' ')}。${winnings > 0 ? `${winnings}コイン獲得！` : '残念！'}`;
        updateUI();
        await saveGameData(); // ★サーバーに保存★
        spinButton.disabled = false;
    });

    spinDirectionNormal.addEventListener('change', async () => {
        spinDirection = 'normal';
        await saveGameData();
    });

    spinDirectionReverse.addEventListener('change', async () => {
        spinDirection = 'reverse';
        await saveGameData();
    });


    // お仕事セクション - タイピングゲーム
    nextTypingWordButton.addEventListener('click', setNewTypingWord);
    typingInput.addEventListener('input', async () => {
        const typedText = typingInput.value;
        currentWordDisplay.innerHTML = ''; // 一度クリア
        for (let i = 0; i < currentWord.length; i++) {
            const charSpan = document.createElement('span');
            charSpan.textContent = currentWord[i];
            if (i < typedText.length) {
                if (typedText[i] === currentWord[i]) {
                    charSpan.style.color = 'lime'; // 正解
                } else {
                    charSpan.style.color = 'red'; // 不正解
                }
            }
            currentWordDisplay.appendChild(charSpan);
        }

        if (typedText === currentWord) {
            workMessage.textContent = "完璧！";
            if (dailyCoinsEarned < dailyCoinLimit) {
                const earned = Math.floor(Math.random() * 5) + 1; // 1～5コイン
                coins += earned;
                dailyCoinsEarned += earned;
                if (dailyCoinsEarned > dailyCoinLimit) {
                    coins -= (dailyCoinsEarned - dailyCoinLimit); // 制限を超えた分は差し引く
                    dailyCoinsEarned = dailyCoinLimit;
                }
                workMessage.textContent += ` +${earned}コイン！現在の獲得: ${dailyCoinsEarned}/${dailyCoinLimit}`;
            } else {
                workMessage.textContent += " 今日の労働限界に達しました！";
            }
            lastWorkTime = Date.now(); // 最終労働時間を更新
            updateUI();
            await saveGameData(); // ★サーバーに保存★
            setTimeout(setNewTypingWord, 1000); // 1秒後に次の単語
        }
    });

    // デイリーボーナス
    claimBonusButton.addEventListener('click', async () => {
        const today = new Date().toISOString().slice(0, 10);
        if (lastBonusClaimDate === today) {
            bonusMessage.textContent = "今日のボーナスは既に受け取り済みです。";
            return;
        }

        const bonusAmount = 500; // デイリーボーナス額
        coins += bonusAmount;
        lastBonusClaimDate = today;
        bonusMessage.textContent = `${bonusAmount}コインのデイリーボーナスを受け取りました！`;
        claimBonusButton.disabled = true; // ボタンを無効化
        updateUI();
        await saveGameData(); // ★サーバーに保存★
    });


    // 軍事基地 - 領土購入
    buyTerritoryButton.addEventListener('click', async () => {
        const cost = 100000;
        const now = Date.now();
        const cooldown = 5 * 60 * 1000; // 5分クールダウン

        if (now - lastTerritoryPurchaseTime < cooldown) {
            militaryMessage.textContent = `領土購入は${Math.ceil((cooldown - (now - lastTerritoryPurchaseTime)) / 60000)}分待ってください。`;
            return;
        }

        if (coins >= cost) {
            coins -= cost;
            playerTerritories += 1;
            lastTerritoryPurchaseTime = now; // クールダウン更新
            militaryMessage.textContent = `領土を1つ購入しました！現在の領土数: ${playerTerritories}`;
            updateUI();
            await saveGameData(); // ★サーバーに保存★
        } else {
            militaryMessage.textContent = `コインが${cost - coins}足りません！`;
        }
    });

    // 軍事基地 - ユニット購入
    buyUnitButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const unitType = event.target.dataset.unitType;
            const gradeSelect = event.target.closest('.unit-option').querySelector('.unit-grade-select');
            const grade = parseInt(gradeSelect.value);
            const quantityInput = event.target.closest('.unit-option').querySelector('.buy-quantity-input');
            const quantity = parseInt(quantityInput.value);

            const costPerUnit = unitCosts[unitType][grade];
            const totalCost = costPerUnit * quantity;

            if (isNaN(quantity) || quantity <= 0) {
                militaryMessage.textContent = "購入数を正しく入力してください。";
                return;
            }

            if (coins >= totalCost) {
                coins -= totalCost;
                if (!units[unitType]) units[unitType] = {};
                if (!units[unitType][grade]) units[unitType][grade] = { count: 0, cooldowns: [] };
                units[unitType][grade].count += quantity;
                militaryMessage.textContent = `${getUnitDisplayName(unitType)} Lv.${grade} を ${quantity}体購入しました！`;
                updateUI();
                await saveGameData(); // ★サーバーに保存★
                quantityInput.value = 1;
            } else {
                militaryMessage.textContent = `コインが${totalCost - coins}足りません！`;
            }
        });
    });

    // バトルセクション - 攻撃ユニット選択
    unitSelectButtons.forEach(button => {
        button.addEventListener('click', () => {
            unitSelectButtons.forEach(btn => btn.classList.remove('selected')); // 全ての選択を解除
            button.classList.add('selected'); // 選択されたボタンをハイライト
            selectedUnitType = button.dataset.unitType;
            selectedUnitGrade = parseInt(button.dataset.unitGrade);
            updateSelectedDisplay();
        });
    });

    // バトルセクション - 攻撃ボタン (サーバー側でバトルロジックを処理)
    attackButton.addEventListener('click', async () => {
        if (!selectedUnitType || !selectedUnitGrade || !selectedPlayerId) {
            battleMessage.textContent = "ユニットと攻撃対象を選択してください。";
            return;
        }

        const deployQuantity = parseInt(deployQuantityInput.value);
        if (isNaN(deployQuantity) || deployQuantity <= 0) {
            battleMessage.textContent = "有効な出撃数を入力してください。";
            return;
        }

        // クライアント側で利用可能なユニット数を簡易チェック (最終的なチェックはサーバーで行う)
        const unitData = units[selectedUnitType][selectedUnitGrade];
        const availableCount = unitData.count - unitData.cooldowns.filter(cooldownEnd => cooldownEnd > Date.now()).length;

        if (deployQuantity > availableCount) {
            battleMessage.textContent = `出撃可能ユニット数(${availableCount}体)を超えています。`;
            return;
        }

        const targetPlayer = otherPlayers.find(p => p.id === selectedPlayerId);
        if (!targetPlayer) {
            battleMessage.textContent = "攻撃対象が見つかりません。";
            return;
        }

        battleMessage.textContent = `バトル開始！ ${getUnitDisplayName(selectedUnitType)} Lv.${selectedUnitGrade} ${deployQuantity}体 で ${targetPlayer.username} に攻撃！`;

        attackButton.disabled = true; // 二重クリック防止

        try {
            const response = await fetch(`${SERVER_URL}/api/battle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: currentPlayerId,
                    targetPlayerId: selectedPlayerId,
                    unitType: selectedUnitType,
                    unitGrade: selectedUnitGrade,
                    deployQuantity: deployQuantity
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Battle failed: ${errorData.message}`);
            }

            const result = await response.json();
            console.log("Battle result:", result);

            // サーバーから返された最新のプレイヤーデータでクライアントの状態を更新
            coins = result.playerData.coins;
            playerTerritories = result.playerData.playerTerritories;
            // ユニットのクールダウンもサーバーから返されたものを反映し、Dateオブジェクトに変換
            for (const type in result.playerData.units) {
                for (const grade in result.playerData.units[type]) {
                    if (result.playerData.units[type][grade] && Array.isArray(result.playerData.units[type][grade].cooldowns)) {
                        result.playerData.units[type][grade].cooldowns = result.playerData.units[type][grade].cooldowns.map(ts => new Date(ts));
                    }
                }
            }
            units = result.playerData.units;

            battleMessage.textContent = result.message;

            // 他のプレイヤーデータも更新されている可能性があるので再取得 (特にBOTが倒された場合など)
            await fetchOtherPlayers();

            // 選択状態をリセット
            selectedUnitType = null;
            selectedUnitGrade = null;
            selectedPlayerId = null;
            deployQuantityInput.value = 1;

            updateUI(); // UIを更新
            // saveGameData()はバトルAPIの応答に含まれるので、ここでは必須ではないが、念のため実行してもよい
            // await saveGameData();
            attackButton.disabled = false;

        } catch (error) {
            console.error("Error during battle:", error);
            battleMessage.textContent = `バトル中にエラーが発生しました: ${error.message}`;
            attackButton.disabled = false;
        }

        setTimeout(() => {
            battleMessage.textContent = "攻撃するユニットとプレイヤーを選択してください。";
            updateBattleUI(); // バトルUIを最新の状態に更新
        }, 3000);
    });


    // ランキングの更新 (サーバーから全プレイヤーデータを取得する)
    async function updateRanking() {
        await fetchOtherPlayers(); // 最新の他のプレイヤーデータを取得

        // 現在のプレイヤーのデータをランキング用に整形
        const playerData = {
            id: currentPlayerId,
            username: username,
            icon: userIcon,
            coins: coins,
            territories: playerTerritories
        };

        // BOTプレイヤーと統合（otherPlayersにはBOTも含まれる想定）
        const allPlayers = [playerData, ...otherPlayers];

        // コイン数で降順にソート、同点の場合は領土数でソート
        allPlayers.sort((a, b) => {
            if (b.coins !== a.coins) {
                return b.coins - a.coins;
            }
            return b.territories - a.territories;
        });

        rankingList.innerHTML = '';
        allPlayers.forEach((player, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="rank">${index + 1}.</span>
                            <span class="name" data-username="${player.username}">
                                <span class="icon-in-ranking">
                                    ${player.icon && player.icon.startsWith('data:image') ? `<img src="${player.icon}" alt="icon">` : `<span>${player.icon || '👤'}</span>`}
                                </span>
                                ${player.username}
                            </span>
                            <span class="score">${player.coins.toLocaleString()}C</span>
                            <span class="territories">${player.territories}領土</span>`;
            rankingList.appendChild(li);

            if (player.id === currentPlayerId) {
                yourRankDisplay.textContent = `あなたの現在の順位: ${index + 1}位`;
            }
        });
    }

    // 設定セクション - ユーザー名とアイコンの保存
    saveUsernameButton.addEventListener('click', async () => {
        const newUsername = usernameInput.value.trim();
        if (newUsername && newUsername !== username) {
            username = newUsername;
            localStorage.setItem('localUsername', newUsername); // ローカルにも保存
            usernameMessage.textContent = "アカウント名を変更しました！";
            updateUI();
            await saveGameData(); // ★サーバーに保存★
        } else if (newUsername === username) {
            usernameMessage.textContent = "アカウント名は変更されていません。";
        } else {
            usernameMessage.textContent = "有効なアカウント名を入力してください。";
        }
    });

    iconUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                userIcon = e.target.result; // Data URLとして保存
                localStorage.setItem('localUserIcon', userIcon); // ローカルにも保存
                updateUI();
                await saveGameData(); // ★サーバーに保存★
            };
            reader.readAsDataURL(file);
        }
    });

    iconSelectors.forEach(iconElement => {
        iconElement.addEventListener('click', async () => {
            document.querySelector('.icon-selector .icon.selected')?.classList.remove('selected');
            userIcon = iconElement.dataset.icon;
            iconElement.classList.add('selected');
            localStorage.setItem('localUserIcon', userIcon); // ローカルにも保存
            updateUI();
            await saveGameData(); // ★サーバーに保存★
        });
    });


    // --- 最後の初期ロード呼び出し ---
    loadGameData(); // 非同期関数なのでawaitは不要（DOMContentLoadedではawaitできない）
    setNewTypingWord(); // タイピングゲームの最初の単語を設定

    // 定期的なUI更新やデータの保存
    setInterval(() => {
        updateUI(); // クールダウン表示などの更新
        // デイリー獲得コインのリセット（午前0時）
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 10) { // 毎日の0時0分にリセット
            const today = now.toISOString().slice(0, 10);
            if (lastBonusClaimDate !== today) { // まだリセットされていなければ
                dailyCoinsEarned = 0;
                updateDailyCoinsEarned();
                checkDailyBonus(); // ボーナス受け取り可能にする
            }
        }
    }, 1000); // 1秒ごとに実行
}); // DOMContentLoaded 終了
