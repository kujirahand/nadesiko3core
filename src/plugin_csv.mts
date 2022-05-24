import { options, parse, stringify } from './nako_csv.mjs'

const PluginCSV = {
  '初期化': {
    type: 'func',
    josi: [],
    pure: true,
    fn: function (): void {
      // 基本的に初期化不要
    }
  },
  // @CSV操作
  'CSV取得': { // @CSV形式のデータstrを強制的に二次元配列に変換して返す // @CSVしゅとく
    type: 'func',
    josi: [['を', 'の', 'で']],
    pure: true,
    fn: function (str: string): string[][] {
      options.delimiter = ','
      return parse(str)
    }
  },
  'TSV取得': { // @TSV形式のデータstrを強制的に二次元配列に変換して返す // @TSVしゅとく
    type: 'func',
    josi: [['を', 'の', 'で']],
    pure: true,
    fn: function (str: string): string[][] {
      options.delimiter = '\t'
      return parse(str)
    }
  },
  '表CSV変換': { // @二次元配列AをCSV形式に変換して返す // @ひょうCSVへんかん
    type: 'func',
    josi: [['を']],
    pure: true,
    fn: function (a: string[][]): string {
      options.delimiter = ','
      return stringify(a)
    }
  },
  '表TSV変換': { // @二次元配列AをTSV形式に変換して返す // @ひょうTSVへんかん
    type: 'func',
    josi: [['を']],
    pure: true,
    fn: function (a: string[][]): string {
      options.delimiter = '\t'
      return stringify(a)
    }
  }
}
export default PluginCSV
