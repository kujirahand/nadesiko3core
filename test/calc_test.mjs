import assert from 'assert'
import { NakoCompiler } from '../src/nako3.mjs'

describe('calc_test.js', async () => {
  const cmp = async (/** @type {string} */ code, /** @type {string} */ res) => {
    const nako = new NakoCompiler()
    assert.strictEqual((await nako.runAsync(code)).log, res)
  }
  it('basic', async () => {
    await cmp('3を表示', '3')
    await cmp('3.14を表示', '3.14')
    await cmp('0.5e+3を表示', '500')
  })
  it('足し算', async () => {
    await cmp('3+5を表示', '8')
  })
  it('引き算', async () => {
    await cmp('10-5を表示。', '5')
    await cmp('１０－５を表示。', '5')
  })
  it('掛け算', async () => {
    await cmp('1+2*3を表示', '7')
  })
  it('連続演算：して', async () => {
    await cmp('3に5を足して表示', '8')
  })
  it('連続演算：て-3に5を掛けて表示', async () => {
    await cmp('3に5を掛けて表示', '15')
  })
  it('配列', async () => {
    await cmp('a=[];a[1]=30;a[1]を表示', '30')
    await cmp('a=[];a【1】=30;a[1]を表示', '30')
  })
  it('ネスト配列', async () => {
    await cmp('a=[[1,2,3], [4,5,6]];a[1][1]を表示', '5')
  })
  it('ネスト配列で、マイナスを含むときのバグ修正 (#276)', async () => {
    await cmp('a=[-1, -2, -3];a[0]を表示', '-1')
    await cmp('a=[-1, -2, -3];a[2]を表示', '-3')
    await cmp('a=[[-1, -1], [1, -1]];a[0][0]を表示', '-1')
  })
  it('オブジェクト', async () => {
    await cmp('a={};a[\'a\']=30;a[\'a\']を表示', '30')
  })
  it('階乗', async () => {
    await cmp('2^3を表示', '8')
  })
  it('否定', async () => {
    await cmp('(!1)を表示', '0')
    await cmp('(!0)を表示', '1')
    await cmp('(!オン)を表示', '0')
    await cmp('(!オフ)を表示', '1')
  })
  it('配列簡易記号', async () => {
    await cmp('A=[];A@0=5;A@0を表示', '5')
    await cmp('A=[];A＠0=5;A＠1=6;AをJSONエンコードして表示', '[5,6]')
  })
  it('JSON配列-改行あり', async () => {
    await cmp('A=[\n0,\n1,\n2,\n3];A@2を表示', '2')
  })
  it('JSON配列-カンマ省略', async () => {
    await cmp('A=[1 2 3 4 5];AをJSONエンコードして表示', '[1,2,3,4,5]')
  })
  it('JSON配列-ネスト', async () => {
    await cmp('A=[[1,2,3],[4,5,6]];AをJSONエンコードして表示', '[[1,2,3],[4,5,6]]')
  })
  it('JSONオブジェクト-改行あり', async () => {
    await cmp('A={\n"殿":"男","姫":"女"\n};A@"殿"を表示', '男')
  })
  it('JSONオブジェクト-値を省略した場合', async () => {
    await cmp('N={"hoge"};N["hoge"]を表示。', 'hoge')
    await cmp('N={"hoge","fuga","bar"};N["bar"]を表示。', 'bar')
    await cmp('N={32,45,66};N[45]を表示。', '45')
  })
  it('JSONオブジェクト-キーを文字列で囲わなかった場合', async () => {
    await cmp('N={hoge:30};N["hoge"]を表示。', '30')
  })
  it('文字列→数値への暗黙的変換', async () => {
    await cmp('A="5";B="50";A+Bを表示', '55')
    await cmp('"100"/"2"を表示', '50')
    await cmp('"2"*"3"を表示', '6')
    await cmp('"100"%"10"を表示', '0')
  })
  it('空配列テスト', async () => {
    await cmp('A=空配列;A@0=30;A@1=50;Aを「:」で配列結合して表示', '30:50')
    await cmp('A=空配列;B=空配列;A@0=30;A@1=50;B@0=1;Bを「:」で配列結合して表示', '1')
  })
  it('単項演算子 minus number', async () => {
    await cmp('-1*5を表示', '-5')
    await cmp('5*-1を表示', '-5')
  })
  it('単項演算子 minus word', async () => {
    await cmp('A=1;5*-Aを表示', '-5')
  })
  it('論理演算', async () => {
    await cmp('BMI=25;A=((25 ≦ BMI) かつ (BMI < 30));Aを表示', 'true')
    await cmp('BMI=25;A=((18.5 > BMI) または (BMI > 30));Aを表示', 'false')
  })
  it('カッコ内の関数呼び出し', async () => {
    await cmp('N=("ABC"の文字数);Nを表示。', '3')
  })
  it('文字列の埋め込み変数加算', async () => {
    await cmp('N1=30;「--{N1+1}--」を表示', '--31--')
  })
  it('文字列の埋め込み変数減算', async () => {
    await cmp('N1=30;「--{N1-1}--」を表示', '--29--')
  })
  it('文字列の埋め込み変数乗算', async () => {
    await cmp('N1=30;「--{N1*2}--」を表示', '--60--')
  })
  it('文字列の埋め込み変数除算', async () => {
    await cmp('N1=30;「--{N1/2}--」を表示', '--15--')
  })
  it('文字列の埋め込み変数剰余', async () => {
    await cmp('N1=30;「--{N1%2}--」を表示', '--0--')
  })
  it('文字列の埋め込み変数冪乗', async () => {
    await cmp('N1=2;「--{N1^3}--」を表示', '--8--')
  })
  it('比較演算子', async () => {
    await cmp('A=1>5;Aを表示', 'false')
  })
  it('ビット演算', async () => {
    await cmp('A=0xF0>>4;Aを表示', '15')
    await cmp('A=0xF<<4;Aを表示', '240')
  })
  it('連文で計算 (#729)', async () => {
    await cmp('1に2を足して3を足して4を引いて5を掛けて2で割って表示', '5')
    await cmp('2に3を掛けて4を足して5で割って表示', '2')
  })
  it('厳格な比較 (#999)', async () => {
    await cmp('N=「」;もし、N=0ならば「OK」と表示。', 'OK')
    await cmp('N=「」;もし、N===0ならば「NG」と表示。違えば「OK」と表示。', 'OK')
  })
  it('なでしこ式関数呼び出しで、途中に四則演算がある場合の処理 (#1188)', async () => {
    await cmp('3.14のINT+2を表示。', '5')
    await cmp('3の5倍×2を表示', '30')
    await cmp('1+3の2倍×2を表示', '16')
  })
})
