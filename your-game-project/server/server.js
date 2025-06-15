// server/server.js - 国運営ゲーム機能対応版
// このファイルは、Node.jsとExpress.jsを使ってゲームのバックエンドサービスを提供します。
// Firebase Firestoreをデータ永続化に利用し、国運営要素を追加します。

// 1. 必要なモジュールを読み込む
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin'); // Firebase Admin SDKをインポート

// 2. Firebase Admin SDKの初期化
// Renderの環境変数からサービスアカウントの認証情報を取得します。
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // 環境変数で'\n'がエスケープされるため、元に戻す
        })
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error.message);
    process.exit(1); // 初期化失敗時はプロセスを終了
}

// Firestoreデータベースのインスタンスを取得
const db = admin.firestore();

// Expressアプリケーションのインスタンスを作成
const app = express();

// Renderが提供するPORT環境変数を使用し、それがなければローカル開発用に3000番ポートを使用
const PORT = process.env.PORT || 3000;

// --- ミドルウェアの設定（順序が重要です！） ---
app.use(cors()); // CORSミドルウェアを一番最初に配置
app.use(express.json()); // JSON形式のリクエストボディをパース
app.use(express.urlencoded({ extended: true })); // URLエンコードされたボディをパース


// --- BOTデータ管理（メモリ内） ---
// BOTデータは再起動ごとにリセットされますが、プレイヤーデータはFirestoreに永続化されます。
let botPlayersData = {};

// サーバー起動時にダミーのBOTデータを生成/更新する関数
function generateOtherPlayers() {
    const names = ["ShadowKiller", "DragonSlayer", "NightWolf", "IronMan", "CyberNinja", "StarCommander", "ThunderFist", "CrimsonKing"];
    const icons = ["👹", "🐉", "🐺", "🤖", "🥷", "🌠", "⚡", "👑"];

    for (let i = 0; i < 8; i++) { // 8人のダミープレイヤーを常に存在させる
        const botId = `bot_${i}`;
        if (!botPlayersData[botId]) { // そのIDのBOTが存在しない場合のみ生成
            botPlayersData[botId] = {
                id: botId,
                username: names[i] || `Bot Player ${i + 1}`,
                icon: icons[i] || '👤',
                coins: Math.floor(Math.random() * 5000) + 1000,
                playerTerritories: Math.floor(Math.random() * 20) + 5,
                units: {},
                power: Math.floor(Math.random() * 1000) + 500,
                lastBonusClaimDate: null,
                lastWorkTime: 0,
                dailyCoinsEarned: 0,
                lastSpinTime: 0,
                lastTerritoryPurchaseTime: 0,
                spinDirection: "normal",
                // ★追加: BOTにも工場と軍事資材の初期値を追加 (シンプルに)
                militarySupplies: 0,
                factories: {
                    material: { level: 1, lastCollected: new Date().toISOString() },
                    product: { level: 1, lastCollected: new Date().toISOString() }
                },
                territoryLevel: 1 // BOTの領土レベルも追加
            };
        }
    }
}

// サーバー起動時にBOTデータを初期化する
generateOtherPlayers();

// --- 軍事資材の生産計算ロジック ---
function calculateMilitarySuppliesProduction(factories, lastCollectedTime) {
    const now = Date.now();
    let effectiveMaterialLevel = factories.material.level || 1;
    let effectiveProductLevel = factories.product.level || 1;

    // 生産能力は両工場の低い方のレベルに依存
    const effectiveProductionLevel = Math.min(effectiveMaterialLevel, effectiveProductLevel);
    
    // レベル1で1000/時間、レベル2で2000/時間...なので、レベル * 1000
    const productionRatePerHour = effectiveProductionLevel * 1000; // 1時間あたりの生産量

    if (productionRatePerHour === 0) { // 工場レベルが0の場合は生産なし
        return 0;
    }

    const lastCollectDate = new Date(lastCollectedTime);
    if (isNaN(lastCollectDate.getTime())) { // 無効な日付の場合は0生産
        console.warn("Invalid lastCollectedTime:", lastCollectedTime);
        return 0;
    }

    const timeElapsedHours = (now - lastCollectDate.getTime()) / (1000 * 60 * 60); // 時間経過

    // 時間経過に応じた生産量を計算し、整数に丸める
    const producedAmount = Math.floor(productionRatePerHour * timeElapsedHours);
    return producedAmount;
}

// --- APIエンドポイントの定義 ---

// ルートパス('/')へのGETリクエストに対するハンドラ
app.get('/', (req, res) => {
    console.log('Root path / accessed');
    res.json({ message: 'Hello from Render Server!', status: 'ready', serverTime: new Date() });
});

// プレイヤーデータを取得または新規作成するAPI (Firestore対応)
app.post('/api/player', async (req, res) => {
    const { requestedId, username: clientUsername, userIcon: clientUserIcon } = req.body;
    let playerRef;
    let playerData;

    try {
        if (requestedId) {
            playerRef = db.collection('players').doc(requestedId);
            const doc = await playerRef.get();
            if (doc.exists) {
                playerData = doc.data();
                console.log(`Existing player loaded from Firestore: ${requestedId}`);
            }
        }

        if (!playerData) { // IDがないか、Firestoreに存在しない場合
            // 新規プレイヤーとしてデータを生成し、Firestoreに追加
            const newPlayerId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            playerRef = db.collection('players').doc(newPlayerId);
            playerData = {
                id: newPlayerId,
                username: clientUsername || "新規プレイヤー",
                icon: clientUserIcon || "😀",
                coins: 1000,
                playerTerritories: 10,
                units: {
                    infantry: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } },
                    armored_car: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } },
                    tank: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } },
                    fighter: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } }
                },
                lastSpinTime: 0,
                lastWorkTime: 0,
                dailyCoinsEarned: 0,
                lastBonusClaimDate: null,
                spinDirection: "normal",
                lastTerritoryPurchaseTime: 0,
                // ★新規追加: 軍事資材、工場データ、領土レベル
                militarySupplies: 0,
                factories: {
                    material: { level: 1, lastCollected: new Date().toISOString() }, // 初回ログイン時刻
                    product: { level: 1, lastCollected: new Date().toISOString() }
                },
                territoryLevel: 1 // 領土の初期レベル
            };
            await playerRef.set(playerData); // Firestoreに新規ドキュメントを作成
            console.log(`New player created in Firestore: ${newPlayerId}`);
        } else {
            // ★既存プレイヤーの場合、新しいフィールドがなければ初期化
            playerData.militarySupplies = playerData.militarySupplies !== undefined ? playerData.militarySupplies : 0;
            playerData.territoryLevel = playerData.territoryLevel !== undefined ? playerData.territoryLevel : 1;
            
            if (!playerData.factories) {
                playerData.factories = {
                    material: { level: 1, lastCollected: new Date().toISOString() },
                    product: { level: 1, lastCollected: new Date().toISOString() }
                };
            } else {
                if (!playerData.factories.material) playerData.factories.material = { level: 1, lastCollected: new Date().toISOString() };
                if (!playerData.factories.product) playerData.factories.product = { level: 1, lastCollected: new Date().toISOString() };
                
                // lastCollected がない、または不正な値の場合、現在時刻に設定
                if (!playerData.factories.material.lastCollected || isNaN(new Date(playerData.factories.material.lastCollected).getTime())) {
                    playerData.factories.material.lastCollected = new Date().toISOString();
                }
                if (!playerData.factories.product.lastCollected || isNaN(new Date(playerData.factories.product.lastCollected).getTime())) {
                    playerData.factories.product.lastCollected = new Date().toISOString();
                }
            }
            // ★オフライン生産の計算と加算
            const producedMaterials = calculateMilitarySuppliesProduction(
                playerData.factories,
                Math.max(
                    new Date(playerData.factories.material.lastCollected).getTime(),
                    new Date(playerData.factories.product.lastCollected).getTime()
                )
            );
            if (producedMaterials > 0) {
                playerData.militarySupplies += producedMaterials;
                // 収集時刻を現在時刻に更新
                playerData.factories.material.lastCollected = new Date().toISOString();
                playerData.factories.product.lastCollected = new Date().toISOString();
                // Firestoreも更新しておく
                await playerRef.update({
                    militarySupplies: playerData.militarySupplies,
                    'factories.material.lastCollected': playerData.factories.material.lastCollected,
                    'factories.product.lastCollected': playerData.factories.product.lastCollected
                });
                console.log(`Offline production for ${playerData.username}: ${producedMaterials} military supplies added.`);
            }
        }
        res.json(playerData);
    } catch (error) {
        console.error("Error in /api/player:", error);
        res.status(500).json({ message: 'プレイヤーデータのロード/作成中にエラーが発生しました。', error: error.message });
    }
});

// プレイヤーデータを更新するAPI (Firestore対応)
app.post('/api/player/update', async (req, res) => {
    const { playerId, data } = req.body;

    if (!playerId) {
        return res.status(400).json({ message: 'プレイヤーIDが必要です。' });
    }

    try {
        const playerRef = db.collection('players').doc(playerId);
        const doc = await playerRef.get();

        if (!doc.exists) {
            console.warn(`Player not found for update: ${playerId}`);
            return res.status(404).json({ message: 'Player not found' });
        }

        // クールダウンデータをISO文字列に変換してから保存（FirestoreはDateオブジェクトをサポートしますが、一貫性のため文字列に）
        if (data.units) {
            for (const type in data.units) {
                for (const grade in data.units[type]) {
                    if (data.units[type][grade] && Array.isArray(data.units[type][grade].cooldowns)) {
                        data.units[type][grade].cooldowns = data.units[type][grade].cooldowns.map(ts => (ts instanceof Date ? ts.toISOString() : ts));
                    }
                }
            }
        }
        // ★追加: 工場データのlastCollectedもISO文字列に変換 (もしあれば)
        if (data.factories) {
            if (data.factories.material && data.factories.material.lastCollected instanceof Date) {
                data.factories.material.lastCollected = data.factories.material.lastCollected.toISOString();
            }
            if (data.factories.product && data.factories.product.lastCollected instanceof Date) {
                data.factories.product.lastCollected = data.factories.product.lastCollected.toISOString();
            }
        }

        // Firestoreのドキュメントを更新
        await playerRef.update(data); // `update` は指定されたフィールドのみ更新
        console.log(`Player data updated in Firestore for ${playerId}`);

        // 更新後の最新データを取得してクライアントに返す
        const updatedDoc = await playerRef.get();
        res.json({ message: 'Player data updated successfully', player: updatedDoc.data() });

    } catch (error) {
        console.error("Error in /api/player/update:", error);
        res.status(500).json({ message: 'プレイヤーデータの更新中にエラーが発生しました。', error: error.message });
    }
});

// 全プレイヤーデータを取得するAPI（ランキング表示用など） (Firestore対応)
app.get('/api/players', async (req, res) => {
    try {
        const playersCollection = db.collection('players');
        const snapshot = await playersCollection.get();
        const realPlayers = [];
        snapshot.forEach(doc => {
            realPlayers.push(doc.data());
        });

        // BOTデータを常に最新の状態にする
        generateOtherPlayers(); // in-memory botPlayersData を更新

        // リアルプレイヤーとBOTプレイヤーを結合
        const allPlayers = [...realPlayers, ...Object.values(botPlayersData)];

        // クライアントに返す前に、不要な情報や機密情報をフィルタリング（必要であれば）
        const publicPlayers = allPlayers.map(p => ({
            id: p.id,
            username: p.username,
            icon: p.icon,
            coins: p.coins,
            territories: p.playerTerritories || p.territories,
            power: p.power || 0
        }));

        console.log(`Fetched ${publicPlayers.length} public players (Real: ${realPlayers.length}, Bots: ${Object.keys(botPlayersData).length}).`);
        res.json(publicPlayers);

    } catch (error) {
        console.error("Error in /api/players:", error);
        res.status(500).json({ message: '全プレイヤーデータの取得中にエラーが発生しました。', error: error.message });
    }
});

// バトルロジックを処理するAPI
const unitPowers = {
    infantry: { 1: 10, 2: 20, 3: 40 },
    armored_car: { 1: 50, 2: 100, 3: 200 },
    tank: { 1: 200, 2: 400, 3: 800 },
    fighter: { 1: 500, 2: 1000, 3: 2000 }
};
const unitCooldownTimes = {
    infantry: { 1: 30 * 60 * 1000, 2: 25 * 60 * 1000, 3: 20 * 60 * 1000 },
    armored_car: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
    tank: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
    fighter: { 1: 120 * 60 * 1000, 2: 100 * 60 * 1000, 3: 80 * 60 * 1000 }
};

app.post('/api/battle', async (req, res) => {
    const { playerId, targetPlayerId, unitType, unitGrade, deployQuantity } = req.body;

    try {
        if (!playerId || !targetPlayerId || !unitType || !unitGrade || deployQuantity === undefined || deployQuantity <= 0) {
            return res.status(400).json({ message: 'バトルに必要な情報が不足しているか、無効な値です。' });
        }

        const playerRef = db.collection('players').doc(playerId);
        const targetRef = db.collection('players').doc(targetPlayerId);

        // Firestoreからプレイヤーとターゲットのデータを同時に取得
        const [playerDoc, targetDoc] = await Promise.all([playerRef.get(), targetRef.get()]);

        let player = playerDoc.data();
        let targetPlayer = targetDoc.data();

        // ターゲットがBOTの場合、in-memoryのbotPlayersDataから取得
        if (targetPlayerId.startsWith('bot_') && botPlayersData[targetPlayerId]) {
            targetPlayer = botPlayersData[targetPlayerId];
        }

        if (!player) {
            return res.status(404).json({ message: '攻撃側のプレイヤーが見つかりません。' });
        }
        if (!targetPlayer) {
            return res.status(404).json({ message: '攻撃対象のプレイヤーが見つかりません。' });
        }

        const playerUnitData = player.units[unitType]?.[unitGrade];
        if (!playerUnitData || playerUnitData.count < deployQuantity) {
            return res.status(400).json({ message: '出撃させようとしたユニットが不足しています。' });
        }

        const now = Date.now();
        playerUnitData.cooldowns = (playerUnitData.cooldowns || []).filter(cooldownEnd => {
            const endDate = new Date(cooldownEnd);
            return !isNaN(endDate.getTime()) && endDate.getTime() > now;
        });

        const availableUnits = playerUnitData.count - playerUnitData.cooldowns.length;
        if (deployQuantity > availableUnits) {
            return res.status(400).json({ message: `ユニットがクールダウン中です。出撃可能な${availableUnits}体を超えています。` });
        }

        const unitPower = unitPowers[unitType]?.[unitGrade] || 0;
        const totalAttackPower = unitPower * deployQuantity;

        let totalDefensePower = targetPlayer.playerTerritories * 50;
        // ターゲットユニットからの防御力追加
        for (const type in targetPlayer.units) {
            for (const grade in targetPlayer.units[type]) {
                totalDefensePower += (unitPowers[type]?.[grade] || 0) * (targetPlayer.units[type]?.[grade]?.count || 0);
            }
        }

        let battleMessage = '';
        let acquiredTerritories = 0;
        let acquiredCoins = 0;

        if (totalAttackPower > totalDefensePower) {
            acquiredTerritories = targetPlayer.playerTerritories > 0 ? Math.floor(Math.random() * Math.min(5, targetPlayer.playerTerritories)) + 1 : 0;
            acquiredCoins = acquiredTerritories * 1000;

            player.playerTerritories += acquiredTerritories;
            player.coins += acquiredCoins;

            targetPlayer.playerTerritories -= acquiredTerritories;
            targetPlayer.playerTerritories = Math.max(0, targetPlayer.playerTerritories);

            battleMessage = `戦闘に勝利！${acquiredTerritories}領土を占領し、${acquiredCoins}コインを獲得しました！`;

            // ターゲットがBOTで領土が0になった場合のリセット
            if (targetPlayer.id.startsWith('bot_') && targetPlayer.playerTerritories <= 0) {
                console.log(`Bot player ${targetPlayerId} defeated and reset.`);
                delete botPlayersData[targetPlayerId]; // メモリから削除
                generateOtherPlayers(); // 新しいBOTを補充
            } else if (!targetPlayer.id.startsWith('bot_') && targetPlayer.playerTerritories <= 0) {
                console.warn(`Human player ${targetPlayerId} has 0 territories after battle.`);
            }

        } else {
            player.coins = Math.max(0, player.coins - Math.floor(totalAttackPower * 0.05));
            battleMessage = `戦闘に敗北しました。`;
        }

        // クールダウンの適用
        const unitCooldownTime = unitCooldownTimes[unitType]?.[unitGrade] || 0;
        for (let i = 0; i < deployQuantity; i++) {
            playerUnitData.cooldowns.push(new Date(now + unitCooldownTime).toISOString());
        }
        player.units[unitType][unitGrade].cooldowns = playerUnitData.cooldowns;

        // Firestoreにプレイヤーデータを更新
        await playerRef.update({
            coins: player.coins,
            playerTerritories: player.playerTerritories,
            units: player.units
        });

        // ターゲットが人間プレイヤーの場合、そのデータもFirestoreに更新
        if (!targetPlayerId.startsWith('bot_')) {
            await targetRef.update({
                playerTerritories: targetPlayer.playerTerritories
            });
        }
        
        // 更新後のプレイヤーデータをFirestoreから取得して返す
        const updatedPlayerDoc = await playerRef.get();
        const updatedTargetDoc = targetPlayerId.startsWith('bot_') ? targetPlayer : await targetRef.get().then(doc => doc.data());

        res.json({
            message: battleMessage,
            playerData: updatedPlayerDoc.data(),
            opponentData: updatedTargetDoc
        });

        console.log(`[BATTLE LOG] プレイヤー ${player.username} (${playerId}) が ${targetPlayer.username} (${targetPlayerId}) を攻撃。結果: ${battleMessage}`);

    } catch (error) {
        console.error("バトル処理中にサーバーエラーが発生しました:", error);
        res.status(500).json({ message: 'サーバー内部でバトル処理中に予期せぬエラーが発生しました。', error: error.message });
    }
});


// --- サーバーを起動 ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
