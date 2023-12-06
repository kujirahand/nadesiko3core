import { NakoRuntimeError } from './nako_errors.mjs';
export default {
    'meta': {
        type: 'const',
        value: {
            pluginName: 'plugin_system',
            pluginVersion: '3.4.5',
            nakoRuntime: ['wnako', 'cnako', 'phpnako'],
            nakoVersion: '^3.4.5' // 要求なでしこバージョン
        }
    },
    '初期化': {
        type: 'func',
        josi: [],
        pure: false,
        fn: function (sys) {
            // 言語バージョンを設定
            sys.isDebug = false;
            sys.__v0['ナデシコバージョン'] = sys.version;
            sys.__v0['ナデシコ言語バージョン'] = sys.coreVersion;
            sys.__namespaceList = [];
            // なでしこの関数や変数を探して返す
            sys.__findVar = function (nameStr, def) {
                if (typeof nameStr === 'function') {
                    return nameStr;
                }
                if (sys.__locals[nameStr]) {
                    return sys.__locals[nameStr];
                }
                // 名前空間が指定されている場合
                if (nameStr.indexOf('__') >= 0) {
                    for (let i = 2; i >= 0; i--) {
                        const varScope = sys.__varslist[i];
                        if (varScope[nameStr]) {
                            return varScope[nameStr];
                        }
                    }
                    return def;
                }
                // 名前空間を参照して関数・変数名を解決する
                const modList = sys.__modList ? sys.__modList : [sys.__modName];
                for (const modName of modList) {
                    const gname = modName + '__' + nameStr;
                    for (let i = 2; i >= 0; i--) {
                        const scope = sys.__varslist[i];
                        if (scope[gname]) {
                            return scope[gname];
                        }
                    }
                }
                return def;
            };
            // 文字列から関数を探す
            sys.__findFunc = function (nameStr, parentFunc) {
                const f = sys.__findVar(nameStr);
                if (typeof f === 'function') {
                    return f;
                }
                throw new Error(`『${parentFunc}』に実行できない関数が指定されました。`);
            };
            // システム関数を実行
            sys.__exec = function (func, params) {
                // システム命令を優先
                const f0 = sys.__v0[func];
                if (f0) {
                    return f0.apply(this, params);
                }
                // グローバル・ローカルを探す
                const f = sys.__findVar(func);
                if (!f) {
                    throw new Error('システム関数でエイリアスの指定ミス:' + func);
                }
                return f.apply(this, params);
            };
            // タイマーに関する処理(タイマーは「!クリア」で全部停止する)
            sys.__timeout = [];
            sys.__interval = [];
            // 日付処理などに使う
            const z2 = sys.__zero2 = (s) => {
                s = '00' + s;
                return s.substring(s.length - 2);
            };
            sys.__zero = (s, keta) => {
                let zeroS = '';
                for (let i = 0; i < keta; i++) {
                    zeroS += '0';
                }
                s = zeroS + s;
                return s.substring(s.length - keta);
            };
            sys.__formatDate = (t) => {
                return t.getFullYear() + '/' + z2(t.getMonth() + 1) + '/' + z2(t.getDate());
            };
            sys.__formatTime = (t) => {
                return z2(t.getHours()) + ':' + z2(t.getSeconds()) + ':' + z2(t.getMinutes());
            };
            sys.__formatDateTime = (t, fmt) => {
                const dateStr = t.getFullYear() + '/' + z2(t.getMonth() + 1) + '/' + z2(t.getDate());
                const timeStr = z2(t.getHours()) + ':' + z2(t.getMinutes()) + ':' + z2(t.getSeconds());
                if (fmt.match(/^\d+\/\d+\/\d+\s+\d+:\d+:\d+$/)) {
                    return dateStr + ' ' + timeStr;
                }
                if (fmt.match(/^\d+\/\d+\/\d+$/)) {
                    return dateStr;
                }
                if (fmt.match(/^\d+:\d+:\d+$/)) {
                    return timeStr;
                }
                return dateStr + ' ' + timeStr;
            };
            sys.__str2date = (s) => {
                // trim
                s = ('' + s).replace(/(^\s+|\s+$)/, '');
                // is unix time
                if (s.match(/^(\d+|\d+\.\d+)$/)) {
                    return new Date(parseFloat(s) * 1000);
                }
                // is time ?
                if (s.match(/^\d+:\d+(:\d+)?$/)) {
                    const t = new Date();
                    const a = (s + ':0').split(':');
                    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), parseInt(a[0]), parseInt(a[1]), parseInt(a[2]));
                }
                // replace splitter to '/'
                s = s.replace(/[\s:-]/g, '/');
                s += '/0/0/0'; // 日付だけのときのために時間分を足す
                const a = s.split('/');
                return new Date(parseInt(a[0]), parseInt(a[1]) - 1, parseInt(a[2]), parseInt(a[3]), parseInt(a[4]), parseInt(a[5]));
            };
            // 『継続表示』のための一時変数(『表示』実行で初期化)
            sys.__printPool = '';
            // 暗黙の型変換で足し算を行うときに使用。bigint はそのまま、その他は number に自動変換
            sys.__parseFloatOrBigint = (v) => {
                return (typeof v) === 'bigint' ? v : parseFloat(v);
            };
            // undefinedチェック
            sys.chk = (value, constId) => {
                if (typeof value === 'undefined') {
                    const cp = sys.constPools[constId];
                    const { msgNo, msgArgs, fileNo, lineNo } = cp;
                    let msg = sys.constPoolsTemplate[msgNo];
                    for (const i in msgArgs) {
                        const arg = sys.constPoolsTemplate[msgArgs[i]];
                        msg = msg.split(`$${i}`).join(arg);
                    }
                    const fileStr = sys.constPoolsTemplate[fileNo];
                    sys.logger.warn(msg, { file: fileStr, line: lineNo });
                }
                return value;
            };
        }
    },
    '!クリア': {
        type: 'func',
        josi: [],
        pure: false,
        fn: function (sys) {
            if (sys.__exec) {
                sys.__exec('全タイマー停止', [sys]);
            }
            if (sys.__genMode === '非同期モード') {
                sys.__stopAsync(sys);
            }
            sys.__v0['表示ログ'] = '';
        }
    },
    // @システム定数
    'ナデシコバージョン': { type: 'const', value: '?' },
    'ナデシコ言語バージョン': { type: 'const', value: '?' },
    'ナデシコエンジン': { type: 'const', value: 'nadesi.com/v3' },
    'ナデシコ種類': { type: 'const', value: '?' },
    'はい': { type: 'const', value: 1 },
    'いいえ': { type: 'const', value: 0 },
    '真': { type: 'const', value: 1 },
    '偽': { type: 'const', value: 0 },
    '永遠': { type: 'const', value: 1 },
    'オン': { type: 'const', value: 1 },
    'オフ': { type: 'const', value: 0 },
    '改行': { type: 'const', value: '\n' },
    'タブ': { type: 'const', value: '\t' },
    'カッコ': { type: 'const', value: '「' },
    'カッコ閉': { type: 'const', value: '」' },
    '波カッコ': { type: 'const', value: '{' },
    '波カッコ閉': { type: 'const', value: '}' },
    'OK': { type: 'const', value: true },
    'NG': { type: 'const', value: false },
    'キャンセル': { type: 'const', value: 0 },
    'TRUE': { type: 'const', value: true },
    'FALSE': { type: 'const', value: false },
    'true': { type: 'const', value: true },
    'false': { type: 'const', value: false },
    'PI': { type: 'const', value: Math.PI },
    '空': { type: 'const', value: '' },
    'NULL': { type: 'const', value: null },
    'undefined': { type: 'const', value: undefined },
    '未定義': { type: 'const', value: undefined },
    'エラーメッセージ': { type: 'const', value: '' },
    '対象': { type: 'const', value: '' },
    '対象キー': { type: 'const', value: '' },
    '回数': { type: 'const', value: '' },
    'CR': { type: 'const', value: '\r' },
    'LF': { type: 'const', value: '\n' },
    '非数': { type: 'const', value: NaN },
    '無限大': { type: 'const', value: Infinity },
    '空配列': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return [];
        }
    },
    '空辞書': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return {};
        }
    },
    '空ハッシュ': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return {};
        }
    },
    '空オブジェクト': {
        type: 'func',
        josi: [],
        pure: false,
        fn: function (sys) {
            return sys.__exec('空ハッシュ', [sys]);
        }
    },
    // @標準出力
    '表示': {
        type: 'func',
        josi: [['を', 'と']],
        pure: true,
        fn: function (s, sys) {
            // 継続表示の一時プールを出力
            s = sys.__printPool + s;
            sys.__printPool = '';
            //
            sys.__varslist[0]['表示ログ'] += (s + '\n');
            sys.logger.send('stdout', s + '');
        },
        return_none: true
    },
    '継続表示': {
        type: 'func',
        josi: [['を', 'と']],
        pure: true,
        fn: function (s, sys) {
            sys.__printPool += s;
        },
        return_none: true
    },
    '連続表示': {
        type: 'func',
        josi: [['と', 'を']],
        isVariableJosi: true,
        pure: true,
        fn: function (...a) {
            const sys = a.pop();
            const v = a.join('');
            sys.__exec('表示', [v, sys]);
        },
        return_none: true
    },
    '連続無改行表示': {
        type: 'func',
        josi: [['と', 'を']],
        isVariableJosi: true,
        pure: true,
        fn: function (...a) {
            const sys = a.pop();
            const v = a.join('');
            sys.__exec('継続表示', [v, sys]);
        },
        return_none: true
    },
    '表示ログ': { type: 'const', value: '' },
    '表示ログクリア': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            sys.__varslist[0]['表示ログ'] = '';
        },
        return_none: true
    },
    '言': {
        type: 'func',
        josi: [['を', 'と']],
        pure: true,
        fn: function (s, sys) {
            sys.logger.send('stdout', s + '');
        },
        return_none: true
    },
    'コンソール表示': {
        type: 'func',
        josi: [['を', 'と']],
        pure: true,
        fn: function (s) {
            console.log(s);
        },
        return_none: true
    },
    // @四則演算
    '足': {
        type: 'func',
        josi: [['に', 'と'], ['を']],
        isVariableJosi: false,
        pure: true,
        fn: function (a, b) {
            return a + b;
        }
    },
    '引': {
        type: 'func',
        josi: [['から'], ['を']],
        pure: true,
        fn: function (a, b) {
            return a - b;
        }
    },
    '掛': {
        type: 'func',
        josi: [['に', 'と'], ['を']],
        pure: true,
        fn: function (a, b) {
            // 数値の掛け算
            if (typeof a === 'number') {
                return a * b;
            }
            // 文字列の掛け算(文字列の繰り返し)
            if (typeof a === 'string') {
                let s = '';
                for (let i = 0; i < parseInt(b); i++) {
                    s += a;
                }
                return s;
            }
            // 配列の繰り返し
            if (a instanceof Array) {
                const aa = [];
                for (let i = 0; i < parseInt(b); i++) {
                    aa.push(...a);
                }
                return aa;
            }
            return a * b;
        }
    },
    '倍': {
        type: 'func',
        josi: [['の', 'を'], ['']],
        pure: true,
        fn: function (a, b) {
            return a * b;
        }
    },
    '割': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (a, b) {
            return a / b;
        }
    },
    '割余': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (a, b) {
            return a % b;
        }
    },
    '偶数': {
        type: 'func',
        josi: [['が']],
        pure: true,
        fn: function (a) {
            return (parseInt(a) % 2 === 0);
        }
    },
    '奇数': {
        type: 'func',
        josi: [['が']],
        pure: true,
        fn: function (a) {
            return (parseInt(a) % 2 === 1);
        }
    },
    '二乗': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (a) {
            return a * a;
        }
    },
    'べき乗': {
        type: 'func',
        josi: [['の'], ['の']],
        pure: true,
        fn: function (a, b) {
            return Math.pow(a, b);
        }
    },
    '以上': {
        type: 'func',
        josi: [['が'], ['']],
        pure: true,
        fn: function (a, b) {
            return a >= b;
        }
    },
    '以下': {
        type: 'func',
        josi: [['が'], ['']],
        pure: true,
        fn: function (a, b) {
            return a <= b;
        }
    },
    '未満': {
        type: 'func',
        josi: [['が'], ['']],
        pure: true,
        fn: function (a, b) {
            return a < b;
        }
    },
    '超': {
        type: 'func',
        josi: [['が'], ['']],
        pure: true,
        fn: function (a, b) {
            return a > b;
        }
    },
    '等': {
        type: 'func',
        josi: [['が'], ['と']],
        pure: true,
        fn: function (a, b) {
            return a === b;
        }
    },
    '等無': {
        type: 'func',
        josi: [['が'], ['と']],
        pure: true,
        fn: function (a, b) {
            return a !== b;
        }
    },
    '一致': {
        type: 'func',
        josi: [['が'], ['と']],
        pure: true,
        fn: function (a, b) {
            // オブジェクトの場合、JSONに変換して比較
            if (typeof (a) === 'object') {
                const jsonA = JSON.stringify(a);
                const jsonB = JSON.stringify(b);
                return jsonA === jsonB;
            }
            return a === b;
        }
    },
    '不一致': {
        type: 'func',
        josi: [['が'], ['と']],
        pure: true,
        fn: function (a, b) {
            // オブジェクトの場合、JSONに変換して比較
            if (typeof (a) === 'object') {
                const jsonA = JSON.stringify(a);
                const jsonB = JSON.stringify(b);
                return jsonA !== jsonB;
            }
            return a !== b;
        }
    },
    '範囲内': {
        type: 'func',
        josi: [['が'], ['から'], ['の', 'までの']],
        pure: true,
        fn: function (v, a, b) {
            return (a <= v) && (v <= b);
        }
    },
    '連続加算': {
        type: 'func',
        josi: [['を'], ['に', 'と']],
        isVariableJosi: true,
        pure: true,
        fn: function (b, ...a) {
            a.pop(); // 必ず末尾に sys があるので、末尾のシステム変数を除外
            a.push(b);
            return a.reduce((p, c) => p + c);
        }
    },
    // @敬語
    'ください': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            if (!sys.__reisetu) {
                sys.__reisetu = 0;
            }
            sys.__reisetu++;
        },
        return_none: true
    },
    'お願': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            if (!sys.__reisetu) {
                sys.__reisetu = 0;
            }
            sys.__reisetu++;
        },
        return_none: true
    },
    'です': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            if (!sys.__reisetu) {
                sys.__reisetu = 0;
            }
            sys.__reisetu++;
        },
        return_none: true
    },
    '拝啓': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            sys.__reisetu = 0;
        },
        return_none: true
    },
    '敬具': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            sys.__reisetu += 100; // bonus point
        },
        return_none: true
    },
    '礼節レベル取得': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            if (!sys.__reisetu) {
                sys.__reisetu = 0;
            }
            return sys.__reisetu;
        }
    },
    // @特殊命令
    'JS実行': {
        type: 'func',
        josi: [['を', 'で']],
        pure: true,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        fn: function (src, sys) {
            // [メモ] ↑のsys は eval の中でも有効なので消さない!!
            // https://github.com/kujirahand/nadesiko3/issues/1237
            return eval(src); // eslint-disable-line
        }
    },
    'JSオブジェクト取得': {
        type: 'func',
        josi: [['の']],
        pure: false,
        fn: function (name, sys) {
            return sys.__findVar(name, null);
        }
    },
    'JS関数実行': {
        type: 'func',
        josi: [['を'], ['で']],
        fn: function (name, args) {
            // nameが文字列ならevalして関数を得る
            // eslint-disable-next-line no-eval
            if (typeof name === 'string') {
                name = eval(name);
            }
            if (typeof name !== 'function') {
                throw new Error('JS関数取得で実行できません。');
            }
            // argsがArrayでなければArrayに変換する
            if (!(args instanceof Array)) {
                args = [args];
            }
            // 実行
            // eslint-disable-next-line prefer-spread
            return name.apply(null, args);
        }
    },
    'ASYNC': {
        type: 'func',
        josi: [],
        asyncFn: true,
        fn: async function () {
            // empty
        },
        return_none: true
    },
    'AWAIT実行': {
        type: 'func',
        josi: [['を'], ['で']],
        asyncFn: true,
        fn: async function (f, args, sys) {
            // nameが文字列ならevalして関数を得る
            if (typeof f === 'string') {
                f = sys.__findFunc(f, 'AWAIT実行');
            }
            if (!(f instanceof Function)) {
                throw new Error('『AWAIT実行』の第一引数はなでしこ関数名かFunction型で指定してください。');
            }
            // 実行
            return await f(...args);
        }
    },
    'JSメソッド実行': {
        type: 'func',
        josi: [['の'], ['を'], ['で']],
        fn: function (obj, m, args) {
            // objが文字列ならevalして関数を得る
            // eslint-disable-next-line no-eval
            if (typeof obj === 'string') {
                obj = eval(obj);
            }
            if (typeof obj !== 'object') {
                throw new Error('JSオブジェクトを取得できませんでした。');
            }
            // method を求める
            if (typeof m !== 'function') {
                m = obj[m];
            }
            // argsがArrayでなければArrayに変換する
            if (!(args instanceof Array)) {
                args = [args];
            }
            // 実行
            return m.apply(obj, args);
        }
    },
    'ナデシコ': {
        type: 'func',
        josi: [['を', 'で']],
        pure: false,
        fn: function (code, sys) {
            if (sys.__genMode === '非同期モード') {
                throw new Error('非同期モードでは「ナデシコ」は利用できません。');
            }
            sys.__varslist[0]['表示ログ'] = '';
            sys.__self.runEx(code, sys.__modName, { resetEnv: false, resetLog: true });
            const out = sys.__varslist[0]['表示ログ'] + '';
            if (out) {
                sys.logger.trace(out);
            }
            return out;
        }
    },
    'ナデシコ続': {
        type: 'func',
        josi: [['を', 'で']],
        fn: function (code, sys) {
            if (sys.__genMode === '非同期モード') {
                throw new Error('非同期モードでは「ナデシコ続」は利用できません。');
            }
            sys.__self.runEx(code, sys.__modName, { resetEnv: false, resetAll: false });
            const out = sys.__varslist[0]['表示ログ'] + '';
            if (out) {
                sys.logger.trace(out);
            }
            return out;
        }
    },
    '実行': {
        type: 'func',
        josi: [['を', 'に', 'で']],
        pure: false,
        fn: function (f, sys) {
            // #938 の規則に従って処理
            // 引数が関数なら実行
            if (typeof f === 'function') {
                return f(sys);
            }
            // 文字列なら関数に変換できるか判定して実行
            if (typeof f === 'string') {
                const tf = sys.__findFunc(f, '実行');
                if (typeof tf === 'function') {
                    return tf(sys);
                }
            }
            // それ以外ならそのまま値を返す
            return f;
        }
    },
    '実行時間計測': {
        type: 'func',
        josi: [['の']],
        pure: false,
        fn: function (f, sys) {
            if (typeof f === 'string') {
                f = sys.__findFunc(f, '実行時間計測');
            }
            //
            if (performance && performance.now) {
                const t1 = performance.now();
                f(sys);
                const t2 = performance.now();
                return (t2 - t1);
            }
            else {
                const t1 = Date.now();
                f(sys);
                const t2 = Date.now();
                return (t2 - t1);
            }
        }
    },
    '終': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            // デバッグモードでなければ例外を投げることでプログラムを終了させる
            sys.__v0.forceClose = true;
            if (!sys.__v0.useDebug) {
                throw new Error('__終わる__');
            }
        }
    },
    // @型変換
    '変数型確認': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            return (typeof v);
        }
    },
    'TYPEOF': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            return (typeof v);
        }
    },
    '文字列変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return String(v);
        }
    },
    'TOSTR': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return String(v);
        }
    },
    '整数変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return parseInt(v);
        }
    },
    'TOINT': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return parseInt(v);
        }
    },
    '実数変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return parseFloat(v);
        }
    },
    'TOFLOAT': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return parseFloat(v);
        }
    },
    'INT': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            return parseInt(v);
        }
    },
    'FLOAT': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            return parseFloat(v);
        }
    },
    'NAN判定': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            return isNaN(v);
        }
    },
    '非数判定': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (v) {
            // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN
            return Number.isNaN(v);
        }
    },
    'HEX': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            return parseInt(a).toString(16);
        }
    },
    '進数変換': {
        type: 'func',
        josi: [['を', 'の'], ['']],
        pure: true,
        fn: function (v, n) {
            return parseInt(v).toString(n);
        }
    },
    '二進': {
        type: 'func',
        josi: [['を', 'の', 'から']],
        pure: true,
        fn: function (v) {
            return parseInt(v).toString(2);
        }
    },
    '二進表示': {
        type: 'func',
        josi: [['を', 'の', 'から']],
        pure: true,
        fn: function (v, sys) {
            const s = parseInt(v).toString(2);
            sys.__exec('表示', [s, sys]);
        }
    },
    'RGB': {
        type: 'func',
        josi: [['と'], ['の'], ['で']],
        pure: true,
        fn: function (r, g, b) {
            const z2 = (v) => {
                const v2 = '00' + (parseInt('' + v).toString(16));
                return v2.substring(v2.length - 2, v2.length);
            };
            return '#' + z2(r) + z2(g) + z2(b);
        }
    },
    // @論理演算
    '論理OR': {
        type: 'func',
        josi: [['と'], ['の']],
        pure: true,
        fn: function (a, b) {
            return (a || b);
        }
    },
    '論理AND': {
        type: 'func',
        josi: [['と'], ['の']],
        pure: true,
        fn: function (a, b) {
            return (a && b);
        }
    },
    '論理NOT': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            return (!v) ? 1 : 0;
        }
    },
    // @ビット演算
    'OR': {
        type: 'func',
        josi: [['と'], ['の']],
        pure: true,
        fn: function (a, b) {
            return (a | b);
        }
    },
    'AND': {
        type: 'func',
        josi: [['と'], ['の']],
        pure: true,
        fn: function (a, b) {
            return (a & b);
        }
    },
    'XOR': {
        type: 'func',
        josi: [['と'], ['の']],
        pure: true,
        fn: function (a, b) {
            return (a ^ b);
        }
    },
    'NOT': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            return (~v);
        }
    },
    'SHIFT_L': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (a, b) {
            return (a << b);
        }
    },
    'SHIFT_R': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (a, b) {
            return (a >> b);
        }
    },
    'SHIFT_UR': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (a, b) {
            return (a >>> b);
        }
    },
    // @文字列処理
    '文字数': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            if (!Array.from) {
                return String(v).length;
            }
            return Array.from(v).length;
        }
    },
    '何文字目': {
        type: 'func',
        josi: [['で', 'の'], ['が']],
        pure: true,
        fn: function (s, a) {
            return String(s).indexOf(a) + 1;
        }
    },
    'CHR': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            if (!String.fromCodePoint) {
                return String.fromCharCode(v);
            }
            return String.fromCodePoint(v);
        }
    },
    'ASC': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (v) {
            if (!String.prototype.codePointAt) {
                return String(v).charCodeAt(0);
            }
            return String(v).codePointAt(0);
        }
    },
    '文字挿入': {
        type: 'func',
        josi: [['で', 'の'], ['に', 'へ'], ['を']],
        pure: true,
        fn: function (s, i, a) {
            if (i <= 0) {
                i = 1;
            }
            const ss = String(s);
            const mae = ss.substring(0, i - 1);
            const usi = ss.substring(i - 1);
            return mae + a + usi;
        }
    },
    '文字検索': {
        type: 'func',
        josi: [['で', 'の'], ['から'], ['を']],
        pure: true,
        fn: function (s, a, b) {
            let str = String(s);
            str = str.substring(a);
            const res = str.indexOf(b);
            if (res === -1) {
                return 0;
            }
            return res + 1 + a;
        }
    },
    '追加': {
        type: 'func',
        josi: [['で', 'に', 'へ'], ['を']],
        pure: true,
        fn: function (s, a) {
            if (s instanceof Array) {
                s.push(a);
                return s;
            }
            return String(s) + String(a);
        }
    },
    '一行追加': {
        type: 'func',
        josi: [['で', 'に', 'へ'], ['を']],
        pure: true,
        fn: function (s, a) {
            if (s instanceof Array) {
                s.push(a);
                return s;
            }
            return String(s) + String(a) + '\n';
        }
    },
    '文字列分解': {
        type: 'func',
        josi: [['を', 'の', 'で']],
        pure: true,
        fn: function (v) {
            if (!Array.from) {
                return String(v).split('');
            }
            return Array.from(v);
        }
    },
    'リフレイン': {
        type: 'func',
        josi: [['を', 'の'], ['で']],
        pure: true,
        fn: function (v, cnt) {
            let s = '';
            for (let i = 0; i < cnt; i++) {
                s += String(v);
            }
            return s;
        }
    },
    '出現回数': {
        type: 'func',
        josi: [['で'], ['の']],
        pure: true,
        fn: function (s, a) {
            s = '' + s;
            a = '' + a;
            return s.split(a).length - 1;
        }
    },
    'MID': {
        type: 'func',
        josi: [['で', 'の'], ['から'], ['を']],
        pure: true,
        fn: function (s, a, cnt) {
            cnt = cnt || 1;
            return (String(s).substring(a - 1, a + cnt - 1));
        }
    },
    '文字抜出': {
        type: 'func',
        josi: [['で', 'の'], ['から'], ['を', '']],
        pure: true,
        fn: function (s, a, cnt) {
            cnt = cnt || 1;
            return (String(s).substring(a - 1, a + cnt - 1));
        }
    },
    'LEFT': {
        type: 'func',
        josi: [['の', 'で'], ['だけ']],
        pure: true,
        fn: function (s, cnt) {
            return (String(s).substring(0, cnt));
        }
    },
    '文字左部分': {
        type: 'func',
        josi: [['の', 'で'], ['だけ', '']],
        pure: true,
        fn: function (s, cnt) {
            return (String(s).substring(0, cnt));
        }
    },
    'RIGHT': {
        type: 'func',
        josi: [['の', 'で'], ['だけ']],
        pure: true,
        fn: function (s, cnt) {
            s = '' + s;
            return (s.substring(s.length - cnt, s.length));
        }
    },
    '文字右部分': {
        type: 'func',
        josi: [['の', 'で'], ['だけ', '']],
        pure: true,
        fn: function (s, cnt) {
            s = '' + s;
            return (s.substring(s.length - cnt, s.length));
        }
    },
    '区切': {
        type: 'func',
        josi: [['の', 'を'], ['で']],
        pure: true,
        fn: function (s, a) {
            return ('' + s).split('' + a);
        }
    },
    '文字列分割': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (s, a) {
            s = '' + s;
            a = '' + a;
            const i = s.indexOf(a);
            if (i < 0) {
                return [s];
            }
            return [s.substring(0, i), s.substring(i + a.length)];
        }
    },
    '切取': {
        type: 'func',
        josi: [['から', 'の'], ['まで', 'を']],
        pure: true,
        fn: function (s, a, sys) {
            s = String(s);
            const i = s.indexOf(a);
            if (i < 0) {
                sys.__v0['対象'] = '';
                return s;
            }
            sys.__v0['対象'] = s.substring(i + a.length);
            return s.substring(0, i);
        }
    },
    '文字削除': {
        type: 'func',
        josi: [['の'], ['から'], ['だけ', 'を', '']],
        pure: true,
        fn: function (s, a, b) {
            s = '' + s;
            const mae = s.substring(0, a - 1);
            const usi = s.substring((a - 1 + b));
            return mae + usi;
        }
    },
    // @置換・トリム
    '置換': {
        type: 'func',
        josi: [['の', 'で'], ['を', 'から'], ['に', 'へ']],
        pure: true,
        fn: function (s, a, b) {
            return String(s).split(a).join(b);
        }
    },
    '単置換': {
        type: 'func',
        josi: [['の', 'で'], ['を'], ['に', 'へ']],
        pure: true,
        fn: function (s, a, b) {
            // replaceは最初の一度だけ置換する
            return String(s).replace(a, b);
        }
    },
    'トリム': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            s = String(s).replace(/^\s+/, '').replace(/\s+$/, '');
            return s;
        }
    },
    '空白除去': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            s = String(s).replace(/^\s+/, '').replace(/\s+$/, '');
            return s;
        }
    },
    // @文字変換
    '大文字変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            return String(s).toUpperCase();
        }
    },
    '小文字変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            return String(s).toLowerCase();
        }
    },
    '平仮名変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            const kanaToHira = (str) => {
                return String(str).replace(/[\u30a1-\u30f6]/g, function (m) {
                    const chr = m.charCodeAt(0) - 0x60;
                    return String.fromCharCode(chr);
                });
            };
            return kanaToHira('' + s);
        }
    },
    'カタカナ変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            const hiraToKana = (str) => {
                return String(str).replace(/[\u3041-\u3096]/g, function (m) {
                    const chr = m.charCodeAt(0) + 0x60;
                    return String.fromCharCode(chr);
                });
            };
            return hiraToKana('' + s);
        }
    },
    '英数全角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            return String(s).replace(/[A-Za-z0-9]/g, function (v) {
                return String.fromCharCode(v.charCodeAt(0) + 0xFEE0);
            });
        }
    },
    '英数半角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            return String(s).replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (v) {
                return String.fromCharCode(v.charCodeAt(0) - 0xFEE0);
            });
        }
    },
    '英数記号全角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            return String(s).replace(/[\x20-\x7F]/g, function (v) {
                return String.fromCharCode(v.charCodeAt(0) + 0xFEE0);
            });
        }
    },
    '英数記号半角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s) {
            return String(s).replace(/[\uFF00-\uFF5F]/g, function (v) {
                return String.fromCharCode(v.charCodeAt(0) - 0xFEE0);
            });
        }
    },
    'カタカナ全角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s, sys) {
            // 半角カタカナ
            const zen1 = sys.__v0['全角カナ一覧'];
            const han1 = sys.__v0['半角カナ一覧'];
            const zen2 = sys.__v0['全角カナ濁音一覧'];
            const han2 = sys.__v0['半角カナ濁音一覧'];
            let str = '';
            let i = 0;
            while (i < s.length) {
                // 濁点の変換
                const c2 = s.substring(i, i + 2);
                const n2 = han2.indexOf(c2);
                if (n2 >= 0) {
                    str += zen2.charAt(n2 / 2);
                    i += 2;
                    continue;
                }
                // 濁点以外の変換
                const c = s.charAt(i);
                const n = han1.indexOf(c);
                if (n >= 0) {
                    str += zen1.charAt(n);
                    i++;
                    continue;
                }
                str += c;
                i++;
            }
            return str;
        }
    },
    'カタカナ半角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (s, sys) {
            // 半角カタカナ
            const zen1 = sys.__v0['全角カナ一覧'];
            const han1 = sys.__v0['半角カナ一覧'];
            const zen2 = sys.__v0['全角カナ濁音一覧'];
            const han2 = sys.__v0['半角カナ濁音一覧'];
            return s.split('').map((c) => {
                const i = zen1.indexOf(c);
                if (i >= 0) {
                    return han1.charAt(i);
                }
                const j = zen2.indexOf(c);
                if (j >= 0) {
                    return han2.substring(j * 2, j * 2 + 2);
                }
                return c;
            }).join('');
        }
    },
    '全角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: false,
        fn: function (s, sys) {
            let result = s;
            result = sys.__exec('カタカナ全角変換', [result, sys]);
            result = sys.__exec('英数記号全角変換', [result, sys]);
            return result;
        }
    },
    '半角変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: false,
        fn: function (s, sys) {
            let result = s;
            result = sys.__exec('カタカナ半角変換', [result, sys]);
            result = sys.__exec('英数記号半角変換', [result, sys]);
            return result;
        }
    },
    '全角カナ一覧': { type: 'const', value: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォャュョッ、。ー「」' },
    '全角カナ濁音一覧': { type: 'const', value: 'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ' },
    '半角カナ一覧': { type: 'const', value: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｬｭｮｯ､｡ｰ｢｣ﾞﾟ' },
    '半角カナ濁音一覧': { type: 'const', value: 'ｶﾞｷﾞｸﾞｹﾞｺﾞｻﾞｼﾞｽﾞｾﾞｿﾞﾀﾞﾁﾞﾂﾞﾃﾞﾄﾞﾊﾞﾋﾞﾌﾞﾍﾞﾎﾞﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ' },
    // @JSON
    'JSONエンコード': {
        type: 'func',
        josi: [['を', 'の']],
        pure: true,
        fn: function (v) {
            return JSON.stringify(v);
        }
    },
    'JSONエンコード整形': {
        type: 'func',
        josi: [['を', 'の']],
        pure: true,
        fn: function (v) {
            return JSON.stringify(v, null, 2);
        }
    },
    'JSONデコード': {
        type: 'func',
        josi: [['を', 'の', 'から']],
        pure: true,
        fn: function (s) {
            return JSON.parse(s);
        }
    },
    // @正規表現
    '正規表現マッチ': {
        type: 'func',
        josi: [['を', 'が'], ['で', 'に']],
        pure: true,
        fn: function (a, b, sys) {
            let re;
            const f = ('' + b).match(/^\/(.+)\/([a-zA-Z]*)$/);
            // パターンがない場合
            if (f === null) {
                re = new RegExp(b, 'g');
            }
            else {
                re = new RegExp(f[1], f[2]);
            }
            const sa = sys.__varslist[0]['抽出文字列'] = [];
            const m = String(a).match(re);
            let result = m;
            if (re.global) {
                // no groups
            }
            else if (m) {
                // has group?
                if (m.length > 0) {
                    result = m[0];
                    for (let i = 1; i < m.length; i++) {
                        sa[i - 1] = m[i];
                    }
                }
            }
            return result;
        }
    },
    '抽出文字列': { type: 'const', value: [] },
    '正規表現置換': {
        type: 'func',
        josi: [['の'], ['を', 'から'], ['で', 'に', 'へ']],
        pure: true,
        fn: function (s, a, b) {
            let re;
            const f = a.match(/^\/(.+)\/([a-zA-Z]*)/);
            if (f === null) {
                re = new RegExp(a, 'g');
            }
            else {
                re = new RegExp(f[1], f[2]);
            }
            return String(s).replace(re, b);
        }
    },
    '正規表現区切': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (s, a) {
            let re;
            const f = a.match(/^\/(.+)\/([a-zA-Z]*)/);
            if (f === null) {
                re = new RegExp(a, 'g');
            }
            else {
                re = new RegExp(f[1], f[2]);
            }
            return String(s).split(re);
        }
    },
    // @指定形式
    '通貨形式': {
        type: 'func',
        josi: [['を', 'の']],
        pure: true,
        fn: function (v) {
            return String(v).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
        }
    },
    'ゼロ埋': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (v, a) {
            v = String(v);
            let z = '0';
            for (let i = 0; i < a; i++) {
                z += '0';
            }
            a = parseInt(a);
            if (a < v.length) {
                a = v.length;
            }
            const s = z + String(v);
            return s.substring(s.length - a, s.length);
        }
    },
    '空白埋': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (v, a) {
            v = String(v);
            let z = ' ';
            for (let i = 0; i < a; i++) {
                z += ' ';
            }
            a = parseInt(a);
            if (a < v.length) {
                a = v.length;
            }
            const s = z + String(v);
            return s.substring(s.length - a, s.length);
        }
    },
    // @文字種類
    'かなか判定': {
        type: 'func',
        josi: [['を', 'の', 'が']],
        pure: true,
        fn: function (s) {
            const c = String(s).charCodeAt(0);
            return (c >= 0x3041 && c <= 0x309F);
        }
    },
    'カタカナ判定': {
        type: 'func',
        josi: [['を', 'の', 'が']],
        pure: true,
        fn: function (s) {
            const c = String(s).charCodeAt(0);
            return (c >= 0x30A1 && c <= 0x30FA);
        }
    },
    '数字判定': {
        type: 'func',
        josi: [['を', 'が']],
        pure: true,
        fn: function (s) {
            const c = String(s).charAt(0);
            return ((c >= '0' && c <= '9') || (c >= '０' && c <= '９'));
        }
    },
    '数列判定': {
        type: 'func',
        josi: [['を', 'が']],
        pure: true,
        fn: function (s) {
            const checkerRE = /^[+\-＋－]?([0-9０-９]*)(([.．][0-9０-９]+)?|([.．][0-9０-９]+[eEｅＥ][+\-＋－]?[0-9０-９]+)?)$/;
            return String(s).match(checkerRE) !== null;
        }
    },
    // @配列操作
    '配列結合': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (a, s) {
            // 配列ならOK
            if (a instanceof Array) {
                return a.join('' + s);
            }
            const a2 = String(a).split('\n'); // 配列でなければ無理矢理改行で区切ってみる
            return a2.join('' + s);
        }
    },
    '配列検索': {
        type: 'func',
        josi: [['の', 'から'], ['を']],
        pure: true,
        fn: function (a, s) {
            if (a instanceof Array) {
                return a.indexOf(s);
            } // 配列ならOK
            return -1;
        }
    },
    '配列要素数': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            if (a instanceof Array) {
                return a.length;
            } // 配列ならOK
            if (a instanceof Object) {
                return Object.keys(a).length;
            } // オブジェクト
            if (typeof a === 'string') {
                return String(a).length;
            } // 文字列
            return 1;
        }
    },
    '要素数': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a, sys) {
            return sys.__exec('配列要素数', [a]);
        }
    },
    'LEN': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a, sys) {
            return sys.__exec('配列要素数', [a]);
        }
    },
    '配列挿入': {
        type: 'func',
        josi: [['の'], ['に', 'へ'], ['を']],
        pure: true,
        fn: function (a, i, s) {
            if (a instanceof Array) {
                return a.splice(i, 0, s);
            } // 配列ならOK
            throw new Error('『配列挿入』で配列以外の要素への挿入。');
        }
    },
    '配列一括挿入': {
        type: 'func',
        josi: [['の'], ['に', 'へ'], ['を']],
        pure: true,
        fn: function (a, i, b) {
            if (a instanceof Array && b instanceof Array) { // 配列ならOK
                for (let j = 0; j < b.length; j++) {
                    a.splice(i + j, 0, b[j]);
                }
                return a;
            }
            throw new Error('『配列一括挿入』で配列以外の要素への挿入。');
        }
    },
    '配列ソート': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (a) {
            if (a instanceof Array) {
                return a.sort();
            } // 配列ならOK
            throw new Error('『配列ソート』で配列以外が指定されました。');
        }
    },
    '配列数値変換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (a) {
            // 配列ならOK
            if (a instanceof Array) {
                for (let i = 0; i < a.length; i++) {
                    a[i] = parseFloat(a[i]);
                }
                return a;
            }
            throw new Error('『配列数値変換』で配列以外が指定されました。');
        }
    },
    '配列数値ソート': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (a) {
            // 配列ならOK
            if (a instanceof Array) {
                return a.sort((a, b) => {
                    return parseFloat(a) - parseFloat(b);
                });
            }
            throw new Error('『配列数値ソート』で配列以外が指定されました。');
        }
    },
    '配列カスタムソート': {
        type: 'func',
        josi: [['で'], ['の', 'を']],
        pure: false,
        fn: function (f, a, sys) {
            let ufunc = f;
            if (typeof f === 'string') {
                ufunc = sys.__findFunc(f, '配列カスタムソート');
            }
            if (a instanceof Array) {
                return a.sort(ufunc);
            }
            throw new Error('『配列カスタムソート』で配列以外が指定されました。');
        }
    },
    '配列逆順': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (a) {
            if (a instanceof Array) {
                return a.reverse();
            } // 配列ならOK
            throw new Error('『配列ソート』で配列以外が指定されました。');
        }
    },
    '配列シャッフル': {
        type: 'func',
        josi: [['の', 'を']],
        pure: true,
        fn: function (a) {
            if (a instanceof Array) { // 配列ならOK
                for (let i = a.length - 1; i > 0; i--) {
                    const r = Math.floor(Math.random() * (i + 1));
                    const tmp = a[i];
                    a[i] = a[r];
                    a[r] = tmp;
                }
                return a;
            }
            throw new Error('『配列シャッフル』で配列以外が指定されました。');
        }
    },
    '配列削除': {
        type: 'func',
        josi: [['の', 'から'], ['を']],
        pure: false,
        fn: function (a, i, sys) {
            return sys.__exec('配列切取', [a, i, sys]);
        }
    },
    '配列切取': {
        type: 'func',
        josi: [['の', 'から'], ['を']],
        pure: true,
        fn: function (a, i) {
            // 配列変数のとき
            if (a instanceof Array) {
                const b = a.splice(i, 1);
                if (b instanceof Array) {
                    return b[0];
                } // 切り取った戻り値は必ずArrayになるので。
                return null;
            }
            // 辞書型変数のとき
            if (a instanceof Object && typeof (i) === 'string') { // 辞書型変数も許容
                if (a[i]) {
                    const old = a[i];
                    delete a[i];
                    return old;
                }
                return undefined;
            }
            throw new Error('『配列切取』で配列以外を指定。');
        }
    },
    '配列取出': {
        type: 'func',
        josi: [['の'], ['から'], ['を']],
        pure: true,
        fn: function (a, i, cnt) {
            if (a instanceof Array) {
                return a.splice(i, cnt);
            }
            throw new Error('『配列取出』で配列以外を指定。');
        }
    },
    '配列ポップ': {
        type: 'func',
        josi: [['の', 'から']],
        pure: true,
        fn: function (a) {
            if (a instanceof Array) {
                return a.pop();
            }
            throw new Error('『配列ポップ』で配列以外の処理。');
        }
    },
    '配列プッシュ': {
        type: 'func',
        josi: [['に', 'へ'], ['を']],
        pure: true,
        fn: function (a, b, sys) {
            return sys.__exec('配列追加', [a, b, sys]);
        }
    },
    '配列追加': {
        type: 'func',
        josi: [['に', 'へ'], ['を']],
        pure: true,
        fn: function (a, b) {
            if (a instanceof Array) { // 配列ならOK
                a.push(b);
                return a;
            }
            throw new Error('『配列追加』で配列以外の処理。');
        }
    },
    '配列複製': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (a) {
            return JSON.parse(JSON.stringify(a));
        }
    },
    '配列足': {
        type: 'func',
        josi: [['に', 'へ', 'と'], ['を']],
        pure: true,
        fn: function (a, b) {
            if (a instanceof Array) {
                return a.concat(b);
            }
            return JSON.parse(JSON.stringify(a));
        }
    },
    '配列最大値': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            return a.reduce((x, y) => Math.max(x, y));
        }
    },
    '配列最小値': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            return a.reduce((x, y) => Math.min(x, y));
        }
    },
    '配列合計': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            if (a instanceof Array) {
                let v = 0;
                a.forEach((n) => {
                    const nn = parseFloat(n);
                    if (isNaN(nn)) {
                        return;
                    }
                    v += nn;
                });
                return v;
            }
            throw new Error('『配列合計』で配列変数以外の値が指定されました。');
        }
    },
    '配列入替': {
        type: 'func',
        josi: [['の'], ['と'], ['を']],
        pure: true,
        fn: function (a, i, j) {
            if (!(a instanceof Array)) {
                throw new Error('『配列入替』の第1引数には配列を指定してください。');
            }
            const tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
            return a;
        }
    },
    '配列連番作成': {
        type: 'func',
        josi: [['から'], ['までの', 'まで', 'の']],
        pure: true,
        fn: function (a, b) {
            const result = [];
            for (let i = a; i <= b; i++) {
                result.push(i);
            }
            return result;
        }
    },
    '配列要素作成': {
        type: 'func',
        josi: [['を'], ['だけ']],
        pure: true,
        fn: function (a, b) {
            const result = [];
            for (let i = 0; i < b; i++) {
                result.push(a);
            }
            return result;
        }
    },
    '配列関数適用': {
        type: 'func',
        josi: [['を'], ['へ', 'に']],
        pure: true,
        fn: function (f, a, sys) {
            let ufunc = f;
            if (typeof f === 'string') {
                ufunc = sys.__findFunc(f, '配列関数適用');
            }
            const result = [];
            for (const e of a) {
                result.push(ufunc(e));
            }
            return result;
        }
    },
    '配列マップ': {
        type: 'func',
        josi: [['を'], ['へ', 'に']],
        pure: true,
        fn: function (f, a, sys) {
            return sys.__exec('配列関数適用', [f, a, sys]);
        }
    },
    '配列フィルタ': {
        type: 'func',
        josi: [['で', 'の'], ['を', 'について']],
        pure: true,
        fn: function (f, a, sys) {
            let ufunc = f;
            if (typeof f === 'string') {
                ufunc = sys.__findFunc(f, '配列フィルタ');
            }
            const result = [];
            for (const e of a) {
                if (ufunc(e)) {
                    result.push(e);
                }
            }
            return result;
        }
    },
    // @二次元配列処理
    '表ソート': {
        type: 'func',
        josi: [['の'], ['を']],
        pure: true,
        fn: function (a, no) {
            if (!(a instanceof Array)) {
                throw new Error('『表ソート』には配列を指定する必要があります。');
            }
            a.sort((n, m) => {
                const ns = n[no];
                const ms = m[no];
                if (ns === ms) {
                    return 0;
                }
                else if (ns < ms) {
                    return -1;
                }
                else {
                    return 1;
                }
            });
            return a;
        }
    },
    '表数値ソート': {
        type: 'func',
        josi: [['の'], ['を']],
        pure: true,
        fn: function (a, no) {
            if (!(a instanceof Array)) {
                throw new Error('『表数値ソート』には配列を指定する必要があります。');
            }
            a.sort((n, m) => {
                const ns = n[no];
                const ms = m[no];
                return ns - ms;
            });
            return a;
        }
    },
    '表ピックアップ': {
        type: 'func',
        josi: [['の'], ['から'], ['を', 'で']],
        pure: true,
        fn: function (a, no, s) {
            if (!(a instanceof Array)) {
                throw new Error('『表ピックアップ』には配列を指定する必要があります。');
            }
            return a.filter((row) => String(row[no]).indexOf(s) >= 0);
        }
    },
    '表完全一致ピックアップ': {
        type: 'func',
        josi: [['の'], ['から'], ['を', 'で']],
        pure: true,
        fn: function (a, no, s) {
            if (!(a instanceof Array)) {
                throw new Error('『表完全ピックアップ』には配列を指定する必要があります。');
            }
            return a.filter((row) => row[no] === s);
        }
    },
    '表検索': {
        type: 'func',
        josi: [['の'], ['で', 'に'], ['から'], ['を']],
        pure: true,
        fn: function (a, col, row, s) {
            if (!(a instanceof Array)) {
                throw new Error('『表検索』には配列を指定する必要があります。');
            }
            for (let i = row; i < a.length; i++) {
                if (a[i][col] === s) {
                    return i;
                }
            }
            return -1;
        }
    },
    '表列数': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            if (!(a instanceof Array)) {
                throw new Error('『表列数』には配列を指定する必要があります。');
            }
            let cols = 1;
            for (let i = 0; i < a.length; i++) {
                if (a[i].length > cols) {
                    cols = a[i].length;
                }
            }
            return cols;
        }
    },
    '表行数': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            if (!(a instanceof Array)) {
                throw new Error('『表行数』には配列を指定する必要があります。');
            }
            return a.length;
        }
    },
    '表行列交換': {
        type: 'func',
        josi: [['の', 'を']],
        pure: false,
        fn: function (a, sys) {
            if (!(a instanceof Array)) {
                throw new Error('『表行列交換』には配列を指定する必要があります。');
            }
            const cols = sys.__exec('表列数', [a]);
            const rows = a.length;
            const res = [];
            for (let r = 0; r < cols; r++) {
                const row = [];
                res.push(row);
                for (let c = 0; c < rows; c++) {
                    row[c] = (a[c][r] !== undefined) ? a[c][r] : '';
                }
            }
            return res;
        }
    },
    '表右回転': {
        type: 'func',
        josi: [['の', 'を']],
        pure: false,
        fn: function (a, sys) {
            if (!(a instanceof Array)) {
                throw new Error('『表右回転』には配列を指定する必要があります。');
            }
            const cols = sys.__exec('表列数', [a]);
            const rows = a.length;
            const res = [];
            for (let r = 0; r < cols; r++) {
                const row = [];
                res.push(row);
                for (let c = 0; c < rows; c++) {
                    row[c] = a[rows - c - 1][r];
                }
            }
            return res;
        }
    },
    '表重複削除': {
        type: 'func',
        josi: [['の'], ['を', 'で']],
        pure: true,
        fn: function (a, i) {
            if (!(a instanceof Array)) {
                throw new Error('『表重複削除』には配列を指定する必要があります。');
            }
            const res = [];
            const keys = {};
            for (let n = 0; n < a.length; n++) {
                const k = a[n][i];
                if (undefined === keys[k]) {
                    keys[k] = true;
                    res.push(a[n]);
                }
            }
            return res;
        }
    },
    '表列取得': {
        type: 'func',
        josi: [['の'], ['を']],
        pure: true,
        fn: function (a, i) {
            if (!(a instanceof Array)) {
                throw new Error('『表列取得』には配列を指定する必要があります。');
            }
            const res = a.map(row => row[i]);
            return res;
        }
    },
    '表列挿入': {
        type: 'func',
        josi: [['の'], ['に', 'へ'], ['を']],
        pure: true,
        fn: function (a, i, s) {
            if (!(a instanceof Array)) {
                throw new Error('『表列挿入』には配列を指定する必要があります。');
            }
            const res = [];
            a.forEach((row, idx) => {
                let nr = [];
                if (i > 0) {
                    nr = nr.concat(row.slice(0, i));
                }
                nr.push(s[idx]);
                nr = nr.concat(row.slice(i));
                res.push(nr);
            });
            return res;
        }
    },
    '表列削除': {
        type: 'func',
        josi: [['の'], ['を']],
        pure: true,
        fn: function (a, i) {
            if (!(a instanceof Array)) {
                throw new Error('『表列削除』には配列を指定する必要があります。');
            }
            const res = [];
            a.forEach((row) => {
                const nr = row.slice(0);
                nr.splice(i, 1);
                res.push(nr);
            });
            return res;
        }
    },
    '表列合計': {
        type: 'func',
        josi: [['の'], ['を', 'で']],
        pure: true,
        fn: function (a, i) {
            if (!(a instanceof Array)) {
                throw new Error('『表列合計』には配列を指定する必要があります。');
            }
            let sum = 0;
            a.forEach((row) => { sum += row[i]; });
            return sum;
        }
    },
    '表曖昧検索': {
        type: 'func',
        josi: [['の'], ['から'], ['で'], ['を']],
        pure: true,
        fn: function (a, row, col, s) {
            if (!(a instanceof Array)) {
                throw new Error('『表曖昧検索』には配列を指定する必要があります。');
            }
            const re = new RegExp(s);
            for (let i = row; i < a.length; i++) {
                const line = a[i];
                if (re.test(line[col])) {
                    return i;
                }
            }
            return -1;
        }
    },
    '表正規表現ピックアップ': {
        type: 'func',
        josi: [['の', 'で'], ['から'], ['を']],
        pure: true,
        fn: function (a, col, s) {
            if (!(a instanceof Array)) {
                throw new Error('『表正規表現ピックアップ』には配列を指定する必要があります。');
            }
            const re = new RegExp(s);
            const res = [];
            for (let i = 0; i < a.length; i++) {
                const row = a[i];
                if (re.test(row[col])) {
                    res.push(row.slice(0));
                }
            }
            return res;
        }
    },
    // @辞書型変数の操作
    '辞書キー列挙': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            const keys = [];
            if (a instanceof Object) { // オブジェクトのキーを返す
                for (const key in a) {
                    keys.push(key);
                }
                return keys;
            }
            if (a instanceof Array) { // 配列なら数字を返す
                for (let i = 0; i < a.length; i++) {
                    keys.push(i);
                }
                return keys;
            }
            throw new Error('『辞書キー列挙』でハッシュ以外が与えられました。');
        }
    },
    '辞書キー削除': {
        type: 'func',
        josi: [['から', 'の'], ['を']],
        pure: true,
        fn: function (a, key) {
            if (a instanceof Object) { // オブジェクトのキーを返す
                if (key in a) {
                    delete a[key];
                }
                return a;
            }
            throw new Error('『辞書キー削除』でハッシュ以外が与えられました。');
        }
    },
    '辞書キー存在': {
        type: 'func',
        josi: [['の', 'に'], ['が']],
        pure: true,
        fn: function (a, key) {
            return key in a;
        }
    },
    // @ハッシュ
    'ハッシュキー列挙': {
        type: 'func',
        josi: [['の']],
        pure: false,
        fn: function (a, sys) {
            return sys.__exec('辞書キー列挙', [a, sys]);
        }
    },
    'ハッシュ内容列挙': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (a) {
            const body = [];
            if (a instanceof Object) { // オブジェクトのキーを返す
                for (const key in a) {
                    body.push(a[key]);
                }
                return body;
            }
            throw new Error('『ハッシュ内容列挙』でハッシュ以外が与えられました。');
        }
    },
    'ハッシュキー削除': {
        type: 'func',
        josi: [['から', 'の'], ['を']],
        pure: false,
        fn: function (a, key, sys) {
            return sys.__exec('辞書キー削除', [a, key, sys]);
        }
    },
    'ハッシュキー存在': {
        type: 'func',
        josi: [['の', 'に'], ['が']],
        pure: true,
        fn: function (a, key) {
            return key in a;
        }
    },
    // @タイマー
    '秒待': {
        type: 'func',
        josi: [['']],
        pure: true,
        asyncFn: true,
        fn: function (n, sys) {
            return new Promise((resolve, reject) => {
                try {
                    // タイマーを仕掛ける
                    const timerId = setTimeout(() => {
                        // タイマー使用中リストに追加したIDを削除
                        const i = sys.__timeout.indexOf(timerId);
                        if (i >= 0) {
                            sys.__timeout.splice(i, 1);
                        }
                        // Promiseを終了
                        resolve();
                    }, parseFloat(n) * 1000);
                    // タイマー使用中リストに追加
                    sys.__timeout.push(timerId);
                }
                catch (err) {
                    reject(err);
                }
            });
        },
        return_none: true
    },
    '秒待機': {
        type: 'func',
        josi: [['']],
        pure: true,
        asyncFn: true,
        fn: async function (n, sys) {
            const p = sys.__exec('秒待', [n, sys]);
            return await p;
        },
        return_none: true
    },
    '秒逐次待機': {
        type: 'func',
        josi: [['']],
        pure: true,
        asyncFn: true,
        fn: async function (n, sys) {
            const p = sys.__exec('秒待', [n, sys]);
            return await p;
        },
        return_none: true
    },
    '秒後': {
        type: 'func',
        josi: [['を'], ['']],
        pure: true,
        fn: function (f, n, sys) {
            // 文字列で指定された関数をオブジェクトに変換
            if (typeof f === 'string') {
                f = sys.__findFunc(f, '秒後');
            }
            // 1回限りのタイマーをセット
            const timerId = setTimeout(() => {
                // 使用中リストに追加したIDを削除
                const i = sys.__timeout.indexOf(timerId);
                if (i >= 0) {
                    sys.__timeout.splice(i, 1);
                }
                if (sys.__genMode === '非同期モード') {
                    sys.newenv = true;
                }
                try {
                    f(timerId, sys);
                }
                catch (e) {
                    let err = e;
                    if (!(e instanceof NakoRuntimeError)) {
                        err = new NakoRuntimeError(e, sys.__varslist[0].line);
                    }
                    sys.logger.error(err);
                }
            }, parseFloat(n) * 1000);
            sys.__timeout.unshift(timerId);
            sys.__v0['対象'] = timerId;
            return timerId;
        }
    },
    '秒毎': {
        type: 'func',
        josi: [['を'], ['']],
        pure: false,
        fn: function (f, n, sys) {
            // 文字列で指定された関数をオブジェクトに変換
            if (typeof f === 'string') {
                f = sys.__findFunc(f, '秒毎');
            }
            // タイマーをセット
            const timerId = setInterval(() => {
                if (sys.__genMode === '非同期モード') {
                    sys.newenv = true;
                }
                f(timerId, sys);
            }, parseFloat(n) * 1000);
            // タイマーIDを追加
            sys.__interval.unshift(timerId);
            sys.__v0['対象'] = timerId;
            return timerId;
        }
    },
    '秒タイマー開始時': {
        type: 'func',
        josi: [['を'], ['']],
        pure: false,
        fn: function (f, n, sys) {
            return sys.__exec('秒毎', [f, n, sys]);
        }
    },
    'タイマー停止': {
        type: 'func',
        josi: [['の', 'で']],
        pure: true,
        fn: function (timerId, sys) {
            const i = sys.__interval.indexOf(timerId);
            if (i >= 0) {
                sys.__interval.splice(i, 1);
                clearInterval(timerId);
                return true;
            }
            const j = sys.__timeout.indexOf(timerId);
            if (j >= 0) {
                sys.__timeout.splice(j, 1);
                clearTimeout(timerId);
                return true;
            }
            return false;
        },
        return_none: false
    },
    '全タイマー停止': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            // clearInterval
            for (let i = 0; i < sys.__interval.length; i++) {
                const timerId = sys.__interval[i];
                clearInterval(timerId);
            }
            sys.__interval = [];
            // clearTimeout
            for (let i = 0; i < sys.__timeout.length; i++) {
                const timerId = sys.__timeout[i];
                clearTimeout(timerId);
            }
            sys.__timeout = [];
        },
        return_none: true
    },
    // @日時処理(簡易)
    '元号データ': { type: 'const', value: [{ '元号': '令和', '改元日': '2019/05/01' }, { '元号': '平成', '改元日': '1989/01/08' }, { '元号': '昭和', '改元日': '1926/12/25' }, { '元号': '大正', '改元日': '1912/07/30' }, { '元号': '明治', '改元日': '1868/10/23' }] },
    '今': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            const z2 = (n) => {
                n = '00' + n;
                return n.substring(n.length - 2, n.length);
            };
            const t = new Date();
            return z2(t.getHours()) + ':' + z2(t.getMinutes()) + ':' + z2(t.getSeconds());
        }
    },
    'システム時間': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            const now = new Date();
            return Math.floor(now.getTime() / 1000);
        }
    },
    'システム時間ミリ秒': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            const now = new Date();
            return now.getTime();
        }
    },
    '今日': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            return sys.__formatDate(new Date());
        }
    },
    '明日': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            const t = Date.now() + (24 * 60 * 60 * 1000);
            return sys.__formatDate(new Date(t));
        }
    },
    '昨日': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            const t = Date.now() - (24 * 60 * 60 * 1000);
            return sys.__formatDate(new Date(t));
        }
    },
    '今年': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return (new Date()).getFullYear();
        }
    },
    '来年': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return (new Date()).getFullYear() + 1;
        }
    },
    '去年': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return (new Date()).getFullYear() - 1;
        }
    },
    '今月': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return (new Date()).getMonth() + 1;
        }
    },
    '来月': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return (new Date()).getMonth() + 2;
        }
    },
    '先月': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            return (new Date()).getMonth();
        }
    },
    '曜日': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (s, sys) {
            const d = sys.__str2date(s);
            return '日月火水木金土'.charAt(d.getDay() % 7);
        }
    },
    '曜日番号取得': {
        type: 'func',
        josi: [['の']],
        pure: true,
        fn: function (s) {
            const a = s.split('/');
            const t = new Date(a[0], a[1] - 1, a[2]);
            return t.getDay();
        }
    },
    'UNIXTIME変換': {
        type: 'func',
        josi: [['の', 'を', 'から']],
        pure: true,
        fn: function (s, sys) {
            const d = sys.__str2date(s);
            return d.getTime() / 1000;
        }
    },
    'UNIX時間変換': {
        type: 'func',
        josi: [['の', 'を', 'から']],
        pure: true,
        fn: function (s, sys) {
            const d = sys.__str2date(s);
            return d.getTime() / 1000;
        }
    },
    '日時変換': {
        type: 'func',
        josi: [['を', 'から']],
        pure: true,
        fn: function (tm, sys) {
            const t = tm * 1000;
            return sys.__formatDateTime(new Date(t), '2022/01/01 00:00:00');
        }
    },
    '日時書式変換': {
        type: 'func',
        josi: [['を'], ['で']],
        pure: true,
        fn: function (tm, fmt, sys) {
            const t = sys.__str2date(tm);
            fmt = fmt.replace(/(YYYY|ccc|WWW|MMM|YY|MM|DD|HH|mm|ss|[MDHmsW])/g, (m) => {
                switch (m) {
                    case 'YYYY': return t.getFullYear();
                    case 'YY': return ('' + t.getFullYear()).substring(2);
                    case 'MM': return sys.__zero2(t.getMonth() + 1);
                    case 'DD': return sys.__zero2(t.getDate());
                    case 'M': return (t.getMonth() + 1);
                    case 'D': return (t.getDate());
                    case 'HH': return sys.__zero2(t.getHours());
                    case 'mm': return sys.__zero2(t.getMinutes());
                    case 'ss': return sys.__zero2(t.getSeconds());
                    case 'ccc': return sys.__zero(t.getMilliseconds(), 3);
                    case 'H': return (t.getHours());
                    case 'm': return (t.getMinutes());
                    case 's': return (t.getSeconds());
                    case 'W': return '日月火水木金土'.charAt(t.getDay() % 7);
                    case 'WWW': return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay() % 7];
                    case 'MMM': return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.getMonth()];
                }
                return m;
            });
            return fmt;
        }
    },
    '和暦変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (s, sys) {
            const d = sys.__str2date(s);
            const t = d.getTime();
            for (const era of sys.__v0['元号データ']) {
                const gengo = era['元号'];
                const d2 = sys.__str2date(era['改元日']);
                const t2 = d2.getTime();
                if (t2 <= t) {
                    let y = (d.getFullYear() - d2.getFullYear()) + 1;
                    if (y === 1) {
                        y = '元';
                    }
                    return gengo + y + '年' + sys.__zero2(d.getMonth() + 1) + '月' + sys.__zero2(d.getDate()) + '日';
                }
            }
            throw new Error('『和暦変換』は明示以前の日付には対応していません。');
        }
    },
    '年数差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの']],
        pure: true,
        fn: function (a, b, sys) {
            const t1 = sys.__str2date(a);
            const t2 = sys.__str2date(b);
            return (t2.getFullYear() - t1.getFullYear());
        }
    },
    '月数差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの']],
        pure: true,
        fn: function (a, b, sys) {
            const t1 = sys.__str2date(a);
            const t2 = sys.__str2date(b);
            return ((t2.getFullYear() * 12 + t2.getMonth()) -
                (t1.getFullYear() * 12 + t1.getMonth()));
        }
    },
    '日数差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの']],
        pure: true,
        fn: function (a, b, sys) {
            const t1 = Math.ceil(sys.__str2date(a).getTime() / 1000);
            const t2 = Math.ceil(sys.__str2date(b).getTime() / 1000);
            const days = Math.ceil((t2 - t1) / (60 * 60 * 24));
            return days;
        }
    },
    '時間差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの']],
        pure: true,
        fn: function (a, b, sys) {
            const t1 = Math.ceil(sys.__str2date(a).getTime() / 1000);
            const t2 = Math.ceil(sys.__str2date(b).getTime() / 1000);
            const hours = Math.ceil((t2 - t1) / (60 * 60));
            return hours;
        }
    },
    '分差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの']],
        pure: true,
        fn: function (a, b, sys) {
            const t1 = Math.ceil(sys.__str2date(a).getTime() / 1000);
            const t2 = Math.ceil(sys.__str2date(b).getTime() / 1000);
            const min = Math.ceil((t2 - t1) / (60));
            return min;
        }
    },
    '秒差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの']],
        pure: true,
        fn: function (a, b, sys) {
            const t1 = Math.ceil(sys.__str2date(a).getTime() / 1000);
            const t2 = Math.ceil(sys.__str2date(b).getTime() / 1000);
            const sec = Math.ceil((t2 - t1));
            return sec;
        }
    },
    '日時差': {
        type: 'func',
        josi: [['と', 'から'], ['の', 'までの'], ['による']],
        pure: true,
        fn: function (a, b, unit, sys) {
            switch (unit) {
                case '年': return sys.__exec('年数差', [a, b, sys]);
                case '月': return sys.__exec('月数差', [a, b, sys]);
                case '日': return sys.__exec('日数差', [a, b, sys]);
                case '時間': return sys.__exec('時間差', [a, b, sys]);
                case '分': return sys.__exec('分差', [a, b, sys]);
                case '秒': return sys.__exec('秒差', [a, b, sys]);
            }
            throw new Error('『日時差』で不明な単位です。');
        }
    },
    '時間加算': {
        type: 'func',
        josi: [['に'], ['を']],
        pure: true,
        fn: function (s, a, sys) {
            const op = a.charAt(0);
            if (op === '-' || op === '+') {
                a = a.substring(1);
            }
            const d = sys.__str2date(s);
            const aa = (a + ':0:0').split(':');
            let sec = parseInt(aa[0]) * 60 * 60 +
                parseInt(aa[1]) * 60 +
                parseInt(aa[2]);
            if (op === '-') {
                sec *= -1;
            }
            const rd = new Date(d.getTime() + (sec * 1000));
            return sys.__formatDateTime(rd, s);
        }
    },
    '日付加算': {
        type: 'func',
        josi: [['に'], ['を']],
        pure: true,
        fn: function (s, a, sys) {
            let op = 1;
            const opc = a.charAt(0);
            if (opc === '-' || opc === '+') {
                a = a.substring(1);
                if (opc === '-') {
                    op *= -1;
                }
            }
            const d = sys.__str2date(s);
            const aa = (a + '/0/0').split('/');
            const addY = parseInt(aa[0]) * op;
            const addM = parseInt(aa[1]) * op;
            const addD = parseInt(aa[2]) * op;
            d.setFullYear(d.getFullYear() + addY);
            d.setMonth(d.getMonth() + addM);
            d.setDate(d.getDate() + addD);
            return sys.__formatDateTime(d, s);
        }
    },
    '日時加算': {
        type: 'func',
        josi: [['に'], ['を']],
        pure: true,
        fn: function (s, a, sys) {
            const r = ('' + a).match(/([+|-]?)(\d+)(年|ヶ月|日|週間|時間|分|秒)$/);
            if (!r) {
                throw new Error('『日付加算』は『(+｜-)1(年|ヶ月|日|時間|分|秒)』の書式で指定します。');
            }
            switch (r[3]) {
                case '年': return sys.__exec('日付加算', [s, `${r[1]}${r[2]}/0/0`, sys]);
                case 'ヶ月': return sys.__exec('日付加算', [s, `${r[1]}0/${r[2]}/0`, sys]);
                case '週間': return sys.__exec('日付加算', [s, `${r[1]}0/0/${parseInt(r[2]) * 7}`, sys]);
                case '日': return sys.__exec('日付加算', [s, `${r[1]}0/0/${r[2]}`, sys]);
                case '時間': return sys.__exec('時間加算', [s, `${r[1]}${r[2]}:0:0`, sys]);
                case '分': return sys.__exec('時間加算', [s, `${r[1]}0:${r[2]}:0`, sys]);
                case '秒': return sys.__exec('時間加算', [s, `${r[1]}0:0:${r[2]}`, sys]);
            }
        }
    },
    '時間ミリ秒取得': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            if (performance && performance.now) {
                return performance.now();
            }
            else if (Date.now) {
                return Date.now();
            }
            else {
                const now = new Date();
                return now.getTime();
            }
        }
    },
    // @デバッグ支援
    'エラー発生': {
        type: 'func',
        josi: [['の', 'で']],
        pure: true,
        fn: function (s) {
            throw new Error(s);
        }
    },
    '__DEBUG': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            sys.isDebug = true;
            console.log(sys);
        }
    },
    '__DEBUG強制待機': { type: 'const', value: 0 },
    '__DEBUGブレイクポイント一覧': { type: 'const', value: [] },
    '__DEBUG待機フラグ': { type: 'const', value: 0 },
    '__DEBUG_BP_WAIT': {
        type: 'func',
        josi: [['で']],
        pure: true,
        asyncFn: true,
        fn: function (curLine, sys) {
            return new Promise((resolve) => {
                const breakpoints = sys.__v0['__DEBUGブレイクポイント一覧'];
                const forceLine = sys.__v0['__DEBUG強制待機'];
                sys.__v0['__DEBUG強制待機'] = 0;
                // ブレイクポイント or __DEBUG強制待機 が指定されたか？
                if (breakpoints.indexOf(curLine) >= 0 || forceLine) {
                    if (sys.__v0['プラグイン名'] !== 'メイン') {
                        return;
                    } // 現状メインのみデバッグする
                    console.log(`@__DEBUG_BP_WAIT(${curLine})`);
                    const timerId = setInterval(() => {
                        if (sys.__v0['__DEBUG待機フラグ'] === 1) {
                            sys.__v0['__DEBUG待機フラグ'] = 0;
                            clearInterval(timerId);
                            resolve(curLine);
                        }
                    }, 500);
                }
                else {
                    resolve(curLine);
                }
            });
        }
    },
    'グローバル関数一覧取得': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            const vars = sys.__varslist[1];
            const res = [];
            for (const key in vars) {
                if (Object.prototype.hasOwnProperty.call(vars, key)) {
                    res.push(key);
                }
            }
            return res;
        }
    },
    'システム関数一覧取得': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            const vars = sys.__varslist[0];
            const res = [];
            for (const key in vars) {
                if (Object.prototype.hasOwnProperty.call(vars, key)) {
                    res.push(key);
                }
            }
            return res;
        }
    },
    'システム関数存在': {
        type: 'func',
        josi: [['が', 'の']],
        pure: true,
        fn: function (fname, sys) {
            return (typeof sys.__v0[fname] !== 'undefined');
        }
    },
    'プラグイン一覧取得': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            const a = [];
            for (const f in sys.pluginfiles) {
                a.push(f);
            }
            return a;
        }
    },
    'モジュール一覧取得': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            const a = [];
            for (const f in sys.__module) {
                a.push(f);
            }
            return a;
        }
    },
    '助詞一覧取得': {
        type: 'func',
        josi: [],
        pure: true,
        asyncFn: true,
        fn: function () {
            return new Promise((resolve, reject) => {
                import('./nako_josi_list.mjs')
                    .then((mod) => {
                    const obj = Object.assign({}, mod);
                    resolve(obj.josiList);
                })
                    .catch((err) => {
                    reject(err);
                });
            });
        }
    },
    '予約語一覧取得': {
        type: 'func',
        josi: [],
        pure: true,
        asyncFn: true,
        fn: function () {
            // const words = require('./nako_reserved_words.mjs')
            return new Promise((resolve, reject) => {
                import('./nako_reserved_words.mjs')
                    .then((mod) => {
                    const obj = Object.assign({}, mod);
                    const w = [];
                    for (const key in obj.default) {
                        w.push(key);
                    }
                    resolve(w);
                })
                    .catch((err) => {
                    reject(err);
                });
            });
        }
    },
    // @プラグイン管理
    'プラグイン名': { type: 'const', value: 'メイン' },
    'プラグイン名設定': {
        type: 'func',
        josi: [['に', 'へ']],
        pure: true,
        fn: function (s, sys) {
            sys.__v0['プラグイン名'] = s;
        },
        return_none: true
    },
    '名前空間': { type: 'const', value: '' },
    '名前空間設定': {
        type: 'func',
        josi: [['に', 'へ']],
        pure: true,
        fn: function (s, sys) {
            // push namespace
            sys.__namespaceList.push([sys.__v0['名前空間'], sys.__v0['プラグイン名']]);
            sys.__v0['名前空間'] = s;
        },
        return_none: true
    },
    '名前空間ポップ': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function (sys) {
            // pop namespace
            const a = sys.__namespaceList.pop();
            if (a) {
                sys.__v0['名前空間'] = a[0];
                sys.__v0['プラグイン名'] = a[1];
            }
        },
        return_none: true
    },
    // @URLエンコードとパラメータ
    'URLエンコード': {
        type: 'func',
        josi: [['を', 'から']],
        pure: true,
        fn: function (text) {
            return encodeURIComponent(text);
        }
    },
    'URLデコード': {
        type: 'func',
        josi: [['を', 'へ', 'に']],
        pure: true,
        fn: function (text) {
            return decodeURIComponent(text);
        }
    },
    'URLパラメータ解析': {
        type: 'func',
        josi: [['を', 'の', 'から']],
        pure: true,
        fn: function (url, sys) {
            const res = {};
            if (typeof url !== 'string') {
                return res;
            }
            const p = url.split('?');
            if (p.length <= 1) {
                return res;
            }
            const params = p[1].split('&');
            for (const line of params) {
                const line2 = line + '=';
                const kv = line2.split('=');
                const k = sys.__exec('URLデコード', [kv[0]]);
                res[k] = sys.__exec('URLデコード', [kv[1]]);
            }
            return res;
        }
    },
    // @BASE64
    'BASE64エンコード': {
        type: 'func',
        josi: [['を', 'から']],
        pure: true,
        fn: function (text) {
            // browser?
            if (typeof (window) !== 'undefined' && window.btoa) {
                const u8a = new TextEncoder().encode(text);
                const utf8str = String.fromCharCode.apply(null, u8a);
                return btoa(utf8str);
            }
            // Node?
            if (typeof (Buffer) !== 'undefined') {
                return Buffer.from(text).toString('base64');
            }
            throw new Error('『BASE64エンコード』は利用できません。');
        }
    },
    'BASE64デコード': {
        type: 'func',
        josi: [['を', 'へ', 'に']],
        pure: true,
        fn: function (text) {
            if (typeof (window) !== 'undefined' && window.atob) {
                const decodedUtf8str = atob(text);
                const dec = Array.prototype.map.call(decodedUtf8str, c => c.charCodeAt());
                const decodedArray = new Uint8Array(dec);
                return new TextDecoder('UTF-8').decode(decodedArray);
            }
            // Node?
            if (typeof (Buffer) !== 'undefined') {
                return Buffer.from(text, 'base64').toString();
            }
            throw new Error('『BASE64デコード』は利用できません。');
        }
    }
};
