/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
import assert from 'assert'
import { NakoCompiler } from '../src/nako3.mjs'

// eslint-disable-next-line no-undef
describe('plugin_system_test', async () => {
  const cmp = async (/** @type {string} */ code, /** @type {string} */ res) => {
    const nako = new NakoCompiler()
    nako.logger.debug('code=' + code)
    const g = await nako.runAsync(code)
    assert.strictEqual(g.log, res)
  }
  const cmpex = async (/** @type {string} */ code, /** @type { name: String, message: string } */ exinfo) => {
    const nako = new NakoCompiler()
    nako.logger.debug('code=' + code)
    try {
      const g = nako.runAsync(code)
    } catch (err) {
      console.log(err.message)
      assert.strictEqual(err.name, exinfo.name)
      assert.notStrictEqual(err.message.indexOf(exinfo.message), -1)
    }
  }

  // --- test ---
  it('簡単なテスト', async () => {
    await cmp('123を表示', '123')
  })
  it('ナデシコエンジンを表示', async () => {
    await cmp('ナデシコエンジンを表示', 'nadesi.com/v3')
  })
  it('四則演算', async () => {
    await cmp('1に2を足して3を掛けて表示', '9')
    await cmp('10を2で割って表示', '5')
    await cmp('10を2で割った余り;それを表示', '0')
    await cmp('10の2倍;それを表示', '20')
    await cmp('V=3;もし(Vが1から5の範囲内)ならば「OK」と表示;違えば「NG」と表示。', 'OK')
    await cmp('V=30;もし(Vが1から5の範囲内)ならば「IN」と表示;違えば「OUT」と表示。', 'OUT')
    await cmp('もし、1が2と等しく無いならば「OK」を表示。', 'OK')
    await cmp('もし、1が2と不一致ならば「OK」を表示。', 'OK')
    await cmp('もし、[1,2]が[1,1]と不一致ならば「OK」を表示。', 'OK')
  })
  it('掛けるの拡張', async () => {
    await cmp('2に3を掛けて表示', '6')
    await cmp('"z"に3を掛けて表示', 'zzz')
    await cmp('[0]に3を掛けてJSONエンコードして表示', '[0,0,0]')
  })
  it('JS実行', async () => {
    await cmp('「3+6」をJS実行して表示', '9')
    await cmp('「Math.floor(3.5)」をJS実行して表示', '3')
  })
  it('型変換', async () => {
    await cmp('「3.14」を文字列変換して表示', '3.14')
    await cmp('「0xFF」を整数変換して表示', '255')
  })
  it('変数型確認', async () => {
    await cmp('30の変数型確認して表示。', 'number')
  })
  it('SIN/COS/TAN', async () => {
    await cmp('SIN(1)を表示。', '' + Math.sin(1))
    await cmp('COS(1)を表示。', '' + Math.cos(1))
    await cmp('TAN(1)を表示。', '' + Math.tan(1))
  })
  it('RGB', async () => {
    await cmp('RGB(255,255,0)を表示。', '#ffff00')
    await cmp('RGB(0,0,0)を表示。', '#000000')
  })
  it('LOGN', async () => {
    await cmp('LOGN(10,10)を表示。', '' + (Math.LOG10E * Math.log(10)))
    await cmp('LOGN(2,10)を表示。', '' + (Math.LOG2E * Math.log(10)))
  })
  it('文字挿入', async () => {
    await cmp('「12345」の2に「**」を文字挿入して表示', '1**2345')
    await cmp('「12345」の1に「**」を文字挿入して表示', '**12345')
    await cmp('「12345」の6に「**」を文字挿入して表示', '12345**')
    await cmp('「12345」の0に「**」を文字挿入して表示', '**12345')
  })
  it('出現回数', async () => {
    await cmp('「aabbccaabbcc」で「aa」の出現回数。表示', '2')
    await cmp('「aa**bb**cc」で「**」の出現回数。表示', '2')
    await cmp('「aa.+bb.+cc」で「.+」の出現回数。表示', '2')
  })
  it('シングル文字列', async () => {
    await cmp('\'abcd\'を表示。', 'abcd')
  })
  it('文字抜き出す', async () => {
    await cmp('MID(\'abcdef\',1,2)を表示', 'ab')
    await cmp('「abcdef」の1から2を文字抜き出しを表示', 'ab')
    await cmp('MID(\'abcdefg\',3,2)を表示', 'cd')
    await cmp('「abcdefg」の3から2を文字抜き出しを表示', 'cd')
    await cmp('MID(\'abcd\',4,2)を表示', 'd')
    await cmp('「abcd」の4から2を文字抜き出しを表示', 'd')
  })
  it('RIGHT', async () => {
    await cmp('RIGHT(\'abcdef\',2)を表示', 'ef')
    await cmp('「abcde」の3だけ文字右部分。それを表示', 'cde')
  })
  it('LEFT', async () => {
    await cmp('LEFT(\'abcd\',2)を表示', 'ab')
    await cmp('「abcde」の3だけ文字左部分。それを表示', 'abc')
  })
  it('切り取る', async () => {
    await cmp('「abc,def,ghi」から「,」まで切り取る。それを表示。', 'abc')
    await cmp('「a,b,c」から「*」まで切り取る。それを表示。', 'a,b,c')
    // #1096
    await cmp('「abc,def」から「,」まで切り取る。対象を表示。', 'def')
    await cmp('「abc,def」から「*」まで切り取る。対象を表示。', '')
  })
  it('文字削除', async () => {
    await cmp('「abcd」の1から2だけ文字削除。それを表示。', 'cd')
    await cmp('「abcd」の2から2だけ文字削除。それを表示。', 'ad')
    await cmp('A=「ab」;「abcd」の1から(Aの文字数)だけ文字削除。それを表示。', 'cd')
  })
  it('置換', async () => {
    await cmp('「a,b,c」の「,」を「-」に置換して表示。', 'a-b-c')
    await cmp('「番号00▲00▲」の「00」を「11」に置換して表示', '番号11▲11▲')
  })
  it('単置換', async () => { // 単置換の問題 #1105
    await cmp('「e,f,g」の「,」を「-」へ単置換して表示。', 'e-f,g')
    await cmp('「番号0000」の「0000」を「0001」に単置換して表示', '番号0001')
    await cmp('「あい▲うえ▲お」の「▲」を「＊」に単置換して表示', 'あい＊うえ▲お')
    await cmp('「あい▲▲うえ▲▲お」の「▲▲」を「＊」に単置換して表示', 'あい＊うえ▲▲お')
  })
  it('空白除去', async () => {
    await cmp('「  aaa   」の空白除去して表示。', 'aaa')
  })
  it('正規表現置換', async () => {
    await cmp('「aa,bb,cc」の「[a-z]+」を「x」で正規表現置換して表示。', 'x,x,x')
    await cmp('「aa,bb,cc」の「/[a-z]+/」を「x」で正規表現置換して表示。', 'x,bb,cc')
    await cmp('「aa,bb,cc」の「/[a-z]+/g」を「x」で正規表現置換して表示。', 'x,x,x')
  })
  it('正規表現マッチ - /.../を省略', async () => {
    // パターンを省略するとグローバルマッチ
    await cmp('「aa,bb,cc」を「[a-z]+」で正規表現マッチ。JSONエンコード。表示。', '["aa","bb","cc"]')
    // グループを指定しても、結果は無視
    await cmp('「aa,bb,cc」を「([a-z]+)」で正規表現マッチ。JSONエンコード。表示。', '["aa","bb","cc"]')
  })
  it('正規表現マッチ - /.../あり グルーピングなし', async () => {
    await cmp('「12-34-56」を「/[0-9]+\\-/」で正規表現マッチ。JSONエンコード。表示。', '"12-"')
  })
  it('正規表現マッチ - /.../あり グルーピングあり', async () => {
    // グループ(..)を指定した場合
    await cmp('「12-34-56」を「/([0-9]+)\\-/」で正規表現マッチ。JSONエンコード。表示。抽出文字列をJSONエンコードして表示。', '"12-"\n["12"]')
  })
  it('正規表現マッチ2', async () => {
    await cmp('「AA,BB,CC」を「/^[a-z]+/i」で正規表現マッチ。表示。', 'AA')
  })
  it('正規表現区切る', async () => {
    await cmp('「aa,bb,cc」を「/\\,/g」で正規表現区切る。JSONエンコード。表示。', '["aa","bb","cc"]')
  })
  it('通貨形式', async () => {
    await cmp('12345を通貨形式。表示。', '12,345')
    await cmp('1000を通貨形式。表示。', '1,000')
  })
  it('ゼロ埋め', async () => {
    await cmp('3を3でゼロ埋め。表示。', '003')
    await cmp('33を3でゼロ埋め。表示。', '033')
    await cmp('333を3でゼロ埋め。表示。', '333')
    await cmp('3333を3でゼロ埋め。表示。', '3333')
    await cmp('10を3でゼロ埋め。表示。', '010')
    await cmp('123を5でゼロ埋め。表示。', '00123')
    await cmp('12345を3でゼロ埋め。表示。', '12345')
  })
  it('空白埋め', async () => {
    await cmp('10を3で空白埋め。表示。', ' 10')
    await cmp('「10」を3で空白埋め。表示。', ' 10')
    await cmp('「010」を4で空白埋め。表示。', ' 010')
    await cmp('「123」を5で空白埋め。表示。', '  123')
    await cmp('「12345」を3で空白埋め。表示。', '12345')
  })
  it('配列要素数', async () => {
    await cmp('A=[0,1,2,3];Aの配列要素数。表示。', '4')
    await cmp('A={"a":1,"b":2,"c":3};Aの配列要素数。表示。', '3')
  })
  it('配列一括挿入', async () => {
    await cmp('A=[1,1,1];Aの1に[0,0]を配列一括挿入。JSONエンコード。表示。', '[1,0,0,1,1]')
  })
  it('配列ソート', async () => {
    await cmp('A=[\'ccc\',\'bb\',\'aaa\'];Aを配列ソート。Aを「:」で配列結合。表示。', 'aaa:bb:ccc')
  })
  it('配列数値変換', async () => {
    await cmp('A=[12,34,56];Aを配列数値変換。Aを「:」で配列結合。表示。', '12:34:56')
    await cmp('A=[12,34,56];Aを配列数値変換。「{A[0]の変数型確認}, {A[1]の変数型確認}, {A[2]の変数型確認}」を表示', 'number, number, number')
  })
  it('配列数値ソート', async () => {
    await cmp('A=[\'a\',1,3,2];Aを配列数値ソート。Aを「:」で配列結合。表示。', 'a:1:2:3')
    await cmp('A=[\'30\',\'222\',\'55\'];Aを配列数値ソート。Aを「:」で配列結合。表示。', '30:55:222')
  })
  it('配列カスタムソート', async () => {
    await cmp('●HOGE(aをbで)\n(b-a)を戻す\nここまで\n' +
      'A=[1,5,3];Aを「HOGE」で配列カスタムソート。Aを「:」で配列結合。表示。', '5:3:1')
  })
  it('配列逆順', async () => {
    await cmp('A=[1,2,3];Aを配列逆順。Aを「:」で配列結合。表示。', '3:2:1')
  })
  it('配列切取/配列削除', async () => {
    await cmp('A=[0,1,2,3];Aの2を配列切り取る。C=それ。Aを「:」で配列結合。表示。Cを表示', '0:1:3\n2')
    await cmp('A=[0,1,2,3];Aから2を配列削除。C=それ。Aを「:」で配列結合。表示。Cを表示', '0:1:3\n2')
    await cmp('A=[[1,2],[3,4],[5,6]];' +
      'Aから2を配列削除して「:」で配列結合して表示。' +
      'Aの要素数を表示。', '5:6\n2')
    await cmp('A=[[1,2],[3,4],[5,6]];' +
      'Aから0を配列削除;' +
      'A[0]を「:」で配列結合して表示。', '3:4')
  })
  it('配列削除で辞書型変数を指定', async () => {
    await cmp('A={"aaa":1,"bbb":2};' +
      'Aから"aaa"を配列削除;' +
      'AをJSONエンコードして表示。', '{"bbb":2}')
  })
  it('配列複製', async () => {
    await cmp('A=[1,2,3];B=Aを配列複製。B[0]=100。Bを「:」で配列結合。表示。', '100:2:3')
    await cmp('A=[1,2,3];B=Aを配列複製。B[0]=100。Aを「:」で配列結合。表示。', '1:2:3')
  })
  it('配列足す', async () => {
    await cmp('A=[1,2,3];B=[4,5,6];AにBを配列足してJSONエンコードして表示。', '[1,2,3,4,5,6]')
    await cmp('A=[1,2,3];B=[4,5,6];AにBを配列足してCに代入。AをJSONエンコードして表示', '[1,2,3]') // A自体は変更しない
  })
  it('配列最大値', async () => {
    await cmp('[2,1,3]の配列最大値を表示', '3')
  })
  it('配列最小値', async () => {
    await cmp('[2,1,3]の配列最小値を表示', '1')
  })
  it('配列合計', async () => {
    await cmp('[1,2,3]の配列合計を表示', '6')
    await cmp('[10,100]の配列合計を表示', '110')
    await cmp('["a","b","c"]の配列合計を表示', '0')
    await cmp('[10,100,"c"]の配列合計を表示', '110')
  })
  it('表ソート', async () => {
    await cmp('A=[[4,4,"b"],[2,2,"a"],[5,5,"c"]];Aの2を表ソート。AをJSONエンコードして表示。', '[[2,2,"a"],[4,4,"b"],[5,5,"c"]]')
    await cmp('A=[[1,"12",4],[2,"1",2],[3,"2",5]];Aの1を表ソート。AをJSONエンコードして表示。', '[[2,"1",2],[1,"12",4],[3,"2",5]]')
    await cmp('A=[{n:"b"},{n:"a"},{n:"c"}];Aの"n"を表ソート。AをJSONエンコードして表示。', '[{"n":"a"},{"n":"b"},{"n":"c"}]')
  })
  it('表数値ソート', async () => {
    await cmp('A=[[4,4,4],[2,2,2],[5,5,5]];Aの1を表数値ソート。AをJSONエンコードして表示。', '[[2,2,2],[4,4,4],[5,5,5]]')
    await cmp('A=[[1,4,4],[2,2,2],[3,5,5]];Aの1を表数値ソート。AをJSONエンコードして表示。', '[[2,2,2],[1,4,4],[3,5,5]]')
    await cmp('A=[{n:11},{n:9},{n:13}];Aの"n"を表数値ソート。AをJSONエンコードして表示。', '[{"n":9},{"n":11},{"n":13}]')
  })
  it('表ピックアップ', async () => {
    await cmp('A=[["赤",1],["青",2],["緑",3]];Aの0から「赤」を表ピックアップしてJSONエンコードして表示。', '[["赤",1]]')
    await cmp('A=[{n:"赤猫"},{n:"青犬"},{n:"白兎"},{n:"青魚"}];Aの"n"から「青」を表ピックアップしてJSONエンコードして表示。', '[{"n":"青犬"},{"n":"青魚"}]')
    await cmp('A=[["赤猫",1],["青雉",2],["緑猫",3],["赤字",4]];Aの0から「赤」を表ピックアップしてJSONエンコードして表示。', '[["赤猫",1],["赤字",4]]')
  })
  it('表完全一致ピックアップ', async () => {
    await cmp('A=[["赤猫",1],["青雉",2],["緑猫",3],["赤字",4]];Aの0から「赤」を表完全一致ピックアップしてJSONエンコードして表示。', '[]')
    await cmp('A=[["赤猫",1],["青雉",2],["緑猫",3],["赤字",4]];Aの0から「赤猫」を表完全一致ピックアップしてJSONエンコードして表示。', '[["赤猫",1]]')
    await cmp('A=[{n:"赤猫"},{n:"青犬"},{n:"白兎"},{n:"青魚"}];Aの"n"から「青」を表完全一致ピックアップしてJSONエンコードして表示。', '[]')
  })
  it('表検索', async () => {
    await cmp('A=[["赤",1],["青",2],["緑",3]];Aの0で0から「青」を表検索して表示。', '1')
    await cmp('A=[["赤",1],["青",2],["緑",3]];Aの0で0から「紫」を表検索して表示。', '-1')
  })
  it('表列数', async () => {
    await cmp('A=[["赤",1],["青",2],["緑",3,3]];Aの表列数を表示。', '3')
    await cmp('A=["a","b"];Aの表列数を表示。', '1')
  })
  it('表行列交換', async () => {
    await cmp('A=[["赤",1],["青",2],["緑",3]];Aを表行列交換してJSONエンコードして表示。', '[["赤","青","緑"],[1,2,3]]')
    await cmp('A=[[1,2,3],[4,5,6]];Aを表行列交換してJSONエンコードして表示。', '[[1,4],[2,5],[3,6]]')
    await cmp('A=[[1,2,3,4],[4,5,6]];Aを表行列交換してJSONエンコードして表示。', '[[1,4],[2,5],[3,6],[4,""]]')
  })
  it('表右回転', async () => {
    await cmp('A=[[1,2,3],[4,5,6]];Aを表右回転してJSONエンコードして表示。', '[[4,1],[5,2],[6,3]]')
  })
  it('表重複削除', async () => {
    await cmp('A=[[1,2,3],[1,1,1],[4,5,6]];Aの0を表重複削除してJSONエンコードして表示。', '[[1,2,3],[4,5,6]]')
  })
  it('表列取得', async () => {
    await cmp('A=[[1,2,3],[4,5,6]];Aの1を表列取得してJSONエンコードして表示。', '[2,5]')
  })
  it('表列挿入', async () => {
    await cmp('A=[[1,2,3],[4,5,6]];Aの0へ[9,9]を表列挿入してJSONエンコードして表示。', '[[9,1,2,3],[9,4,5,6]]')
    await cmp('A=[[1,2,3],[4,5,6]];Aの1へ[9,9]を表列挿入してJSONエンコードして表示。', '[[1,9,2,3],[4,9,5,6]]')
  })
  it('表列削除', async () => {
    await cmp('A=[[1,2,3],[4,5,6]];Aの1を表列削除してJSONエンコードして表示。', '[[1,3],[4,6]]')
  })
  it('表列合計', async () => {
    await cmp('A=[[1,2,3],[4,5,6]];Aの1を表列合計して表示。', '7')
  })
  it('表曖昧検索', async () => {
    await cmp('A=[[1,"佐藤"],[2,"加藤"]];Aの0から1で「佐」を表曖昧検索して表示。', '0')
    await cmp('A=[[1,"佐藤"],[2,"加藤"],[3,"佐々木"]];Aの1から1で「佐」を表曖昧検索して表示。', '2')
  })
  it('表正規表現ピックアップ', async () => {
    await cmp('A=[[1,"佐藤"],[2,"加藤"]];Aの1から「佐」を表正規表現ピックアップしてJSONエンコードして表示。', '[[1,"佐藤"]]')
    await cmp('A=[[1,"佐藤"],[2,"加藤"]];Aの1から「.+藤」を表正規表現ピックアップしてJSONエンコードして表示。', '[[1,"佐藤"],[2,"加藤"]]')
  })
  it('文字種変換', async () => {
    await cmp('「abc」を大文字変換して表示', 'ABC')
    await cmp('「ABC」を小文字変換して表示', 'abc')
    await cmp('「アイウ」を平仮名変換して表示', 'あいう')
    await cmp('「あいう」をカタカナ変換して表示', 'アイウ')
  })
  it('空配列', async () => {
    await cmp('A=空配列;A@0=10;A@1=20;A@2=30;A@1を表示。', '20')
  })
  it('空ハッシュ', async () => {
    await cmp('A=空ハッシュ;A[「あ」]=10;A[「い」]=20;A[「う」]=30;A[「い」]を表示。', '20')
  })
  it('空オブジェクト', async () => {
    await cmp('A=空オブジェクト;A[「あ」]=10;A[「い」]=20;A[「う」]=30;A[「い」]を表示。', '20')
  })
  it('四捨五入', async () => {
    await cmp('3.14を四捨五入して表示。', '3')
    await cmp('3.6を四捨五入して表示。', '4')
    await cmp('3.5を四捨五入して表示。', '4')
    await cmp('3.15を1で小数点四捨五入して表示。', '3.2')
    await cmp('3.14を1で小数点四捨五入して表示。', '3.1')
  })
  it('切り上げ・切り捨て', async () => {
    await cmp('3.14を切り上げして表示。', '4')
    await cmp('3.8を切り上げして表示。', '4')
    await cmp('3.1を切り捨てして表示。', '3')
    await cmp('3.8を切り捨てして表示。', '3')
    await cmp('0.31を1で小数点切り上げして表示。', '0.4')
    await cmp('0.38を1で小数点切り下げして表示。', '0.3')
  })
  it('カタカナか判定', async () => {
    await cmp('「アイウエオ」がカタカナか判定して表示。', 'true')
    await cmp('「あいうえお」がカタカナか判定して表示。', 'false')
  })
  it('数字か判定', async () => {
    await cmp('「12345」が数字か判定して表示。', 'true')
    await cmp('「あいうえお」が数字か判定して表示。', 'false')
  })
  it('数列か判定', async () => {
    await cmp('「12345」が数列か判定して表示。', 'true')
    await cmp('「あいうえお」が数列か判定して表示。', 'false')
    // #1423 による修正
    await cmp('「-12345」が数列か判定して表示。', 'true')
    await cmp('「123-45」が数列か判定して表示。', 'false')
    await cmp('「12.345」が数列か判定して表示。', 'true')
    await cmp('「1.23.45」が数列か判定して表示。', 'false')
    await cmp('「1.234E-5」が数列か判定して表示。', 'true')
  })
  it('XOR', async () => {
    await cmp('XOR(0xFF, 0xF)を表示。', '240')
  })
  it('進数変換', async () => {
    await cmp('255を16進数変換して大文字変換して表示。', 'FF')
  })
  it('CHR-サロゲートペアを考慮', async () => {
    await cmp('CHR(12354)を表示。', 'あ')
    await cmp('CHR(0x5200)を表示。', '刀')
    await cmp('CHR(0x29E3D)を表示。', '𩸽')
    await cmp('CHR(0x2A6CF)を表示。', '𪛏')
  })
  it('ASC-サロゲートペアを考慮', async () => {
    await cmp('ASC("あ")を表示。', '12354')
    await cmp('HEX(ASC("𩸽"))を表示。', '29e3d')
  })
  it('文字数-サロゲートペアを考慮', async () => {
    await cmp('文字数("𩸽のひらき")を表示。', '5')
  })
  it('文字列分解-サロゲートペアを考慮', async () => {
    await cmp('JSONエンコード(文字列分解("𩸽のひらき"))を表示。', '["𩸽","の","ひ","ら","き"]')
  })
  it('プラグイン一覧取得', async () => {
    await cmp('プラグイン一覧取得して「:」で配列結合して表示', 'plugin_system:plugin_math:plugin_promise:plugin_test:plugin_csv')
  })
  it('配列切り取り', async () => {
    await cmp('A=[0,1,2,3,4,5];Aの0を配列切り取り;表示', '0')
    await cmp('A=[0,1,2,3,4,5];Aの1を配列切り取り;Aを「:」で配列結合して表示', '0:2:3:4:5')
  })
  it('ハッシュ', async () => {
    await cmp('A={"a":0,"b":1,"c":2};Aのハッシュキー列挙して配列ソートして「:」で配列結合して表示', 'a:b:c')
    await cmp('A={"a":0,"b":1,"c":2};Aの要素数を表示', '3')
    await cmp('A={"a":0,"b":1,"c":2};Aから「b」をハッシュキー削除して要素数を表示', '2')
    await cmp('A={"a":0,"b":1,"c":2};Aのハッシュ内容列挙して配列ソートして「:」で配列結合して表示', '0:1:2')
    await cmp('A={"a":0,"b":1,"c":2};Aに"c"がハッシュキー存在。もし、そうならば「OK」と表示。違えば、「NG」と表示。', 'OK')
    await cmp('A={"a":0,"b":1,"c":2};Aに"d"がハッシュキー存在。もし、そうならば「NG」と表示。違えば、「OK」と表示。', 'OK')
  })
  it('辞書型変数 #950', async () => {
    await cmp('A={"a":0,"b":1,"c":2};Aの辞書キー列挙して配列ソートして「:」で配列結合して表示', 'a:b:c')
    await cmp('A={"a":0,"b":1};Aの要素数を表示', '2')
    await cmp('A={"a":0,"b":1,"c":2};Aから「b」を辞書キー削除して要素数を表示', '2')
    await cmp('A={"a":0,"b":1,"c":2};Aに"c"が辞書キー存在。もし、そうならば「OK」と表示。違えば、「NG」と表示。', 'OK')
  })
  it('「辞書キー削除」の問題 core#91', async () => {
    await cmp('A={"a":0,"b":1};Aから「a」を辞書キー削除してJSONエンコードして表示', '{"b":1}')
    await cmp('A={"a":1,"b":1};Aから「a」を辞書キー削除してJSONエンコードして表示', '{"b":1}')
    await cmp('A={"a":0,"b":0};Aから「a」を辞書キー削除;Aから「b」を辞書キー削除;AをJSONエンコードして表示', '{}')
  })
  it('空辞書の定義間違い #1060', async () => {
    await cmp('A=空辞書。A["aaa"]=30;A["bbb"]=50;Aの辞書キー列挙して配列ソートして「:」で配列結合して表示', 'aaa:bbb')
  })
  it('ビット演算', async () => {
    await cmp('OR(0xF0,0xF)を表示', '255')
    await cmp('AND(0xF7,0xF)を表示', '7')
    await cmp('XOR(1,1)を表示', '0')
    await cmp('XOR(0,1)を表示', '1')
    await cmp('NOT(0xFF)を表示', '-256')
  })
  it('論理演算', async () => {
    await cmp('論理OR(1,0)を表示', '1')
    await cmp('論理AND(1,0)を表示', '0')
    await cmp('論理NOT(1)を表示', '0')
  })
  it('英数記号全角半角変換', async () => {
    await cmp('「＃！」を英数記号半角変換して表示', '#!')
    await cmp('「#!」を英数記号全角変換して表示', '＃！')
    await cmp('「abc123#」を英数記号全角変換して表示', 'ａｂｃ１２３＃')
    await cmp('「ａｂｃ１２３＃」を英数記号半角変換して表示', 'abc123#')
    await cmp('「abc123」を英数全角変換して表示', 'ａｂｃ１２３')
    await cmp('「ａｂｃ１２３」を英数半角変換して表示', 'abc123')
  })
  it('カタカナ全角半角変換', async () => {
    await cmp('「アガペ123」をカタカナ半角変換して表示', 'ｱｶﾞﾍﾟ123')
    await cmp('「ｱｶﾞﾍﾟ123」をカタカナ全角変換して表示', 'アガペ123')
    await cmp('「アガペ#!１２３」を半角変換して表示', 'ｱｶﾞﾍﾟ#!123')
    await cmp('「ｱｶﾞﾍﾟ#!123」を全角変換して表示', 'アガペ＃！１２３')
    await cmp('「チャイナマンゴー」をカタカナ半角変換して表示', 'ﾁｬｲﾅﾏﾝｺﾞｰ')
    await cmp('「ﾁｬｲﾅﾏﾝｺﾞｰ」をカタカナ全角変換して表示', 'チャイナマンゴー')
  })
  it('JS関数実行', async () => {
    await cmp('"Math.floor"を[3.14]でJS関数実行して表示', '3')
    await cmp('"Math.floor"を3.14でJS関数実行して表示', '3')
    await cmp('F="Math.floor"でJS実行;Fを[3.14]でJS関数実行して表示', '3')
  })
  it('文字列検索', async () => {
    await cmp('「しんぶんし」で1から「ん」を文字検索して表示', '2')
    await cmp('「しんぶんし」で3から「ん」を文字検索して表示', '4')
    await cmp('「しんぶんし」で5から「ん」を文字検索して表示', '0')
  })
  it('TYPEOF', async () => {
    await cmp('TYPEOF(「あ」)を表示', 'string')
    await cmp('TYPEOF(0)を表示', 'number')
    await cmp('もし、NAN判定(INT(「あ」))ならば、「ok」と表示。違えば、「ng」と表示', 'ok')
  })
  it('URLエンコード', async () => {
    await cmp('「埼玉県さいたま市」をURLエンコードして表示', '%E5%9F%BC%E7%8E%89%E7%9C%8C%E3%81%95%E3%81%84%E3%81%9F%E3%81%BE%E5%B8%82')
  })
  it('URLデコード', async () => {
    await cmp('「%E5%9F%BC%E7%8E%89%E7%9C%8C%E3%81%95%E3%81%84%E3%81%9F%E3%81%BE%E5%B8%82」をURLデコードして表示', '埼玉県さいたま市')
  })
  it('URLパラメータ解析', async () => {
    await cmp('「http://hoge.com/」のURLパラメータ解析してJSONエンコードして表示', '{}')
    await cmp('「https://nadesi.com/?a=3&b=5」のURLパラメータ解析;それ["a"]を表示;それ["b"]を表示。', '3\n5')
  })
  it('助詞省略形のコマンド', async () => {
    await cmp('3が1以上。もし、そうなら「OK」と表示。', 'OK')
    await cmp('1が3以上。もし、そうなら「NG」と表示。もし、そうでなければ「OK」と表示。', 'OK')
  })
  it('HYPOTの問題 #603', async () => {
    await cmp('HYPOT(1,1)を表示。', '1.4142135623730951')
    await cmp('HYPOT(10,5)を表示。', '11.180339887498949')
  })
  it('ナデシコする1/2', async () => {
    await cmp('「1+2を表示する。」をナデシコする。', '3')
    await cmp('Aは3;「1+Aを表示する。」をナデシコする。', '4')
    await cmp('Bは2;「BはB+3。Bを表示する。」をナデシコする。Bを表示する。', '5\n5')
    await cmp('●Cとは\n5を戻す\nここまで\n「1+C()を表示する。」をナデシコする。C()を表示する。', '6\n5')
    await cmp('「Dは4;Dを表示する。」をナデシコする。3+Dを表示する。', '4\n7')
    await cmp('Eは5;「Eは3;Eを表示する。」をナデシコする。5+Eを表示する。', '3\n8')
    await cmp('Bは2;Bを表示する。;「BはB+3。Bを表示する。」をナデシコする。Bを表示する。', '5\n5')
    await cmp('Bは2;Bを表示する。;「BはB+3。Bを表示する。」をナデシコ続ける。Bを表示する。', '2\n5\n5')
    await cmp('1と2を足す\n「それを表示」をナデシコする', '3')
  })
  it('ナデシコする2/2', async () => {
    cmpex('「●Fとは\n2を戻す\nここまで\nF()を表示する。」をナデシコする。7+F()を表示する。', { name: 'NakoError', message: '関数『F』が見当たりません' })
  })
  it('敬語 #728', async () => {
    await cmp('32を表示してください', '32')
    await cmp('1に2を足して3を掛けて表示してください。', '9')
    await cmp('1に2を足して3を掛けて表示してください。お願いします。', '9')
    await cmp('拝啓、「abc」の「a」を「*」に置換してください。お願いします。礼節レベル取得して表示', '2')
  })
  it('一致 #831', async () => {
    await cmp('1と1が一致。もしそうなら"1"を表示。違えば"0"を表示。', '1')
    await cmp('[1,2,3]と[1,2,3]が一致。もしそうなら"1"を表示。違えば"0"を表示。', '1')
    await cmp('[1,2,3]と[2,3]が一致。もしそうなら"NG"を表示。違えば"OK"を表示。', 'OK')
    await cmp('["a",2,3]と["a",2,3]が一致。もしそうなら"OK"を表示。違えば"NG"を表示。', 'OK')
  })
  it('「ナデシコ」が空白行を出力してしまう問題の修正', async () => {
    let lineCount = 0
    const nako = new NakoCompiler()
    nako.logger.addListener('stdout', (_data) => { lineCount++ })
    nako.run('「a=1+2」をナデシコ')
    assert.strictEqual(lineCount, 0)
  })
  it('JSメソッド実行 #854', async () => {
    let globalScope
    let globalName
    if (typeof window === 'object' && typeof window.navigator === 'object') {
      globalScope = window
      globalName = 'window'
    } else {
      globalScope = global
      globalName = 'global'
    }
    // @ts-ignore
    globalScope.jstest = () => { return 777 }
    await cmp('「' + globalName + '」の「jstest」を[]でJSメソッド実行して表示。', '777')
    // @ts-ignore
    globalScope.jstest_x2 = (/** @type {number} */ a) => { return a * 2 }
    await cmp('「' + globalName + '」の「jstest_x2」を30でJSメソッド実行して表示。', '60')
    // @ts-ignore
    globalScope.jstest_mul = (/** @type {number} */ a, /** @type {number} */ b) => { return a * b }
    await cmp('「' + globalName + '」の「jstest_mul」を[30,30]でJSメソッド実行して表示。', '900')
  })
  it('BASE64 #1102', async () => {
    await cmp('「こんにちは」をBASE64エンコードして表示', '44GT44KT44Gr44Gh44Gv')
    await cmp('「44GT44KT44Gr44Gh44Gv」をBASE64デコードして表示', 'こんにちは')
    await cmp('「●ここだけ★のなでしこの話」をBASE64エンコードして表示', '4peP44GT44GT44Gg44GR4piF44Gu44Gq44Gn44GX44GT44Gu6Kmx')
    await cmp('「4peP44GT44GT44Gg44GR4piF44Gu44Gq44Gn44GX44GT44Gu6Kmx」をBASE64デコードして表示', '●ここだけ★のなでしこの話')
  })
  it('文字列分割 #1098', async () => {
    await cmp('「あ::い::う」を「::」で文字列分割してAに代入; A[0]を表示。A[1]を表示。', 'あ\nい::う')
    await cmp('「000-111-222」を「-」で文字列分割してAに代入; A[0]を表示。A[1]を表示。', '000\n111-222')
    await cmp('「ああ,いい,うう」を「,」で文字列分割して「==」で配列結合して表示。', 'ああ==いい,うう')
    await cmp('「ああ::いい::うう」を「::」で文字列分割して「=」で配列結合して表示。', 'ああ=いい::うう')
  })
  it('出現回数 #1105', async () => {
    await cmp('「あ::い::う」で「::」の出現回数を表示。', '2')
    await cmp('「あ::い::う::」で「::」の出現回数を表示。', '3')
    await cmp('「::あ::い::う」で「::」の出現回数を表示。', '3')
    await cmp('「▲あい▲うえ▲お」で「▲」の出現回数を表示。', '3')
    await cmp('「あい▲▲うえ▲▲お」で「▲▲」の出現回数を表示。', '2')
    await cmp('「番号0000」で「00」の出現回数を表示。', '2')
    await cmp('「番号0001」で「0」の出現回数を表示。', '3')
  })
  it('日時処理(簡易) #1117', async () => {
    await cmp('「2021/12/25」の曜日を表示。', '土')
    await cmp('(1640393988825/1000)を日時変換を表示。', '2021/12/25 09:59:48')
    await cmp('「2021/01/01」を和暦変換して表示。', '令和3年01月01日')
    await cmp('「1926/12/29」を和暦変換して表示。', '昭和元年12月29日')
    await cmp('「1990/03/30」を和暦変換して表示。', '平成2年03月30日')
    await cmp('「2017/03/06」の曜日。それを表示', '月')
    await cmp('「2017/03/06」の曜日番号取得。それを表示', '1')
    await cmp('「2017/03/06 00:00:00」をUNIX時間変換して表示', '1488726000')
    await cmp('「2017/03/06 00:00:01」をUNIX時間変換して表示', '1488726001')
    await cmp('「2017/03/06 00:00:00」をUNIXTIME変換して表示', '1488726000')
    await cmp('「2017/03/06 00:00:01」をUNIXTIME変換して表示', '1488726001')
    await cmp('1488726000を日時変換して表示', '2017/03/06 00:00:00')
    await cmp('1504191600を日時変換して表示', '2017/09/01 00:00:00')
  })
  it('日時差 #1117', async () => {
    await cmp('「2017/03/06」から「2018/03/06」までの年数差。それを表示', '1')
    await cmp('「2017/03/06」と「2018/03/06」の年数差。それを表示', '1')
    await cmp('「2018/03/06」から「2017/03/06」までの年数差。それを表示', '-1')
    await cmp('「2018/03/06」と「2017/03/06」の年数差。それを表示', '-1')
    await cmp('「2017/03/06」から「2017/04/06」までの月数差。それを表示', '1')
    await cmp('「2017/03/06」と「2017/04/06」の月数差。それを表示', '1')
    await cmp('「2017/04/06」から「2017/03/06」までの月数差。それを表示', '-1')
    await cmp('「2017/04/06」と「2017/03/06」の月数差。それを表示', '-1')
    await cmp('「2017/03/06」から「2017/04/06」までの日数差。それを表示', '31')
    await cmp('「2017/03/06」と「2017/04/06」の日数差。それを表示', '31')
    await cmp('「2017/04/06」から「2017/03/06」までの日数差。それを表示', '-31')
    await cmp('「2017/04/06」と「2017/03/06」の日数差。それを表示', '-31')
    await cmp('「2017/03/06 00:00:00」から「2017/03/06 12:00:00」までの時間差。それを表示', '12')
    await cmp('「2017/03/06 00:00:00」と「2017/03/06 12:00:00」の時間差。それを表示', '12')
    await cmp('「00:00:00」から「12:00:00」までの時間差。それを表示', '12')
    await cmp('「00:00:00」と「12:00:00」の時間差。それを表示', '12')
    await cmp('「2017/03/06 12:00:00」から「2017/03/06 00:00:00」までの時間差。それを表示', '-12')
    await cmp('「2017/03/06 12:00:00」と「2017/03/06 00:00:00」の時間差。それを表示', '-12')
    await cmp('「12:00:00」から「00:00:00」までの時間差。それを表示', '-12')
    await cmp('「12:00:00」と「00:00:00」の時間差。それを表示', '-12')
    await cmp('「2017/03/06 00:00:00」から「2017/03/06 00:59:00」までの分差。それを表示', '59')
    await cmp('「2017/03/06 00:00:00」と「2017/03/06 00:59:00」の分差。それを表示', '59')
    await cmp('「00:00:00」から「00:59:00」までの分差。それを表示', '59')
    await cmp('「00:00:00」と「00:59:00」の分差。それを表示', '59')
    await cmp('「2017/03/06 00:59:00」から「2017/03/06 00:00:00」までの分差。それを表示', '-59')
    await cmp('「2017/03/06 00:59:00」と「2017/03/06 00:00:00」の分差。それを表示', '-59')
    await cmp('「00:59:00」から「00:00:00」までの分差。それを表示', '-59')
    await cmp('「00:59:00」と「00:00:00」の分差。それを表示', '-59')
    await cmp('「2017/03/06 00:00:00」から「2017/03/06 00:00:59」までの秒差。それを表示', '59')
    await cmp('「2017/03/06 00:00:00」と「2017/03/06 00:00:59」の秒差。それを表示', '59')
    await cmp('「00:00:00」から「00:00:59」までの秒差。それを表示', '59')
    await cmp('「00:00:00」と「00:00:59」の秒差。それを表示', '59')
    await cmp('「2017/03/06 00:00:59」から「2017/03/06 00:00:00」までの秒差。それを表示', '-59')
    await cmp('「2017/03/06 00:00:59」と「2017/03/06 00:00:00」の秒差。それを表示', '-59')
    await cmp('「00:00:59」から「00:00:00」までの秒差。それを表示', '-59')
    await cmp('「00:00:59」と「00:00:00」の秒差。それを表示', '-59')
    await cmp('「2020/07/17 00:00:00」と「2020/07/18 00:00:00」の「時間」による日時差を表示', '24')
  })
  it('日時加算 #1117', async () => {
    await cmp('「2017/03/06 00:00:01」に「+00:00:00」を時間加算。それを表示', '2017/03/06 00:00:01')
    await cmp('「2017/03/06 00:00:01」に「+01:02:03」を時間加算。それを表示', '2017/03/06 01:02:04')
    await cmp('「00:00:01」に「+01:02:03」を時間加算。それを表示', '01:02:04')
    await cmp('「2017/03/06 00:00:01」に「-01:02:03」を時間加算。それを表示', '2017/03/05 22:57:58')
    await cmp('「00:00:01」に「-01:02:03」を時間加算。それを表示', '22:57:58')
    await cmp('「2017/03/06 00:00:01」に「+1年」を日時加算。それを表示', '2018/03/06 00:00:01')
    await cmp('「2017/03/06」に「+1年」を日時加算。それを表示', '2018/03/06')
    await cmp('「2017/03/06 00:00:01」に「+1ヶ月」を日時加算。それを表示', '2017/04/06 00:00:01')
    await cmp('「2017/03/06」に「+1ヶ月」を日時加算。それを表示', '2017/04/06')
    await cmp('「2017/03/06 00:00:01」に「+1日」を日時加算。それを表示', '2017/03/07 00:00:01')
    await cmp('「2017/03/06」に「+1日」を日時加算。それを表示', '2017/03/07')
    await cmp('「2017/03/06 00:00:01」に「+1時間」を日時加算。それを表示', '2017/03/06 01:00:01')
    await cmp('「00:00:01」に「+1時間」を日時加算。それを表示', '01:00:01')
    await cmp('「2017/03/06 00:00:01」に「+2分」を日時加算。それを表示', '2017/03/06 00:02:01')
    await cmp('「00:00:01」に「+2分」を日時加算。それを表示', '00:02:01')
    await cmp('「2017/03/06 00:00:01」に「+3秒」を日時加算。それを表示', '2017/03/06 00:00:04')
    await cmp('「00:00:01」に「+3秒」を日時加算。それを表示', '00:00:04')
    await cmp('「2017/03/06 00:00:01」に「-1年」を日時加算。それを表示', '2016/03/06 00:00:01')
    await cmp('「2017/03/06」に「-1年」を日時加算。それを表示', '2016/03/06')
    await cmp('「2017/03/06 00:00:01」に「-1ヶ月」を日時加算。それを表示', '2017/02/06 00:00:01')
    await cmp('「2017/03/06」に「-1ヶ月」を日時加算。それを表示', '2017/02/06')
    await cmp('「2017/03/06 00:00:01」に「-1日」を日時加算。それを表示', '2017/03/05 00:00:01')
    await cmp('「2017/03/06」に「-1日」を日時加算。それを表示', '2017/03/05')
    await cmp('「2017/03/06 00:00:01」に「-1時間」を日時加算。それを表示', '2017/03/05 23:00:01')
    await cmp('「00:00:01」に「-1時間」を日時加算。それを表示', '23:00:01')
    await cmp('「2017/03/06 00:00:01」に「-2分」を日時加算。それを表示', '2017/03/05 23:58:01')
    await cmp('「00:00:01」に「-2分」を日時加算。それを表示', '23:58:01')
    await cmp('「2022/02/16 00:00:02」に「-2秒」を日時加算。それを表示', '2022/02/16 00:00:00')
    await cmp('「2022/02/16 00:02:00」に「-2分」を日時加算。それを表示', '2022/02/16 00:00:00')
    await cmp('「2022/02/16 02:00:00」に「-2時間」を日時加算。それを表示', '2022/02/16 00:00:00')
    await cmp('「2017/03/06 00:00:01」に「-3秒」を日時加算。それを表示', '2017/03/05 23:59:58')
    await cmp('「2022/02/16」に「-1日」を日時加算。それを表示', '2022/02/15')
    await cmp('「00:00:01」に「-3秒」を日時加算。それを表示', '23:59:58')
    await cmp('「2017/03/06 00:00:01」に「+0001/02/03」を日付加算。それを表示', '2018/05/09 00:00:01')
    await cmp('「2017/03/06」に「+0001/02/03」を日付加算。それを表示', '2018/05/09')
    await cmp('「2017/03/06 00:00:01」に「-0001/02/03」を日付加算。それを表示', '2016/01/03 00:00:01')
    await cmp('「2017/03/06」に「-0001/02/03」を日付加算。それを表示', '2016/01/03')
    await cmp('「2021/12/01」に「2週間」を日時加算して表示', '2021/12/15')
    await cmp('「2021/12/29 23:59:59」に「2週間」を日時加算して表示', '2022/01/12 23:59:59')
    await cmp('「2024-05-10T10:50」に「10分」を日時加算して表示', '2024/05/10 11:00:00')
  })
  it('日時書式変換 #1117', async () => {
    await cmp('T=「2000/1/2 00:00:00」をUNIX時間変換;Tを「YYYY-MM-DD」で日時書式変換して表示', '2000-01-02')
    await cmp('T=「2000/1/2 03:04:05」をUNIX時間変換;Tを「YYYY-MM-DD HH:mm:ss」で日時書式変換して表示', '2000-01-02 03:04:05')
    await cmp('T=「2021/12/25」をUNIX時間変換;Tを「YYYY-MM-DD(W)」で日時書式変換して表示', '2021-12-25(土)')
    await cmp('T=「2021/12/25」をUNIX時間変換;Tを「YYYY-MM-DD(WWW)」で日時書式変換して表示', '2021-12-25(Sat)')
    await cmp('T=「2021/12/25」をUNIX時間変換;Tを「WWW MMM DD YYYY」で日時書式変換して表示', 'Sat Dec 25 2021')
    await cmp('1640438681.025を「HH:mm:ss.ccc」で日時書式変換して表示', '22:24:41.025')
    await cmp('「2024-05-10T10:50」を「YYYY/MM/DD HH:mm:ss」で日時書式変換して表示', '2024/05/10 10:50:00')
  })
  it('日時書式変換 #1121', async () => {
    await cmp('「2000/1/2 00:00:00」を「YYYY-MM-DD」で日時書式変換して表示', '2000-01-02')
    await cmp('「2023/4/5 00:00:00」を「YYYYMMDD」で日時書式変換して表示', '20230405')
    await cmp('1640438681.025を「HH:mm:ss.ccc」で日時書式変換して表示', '22:24:41.025')
  })
  it('『昨日』の問題 #1124', async () => {
    await cmp('昨日。もしそれが「」でなければ「OK」と表示', 'OK')
    await cmp('今日に「-1日」を日時加算してDに代入。昨日とDが等しい。もしそうならば「OK」と表示。', 'OK')
    await cmp('今日に「1日」を日時加算してDに代入。明日とDが等しい。もしそうならば「OK」と表示。', 'OK')
    await cmp('今月に1を足してDに代入。来月とDが等しい。もしそうならば「OK」と表示。', 'OK')
    await cmp('今月に-1を足してDに代入。先月とDが等しい。もしそうならば「OK」と表示。', 'OK')
    await cmp('今年に1を足してDに代入。来年とDが等しい。もしそうならば「OK」と表示。', 'OK')
    await cmp('今年に-1を足してDに代入。去年とDが等しい。もしそうならば「OK」と表示。', 'OK')
  })
  it('『二乗』 #1140', async () => {
    await cmp('3の二乗を表示', '9')
    await cmp('2の3のべき乗を表示', '8')
  })
  it('『偶数』『奇数』 #1146', async () => {
    await cmp('もし4が偶数ならば「OK」と表示。', 'OK')
    await cmp('もし3が奇数ならば「OK」と表示。', 'OK')
  })
  it('範囲切り取る(core#164)', async () => {
    await cmp('S=「aaa[bbb]ccc」。Sの「[」から「]」まで範囲切り取って表示', 'bbb')
    await cmp('S=「aaa[bbb]ccc」。Sの「[」から「]」まで範囲切り取る。対象を表示', 'aaaccc')
    await cmp('S=「aaa[[bbb]]ccc」。Sの「[[」から「]]」まで範囲切り取って表示', 'bbb')
    await cmp('S=「aaa[[bbb]]ccc」。Sの「[[」から「]]」まで範囲切り取る。対象を表示', 'aaaccc')
    // 見つからなかった時の動作
    await cmp('S=「aaa[[bbb]]ccc」。Sの「<<」から「>>」まで範囲切り取る。「{それ}::{対象}」を表示', '::aaa[[bbb]]ccc')
    await cmp('S=「aaa[[bbb]]ccc」。Sの「[[」から「>>」まで範囲切り取る。「{それ}::{対象}」を表示', 'bbb]]ccc::')
    await cmp('S=「aaa[[bbb]]ccc」。Sの「<<」から「]]」まで範囲切り取る。「{それ}::{対象}」を表示', '::aaa[[bbb]]ccc')
  })
})
