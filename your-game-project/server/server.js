// server/server.js - 最終確定版
// このファイルは、Node.jsとExpress.jsを使ってゲームのバックエンドサービスを提供します。
// プレイヤーデータの管理、ゲームロジック（バトルなど）、APIエンドポイントを含みます。

// 1. 必要なモジュールを読み込む（ファイル全体で一度だけ！）
const express = require('express');
const cors = require('cors'); // CORS（クロスオリジンリソース共有）を許可するために必要
const path = require('path'); // ファイルパス操作のために必要
const fs = require('fs');     // ファイルシステム操作のために必要（メモリ内DBの補助）

// 2. Expressアプリケーションのインスタンスを作成（ファイル全体で一度だけ！）
const app = express();

// Renderが提供するPORT環境変数を使用し、それがなければローカル開発用に3000番ポートを使用
const PORT = process.env.PORT || 3000;

// --- 3. ミドルウェアの設定（順序が重要です！これらを重複させない！） ---
// CORSミドルウェアを一番最初に配置することで、全てのリクエストに対してCORSヘッダーが適用されます。
// 本番環境では、クライアントの公開URLのみを許可するよう厳密に設定することを推奨します。
// 例: app.use(cors({ origin: 'https://ak-game-client.onrender.com' }));
app.use(cors());

// クライアントから送信されるJSON形式のリクエストボディをパースするために必要
app.use(express.json());
// URLエンコードされたボディをパースするために必要 (フォームデータなど)
app.use(express.urlencoded({ extended: true }));


// --- 4. 簡易データベース（メモリ内） ---
// 注意：このデータベースはサーバーが再起動するたびにリセットされます！
// 本番運用には、Renderが提供するPostgreSQLやMongoDBのような永続的な外部データベースサービスが必須です。
let playersData = {};

// サーバー起動時にダミーのBOTデータを生成/更新する関数
// BOTデータが存在しない場合や、プレイヤーがBOTを倒した場合に新しく生成・補充されます。
function generateOtherPlayers() {
    const names = ["ShadowKiller", "DragonSlayer", "NightWolf", "IronMan", "CyberNinja", "StarCommander", "ThunderFist", "CrimsonKing"];
    const icons = ["👹", "🐉", "🐺", "🤖", "🥷", "🌠", "⚡", "👑"];

    for (let i = 0; i < 8; i++) { // 8人のダミープレイヤーを常に存在させる
        const botId = `bot_${i}`;
        if (!playersData[botId]) { // そのIDのBOTが存在しない場合のみ生成
            playersData[botId] = {
                id: botId,
                username: names[i] || `Bot Player ${i + 1}`,
                icon: icons[i] || '👤',
                coins: Math.floor(Math.random() * 5000) + 1000,
                playerTerritories: Math.floor(Math.random() * 20) + 5,
                units: {}, // BOTのユニットは今回は簡易化（バトルロジックでは使わない）
                power: Math.floor(Math.random() * 1000) + 500, // BOTの総合戦闘力
                // プレイヤーと同じデータ構造を持つが、BOTでは使われないプロパティも含む
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

// サーバー起動時にBOTデータを初期化する
generateOtherPlayers();


// --- 5. APIエンドポイントの定義 ---

// ルートパス('/')へのGETリクエストに対するハンドラ
// サーバーが正常に動作しているか確認するためのシンプルなエンドポイントです。
app.get('/', (req, res) => {
    console.log('Root path / accessed');
    // クライアントがJSONを期待しているので、JSON形式でメッセージを返します。
    res.json({ message: 'Hello from Render Server!', status: 'ready', serverTime: new Date() });
});

// プレイヤーデータを取得または新規作成するAPI
// クライアントが初期ロード時に自分のプレイヤーデータをサーバーから取得するために使用します。
app.post('/api/player', (req, res) => {
    const { requestedId, username: clientUsername, userIcon: clientUserIcon } = req.body;
    
    let playerId = requestedId;
    if (!playerId || !playersData[playerId]) { // クライアントから提供されたIDがない、またはそのIDのプレイヤーがメモリに存在しない場合
        // 新規プレイヤーとしてデータを生成
        playerId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // ユニークなIDを生成
        playersData[playerId] = {
            id: playerId,
            username: clientUsername || "新規プレイヤー", // クライアントから提供されたユーザー名、なければデフォルト
            icon: clientUserIcon || "😀", // クライアントから提供されたアイコン、なければデフォルト
            coins: 1000, // 初期コイン
            playerTerritories: 10, // 初期領土
            // ユニットデータの初期化（空の状態）
            units: {
                infantry: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } },
                armored_car: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } },
                tank: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } },
                fighter: { 1: { count: 0, cooldowns: [] }, 2: { count: 0, cooldowns: [] }, 3: { count: 0, cooldowns: [] } }
            },
            // その他ゲーム状態の初期化
            lastSpinTime: 0,
            lastWorkTime: 0,
            dailyCoinsEarned: 0,
            lastBonusClaimDate: null,
            spinDirection: "normal",
            lastTerritoryPurchaseTime: 0
        };
        console.log(`New player created: ${playerId}`);
    } else {
        console.log(`Existing player loaded: ${playerId}`);
    }
    res.json(playersData[playerId]); // 該当プレイヤーのデータをJSONで返す
});

// プレイヤーデータを更新するAPI
// クライアントからの様々なゲーム内操作（コインの増減、ユニット購入など）で呼び出されます。
app.post('/api/player/update', (req, res) => {
    const { playerId, data } = req.body; // クライアントから送られてくるプレイヤーIDと更新データ

    if (!playersData[playerId]) {
        console.warn(`Player not found for update: ${playerId}`);
        return res.status(404).json({ message: 'Player not found' });
    }

    // ユニットのクールダウンデータをISO文字列に変換してから保存
    // Dateオブジェクトが送られてくる可能性があるため、toISOString()で文字列に統一
    if (data.units) {
        for (const type in data.units) {
            for (const grade in data.units[type]) {
                if (data.units[type][grade] && Array.isArray(data.units[type][grade].cooldowns)) {
                    data.units[type][grade].cooldowns = data.units[type][grade].cooldowns.map(ts => (ts instanceof Date ? ts.toISOString() : ts));
                }
            }
        }
    }

    // 既存のプレイヤーデータを、クライアントから受け取ったデータで更新
    // Object.assignは、dataに含まれるプロパティだけを上書きします。
    Object.assign(playersData[playerId], data);
    console.log(`Player data updated for ${playerId}`);
    res.json({ message: 'Player data updated successfully', player: playersData[playerId] });
});

// 全プレイヤーデータを取得するAPI（ランキング表示などに使用）
// BOTプレイヤーも含む全ての公開可能なプレイヤーデータを返します。
app.get('/api/players', (req, res) => {
    // 最新のBOTデータを確実に含むようにする
    generateOtherPlayers();

    // クライアントに返す前に、不要な情報や機密情報をフィルタリング
    const publicPlayers = Object.values(playersData).map(p => ({
        id: p.id,
        username: p.username,
        icon: p.icon,
        coins: p.coins,
        territories: p.playerTerritories || p.territories, // プレイヤーとBOTでプロパティ名が異なる場合を考慮
        power: p.power || 0 // BOTプレイヤーのpower (PvPの場合、これも変動しうる)
    }));
    console.log(`Fetched ${publicPlayers.length} public players.`);
    res.json(publicPlayers);
});

// バトルロジックを処理するAPI
// クライアントからの攻撃リクエストを受け取り、サーバー側で戦闘結果を計算・更新します。
app.post('/api/battle', (req, res) => {
    const { playerId, targetPlayerId, unitType, unitGrade, deployQuantity } = req.body;

    const player = playersData[playerId];
    const targetPlayer = playersData[targetPlayerId];

    if (!player || !targetPlayer) {
        console.warn(`Battle failed: Player ${playerId} or target ${targetPlayerId} not found.`);
        return res.status(404).json({ message: 'Player or target not found' });
    }

    // サーバーサイドでのユニットの存在とクールダウンチェック
    // クライアントからのデータがISO文字列の場合があるので、Dateオブジェクトに変換して比較
    const unitData = player.units[unitType]?.[grade]; // ユニットが存在するか確認
    if (!unitData) {
        console.warn(`Battle failed: Unit ${unitType} Lv.${unitGrade} not found for player ${playerId}.`);
        return res.status(400).json({ message: 'Invalid unit selected.' });
    }

    const availableCount = unitData.count - (unitData.cooldowns ? unitData.cooldowns.filter(cooldownEndStr => new Date(cooldownEndStr) > new Date()).length : 0);

    if (deployQuantity <= 0 || deployQuantity > availableCount) {
        console.warn(`Battle failed for ${playerId}: Invalid deploy quantity (${deployQuantity}) or units on cooldown. Available: ${availableCount}`);
        return res.status(400).json({ message: 'Invalid deploy quantity or units are on cooldown.' });
    }

    // クールダウンの適用: 出撃したユニット数だけクールダウンエントリを追加
    // クールダウン時間はサーバー側で管理すべき定数として定義
    const unitCooldownTimes = {
        infantry: { 1: 30 * 60 * 1000, 2: 25 * 60 * 1000, 3: 20 * 60 * 1000 },
        armored_car: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
        tank: { 1: 60 * 60 * 1000, 2: 50 * 60 * 1000, 3: 40 * 60 * 1000 },
        fighter: { 1: 120 * 60 * 1000, 2: 100 * 60 * 1000, 3: 80 * 60 * 1000 }
    };
    const cooldownDuration = unitCooldownTimes[unitType][unitGrade];
    const now = new Date();
    for (let i = 0; i < deployQuantity; i++) {
        unitData.cooldowns.push(new Date(now.getTime() + cooldownDuration).toISOString()); // クールダウン終了時刻をISO文字列で保存
    }

    // サーバーサイドでの戦闘力計算（これらの値もサーバーで一元管理されるべき）
    const unitPowers = {
        infantry: { 1: 10, 2: 20, 3: 40 },
        armored_car: { 1: 50, 2: 100, 3: 200 },
        tank: { 1: 200, 2: 400, 3: 800 },
        fighter: { 1: 500, 2: 1000, 3: 2000 }
    };
    const playerUnitPower = unitPowers[unitType][unitGrade] * deployQuantity;
    // 相手プレイヤーの戦闘力（BOTはpowerプロパティ、プレイヤーは領土数から簡易的に算出）
    const enemyTotalPower = targetPlayer.power || (targetPlayer.playerTerritories * 50);

    let resultText = "";
    let win = false;
    let acquiredCoins = 0;
    let acquiredTerritories = 0;

    if (playerUnitPower >= enemyTotalPower * 0.8) { // プレイヤーの戦力が相手の80%以上なら勝利
        win = true;
        acquiredTerritories = Math.floor(targetPlayer.playerTerritories * 0.2); // 相手領土の20%を奪う
        acquiredCoins = targetPlayer.playerTerritories * 100; // 領土数に応じてコイン獲得

        player.playerTerritories += acquiredTerritories; // プレイヤーの領土を増やす
        if (player.playerTerritories > 9999) player.playerTerritories = 9999; // 上限設定
        player.coins += acquiredCoins; // プレイヤーのコインを増やす

        // 相手プレイヤーの領土を減らす
        targetPlayer.playerTerritories -= acquiredTerritories;
        if (targetPlayer.playerTerritories <= 0) {
            // 相手がBOTプレイヤーであれば削除し、新しいBOTを補充
            console.log(`Bot player ${targetPlayerId} defeated. Generating new bots.`);
            delete playersData[targetPlayerId];
            generateOtherPlayers(); // 新しいBOTを補充 (これにより、常にBOTが存在する状態に保たれる)
        }
        resultText = `勝利！${targetPlayer.username}から領土を一部奪い、${acquiredCoins}コインを獲得しました！`;

    } else {
        resultText = `敗北... ${targetPlayer.username}は強すぎました。領土は失いませんでした。`; // 敗北時は領土を失わない
    }

    console.log(`Battle result for ${playerId} vs ${targetPlayer.username}: ${resultText}`);
    res.json({
        message: resultText,
        win: win,
        acquiredCoins: acquiredCoins,
        acquiredTerritories: acquiredTerritories,
        playerData: player // 更新されたプレイヤーデータをクライアントに返す
    });
});


// --- サーバーを起動 ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
