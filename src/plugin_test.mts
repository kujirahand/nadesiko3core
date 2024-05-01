/**
 * file: plugin_test.js
 * テスト実行用プラグイン
 */
export default {
  'meta': {
    type: 'const',
    value: {
      pluginName: 'plugin_test', // プラグインの名前
      description: 'テストを提供するプラグイン', // プラグインの説明
      pluginVersion: '3.6.0', // プラグインのバージョン
      nakoRuntime: ['wnako', 'cnako', 'phpnako'], // 対象ランタイム
      nakoVersion: '^3.6.0' // 要求なでしこバージョン
    }
  },
  // @テスト
  'ASSERT等': { // @ テストで、ASSERTでAとBが正しいことを報告する // @ASSERTひとしい
    type: 'func',
    josi: [['と'], ['が']],
    pure: true,
    fn: function (a: any, b: any): boolean {
      if (a !== b) {
        throw new Error(`不一致 [実際]${a} [期待]${b}`)
      }
      return true
    }
  },
  'テスト実行': { // @ テストで、ASSERTでAとBでテスト実行してAとBが等しいことを報告する // @てすとじっこう
    type: 'func',
    josi: [['と'], ['で']],
    pure: false,
    fn: function (a: any, b: any, sys: any) {
      sys.__exec('ASSERT等', [a, b, sys])
    }
  },
  'テスト等': { // @ テストで、ASSERTでAとBが正しいことを報告する // @テストひとしい
    type: 'func',
    josi: [['と'], ['が']],
    pure: false,
    fn: function (a: any, b: any, sys: any) {
      sys.__exec('ASSERT等', [a, b, sys])
    }
  }
}
