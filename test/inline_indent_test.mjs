import assert from 'assert'
import { NakoCompiler } from '../src/nako3.mjs'

describe('inline_indent_test', async () => {
  // nako.logger.addListener('trace', ({ browserConsole }) => { console.log(...browserConsole) })
  const cmp = async (/** @type {string} */ code, /** @type {string} */ res) => {
    const nako = new NakoCompiler()
    nako.logger.debug('code=' + code)
    assert.strictEqual((await nako.runAsync(code)).log, res)
  }
  it('繰り返す', async () => {
    await cmp('Nを1から3まで繰り返す:\n  Nを表示\n', '1\n2\n3')
    await cmp('Nを１から３まで繰り返す:\n　　Nを表示\n', '1\n2\n3')
  })
  it('繰り返す2', async () => {
    await cmp('1から3まで繰り返す\nそれを表示\nここまで', '1\n2\n3')
  })
  it('もし-日本語による比較', async () => {
    await cmp('もし3が3と等しいならば:\n　　「OK」と表示。', 'OK')
    await cmp('もし(3+2)が5と等しいならば:\n　　「OK」と表示。', 'OK')
  })
  it('回-break', async () => {
    await cmp('3回:\n' +
              '　　\'a\'と表示。\n' +
              '　　もし(回数=2)ならば、抜ける\n', 'a\na')
  })
  it('反復 - 配列', async () => {
    await cmp('[1,2,3]を反復:\n  対象を表示\n', '1\n2\n3')
  })
  it('反復 - オブジェクト', async () => {
    await cmp('{\'a\':1,\'b\':2,\'c\':3}を反復:\n  対象を表示\n', '1\n2\n3')
    await cmp('{\'a\':1,\'b\':2,\'c\':3}を反復:\n  対象キーを表示\n', 'a\nb\nc')
  })
  it('反復 - 変数付き', async () => {
    await cmp('A=[1,2,3];NでAを反復:\n  Nを表示\n', '1\n2\n3')
    await cmp('Nで[1,2,3]を反復:\n  Nを表示\n', '1\n2\n3')
  })
  it('繰り返しのネスト', async () => {
    await cmp('C=0;Iを0から3まで繰り返す:\n  Jを0から3まで繰り返す:\n    C=C+1;\nCを表示', '16')
  })
  it('もし、と戻るの組み合わせ', async () => {
    await cmp('●テスト処理:\n' +
              '　　「あ」と表示\n' +
              '　　もし、3=3ならば、戻る。\n' +
              '　　「ここには来ない」と表示\n' +
              '\n' +
              'テスト処理。', 'あ')
  })
  it('もし文のエラー(#378)', async () => {
    await cmp('●AAAとは:\n' +
              '　　列を1から3まで繰り返す:\n' +
              '　　　　列を表示。' +
              '　　　　もし、列=2ならば、「*」と表示。\n' +
              'AAA', '1\n2\n*\n3')
  })
  it('「増繰り返す」「減繰り返す」を追加#1140', async () => {
    await cmp('Nを0から4まで2ずつ増やし繰り返す:\n　　Nを表示\n', '0\n2\n4')
  })
  // inline indent
  it('#1215 インラインインデント構文 - 回', async () => {
    await cmp('3回:\n' +
              '  "a"と表示\n', 'a\na\na')
  })
  it('#1215 インラインインデント構文 - もし', async () => {
    await cmp(
      'A=5;B=3;もし,A>Bならば:\n' +
      '  "ok"と表示\n' +
      '違えば:\n' +
      '  "ng"と表示\n', 'ok')
  })
  it('#1215 インラインインデント構文 - エラー監視', async () => {
    await cmp(
      'エラー監視:\n' +
      '  "ok"と表示\n' +
      'エラーならば:\n' +
      '  "err"と表示\n',
      'ok')
    await cmp(
      'エラー監視:\n' +
      '  "aaa"のエラー発生\n' +
      'エラーならば:\n' +
      '  "err"と表示\n',
      'err')
  })
  it('#1215 インラインインデント構文3 - ネスト', async () => {
    await cmp(
      '3回:\n' +
      '  もし、5>3ならば:\n' +
      '    「a」と表示\n' +
      '  違えば:\n' +
      '    「b」と表示\n',
      'a\na\na')
  })
  it('#1273 インラインインデントで無駄な区切り文字の問題', async () => {
    await cmp(
      '3回:\n' +
      '  もし、5>3ならば:\n' +
      '    「a」と表示。\n' +
      '  違えば:\n' +
      '    「b」と表示。\n',
      'a\na\na')
  })
})
