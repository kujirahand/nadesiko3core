import CSV from 'csv-lite-js';
const PluginCSV = {
    '初期化': {
        type: 'func',
        josi: [],
        pure: true,
        fn: function () {
            // 基本的に初期化不要
        }
    },
    // @CSV操作
    'CSV取得': {
        type: 'func',
        josi: [['を', 'の', 'で']],
        pure: true,
        fn: function (str) {
            CSV.options.delimiter = ',';
            return CSV.parse(str);
        }
    },
    'TSV取得': {
        type: 'func',
        josi: [['を', 'の', 'で']],
        pure: true,
        fn: function (str) {
            CSV.options.delimiter = '\t';
            return CSV.parse(str);
        }
    },
    '表CSV変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (a) {
            CSV.options.delimiter = ',';
            return CSV.stringify(a);
        }
    },
    '表TSV変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (a) {
            CSV.options.delimiter = '\t';
            return CSV.stringify(a);
        }
    }
};
export default PluginCSV;
// scriptタグで取り込んだ時、自動で登録する
if (typeof (navigator) === 'object' && typeof (navigator.nako3) === 'object') {
    navigator.nako3.addPluginObject('PluginCSV', PluginCSV);
}
