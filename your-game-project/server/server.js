// server/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs'); // ローカルでのテスト目的で残すが、Renderでは永続化しない
const path = require('path');

const app = express();
// Renderが提供するPORT環境変数を使用し、それがなければローカル開発用に3000番ポートを使用
const PORT = process.env.PORT || 3000;

// --- ミドルウェアの設定 ---
app.use(express.json()); // JSON形式のリクエストボディをパース
// CORSを許可する設定。本番環境では、クライアントの公開URLのみを許可するよう厳しく設定すべきです。
app.use(cors());

// --- 簡易データベース（メモリ内） ---
// 注意：このデータベースはサーバーが再起動するたびにリセットされます！
// 本格的な運用には、Renderが提供するPostgreSQLやMongoDBなどの外部データベースが必要です。
let playersData = {};

// サーバー起動時にダミーのBOTデータを生成/更新する関数
function generateOtherPlayers() {
    const names = ["ShadowKiller", "DragonSlayer", "NightWolf", "IronMan", "CyberNinja", "StarCommander", "ThunderFist", "CrimsonKing"];
    const icons = ["👹", "🐉", "🐺", "🤖", "🥷", "🌠", "⚡", "👑"];

    for (let i = 0; i < 8; i++) { // 8人のダミープレイヤー
        const botId = `bot_${i}`;
        if (!playersData[botId]) { // 存在しない場合のみ生成
            playersData[botId] = {
                id: botId,
                username: names[i] || `Bot Player ${i + 1}`,
                icon: icons[i] || '👤',
                coins: Math.floor(Math.random() * 5000) + 1000,
                playerTerritories: Math.floor(Math.random() * 20) + 5,
                units: {}, // BOTのユニットは簡易化
                power: Math.floor(Math.random() * 1000) + 500, // BOTの総合戦闘力
                lastBonusClaimDate: null,
                lastWorkTime: 0,
                dailyCoinsEarned: 0,
                lastSpinTime: 0,
                lastTerritoryPurchaseTime: 0,
                spinDirection: "normal"
            };
        }
    }
}

// サーバー起動時にBOTデータを初期化
generateOtherPlayers();


// --- APIエンドポイント ---

// プレイヤーデータを取得または新規作成（ログイン/初期ロード時）
app.post('/api/player', (req, res) => {
    const { requestedId, username: clientUsername, userIcon: clientUserIcon } = req.body;
    
    let playerId = requestedId;
    if (!playerId || !playersData[playerId]) { // IDがないか、そのIDのプレイヤーが存在しない場合
        // 新規プレイヤーとして生成
        playerId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        playersData[playerId] = {
            id: playerId,
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
            lastTerritoryPurchaseTime: 0
        };
    }
    res.json(playersData[playerId]);
});

// プレイヤーデータを更新（クライアントからの各種操作）
app.post('/api/player/update', (req, res) => {
    const { playerId, data } = req.body;

    if (!playersData[playerId]) {
        return res.status(404).json({ message: 'Player not found' });
    }

    // クールダウンデータをISO文字列に変換してから保存（クライアントから来たものがDateオブジェクトの場合）
    if (data.units) {
        for (const type in data.units) {
            for (const grade in data.units[type]) {
                if (data.units[type][grade] && Array.isArray(data.units[type][grade].cooldowns)) {
                    data.units[type][grade].cooldowns = data.units[type][grade].cooldowns.map(ts => (ts instanceof Date ? ts.toISOString() : ts));
                }
            }
        }
    }

    Object.assign(playersData[playerId], data); // 既存のプレイヤーデータを更新
    res.json({ message: 'Player data updated successfully', player: playersData[playerId] });
});

// 全プレイヤーデータを取得（ランキング表示用など）
app.get('/api/players', (req, res) => {
    // BOTデータを常に最新の状態にする
    generateOtherPlayers(); // これにより、アクセスがあるたびにBOTがチェックされ、必要なら生成される

    const publicPlayers = Object.values(playersData).map(p => ({
        id: p.id,
        username: p.username,
        icon: p.icon,
        coins: p.coins,
        territories: p.playerTerritories || p.territories, // BOTとプレイヤーでプロパティ名が異なる場合を考慮
        power: p.power || 0 // BOTプレイヤーのpower
    }));
    res.json(publicPlayers);
});

// --- バトルロジックのエンドポイント (サーバーサイドで実行) ---
app.post('/api/battle', (req, res) => {
    const { playerId, targetPlayerId, unitType, unitGrade, deployQuantity } = req.body;

    const player = playersData[playerId];
    const targetPlayer = playersData[targetPlayerId];

    if (!player || !targetPlayer) {
        return res.status(404).json({ message: 'Player or target not found' });
    }

    // サーバーサイドでのユニットの存在とクールダウンチェック
    const unitData = player.units[unitType][unitGrade];
    const availableCount = unitData.count - (unitData.cooldowns ? unitData.cooldowns.filter(cooldownEndStr => new Date(cooldownEndStr) > new Date()).length : 0);

    if (deployQuantity <= 0 || deployQuantity > availableCount) {
        return res.status(400).json({ message: 'Invalid deploy quantity or units are on cooldown.' });
    }

    // クールダウンの適用: 出撃したユニット数だけクールダウンエントリを追加
    const unitCooldownTimes = {
        infantry: { 1: 30 * 60 * 1000, 2: 25 * 60 * 1000, 3: 20 * 60 * 1000 },
        armored_car: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
        tank: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
        fighter: { 1: 120 * 60 * 1000, 2: 100 * 60 * 1000, 3: 80 * 60 * 1000 }
    };
    const cooldownDuration = unitCooldownTimes[unitType][unitGrade];
    const now = new Date();
    for (let i = 0; i < deployQuantity; i++) {
        unitData.cooldowns.push(new Date(now.getTime() + cooldownDuration).toISOString()); // ISO文字列で保存
    }

    // サーバーサイドでの戦闘力計算
    const unitPowers = {
        infantry: { 1: 10, 2: 20, 3: 40 },
        armored_car: { 1: 50, 2: 100, 3: 200 },
        tank: { 1: 200, 2: 400, 3: 800 },
        fighter: { 1: 500, 2: 1000, 3: 2000 }
    };
    const playerUnitPower = unitPowers[unitType][unitGrade] * deployQuantity;
    const enemyTotalPower = targetPlayer.power || (targetPlayer.playerTerritories * 50);

    let resultText = "";
    let win = false;
    let acquiredCoins = 0;
    let acquiredTerritories = 0;

    if (playerUnitPower >= enemyTotalPower * 0.8) {
        win = true;
        acquiredTerritories = Math.floor(targetPlayer.playerTerritories * 0.2);
        acquiredCoins = targetPlayer.playerTerritories * 100;

        player.playerTerritories += acquiredTerritories;
        if (player.playerTerritories > 9999) player.playerTerritories = 9999;
        player.coins += acquiredCoins;

        targetPlayer.playerTerritories -= acquiredTerritories;
        if (targetPlayer.playerTerritories <= 0) {
            delete playersData[targetPlayerId]; // BOTを削除
            generateOtherPlayers(); // 新しいBOTを補充 (これにより、常にBOTが存在する状態に保たれる)
        }
        resultText = `勝利！${targetPlayer.username}から領土を一部奪い、${acquiredCoins}コインを獲得しました！`;

    } else {
        resultText = `敗北... ${targetPlayer.username}は強すぎました。領土は失いませんでした。`;
    }

    res.json({
        message: resultText,
        win: win,
        acquiredCoins: acquiredCoins,
        acquiredTerritories: acquiredTerritories,
        playerData: player // 更新されたプレイヤーデータをクライアントに返す
    });
});


// サーバーを起動
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors'); // 追加

const app = express();

// ★★★ ここに追加 ★★★
app.use(cors()); // 全てのリクエストを許可する場合
// または、特定のオリジンのみを許可する場合
// app.use(cors({ origin: 'https://ak-game-client.onrender.com' }));
// ★★★ ここまで ★★★

// ... (既存のルートハンドラなど) ...