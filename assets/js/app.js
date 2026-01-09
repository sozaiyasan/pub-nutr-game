// ==========================================
// クイズバトル - Boss Rush
// ==========================================

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDh9-NYPq2cTNdr2hfEXZ63eKk4sajkJ6Q",
  authDomain: "testgame-b6790.firebaseapp.com",
  databaseURL: "https://testgame-b6790-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "testgame-b6790",
  storageBucket: "testgame-b6790.firebasestorage.app",
  messagingSenderId: "822315045870",
  appId: "1:822315045870:web:0470b6258335aba96af4ff"
};

// Firebase初期化
let database;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    console.log('✅ Firebase初期化成功');
} catch (error) {
    console.warn('⚠️ Firebase初期化失敗:', error);
    database = null;
}

// ==========================================
// データ定義
// ==========================================

// 問題データ（CSVから読み込む予定）
let QUESTIONS = [];

// ボスデータ
const BOSS_DATA = [
    { 
        name: 'ウォーミングボス', 
        hp: 8,
        maxHp: 8,
        image: 'assets/img/boss01.png',
        type: 'normal',
        description: '基本のボス。落ち着いて答えよう！'
    },
    { 
        name: 'チャレンジボス', 
        hp: 14,
        maxHp: 14,
        image: 'assets/img/boss02.png',
        type: 'normal',
        description: '本番！速答とコンボを狙え！'
    },
    { 
        name: 'リベンジボス', 
        hp: 10,
        maxHp: 10,
        image: 'assets/img/boss03.png',
        type: 'weakness',
        description: 'あなたの弱点を知っている...！'
    }
];

// ゲーム状態
let gameState = {
    playerName: '',
    currentStage: 0,
    currentBoss: null,
    startTime: null,
    questionStartTime: null,
    correctCount: 0,
    incorrectCount: 0,
    usedQuestions: [],
    clearTime: 0,
    combo: 0,
    maxCombo: 0
};

// タイマー
let timerInterval = null;

// ==========================================
// 問題統計（ローカルストレージ）
// ==========================================

function getQuestionStats() {
    const stats = localStorage.getItem('quizBattleQuestionStats');
    return stats ? JSON.parse(stats) : {};
}

function saveQuestionStats(stats) {
    localStorage.setItem('quizBattleQuestionStats', JSON.stringify(stats));
}

function recordQuestionAnswer(questionId, isCorrect) {
    const stats = getQuestionStats();
    
    if (!stats[questionId]) {
        stats[questionId] = { total: 0, correct: 0 };
    }
    
    stats[questionId].total++;
    if (isCorrect) {
        stats[questionId].correct++;
    }
    
    saveQuestionStats(stats);
}

function resetQuestionStats() {
    if (confirm('問題ごとの統計データをリセットしますか？')) {
        localStorage.removeItem('quizBattleQuestionStats');
        alert('統計データをリセットしました');
        showWeakQuestions();
    }
}

function showWeakQuestions() {
    const stats = getQuestionStats();
    const weakQuestionsData = [];
    
    // 統計データと問題を結合
    for (const questionId in stats) {
        const question = QUESTIONS.find(q => q.id == questionId);
        if (question) {
            const stat = stats[questionId];
            const correctRate = stat.total > 0 ? (stat.correct / stat.total * 100) : 0;
            
            weakQuestionsData.push({
                question: question,
                total: stat.total,
                correct: stat.correct,
                correctRate: correctRate
            });
        }
    }
    
    // 正答率が低い順にソート
    weakQuestionsData.sort((a, b) => a.correctRate - b.correctRate);
    
    // 表示
    const listElement = document.getElementById('weakQuestionsList');
    
    if (weakQuestionsData.length === 0) {
        listElement.innerHTML = '<p style="text-align: center; color: #666;">まだ問題を解いていません</p>';
    } else {
        let html = '';
        weakQuestionsData.forEach(data => {
            html += `
                <div class="weak-question-item">
                    <div class="weak-question-header">
                        <strong>問題:</strong> ${escapeHtml(data.question.question)}
                    </div>
                    <div class="weak-question-stats">
                        <span>回答数: ${data.total}回</span>
                        <span>正解数: ${data.correct}回</span>
                        <span class="correct-rate" style="color: ${data.correctRate >= 70 ? '#27ae60' : data.correctRate >= 40 ? '#f39c12' : '#e74c3c'}">
                            正答率: ${data.correctRate.toFixed(1)}%
                        </span>
                    </div>
                    <div class="weak-question-answer" onclick="this.classList.toggle('show')">
                        <div class="answer-label">答えを表示</div>
                        <div class="answer-content">${escapeHtml(data.question.correct)}</div>
                    </div>
                </div>
            `;
        });
        
        listElement.innerHTML = html;
    }
    
    showScreen('weakQuestionsScreen');
}

// ==========================================
// 自己ベスト記録
// ==========================================

function loadBestTime() {
    const bestTime = localStorage.getItem('quizBattleBestTime');
    return bestTime ? parseInt(bestTime) : null;
}

function saveBestTime(time) {
    const currentBest = loadBestTime();
    if (!currentBest || time < currentBest) {
        localStorage.setItem('quizBattleBestTime', time);
        return true; // 更新された
    }
    return false;
}

function displayBestTimeOnStart() {
    const bestTime = loadBestTime();
    const bestTimeElement = document.getElementById('bestTimeDisplay');
    
    if (bestTime) {
        bestTimeElement.innerHTML = `
            <div class="best-time-display">
                <p>🏆 自己ベスト記録</p>
                <p class="best-time">${formatTime(bestTime)}</p>
                <p class="challenge-text">記録を更新しよう！</p>
            </div>
        `;
    } else {
        bestTimeElement.innerHTML = `
            <div class="best-time-display">
                <p>🎮 初回プレイ</p>
                <p class="challenge-text">記録を作ろう！</p>
            </div>
        `;
    }
}

// ==========================================
// CSV読み込み
// ==========================================

function loadQuestionsFromCSV() {
    console.log('📖 CSVファイル読み込み開始...');
    console.log('📂 読み込みパス: assets/data/questions.csv');
    
    fetch('assets/data/questions.csv')
        .then(response => {
            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csv => {
            console.log('📄 CSV読み込み成功');
            console.log('📏 総行数:', csv.split('\n').length);
            
            const lines = csv.split('\n');
            const questions = [];
            
            // ヘッダー行をスキップ
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const parts = parseCSVLine(line);
                
                if (parts.length >= 6) {
                    questions.push({
                        id: parts[0],
                        question: parts[1],
                        correct: parts[2],
                        wrong: [parts[3], parts[4], parts[5]]
                    });
                }
            }
            
            if (questions.length > 0) {
                QUESTIONS = questions;
                console.log(`✅ ${QUESTIONS.length}件の問題を読み込みました`);
                console.log('🔍 最初の問題:', QUESTIONS[0]);
                console.log('🔍 最後の問題:', QUESTIONS[QUESTIONS.length - 1]);
            } else {
                throw new Error('問題データが空です');
            }
        })
        .catch(error => {
            console.error('❌ CSV読み込みエラー:', error);
            console.log('📦 フォールバックデータを使用します');
            QUESTIONS = getFallbackQuestions();
            console.log(`✅ ${QUESTIONS.length}件のフォールバック問題を読み込みました`);
        });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function getFallbackQuestions() {
    return [
        { id: 1, question: '日本の首都はどこ？', correct: '東京', wrong: ['大阪', '京都', '名古屋'] },
        { id: 2, question: '1+1は？', correct: '2', wrong: ['1', '3', '4'] },
        { id: 3, question: '地球は太陽の周りを何日で一周する？', correct: '365日', wrong: ['300日', '400日', '500日'] },
        { id: 4, question: '日本で一番高い山は？', correct: '富士山', wrong: ['北岳', '穂高岳', '槍ヶ岳'] },
        { id: 5, question: '水の化学式は？', correct: 'H2O', wrong: ['CO2', 'O2', 'NaCl'] },
        { id: 6, question: '日本の47都道府県で最も面積が大きいのは？', correct: '北海道', wrong: ['東京都', '沖縄県', '岩手県'] },
        { id: 7, question: '光の速さは秒速約何km？', correct: '30万km', wrong: ['10万km', '50万km', '100万km'] },
        { id: 8, question: 'オリンピックは何年ごとに開催される？', correct: '4年', wrong: ['2年', '5年', '3年'] },
        { id: 9, question: '日本で最も長い川は？', correct: '信濃川', wrong: ['利根川', '石狩川', '天塩川'] },
        { id: 10, question: '人間の歯は永久歯で何本？', correct: '32本', wrong: ['28本', '30本', '34本'] },
        { id: 11, question: '太陽系で最も大きい惑星は？', correct: '木星', wrong: ['土星', '天王星', '海王星'] },
        { id: 12, question: '日本の国鳥は？', correct: 'キジ', wrong: ['ツル', 'タカ', 'ハト'] },
        { id: 13, question: '円周率πの最初の3桁は？', correct: '3.14', wrong: ['3.15', '3.16', '3.13'] },
        { id: 14, question: '日本で最初のノーベル賞受賞者は？', correct: '湯川秀樹', wrong: ['野口英世', '北里柴三郎', '福沢諭吉'] },
        { id: 15, question: '世界で最も高い山は？', correct: 'エベレスト', wrong: ['K2', 'マッターホルン', 'キリマンジャロ'] },
        { id: 16, question: '日本の通貨単位は？', correct: '円', wrong: ['ドル', 'ユーロ', 'ウォン'] },
        { id: 17, question: 'DNA の正式名称は？', correct: 'デオキシリボ核酸', wrong: ['リボ核酸', 'アミノ酸', 'タンパク質'] },
        { id: 18, question: '日本の国花は？', correct: '桜', wrong: ['梅', '菊', '藤'] },
        { id: 19, question: '人間の体で最も大きい臓器は？', correct: '皮膚', wrong: ['肝臓', '心臓', '肺'] },
        { id: 20, question: '日本で最も人口が多い都道府県は？', correct: '東京都', wrong: ['大阪府', '神奈川県', '愛知県'] },
        { id: 21, question: '地球から月までの距離は約何km？', correct: '38万km', wrong: ['10万km', '50万km', '100万km'] },
        { id: 22, question: '日本の義務教育は何年間？', correct: '9年', wrong: ['6年', '12年', '10年'] },
        { id: 23, question: '血液型は何種類？', correct: '4種類', wrong: ['2種類', '6種類', '8種類'] },
        { id: 24, question: '日本の国土面積の約何%が森林？', correct: '約70%', wrong: ['約30%', '約50%', '約90%'] },
        { id: 25, question: '東京オリンピックは西暦何年？', correct: '2021年', wrong: ['2020年', '2019年', '2022年'] },
        { id: 26, question: '日本で最も深い湖は？', correct: '田沢湖', wrong: ['琵琶湖', '霞ヶ浦', '支笏湖'] },
        { id: 27, question: '1時間は何秒？', correct: '3600秒', wrong: ['3000秒', '4000秒', '3200秒'] },
        { id: 28, question: '地球の赤道の長さは約何km？', correct: '約4万km', wrong: ['約2万km', '約6万km', '約8万km'] },
        { id: 29, question: '日本で最も広い平野は？', correct: '関東平野', wrong: ['濃尾平野', '大阪平野', '石狩平野'] },
        { id: 30, question: '虹は何色？', correct: '7色', wrong: ['5色', '6色', '8色'] }
    ];
}

// ==========================================
// ランキング機能
// ==========================================

function saveRanking(record) {
    if (database) {
        // Firebaseに保存
        const newRankingRef = database.ref('rankings').push();
        newRankingRef.set({
            name: record.name,
            time: record.time,
            correct: record.correct,
            incorrect: record.incorrect,
            maxCombo: record.maxCombo,
            date: record.date,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        })
        .then(() => {
            console.log('✅ ランキングをFirebaseに保存しました');
        })
        .catch(error => {
            console.error('❌ Firebase保存エラー:', error);
            saveRankingLocal(record);
        });
    } else {
        // ローカルストレージに保存
        saveRankingLocal(record);
    }
}

function saveRankingLocal(record) {
    const rankings = JSON.parse(localStorage.getItem('quizBattleRankings') || '[]');
    rankings.push(record);
    rankings.sort((a, b) => a.time - b.time);
    
    // 上位50件のみ保存
    const top50 = rankings.slice(0, 50);
    localStorage.setItem('quizBattleRankings', JSON.stringify(top50));
    
    console.log('✅ ランキングをローカルに保存しました');
}

function loadRanking(callback) {
    if (database) {
        database.ref('rankings')
            .orderByChild('time')
            .limitToFirst(50)
            .once('value')
            .then(snapshot => {
                const rankings = [];
                snapshot.forEach(child => {
                    rankings.push(child.val());
                });
                console.log('✅ Firebaseからランキングを読み込みました:', rankings.length + '件');
                callback(rankings);
            })
            .catch(error => {
                console.error('❌ Firebase読み込みエラー:', error);
                const localRankings = JSON.parse(localStorage.getItem('quizBattleRankings') || '[]');
                callback(localRankings);
            });
    } else {
        const localRankings = JSON.parse(localStorage.getItem('quizBattleRankings') || '[]');
        callback(localRankings);
    }
}

function displayRanking(elementId, highlightName = null, highlightTime = null) {
    loadRanking(rankings => {
        const listElement = document.getElementById(elementId);
        
        if (rankings.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; color: #666;">まだランキングがありません</p>';
            return;
        }
        
        let html = '';
        rankings.slice(0, 30).forEach((record, index) => {
            const isHighlight = record.name === highlightName && record.time === highlightTime;
            const rankClass = index < 3 ? `rank-${index + 1}` : '';
            const highlightClass = isHighlight ? 'highlight' : '';
            
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            
            html += `
                <div class="ranking-item ${rankClass} ${highlightClass}">
                    <span class="rank">${medal || (index + 1) + '位'}</span>
                    <span class="name">${escapeHtml(record.name)}</span>
                    <span class="time">${formatTime(record.time)}</span>
                </div>
            `;
        });
        
        listElement.innerHTML = html;
    });
}

function sanitizeInput(input) {
    return input
        .replace(/[<>'"]/g, '')
        .substring(0, 20)
        .trim();
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ==========================================
// 名前バリデーション機能（NGワードフィルタ）
// ==========================================

function validatePlayerName(name) {
    // 1. 文字数チェック
    if (name.length < 2 || name.length > 10) {
        return {
            valid: false,
            message: '名前は2文字以上10文字以内で入力してください'
        };
    }

    // 2. 使用可能文字チェック（ひらがな、カタカナ、漢字、英数字のみ）
    const validPattern = /^[ぁ-んァ-ヶー一-龠々ａ-ｚＡ-Ｚa-zA-Z0-9０-９]+$/;
    if (!validPattern.test(name)) {
        return {
            valid: false,
            message: '名前には記号や特殊文字を使用できません'
        };
    }

    // 3. NGワードチェック（ng-words.jsから読み込み）
    if (typeof containsNGWord !== 'undefined' && containsNGWord(name)) {
        return {
            valid: false,
            message: '不適切な表現が含まれています'
        };
    }

    // 4. 厳密なNGワードチェック（スペースや記号を削除してチェック）
    if (typeof containsNGWordStrict !== 'undefined' && containsNGWordStrict(name)) {
        return {
            valid: false,
            message: '不適切な表現が含まれています'
        };
    }

    // 5. 連続する同じ文字のチェック（3回以上）
    if (/(.)\1{2,}/.test(name)) {
        return {
            valid: false,
            message: '同じ文字を3回以上連続して使用できません'
        };
    }

    return { valid: true };
}

// ==========================================
// ゲームロジック
// ==========================================

function showScreen(screenId) {
    const screens = ['startScreen', 'gameScreen', 'resultScreen', 'rankingScreen', 'weakQuestionsScreen'];
    screens.forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function startGame() {
    const playerNameInput = document.getElementById('playerName');
    const name = playerNameInput.value.trim();
    
    if (!name) {
        alert('名前を入力してください');
        return;
    }

    // 名前のバリデーション
    const validation = validatePlayerName(name);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    if (QUESTIONS.length === 0) {
        alert('問題データが読み込まれていません');
        return;
    }

    // ゲーム状態初期化
    gameState = {
        playerName: sanitizeInput(name),
        currentStage: 0,
        currentBoss: null,
        startTime: Date.now(),
        questionStartTime: null,
        correctCount: 0,
        incorrectCount: 0,
        usedQuestions: [],
        clearTime: 0,
        combo: 0,
        maxCombo: 0
    };

    showScreen('gameScreen');
    nextStage();
}

function nextStage() {
    if (gameState.currentStage >= BOSS_DATA.length) {
        // 全ステージクリア
        gameState.clearTime = Date.now() - gameState.startTime;
        showResult();
        return;
    }
    
    // 初回のステージ開始のみここを通る（2ステージ目以降は showBossIntroAnimation から）
    if (gameState.currentStage === 0) {
        gameState.currentStage = 1;
        const bossTemplate = BOSS_DATA[0];
        gameState.currentBoss = {
            ...bossTemplate,
            currentHp: bossTemplate.hp
        };
        
        // UI更新
        document.getElementById('currentStage').textContent = gameState.currentStage;
        document.getElementById('totalStages').textContent = BOSS_DATA.length;
        document.getElementById('bossName').textContent = gameState.currentBoss.name;
        document.getElementById('bossImage').src = gameState.currentBoss.image;
        
        updateBossHp();
        nextQuestion();
    }
}


function updateBossHp() {
    const boss = gameState.currentBoss;
    const hpPercentage = (boss.currentHp / boss.maxHp) * 100;
    
    document.getElementById('bossHpBar').style.width = hpPercentage + '%';
    
    // HP表示を更新
    const hpText = document.getElementById('bossHpText');
    hpText.innerHTML = `
        <span class="hp-label">残りHP:</span>
        <span class="hp-value">${boss.currentHp}</span>
        <span class="hp-questions">（約${boss.currentHp}問）</span>
    `;
}

function selectQuestion() {
    const boss = gameState.currentBoss;
    
    // 未使用問題をフィルタ
    let availableQuestions = QUESTIONS.filter(q => !gameState.usedQuestions.includes(q.id));
    
    // 全問使い切った場合はリセット
    if (availableQuestions.length === 0) {
        gameState.usedQuestions = [];
        availableQuestions = [...QUESTIONS];
    }
    
    let candidateQuestions = availableQuestions;
    
    // ボス3（ラスボス）は苦手問題優先
    if (boss.type === 'weakness') {
        // 🔧 修正: 全問題から苦手問題を抽出（未使用フィルタを無視）
        const weakQuestions = getWeaknessQuestions(QUESTIONS);  // ← ここを変更
        
        // 🔍 デバッグログ
        console.log('==========================================');
        console.log('🎯 ボス3: 苦手問題チェック');
        console.log('全体候補問題数（未使用）:', availableQuestions.length);
        console.log('苦手問題数（全体から）:', weakQuestions.length);
        console.log('苦手問題ID一覧:', weakQuestions.map(q => q.id));
        console.log('==========================================');
        
        // 苦手問題があればそこから選択
        if (weakQuestions.length > 0) {
            // 🔧 修正: 苦手問題の中で未使用のものを優先、なければ全苦手問題から
            const unusedWeakQuestions = weakQuestions.filter(q => !gameState.usedQuestions.includes(q.id));
            
            if (unusedWeakQuestions.length > 0) {
                candidateQuestions = unusedWeakQuestions;
                console.log('✅ 未使用の苦手問題から出題します:', unusedWeakQuestions.length + '問');
            } else {
                // 全ての苦手問題が出題済みの場合、苦手問題を再出題
                candidateQuestions = weakQuestions;
                console.log('✅ 苦手問題を再出題します（全て出題済み）:', weakQuestions.length + '問');
            }
        } else {
            console.log('⚠️ 苦手問題なし、通常問題から出題します');
        }
    }
    
    // ランダムに1問選択
    const question = candidateQuestions[Math.floor(Math.random() * candidateQuestions.length)];
    gameState.usedQuestions.push(question.id);
    
    console.log('選択された問題ID:', question.id, '問題:', question.question);
    
    return question;
}



function getWeaknessQuestions(availableQuestions) {
    const stats = getQuestionStats();
    const weakQuestions = [];
    
    console.log('📊 統計データ取得');
    
    for (const q of availableQuestions) {
        const stat = stats[q.id];
        if (stat && stat.total >= 2) { // 最低2回以上解いている
            const correctRate = (stat.correct / stat.total) * 100;
            
            if (correctRate < 60) { // 正答率60%未満
                weakQuestions.push(q);
                console.log(`  ✅ 問題ID ${q.id} を苦手問題に追加（正答率 ${correctRate.toFixed(1)}%）`);
            }
        }
    }
    
    return weakQuestions;
}


function nextQuestion() {
    const question = selectQuestion();
    
    // 問題表示
    document.getElementById('questionText').textContent = question.question;
    
    // 選択肢をシャッフル
    const choices = [
        { text: question.correct, isCorrect: true },
        { text: question.wrong[0], isCorrect: false },
        { text: question.wrong[1], isCorrect: false },
        { text: question.wrong[2], isCorrect: false }
    ];
    
    for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    
    // 選択肢ボタン生成
    const choicesElement = document.getElementById('choices');
    choicesElement.innerHTML = '';
    
    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.textContent = choice.text;
        button.onclick = () => answerQuestion(choice.isCorrect, index, question.id);
        choicesElement.appendChild(button);
    });
    
    // タイマー開始
    gameState.questionStartTime = Date.now();
    startTimer();
}

function startTimer() {
    stopTimer();
    
    timerInterval = setInterval(() => {
        // ゲーム開始からの経過時間を表示
        const elapsed = Date.now() - gameState.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const milliseconds = Math.floor((elapsed % 1000) / 100);
        
        document.getElementById('timer').textContent = `${minutes}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
    }, 100);
}


function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function calculateDamage(combo, answerTime) {
    // 基本ダメージ
    let baseDamage = 1;
    
    // コンボボーナス
    if (combo >= 5) {
        baseDamage = 3;
    } else if (combo >= 3) {
        baseDamage = 2;
    } else {
        baseDamage = 1;
    }
    
    // 速答ボーナス（3秒以内）
    const hasSpeedBonus = answerTime < 3;
    const speedBonus = hasSpeedBonus ? 1 : 0;
    
    const totalDamage = baseDamage + speedBonus;
    
    return {
        damage: totalDamage,
        hasSpeedBonus: hasSpeedBonus,
        combo: combo
    };
}

function showDamageEffect(damage, hasSpeedBonus, combo) {
    const damageOverlay = document.createElement('div');
    damageOverlay.className = 'damage-overlay';
    
    // ダメージ値に応じたクラス
    let damageClass = 'damage-normal';
    let damageText = `-${damage}`;
    let extraEffect = '';
    
    if (damage === 4) {
        damageClass = 'damage-max';
        damageText = `MAX DAMAGE!`;
        extraEffect = '⚡🔥💥';
    } else if (damage === 3) {
        damageClass = 'damage-large';
        extraEffect = hasSpeedBonus ? '⚡🔥🔥' : '🔥🔥';
    } else if (damage === 2) {
        damageClass = 'damage-medium';
        extraEffect = hasSpeedBonus ? '⚡🔥' : '🔥';
    } else {
        damageClass = 'damage-small';
        extraEffect = hasSpeedBonus ? '⚡' : '';
    }
    
    damageOverlay.innerHTML = `
        <div class="damage-number ${damageClass}">
            ${extraEffect}<br>
            ${damageText}
        </div>
    `;
    
    document.querySelector('.boss-area').appendChild(damageOverlay);
    
    // ボス画像の揺れ
    const bossImage = document.getElementById('bossImage');
    bossImage.classList.remove('shake-small', 'shake-medium', 'shake-large', 'shake-huge');
    
    if (damage >= 4) {
        bossImage.classList.add('shake-huge');
    } else if (damage >= 3) {
        bossImage.classList.add('shake-large');
    } else if (damage === 2) {
        bossImage.classList.add('shake-medium');
    } else {
        bossImage.classList.add('shake-small');
    }
    
    setTimeout(() => {
        damageOverlay.remove();
        bossImage.classList.remove('shake-small', 'shake-medium', 'shake-large', 'shake-huge');
    }, 1200);
}

function showComboEffect(combo, hasSpeedBonus) {
    if (combo < 2) return;
    
    const comboOverlay = document.createElement('div');
    comboOverlay.className = 'combo-overlay';
    
    let fireEmoji = '🔥';
    if (combo >= 5) fireEmoji = '🔥🔥🔥';
    else if (combo >= 3) fireEmoji = '🔥🔥';
    
    const speedText = hasSpeedBonus ? '<div class="speed-bonus">⚡ SPEED BONUS!</div>' : '';
    
    comboOverlay.innerHTML = `
        ${speedText}
        <div class="combo-text">
            ${fireEmoji} COMBO × ${combo} ${fireEmoji}
        </div>
    `;
    
    document.querySelector('.boss-area').appendChild(comboOverlay);
    
    setTimeout(() => {
        comboOverlay.remove();
    }, 1500);
}

function showResultIcon(isCorrect) {
    const icon = document.createElement('div');
    icon.className = 'answer-result';  // 1つの要素のみ作成
    icon.textContent = isCorrect ? '○' : '×';
    icon.style.color = isCorrect ? '#28a745' : '#dc3545';  // 色を直接指定
    
    document.body.appendChild(icon);  // bodyに直接追加
    
    setTimeout(() => {
        icon.remove();  // 要素を削除
    }, 1500);
}


function answerQuestion(isCorrect, choiceIndex, questionId) {
    stopTimer();
    
    // ボタン無効化
    const buttons = document.querySelectorAll('.choice-btn');
    buttons.forEach(btn => btn.disabled = true);
    
    // 問題統計を記録
    recordQuestionAnswer(questionId, isCorrect);
    
    const answerTime = (Date.now() - gameState.questionStartTime) / 1000;
    
    if (isCorrect) {
        // 正解
        gameState.correctCount++;
        gameState.combo++;
        
        // 最大コンボ更新
        if (gameState.combo > gameState.maxCombo) {
            gameState.maxCombo = gameState.combo;
        }
        
        buttons[choiceIndex].classList.add('correct');
        
        // ダメージ計算
        const damageResult = calculateDamage(gameState.combo, answerTime);
        const damage = damageResult.damage;
        
        // ボスにダメージ
        gameState.currentBoss.currentHp = Math.max(0, gameState.currentBoss.currentHp - damage);
        updateBossHp();
        
        // ダメージ演出
        showDamageEffect(damage, damageResult.hasSpeedBonus, gameState.combo);
        
        // コンボ演出
        showComboEffect(gameState.combo, damageResult.hasSpeedBonus);
        
        // ○表示
        showResultIcon(true);
        
        // ボス撃破チェック
        if (gameState.currentBoss.currentHp <= 0) {
        setTimeout(() => {
            stopTimer(); // タイマー停止
            showBossDefeatedAnimation(); // 撃破演出
        }, 800);
        } else {
        setTimeout(() => {
            nextQuestion();
        }, 800);
        }

    } else {
        // 不正解
        gameState.incorrectCount++;
        gameState.combo = 0; // コンボリセット
        
        buttons[choiceIndex].classList.add('incorrect');
        
        // 正解をハイライト
        const question = QUESTIONS.find(q => q.id == questionId);
        buttons.forEach(btn => {
            if (question && btn.textContent === question.correct) {
                btn.classList.add('correct');
            }
        });
        
        // ×表示
        showResultIcon(false);
        
        setTimeout(() => {
            nextQuestion();
        }, 1000);
    }
}

function showBossDefeatedAnimation() {
    // 撃破演出のオーバーレイを作成
    const overlay = document.createElement('div');
    overlay.className = 'boss-defeated-overlay';
    overlay.innerHTML = `
        <div class="boss-defeated-content">
            <div class="boss-defeated-text">💥 BOSS DEFEATED! 💥</div>
            <div class="boss-defeated-name">${gameState.currentBoss.name}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 1.5秒後に次のステージへ
    setTimeout(() => {
        overlay.remove();
        
        // 次のステージがあれば登場演出
        if (gameState.currentStage < BOSS_DATA.length) {
            showBossIntroAnimation();
        } else {
            // 全ステージクリア
            nextStage();
        }
    }, 2500);
}

function showBossIntroAnimation() {
    // 次のボスを先に設定
    gameState.currentStage++;
    const bossTemplate = BOSS_DATA[gameState.currentStage - 1];
    gameState.currentBoss = {
        ...bossTemplate,
        currentHp: bossTemplate.hp
    };
    
    // 登場演出のオーバーレイを作成
    const overlay = document.createElement('div');
    overlay.className = 'boss-intro-overlay';
    overlay.innerHTML = `
        <div class="boss-intro-content">
            <div class="boss-intro-stage">STAGE ${gameState.currentStage}</div>
            <img src="${gameState.currentBoss.image}" class="boss-intro-image" alt="${gameState.currentBoss.name}">
            <div class="boss-intro-name">${gameState.currentBoss.name}</div>
            <div class="boss-intro-description">${gameState.currentBoss.description}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // UI更新
    document.getElementById('currentStage').textContent = gameState.currentStage;
    document.getElementById('totalStages').textContent = BOSS_DATA.length;
    document.getElementById('bossName').textContent = gameState.currentBoss.name;
    document.getElementById('bossImage').src = gameState.currentBoss.image;
    updateBossHp();
    
    // 2秒後にゲーム再開
    setTimeout(() => {
        overlay.remove();
        startTimer(); // タイマー再開
        nextQuestion();
    }, 2500);
}


function showResult() {
    const resultElement = document.getElementById('resultContent');
    
    const minutes = Math.floor(gameState.clearTime / 60000);
    const seconds = Math.floor((gameState.clearTime % 60000) / 1000);
    const milliseconds = Math.floor((gameState.clearTime % 1000) / 10);
    
    // 自己ベスト更新チェック
    const isBestTime = saveBestTime(gameState.clearTime);
    const previousBest = loadBestTime();
    
    let bestTimeHTML = '';
    if (isBestTime) {
        bestTimeHTML = `
            <div class="best-time-updated">
                🎉 自己ベスト更新！ 🎉
            </div>
        `;
    } else if (previousBest && previousBest !== gameState.clearTime) {
        const diff = gameState.clearTime - previousBest;
        const diffSign = diff > 0 ? '+' : '';
        bestTimeHTML = `
            <p style="color: #666;">自己ベストとの差: ${diffSign}${formatTime(Math.abs(diff))}</p>
        `;
    }
    
    resultElement.innerHTML = `
        <h2>🎉 全ステージクリア！ 🎉</h2>
        ${bestTimeHTML}
        <div class="result-stats">
            <p><strong>プレイヤー名:</strong> ${escapeHtml(gameState.playerName)}</p>
            <p><strong>クリアタイム:</strong> ${minutes}分${seconds}.${String(milliseconds).padStart(2, '0')}秒</p>
            <p><strong>正解数:</strong> ${gameState.correctCount}問</p>
            <p><strong>不正解数:</strong> ${gameState.incorrectCount}問</p>
            <p><strong>最大コンボ:</strong> ${gameState.maxCombo}連続 🔥</p>
        </div>
    `;
    
    // ランキング保存
    const record = {
        name: gameState.playerName,
        time: gameState.clearTime,
        correct: gameState.correctCount,
        incorrect: gameState.incorrectCount,
        maxCombo: gameState.maxCombo,
        date: new Date().toLocaleDateString('ja-JP')
    };
    
    saveRanking(record);
    
    // ランキング表示
    displayRanking('resultRankingList', gameState.playerName, gameState.clearTime);
    
    showScreen('resultScreen');
}

function showRanking() {
    displayRanking('rankingList');
    showScreen('rankingScreen');
}

function backToStart() {
    showScreen('startScreen');
    displayBestTimeOnStart();
}

function formatTime(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = Math.floor((milliseconds % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// ==========================================
// ルール開閉機能
// ==========================================

function toggleRules() {
    const content = document.getElementById('rulesContent');
    const icon = document.getElementById('rulesToggleIcon');
    
    content.classList.toggle('open');
    icon.classList.toggle('open');
}

// ==========================================
// 初期化
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 ゲーム初期化開始');
    loadQuestionsFromCSV();
    displayBestTimeOnStart();
});

// ==========================================
// ビューポート高さ調整（iOS Chrome 対応）
// ==========================================

function setViewportHeight() {
    // 実際のビューポート高さを取得
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    console.log('📱 ビューポート高さ設定:', window.innerHeight + 'px');
}

// 初回実行
setViewportHeight();

// リサイズ時・画面回転時に再計算
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', setViewportHeight);

// iOS Safari のアドレスバー表示/非表示時に再計算
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            setViewportHeight();
            ticking = false;
        });
        ticking = true;
    }
});
