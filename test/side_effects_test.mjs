/* eslint-disable no-undef */
import assert from 'assert'

import { NakoCompiler } from '../src/nako3.mjs'
// import { NakoSyntaxError } from '../src/nako_errors.mjs'

describe('side_effects_test', () => {
  it('変数の定義 - 1', () => {
    const nako = new NakoCompiler()
    nako.run('A=10', 'main.nako3')
    assert.strictEqual((nako.run('Aを表示')).log, '10')
  })
  it('関数の定義 - 変数として参照', () => {
    const nako = new NakoCompiler()
    nako.run('●Aとは;3を戻す;ここまで', 'main.nako3')
    const g = nako.run('Aを表示')
    assert.strictEqual(g.log, '3')
  })
  it('関数の定義 - 関数として参照', () => {
    const nako = new NakoCompiler()
    try {
      nako.run('●Aとは\nここまで', 'main.nako3')
      nako.reset()
      nako.run('A', 'main.nako3')
    } catch (err) {
      assert.strictEqual(err.type, 'NakoSyntaxError')
    }
  })
  it('関数の定義 - 関数として定義した場合', () => {
    const nako = new NakoCompiler()
    nako.run('●Aとは\nここまで', 'main.nako3')
    assert.strictEqual((nako.run('●（xの）Aとは\nここまで', 'main.nako3')).log, '')
  })
  it('プラグイン変数の上書き', () => {
    const nako = new NakoCompiler()
    nako.addPluginObject('SideEffectTestPlugin', {
      'プラグイン変数': { type: 'var', value: 100 }
    })
    nako.run('プラグイン変数=20', 'main.nako3') // プラグイン変数 = 20
    nako.reset() // ここで変数がリセットされるので、上記のプラグイン変数が有効になる
    assert.strictEqual((nako.run('プラグイン変数を表示', 'main.nako3')).log, '100')
  })
  it('プラグイン関数の上書き', () => {
    const nako = new NakoCompiler()
    nako.run('●(AとBを)足すとは;999を戻す;ここまで', 'main.nako3')
    assert.strictEqual((nako.run('1と2を足して表示', 'main.nako3')).log, '999')
  })
  it('プラグイン関数の上書き後にリセット', () => {
    const nako = new NakoCompiler()
    nako.run('●(AとBを)足すとは;999を戻す;ここまで', 'main.nako3')
    nako.reset()
    assert.strictEqual((nako.run('1と2を足して表示', 'main.nako3')).log, '3')
  })
  it('addFuncで設定した関数の上書き', () => {
    const nako = new NakoCompiler()
    nako.addFunc('hoge', [], () => 1, false)
    assert.strictEqual((nako.run('●hogeとは\n2を戻す\nここまで\nhogeを表示', 'main.nako3')).log, '2')
    nako.reset()
    assert.strictEqual((nako.run('hogeを表示', 'main.nako3')).log, '1')
  })
  it('「初期化」と「!クリア」を呼ぶ', () => {
    const log = []
    const nako = new NakoCompiler()

    let count = 0
    nako.addPluginObject('ClearTest', {
      '初期化': {
        type: 'func',
        josi: [],
        pure: true,
        fn: (sys) => {
          sys.x = count++
          log.push('初期化' + sys.x)
        }
      },
      '!クリア': {
        type: 'func',
        josi: [],
        pure: true,
        fn: (sys) => {
          log.push('!クリア' + sys.x)
        }
      }
    })
    // NakoGlobalのテスト
    const process1 = nako.runSync('a=1')
    const process2 = nako.runSync('a=1')
    assert.strictEqual(process1, process2) // 同じものを返すこと
    process1.destroy()
    assert.deepStrictEqual(log, ['初期化0', '初期化1', '!クリア1'])
  })
  it('余分なNakoGlobalが生成されないこと #1246', () => {
    const nako3 = new NakoCompiler()
    const g1 = nako3.runSync('A=10')
    const g2 = nako3.runSync('B=10')
    assert.strictEqual(g1.guid, g2.guid)
  })
})
