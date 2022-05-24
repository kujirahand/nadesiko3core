import { options, parse, stringify } from './nako_csv.mjs';
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
            options.delimiter = ',';
            return parse(str);
        }
    },
    'TSV取得': {
        type: 'func',
        josi: [['を', 'の', 'で']],
        pure: true,
        fn: function (str) {
            options.delimiter = '\t';
            return parse(str);
        }
    },
    '表CSV変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (a) {
            options.delimiter = ',';
            return stringify(a);
        }
    },
    '表TSV変換': {
        type: 'func',
        josi: [['を']],
        pure: true,
        fn: function (a) {
            options.delimiter = '\t';
            return stringify(a);
        }
    }
};
export default PluginCSV;
