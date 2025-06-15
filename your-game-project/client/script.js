// client/script.js
// このファイルは、ゲームのクライアントサイドロジック、UI操作、
// そしてサーバーとの非同期通信を実装します。

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
    const spinMessage = document = document.getElementById('spin-message');
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
    const unitGradeSelects = document.querySelectorAll('.unit-grade-select'); // ユニットグレード選択

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

    // パチンコ関連
    const pachinkoCanvas = document.getElementById('pachinko-canvas');
    const pachinkoCtx = pachinkoCanvas.getContext('2d');
    const pachinkoSpinButton = document.getElementById('pachinko-spin-button');
    const pachinkoBetInput = document.getElementById('pachinko-bet-input');
    const pachinkoMessage = document.getElementById('pachinko-message');
    let pachinkoBall = null; // ボールの状態
    let pachinkoSlots = []; // 当たり判定のスロット
    let pachinkoPegs = []; // 釘
    const PACHINKO_BALL_RADIUS = 8;
    const PACHINKO_GRAVITY = 0.5; // 物理エンジンの重力
    const PACHINKO_BOUNCE = 0.6; // 跳ね返り係数

    // 国運営関連 (新要素)
    const territoryCurrentLevelDisplay = document.getElementById('territory-current-level');
    const territoryLevelCostDisplay = document.getElementById('territory-level-cost');
    const territoryLevelCostCoinsDisplay = document.getElementById('territory-level-cost-coins');
    const territoryLevelMessage = document.getElementById('territory-level-message');
    const levelUpTerritoryButton = document.getElementById('level-up-territory-button');

    const materialFactoryLevelDisplay = document.getElementById('material-factory-level');
    const materialFactoryCostDisplay = document.getElementById('material-factory-cost');
    const materialFactoryMessage = document.getElementById('material-factory-message');
    const levelUpMaterialFactoryButton = document.getElementById('level-up-material-factory-button');

    const productFactoryLevelDisplay = document.getElementById('product-factory-level');
    const productFactoryCostDisplay = document.getElementById('product-factory-cost');
    const productFactoryMessage = document.getElementById('product-factory-message');
    const levelUpProductFactoryButton = document.getElementById('level-up-product-factory-button');

    const militarySuppliesAmountDisplay = document.getElementById('military-supplies-amount');
    const militarySuppliesProductionRateDisplay = document.getElementById('military-supplies-production-rate');
    const militarySuppliesMessage = document.getElementById('military-supplies-message');
    const collectMilitarySuppliesButton = document.getElementById('collect-military-supplies-button');


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
    let currentPlayerId = null; // 現在のプレイヤーのIDをサーバーから取得して保持します
    let militarySupplies = 0; // 軍事資材
    let factories = { // 工場レベルと最終収集時刻
        material: { level: 1, lastCollected: new Date().toISOString() },
        product: { level: 1, lastCollected: new Date().toISOString() }
    };
    let territoryLevel = 1; // 領土のレベル

    // --- サーバーのURL ---
    // ★★★★ ここをあなたのRenderでデプロイしたサーバーの公開URLに置き換えてください！ ★★★★
    const SERVER_URL = 'https://ak-game-server.onrender.com';
    // 例: const SERVER_URL = 'https://my-game-server-abc12.onrender.com';


    // --- プレイヤー以外のユーザーデータ (サーバーから取得する) ---
    let otherPlayers = [];

    // --- ゲーム定数 ---
    const slotSymbols = ['🍒', '🍋', '🔔', '💎', '⭐'];
    const typingWords = ["apple", "banana", "cherry", "grape", "lemon", "orange", "strawberry", "watermelon", "pineapple", "kiwi"];
    let currentWord = '';
    let typingIndex = 0;

    const unitCoinCosts = { // コインでのユニット購入コスト (元の価格)
        infantry: { 1: 100, 2: 200, 3: 400 },
        armored_car: { 1: 500, 2: 1000, 3: 2000 },
        tank: { 1: 2000, 2: 4000, 3: 8000 },
        fighter: { 1: 5000, 2: 10000, 3: 20000 }
    };

    // 軍事資材でのユニット購入コスト (コインの半分の個数)
    const unitMilitarySuppliesCosts = {
        infantry: { 1: 50, 2: 100, 3: 200 },
        armored_car: { 1: 250, 2: 500, 3: 1000 },
        tank: { 1: 1000, 2: 2000, 3: 4000 },
        fighter: { 1: 2500, 2: 5000, 3: 10000 }
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

    // 工場レベルアップコスト (コイン)
    const factoryLevelUpCosts = {
        material: { 1: 1000, 2: 5000, 3: 10000, 4: 25000, 5: 50000 }, // 例
        product: { 1: 1000, 2: 5000, 3: 10000, 4: 25000, 5: 50000 } // 例
    };
    // 領土レベルアップコスト
    const territoryLevelUpCosts = {
        territories: { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 }, // 領土数
        coins: { 1: 5000, 2: 15000, 3: 30000, 4: 50000, 5: 100000 } // コイン
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

        // アイコン選択のハイライト
        document.querySelectorAll('.icon-selector .icon').forEach(iconElement => {
            if (iconElement.dataset.icon === userIcon) {
                iconElement.classList.add('selected');
            } else {
                iconElement.classList.remove('selected');
            }
        });

        // 軍事基地のユニット保有数とクールダウン表示、コスト表示
        ['infantry', 'armored_car', 'tank', 'fighter'].forEach(type => {
            [1, 2, 3].forEach(grade => {
                const countElem = document.getElementById(`${type}-count-${grade}`);
                const cooldownElem = document.getElementById(`${type}-cooldown-${grade}`);
                const availableElem = document.getElementById(`${type}-available-${grade}`);
                const coinCostElem = document.getElementById(`${type}-cost-${grade}`);

                const currentUnitData = units[type]?.[grade] || { count: 0, cooldowns: [] };
                const now = new Date();
                // クールダウン中のユニット数を計算
                const cooldownCount = currentUnitData.cooldowns.filter(cooldownEnd => cooldownEnd > now).length;
                const availableCount = currentUnitData.count - cooldownCount;

                if (countElem) countElem.textContent = currentUnitData.count;
                if (cooldownElem) cooldownElem.textContent = cooldownCount;
                if (availableElem) availableElem.textContent = availableCount;

                // ユニットコストの表示更新
                if (coinCostElem) {
                    const coinC = unitCoinCosts[type][grade];
                    const militaryS = unitMilitarySuppliesCosts[type][grade];
                    coinCostElem.textContent = `コスト: ${coinC}C / ${militaryS}資材`;
                }

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

        // 国運営タブのUI更新
        territoryCurrentLevelDisplay.textContent = territoryLevel;
        const nextTerritoryLevel = territoryLevel + 1;
        const nextTerritoryCost = territoryLevelUpCosts.territories[nextTerritoryLevel];
        const nextTerritoryCoinCost = territoryLevelUpCosts.coins[nextTerritoryLevel];
        if (nextTerritoryCost && nextTerritoryCoinCost) {
            territoryLevelCostDisplay.textContent = `${nextTerritoryCost}領土`;
            territoryLevelCostCoinsDisplay.textContent = `${nextTerritoryCoinCost}C`;
            levelUpTerritoryButton.disabled = playerTerritories < nextTerritoryCost || coins < nextTerritoryCoinCost;
        } else {
            territoryLevelCostDisplay.textContent = '最大';
            territoryLevelCostCoinsDisplay.textContent = '最大';
            levelUpTerritoryButton.disabled = true; // 最大レベル
        }
        
        // 工場レベルとコスト、生産量の表示
        materialFactoryLevelDisplay.textContent = factories.material.level;
        productFactoryLevelDisplay.textContent = factories.product.level;

        const nextMaterialCost = factoryLevelUpCosts.material[factories.material.level + 1];
        if (nextMaterialCost) {
            materialFactoryCostDisplay.textContent = `${nextMaterialCost}C`;
            levelUpMaterialFactoryButton.disabled = coins < nextMaterialCost;
        } else {
            materialFactoryCostDisplay.textContent = '最大';
            levelUpMaterialFactoryButton.disabled = true;
        }

        const nextProductCost = factoryLevelUpCosts.product[factories.product.level + 1];
        if (nextProductCost) {
            productFactoryCostDisplay.textContent = `${nextProductCost}C`;
            levelUpProductFactoryButton.disabled = coins < nextProductCost;
        } else {
            productFactoryCostDisplay.textContent = '最大';
            levelUpProductFactoryButton.disabled = true;
        }

        // 軍事資材表示
        militarySuppliesAmountDisplay.textContent = militarySupplies.toLocaleString();

        // 軍事資材の生産量計算と表示
        const effectiveProductionLevel = Math.min(factories.material.level, factories.product.level);
        const productionRate = effectiveProductionLevel * 1000; // 1時間あたりの生産量
        militarySuppliesProductionRateDisplay.textContent = productionRate.toLocaleString();
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

            button.disabled = availableCount <= 0; // 使用可能なユニットがなければ無効化
            button.classList.toggle('selected', selectedUnitType === type && selectedUnitGrade === grade);
            button.querySelector('span').textContent = availableCount; // 使用可能数をリアルタイム更新
        });

        // プレイヤーリストの更新
        await fetchOtherPlayers(); // 最新の他のプレイヤーデータを取得

        playerList.innerHTML = '';
        // BOTを除外してバトル対象のプレイヤーリストを生成
        const humanPlayersForBattle = otherPlayers.filter(p => !p.id.startsWith('bot_'));

        if (humanPlayersForBattle.length === 0) {
            // メッセージを修正: 人間プレイヤーがいない場合の表示
            playerList.innerHTML = '<li>現在攻撃可能な他の人間プレイヤーがいません。</li>';
        } else {
            humanPlayersForBattle.forEach(player => { // フィルタリングされたリストを使用
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

    // --- ゲーム初期化とデータ読み込み ---
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
                // HTTPエラーの場合、詳細なエラーメッセージを取得
                let errorDetails = `Status: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    errorDetails += ` - ${errorJson.message || JSON.stringify(errorJson)}`;
                } catch (jsonError) {
                    // JSONパースに失敗した場合はそのまま
                    errorDetails += ` - (Non-JSON response or empty response)`;
                }
                throw new Error(`Failed to load player data: ${errorDetails}`);
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
            militarySupplies = data.militarySupplies || 0; // ★追加
            factories = data.factories || { material: { level: 1, lastCollected: new Date().toISOString() }, product: { level: 1, lastCollected: new Date().toISOString() } }; // ★追加
            territoryLevel = data.territoryLevel || 1; // ★追加

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
            // 工場データの日付もDateオブジェクトに変換
            if (factories.material && factories.material.lastCollected) factories.material.lastCollected = new Date(factories.material.lastCollected);
            if (factories.product && factories.product.lastCollected) factories.product.lastCollected = new Date(factories.product.lastCollected);


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

    // ゲームデータをサーバーに保存
    async function saveGameData() {
        if (!currentPlayerId) {
            console.warn("currentPlayerId is not set. Cannot save data.");
            return;
        }

        const dataToSave = {
            coins,
            playerTerritories,
            username,
            icon: userIcon,
            spinDirection,
            lastSpinTime,
            lastWorkTime,
            dailyCoinsEarned,
            lastBonusClaimDate,
            lastTerritoryPurchaseTime,
            militarySupplies, // ★追加
            territoryLevel, // ★追加
            factories: { // ★追加 - 日付をISO文字列に変換して送信
                material: {
                    level: factories.material.level,
                    lastCollected: factories.material.lastCollected.toISOString()
                },
                product: {
                    level: factories.product.level,
                    lastCollected: factories.product.lastCollected.toISOString()
                }
            },
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
                let errorDetails = `Status: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    errorDetails += ` - ${errorJson.message || JSON.stringify(errorJson)}`;
                } catch (jsonError) {
                    errorDetails += ` - (Non-JSON response or empty response)`;
                }
                throw new Error(`Failed to save player data: ${errorDetails}`);
            }

            const result = await response.json();
            // サーバーから返された最新のプレイヤーデータでクライアントの状態を更新
            // これにより、サーバーが保存した正確なusernameとuserIconがクライアントに反映される
            username = result.player.username;
            userIcon = result.player.icon;
            // militarySupplies もサーバーからの最新値で更新されるはず
            militarySupplies = result.player.militarySupplies; // ★追加
            territoryLevel = result.player.territoryLevel; // ★追加
            factories = result.player.factories; // ★追加
            // factories内のlastCollectedはISO文字列で返ってくるのでDateオブジェクトに変換
            if (factories.material && factories.material.lastCollected) factories.material.lastCollected = new Date(factories.material.lastCollected);
            if (factories.product && factories.product.lastCollected) factories.product.lastCollected = new Date(factories.product.lastCollected);

            updateUI(); // UIを再更新して、サーバーの情報を反映

        } catch (error) {
            console.error("Error saving game data:", error);
        }
    }

    // 他のプレイヤーデータをサーバーから取得する関数
    async function fetchOtherPlayers() {
        try {
            const response = await fetch(`${SERVER_URL}/api/players`);
            if (!response.ok) {
                let errorDetails = `Status: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    errorDetails += ` - ${errorJson.message || JSON.stringify(errorJson)}`;
                } catch (jsonError) {
                    errorDetails += ` - (Non-JSON response or empty response)`;
                }
                throw new Error(`Failed to fetch other players: ${errorDetails}`);
            }
            const allPlayers = await response.json();
            // 自分以外のプレイヤーだけをフィルタリング
            otherPlayers = allPlayers.filter(p => p.id !== currentPlayerId);
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
            } else if (button.dataset.tab === 'pachinko') {
                initializePachinkoCanvas();
                drawPachinko();
                pachinkoSpinButton.disabled = false;
                pachinkoMessage.textContent = "賭け金を入力してボールを落とそう！";
            } else if (button.dataset.tab === 'country-management') { // ★国運営タブに移動した場合
                updateUI(); // ここで軍事資材のリアルタイム生産計算も反映される
            }
            updateUI(); // その他のタブでも基本UIは更新
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
        const cost = 100000; // 領土購入コスト
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

            if (isNaN(quantity) || quantity <= 0) {
                militaryMessage.textContent = "購入数を正しく入力してください。";
                return;
            }

            const coinCostPerUnit = unitCoinCosts[unitType][grade];
            const militarySuppliesCostPerUnit = unitMilitarySuppliesCosts[unitType][grade];

            const totalCoinCost = coinCostPerUnit * quantity;
            const totalMilitarySuppliesCost = militarySuppliesCostPerUnit * quantity;

            let purchased = false;
            if (coins >= totalCoinCost && militarySupplies >= totalMilitarySuppliesCost) {
                // 両方支払える場合、どちらで買うか選択肢を与えるか、軍事資材を優先するか
                // 今回はシンプルに、軍事資材があれば軍事資材を優先する
                if (confirm(`コイン ${totalCoinCost} または軍事資材 ${totalMilitarySuppliesCost} で購入しますか？ OKで軍事資材、キャンセルでコインを使用します。`)) {
                    militarySupplies -= totalMilitarySuppliesCost;
                    militaryMessage.textContent = `${getUnitDisplayName(unitType)} Lv.${grade} を ${quantity}体、軍事資材で購入しました！`;
                    purchased = true;
                } else {
                    coins -= totalCoinCost;
                    militaryMessage.textContent = `${getUnitDisplayName(unitType)} Lv.${grade} を ${quantity}体、コインで高値で購入しました！`;
                    purchased = true;
                }
            } else if (militarySupplies >= totalMilitarySuppliesCost) {
                militarySupplies -= totalMilitarySuppliesCost;
                militaryMessage.textContent = `${getUnitDisplayName(unitType)} Lv.${grade} を ${quantity}体、軍事資材で入手しました！`;
                purchased = true;
            } else if (coins >= totalCoinCost) {
                coins -= totalCoinCost;
                militaryMessage.textContent = `${getUnitDisplayName(unitType)} Lv.${grade} を ${quantity}体、コインで高値で購入しました！`;
                purchased = true;
            } else {
                militaryMessage.textContent = `コインが${totalCoinCost - coins}、または軍事資材が${totalMilitarySuppliesCost - militarySupplies}足りません！`;
            }

            if (purchased) {
                if (!units[unitType]) units[unitType] = {};
                if (!units[unitType][grade]) units[unitType][grade] = { count: 0, cooldowns: [] };
                units[unitType][grade].count += quantity;
                updateUI();
                await saveGameData(); // ★サーバーに保存★
                quantityInput.value = 1;
            }
        });
    });

    // ユニットグレード選択時のコスト表示更新
    unitGradeSelects.forEach(select => {
        select.addEventListener('change', (event) => {
            const unitType = event.target.closest('.unit-option').querySelector('.buy-unit-button').dataset.unitType;
            const grade = parseInt(event.target.value);
            const costElem = event.target.closest('.unit-option').querySelector('.unit-costs span');
            if (costElem) {
                const coinC = unitCoinCosts[unitType][grade];
                const militaryS = unitMilitarySuppliesCosts[unitType][grade];
                costElem.textContent = `コスト: ${coinC}C / ${militaryS}資材`;
            }
        });
        // 初期ロード時にコストを表示
        const unitType = select.closest('.unit-option').querySelector('.buy-unit-button').dataset.unitType;
        const grade = parseInt(select.value);
        const costElem = select.closest('.unit-option').querySelector('.unit-costs span');
        if (costElem) {
            const coinC = unitCoinCosts[unitType][grade];
            const militaryS = unitMilitarySuppliesCosts[unitType][grade];
            costElem.textContent = `コスト: ${coinC}C / ${militaryS}資材`;
        }
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
            militarySupplies = result.playerData.militarySupplies; // バトル結果で資材が変わる可能性もあるので更新

            battleMessage.textContent = result.message;

            // 他のプレイヤーデータも更新されている可能性があるので再取得 (特にBOTが倒された場合など)
            await fetchOtherPlayers();

            // 選択状態をリセット
            selectedUnitType = null;
            selectedUnitGrade = null;
            selectedPlayerId = null;
            deployQuantityInput.value = 1;

            updateUI(); // UIを更新
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

        // BOTを除外してランキングを生成
        const allPlayers = [playerData, ...otherPlayers.filter(p => !p.id.startsWith('bot_'))];

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
            username = newUsername; // ローカル変数をまず更新
            localStorage.setItem('localUsername', newUsername); // ローカルストレージにも保存
            usernameMessage.textContent = "アカウント名を変更しました！";
            await saveGameData(); // サーバーに保存し、その中でusernameとUIが更新される
            usernameInput.value = ''; // 入力フィールドをクリア
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

    spinDirectionNormal.addEventListener('change', async () => {
        spinDirection = 'normal';
        await saveGameData();
    });

    spinDirectionReverse.addEventListener('change', async () => {
        spinDirection = 'reverse';
        await saveGameData();
    });

    // --- パチンコゲームロジック ---
    // キャンバス初期化とサイズ調整
    function initializePachinkoCanvas() {
        const parent = pachinkoCanvas.parentElement;
        pachinkoCanvas.width = parent.clientWidth;
        pachinkoCanvas.height = Math.min(parent.clientWidth * 1.2, 500); // 縦長に、最大500px

        pachinkoCtx.font = '14px Arial'; // フォント設定を初期化時に行う

        // 釘の配置を計算
        pachinkoPegs = [];
        const pegRadius = 3;
        const cols = 10;
        const rows = 15; // 釘の行数を増やす
        const startY = 50; // 上から少し下げる
        const spacingX = pachinkoCanvas.width / (cols + 1);
        const spacingY = (pachinkoCanvas.height - startY - 100) / rows; // 下のスロットスペースを空ける

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = (c + 0.5 + (r % 2 === 0 ? 0 : 0.5)) * spacingX; // 千鳥配置
                const y = startY + r * spacingY;
                if (x > pegRadius && x < pachinkoCanvas.width - pegRadius && y > pegRadius && y < pachinkoCanvas.height - pegRadius) {
                    pachinkoPegs.push({ x: x, y: y, r: pegRadius });
                }
            }
        }

        // スロットの配置と報酬を設定
        pachinkoSlots = [];
        const slotWidth = pachinkoCanvas.width / 5; // 5つのスロット
        const slotHeight = 30;
        const slotY = pachinkoCanvas.height - slotHeight; // 一番下

        const rewards = [50, 10, 100, 10, 50]; // スロットごとの報酬

        for (let i = 0; i < 5; i++) {
            pachinkoSlots.push({
                x: i * slotWidth,
                y: slotY,
                width: slotWidth,
                height: slotHeight,
                reward: rewards[i]
            });
        }
    }

    // パチンコゲーム描画
    function drawPachinko() {
        pachinkoCtx.clearRect(0, 0, pachinkoCanvas.width, pachinkoCanvas.height); // キャンバスをクリア

        // 釘を描画
        pachinkoCtx.fillStyle = '#AAAAAA'; // 釘の色
        pachinkoPegs.forEach(peg => {
            pachinkoCtx.beginPath();
            pachinkoCtx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
            pachinkoCtx.fill();
        });

        // スロットを描画
        pachinkoSlots.forEach((slot, index) => {
            pachinkoCtx.fillStyle = index % 2 === 0 ? '#4CAF50' : '#2196F3'; // スロットの色
            pachinkoCtx.fillRect(slot.x, slot.y, slot.width, slot.height);
            pachinkoCtx.fillStyle = 'white';
            pachinkoCtx.font = '14px Arial';
            pachinkoCtx.textAlign = 'center';
            pachinkoCtx.fillText(`${slot.reward}C`, slot.x + slot.width / 2, slot.y + slot.height / 2 + 5);
        });

        // ボールを描画
        if (pachinkoBall && pachinkoBall.status !== 'stopped') {
            pachinkoCtx.fillStyle = 'orange';
            pachinkoCtx.beginPath();
            pachinkoCtx.arc(pachinkoBall.x, pachinkoBall.y, PACHINKO_BALL_RADIUS, 0, Math.PI * 2);
            pachinkoCtx.fill();
        }
    }

    // パチンコゲーム更新ループ
    function updatePachinko() {
        if (!pachinkoBall || pachinkoBall.status === 'stopped') {
            return;
        }

        // 重力による加速
        pachinkoBall.vy += PACHINKO_GRAVITY;
        pachinkoBall.x += pachinkoBall.vx;
        pachinkoBall.y += pachinkoBall.vy;

        // 壁との衝突判定 (左右)
        if (pachinkoBall.x - PACHINKO_BALL_RADIUS < 0 || pachinkoBall.x + PACHINKO_BALL_RADIUS > pachinkoCanvas.width) {
            pachinkoBall.vx *= -PACHINKO_BOUNCE;
            // 画面内に戻す
            pachinkoBall.x = Math.max(PACHINKO_BALL_RADIUS, Math.min(pachinkoCanvas.width - PACHINKO_BALL_RADIUS, pachinkoBall.x));
        }
        // 壁との衝突判定 (上、ボールが上に行かないように)
        if (pachinkoBall.y - PACHINKO_BALL_RADIUS < 0) {
            pachinkoBall.vy *= -PACHINKO_BOUNCE;
            pachinkoBall.y = PACHINKO_BALL_RADIUS;
        }


        // 釘との衝突判定
        pachinkoPegs.forEach(peg => {
            const dx = pachinkoBall.x - peg.x;
            const dy = pachinkoBall.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < PACHINKO_BALL_RADIUS + peg.r) {
                // ボールが釘をすり抜けないように修正
                const overlap = (PACHINKO_BALL_RADIUS + peg.r) - distance;
                pachinkoBall.x += (dx / distance) * overlap;
                pachinkoBall.y += (dy / distance) * overlap;

                // 衝突ベクトル
                const normalX = dx / distance;
                const normalY = dy / distance;

                // 相対速度
                const relativeVx = pachinkoBall.vx;
                const relativeVy = pachinkoBall.vy;

                // 法線方向の速度成分
                const dotProduct = relativeVx * normalX + relativeVy * normalY;

                // 跳ね返り (法線方向に反転)
                pachinkoBall.vx -= (1 + PACHINKO_BOUNCE) * dotProduct * normalX;
                pachinkoBall.vy -= (1 + PACHINKO_BOUNCE) * dotProduct * normalY;

                // 速度減衰 (摩擦)
                pachinkoBall.vx *= 0.95;
                pachinkoBall.vy *= 0.95;
            }
        });

        // スロットへの落下判定 (キャンバスの下端に到達)
        if (pachinkoBall.y + PACHINKO_BALL_RADIUS >= pachinkoCanvas.height) {
            pachinkoBall.status = 'stopped';
            const hitSlot = pachinkoSlots.find(slot =>
                pachinkoBall.x >= slot.x && pachinkoBall.x <= slot.x + slot.width
            );

            if (hitSlot) {
                coins += hitSlot.reward;
                pachinkoMessage.textContent = `大当たり！ ${hitSlot.reward}コイン獲得！`;
            } else {
                pachinkoMessage.textContent = '残念、ハズレ！';
            }
            updateUI();
            saveGameData(); // サーバーに保存
            pachinkoSpinButton.disabled = false;
        }

        drawPachinko();
        requestAnimationFrame(updatePachinko);
    }

    // パチンコゲーム開始
    pachinkoSpinButton.addEventListener('click', () => {
        const bet = parseInt(pachinkoBetInput.value);
        if (isNaN(bet) || bet <= 0 || coins < bet) {
            pachinkoMessage.textContent = '有効な賭け金を入力してください。';
            return;
        }

        coins -= bet; // 賭け金を減算
        updateUI(); // UI更新
        pachinkoMessage.textContent = "ボール発射！";
        pachinkoSpinButton.disabled = true; // ボタンを一時的に無効化

        // ボールを初期化
        pachinkoBall = {
            x: pachinkoCanvas.width / 2, // 中央上部から開始
            y: PACHINKO_BALL_RADIUS,
            vx: (Math.random() - 0.5) * 5, // 横方向の初期速度
            vy: 0,
            status: 'dropping'
        };
        requestAnimationFrame(updatePachinko); // アニメーション開始
    });

    // --- 国運営ロジック ---
    // 領土レベルアップ
    levelUpTerritoryButton.addEventListener('click', async () => {
        const nextLevel = territoryLevel + 1;
        const requiredTerritories = territoryLevelUpCosts.territories[nextLevel];
        const requiredCoins = territoryLevelUpCosts.coins[nextLevel];

        if (!requiredTerritories || !requiredCoins) {
            territoryLevelMessage.textContent = "領土レベルは最大です。";
            return;
        }

        if (playerTerritories >= requiredTerritories && coins >= requiredCoins) {
            playerTerritories -= requiredTerritories;
            coins -= requiredCoins;
            territoryLevel++;
            territoryLevelMessage.textContent = `領土レベルが${territoryLevel}にアップしました！`;
            updateUI();
            await saveGameData();
        } else {
            territoryLevelMessage.textContent = `領土${requiredTerritories - playerTerritories}、コイン${requiredCoins - coins}が足りません。`;
        }
    });

    // 材料工場レベルアップ
    levelUpMaterialFactoryButton.addEventListener('click', async () => {
        const nextLevel = factories.material.level + 1;
        const requiredCoins = factoryLevelUpCosts.material[nextLevel];

        if (!requiredCoins) {
            materialFactoryMessage.textContent = "材料工場は最大レベルです。";
            return;
        }

        if (coins >= requiredCoins) {
            coins -= requiredCoins;
            factories.material.level++;
            materialFactoryMessage.textContent = `材料工場がレベル${factories.material.level}にアップしました！`;
            updateUI();
            await saveGameData();
        } else {
            materialFactoryMessage.textContent = `コインが${requiredCoins - coins}足りません。`;
        }
    });

    // 商品工場レベルアップ
    levelUpProductFactoryButton.addEventListener('click', async () => {
        const nextLevel = factories.product.level + 1;
        const requiredCoins = factoryLevelUpCosts.product[nextLevel];

        if (!requiredCoins) {
            productFactoryMessage.textContent = "商品工場は最大レベルです。";
            return;
        }

        if (coins >= requiredCoins) {
            coins -= requiredCoins;
            factories.product.level++;
            productFactoryMessage.textContent = `商品工場がレベル${factories.product.level}にアップしました！`;
            updateUI();
            await saveGameData();
        } else {
            productFactoryMessage.textContent = `コインが${requiredCoins - coins}足りません。`;
        }
    });

    // 軍事資材の収集
    collectMilitarySuppliesButton.addEventListener('click', async () => {
        // オフライン生産の計算はサーバーで行われるため、ここでは単にデータを再ロードして更新する
        // または、サーバーに明示的な収集APIを追加する
        // 今回はシンプルに、loadGameData() を呼び出して最新の状態を反映させる
        await loadGameData(); // これでサーバー側で計算された生産量が反映される
        militarySuppliesMessage.textContent = `最新の軍事資材を収集しました。`;
        updateUI(); // UI更新を保証
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
