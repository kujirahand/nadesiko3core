import CSV from 'csv-lite-js'

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
      CSV.options.delimiter = ','
      return CSV.parse(str)
    }
  },
  'TSV取得': { // @TSV形式のデータstrを強制的に二次元配列に変換して返す // @TSVしゅとく
    type: 'func',
    josi: [['を', 'の', 'で']],
    pure: true,
    fn: function (str: string): string[][] {
      CSV.options.delimiter = '\t'
      return CSV.parse(str)
    }
  },
  '表CSV変換': { // @二次元配列AをCSV形式に変換して返す // @ひょうCSVへんかん
    type: 'func',
    josi: [['を']],
    pure: true,
    fn: function (a: string[][]): string {
      CSV.options.delimiter = ','
      return CSV.stringify(a)
    }
  },
  '表TSV変換': { // @二次元配列AをTSV形式に変換して返す // @ひょうTSVへんかん
    type: 'func',
    josi: [['を']],
    pure: true,
    fn: function (a: string[][]): string {
      CSV.options.delimiter = '\t'
      return CSV.stringify(a)
    }
  }
}
export default PluginCSV

// scriptタグで取り込んだ時、自動で登録する
if (typeof (navigator) === 'object' && typeof ((navigator as any).nako3) === 'object') {
  (navigator as any).nako3.addPluginObject('PluginCSV', PluginCSV)
}
