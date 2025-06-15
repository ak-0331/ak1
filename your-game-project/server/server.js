// server/server.js - 最終修正版
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

// --- 3. ミドルウェアの設定（順序が非常に重要です！） ---
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
// server/server.js の app.post('/api/battle', ...) の部分

app.post('/api/battle', (req, res) => {
    const { playerId, targetPlayerId, unitType, unitGrade, deployQuantity } = req.body;

    try {
        // パラメータの基本的な検証
        if (!playerId || !targetPlayerId || !unitType || !unitGrade || deployQuantity === undefined || deployQuantity <= 0) {
            return res.status(400).json({ message: 'バトルに必要な情報が不足しているか、無効な値です。' });
        }

        const player = playersData[playerId];
        const targetPlayer = playersData[targetPlayerId];

        if (!player) {
            return res.status(404).json({ message: '攻撃側のプレイヤーが見つかりません。' });
        }
        if (!targetPlayer) {
            return res.status(404).json({ message: '攻撃対象のプレイヤーが見つかりません。' });
        }

        // ユニットの所有と利用可能性の検証
        const playerUnitData = player.units[unitType]?.[unitGrade]; // ここを 'unitGrade' に修正
        if (!playerUnitData || playerUnitData.count < deployQuantity) {
            return res.status(400).json({ message: '出撃させようとしたユニットが不足しています。' });
        }

        // クールダウンのチェック (サーバー側で最終的に権限を持つ)
        const now = Date.now();
        // 期限切れのクールダウンをフィルタリング
        playerUnitData.cooldowns = playerUnitData.cooldowns.filter(cooldownEnd => {
            const endDate = new Date(cooldownEnd);
            if (isNaN(endDate.getTime())) { // 無効な日付文字列のチェック
                console.warn(`[SERVER WARNING] Invalid cooldown date string found: ${cooldownEnd}. Filtering it out.`);
                return false; // 不正な日付はクールダウンとして扱わない
            }
            return endDate.getTime() > now;
        });

        const availableUnits = playerUnitData.count - playerUnitData.cooldowns.length;
        if (deployQuantity > availableUnits) {
            return res.status(400).json({ message: `ユニットがクールダウン中です。出撃可能な${availableUnits}体を超えています。` });
        }

        // --- 実際のバトルロジック ---
        // 攻撃力の計算
        const unitPower = unitPowers[unitType]?.[unitGrade] || 0; // ここも 'unitGrade' に修正
        const totalAttackPower = unitPower * deployQuantity;

        // 防御力の計算 (簡略化: 領土とターゲットのユニットに基づく)
        let totalDefensePower = targetPlayer.playerTerritories * 50; // BOTはplayerTerritoriesを持つので修正
        // ターゲットユニットからの防御力追加 (簡略化: 全てが防御に参加すると仮定)
        for (const type in targetPlayer.units) {
            for (const grade in targetPlayer.units[type]) {
                totalDefensePower += (unitPowers[type]?.[grade] || 0) * (targetPlayer.units[type]?.[grade]?.count || 0);
            }
        }

        let battleMessage = '';

        if (totalAttackPower > totalDefensePower) {
            // 攻撃側が勝利
            // ターゲットの領土が0でないことを確認してランダムに領土を奪う
            const maxAcquirable = targetPlayer.playerTerritories > 0 ? Math.min(5, targetPlayer.playerTerritories) : 0;
            const acquiredTerritories = maxAcquirable > 0 ? Math.floor(Math.random() * maxAcquirable) + 1 : 0;
            
            let acquiredCoins = 0;
            if (acquiredTerritories > 0) {
                 acquiredCoins = acquiredTerritories * 1000; // 勝利報酬
            }
           
            // ターゲットの領土を減らす
            targetPlayer.playerTerritories -= acquiredTerritories;
            targetPlayer.playerTerritories = Math.max(0, targetPlayer.playerTerritories); // 0未満にならないように

            // プレイヤーの領土を増やす
            player.playerTerritories += acquiredTerritories;
            player.coins += acquiredCoins;

            battleMessage = `戦闘に勝利！${acquiredTerritories}領土を占領し、${acquiredCoins}コインを獲得しました！`;

            // ターゲットがBOTで全ての領土を失った場合、リセット（または消滅）
            if (targetPlayer.id.startsWith('bot_') && targetPlayer.playerTerritories <= 0) { // BOTの領土が0になった場合
                console.log(`Bot player ${targetPlayerId} defeated and reset.`);
                // BOTをリセットする（新しいBOTを生成するより、既存BOTを再生成する方がシンプル）
                const botIndex = parseInt(targetPlayerId.replace('bot_', ''));
                if (!isNaN(botIndex)) {
                     // BOTを削除し、generateOtherPlayersで補充
                     delete playersData[targetPlayerId];
                     generateOtherPlayers();
                } else {
                    // BOTでないプレイヤーの領土が0になった場合、データは残す
                    console.log(`Human player ${targetPlayerId} defeated (territories 0). Data remains.`);
                }
            } else if (targetPlayer.playerTerritories <= 0 && !targetPlayer.id.startsWith('bot_')) {
                // 人間プレイヤーの領土が0になった場合、データは残すが警告
                console.warn(`Human player ${targetPlayerId} has 0 territories after battle.`);
            }


        } else {
            // 防御側が勝利または引き分け
            // 失敗した場合のコイン損失は、攻撃力に基づいて調整 (負けはコストがかかる)
            player.coins = Math.max(0, player.coins - Math.floor(totalAttackPower * 0.05)); // 攻撃力の5%を失う
            battleMessage = `戦闘に敗北しました。`;
        }

        // 出撃ユニットにクールダウンを適用 (勝敗に関わらず)
        const unitCooldownTime = unitCooldownTimes[unitType]?.[unitGrade] || 0; // ここも 'unitGrade' に修正
        for (let i = 0; i < deployQuantity; i++) {
            playerUnitData.cooldowns.push(new Date(now + unitCooldownTime).toISOString());
        }
        // プレイヤーオブジェクトのクールダウン配列を最新の状態に更新
        player.units[unitType][unitGrade].cooldowns = playerUnitData.cooldowns; // ここも 'unitGrade' に修正


        // 更新されたプレイヤーデータを返す
        res.json({
            message: battleMessage,
            playerData: player, // 更新されたプレイヤーオブジェクト
            opponentData: targetPlayer // 更新された相手プレイヤーオブジェクト (領土が変更された場合など)
        });

        console.log(`[BATTLE LOG] プレイヤー ${player.username} (${playerId}) が ${targetPlayer.username} (${targetPlayerId}) を攻撃。結果: ${battleMessage}`);

    } catch (error) {
        console.error("バトル処理中にサーバーエラーが発生しました:", error);
        // エラー時も必ずJSONを返す
        res.status(500).json({ message: 'サーバー内部でバトル処理中に予期せぬエラーが発生しました。', error: error.message });
    }
});



// --- サーバーを起動 ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
