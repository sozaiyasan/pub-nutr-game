// ==========================================
// NGワードリスト & チェック関数
// ==========================================

const NG_WORDS = [
    // 誹謗中傷系
    'バカ', 'ばか', '馬鹿', 'アホ', 'あほ', '阿呆',
    'クズ', 'くず', 'ゴミ', 'ごみ', 'カス', 'かす',
    'ブス', 'ぶす', 'デブ', 'でぶ', 'ハゲ', 'はげ',
    'ブサイク', 'ぶさいく', 'キチガイ', 'きちがい', '気違い',
    
    // 暴力的表現
    '死ね', 'しね', 'シネ', '殺す', 'ころす', 'コロス',
    '消えろ', 'きえろ', 'キエロ', '死んで', 'しんで',
    
    // 差別的・嫌悪表現
    'キモ', 'きも', 'キモい', 'きもい', '気持ち悪',
    'ウザ', 'うざ', 'ウザい', 'うざい', 'うぜー', 'ウゼー',
    'クサイ', 'くさい', '臭い', 'チビ', 'ちび',
    
    // 攻撃的表現
    '荒らし', 'あらし', 'アラシ', 'チート', 'ちーと',
    '不正', 'ふせい', 'ズル', 'ずる',
    
    // その他不適切表現
    'うんこ', 'ウンコ', 'くそ', 'クソ', '糞',
    'ちんこ', 'チンコ', 'まんこ', 'マンコ',
    'セックス', 'せっくす', 'エロ', 'えろ',
    
    // 一般的に避けるべき表現
    '殺人', 'さつじん', '自殺', 'じさつ',
    '暴力', 'ぼうりょく', 'いじめ', 'イジメ',
    
    // スラング・ネットスラング
    'ガイジ', 'がいじ', 'キッズ', 'きっず',
    'ゆとり', 'ユトリ', '老害', 'ろうがい',
    
    // 伏字対策（よくある回避パターン）
    'ば○', 'ば●', 'ば*', 'ばか', 'バ力',
    'し○', 'し●', 'し*', 'シね', '死ね',
];

// NGワードチェック関数（部分一致）
function containsNGWord(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    
    // カタカナをひらがなに変換してチェック
    const hiraganaText = lowerText.replace(/[\u30a1-\u30f6]/g, function(match) {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
    
    // 各NGワードをチェック
    for (const ngWord of NG_WORDS) {
        const lowerNgWord = ngWord.toLowerCase();
        
        // 元のテキストとひらがな変換後の両方でチェック
        if (lowerText.includes(lowerNgWord) || hiraganaText.includes(lowerNgWord)) {
            return true;
        }
    }
    
    return false;
}

// スペースや記号を削除してチェック（回避対策）
function containsNGWordStrict(text) {
    if (!text) return false;
    
    // スペース、記号、数字を削除
    const cleanText = text.replace(/[\s\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?。、！？]/g, '');
    
    return containsNGWord(cleanText);
}

// エクスポート（モジュールとして使う場合）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NG_WORDS, containsNGWord, containsNGWordStrict };
}
