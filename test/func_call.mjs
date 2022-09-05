/* eslint-disable no-undef */
import assert from 'assert'
import { NakoCompiler } from '../src/nako3.mjs'
import { NakoSyntaxError } from '../src/nako_errors.mjs'

describe('関数呼び出しテスト', async () => {
  const cmp = async (/** @type {string} */ code, /** @type {string} */ res) => {
    const nako = new NakoCompiler()
    nako.logger.debug('code=' + code)
    assert.strictEqual((await nako.runAsync(code)).log, res)
  }
  const cmd = (/** @type {string} */ code) => {
    const nako = new NakoCompiler()
    nako.logger.debug('code=' + code)
    nako.run(code)
  }
  // --- test ---
  it('関数式の呼び出し - 足す(2,3)を表示。', async () => {
    await cmp('足す(2,3)を表示。', '5')
  })
  it('四則演算を連文で', async () => {
    await cmp('1に2を足して3を掛けて3で割って2を引いて表示', '1')
  })
  it('「そう」のテスト', async () => {
    await cmp('３が１以上。もしそうならば「真」と表示。', '真')
  })
  it('後方で定義した関数を前方で使う1', async () => {
    await cmp('HOGE(3,4)を表示;●(A,B)HOGEとは;それはA+B;ここまで;', '7')
    await cmp('「姫」と「殿」が出会って表示;●(AとBが)出会うとは;それはA&B;ここまで;', '姫殿')
  })
  it('後方で定義した関数を前方で使う2', async () => {
    await cmp('Nとは変数=30;HOGE(3,4)を表示;●(A,B)HOGEとは;それはA+B+N;ここまで;', '37')
  })
  it('代入と表示', async () => {
    await cmp('A=今日;もし(今日=A)ならば「1」と表示', '1')
  })
  it('代入1', async () => {
    await cmp('A=今日の曜日番号取得;B=(今日)の曜日番号取得;もしA=Bならば「等しい」を表示。', '等しい')
  })
  it('代入2', async () => {
    await cmp('Aは、今日の曜日番号取得;Bは、(今日)の曜日番号取得;もしA=Bならば「等しい」を表示。', '等しい')
  })
  it('代入3', async () => {
    await cmp('A=(今日の曜日番号取得)+1;B=((今日)の曜日番号取得)+1;もしA=Bならば「等しい」を表示。', '等しい')
  })
  it('配列への代入', async () => {
    await cmp('値段は空配列。値段[0]に3000を代入。値段[0]を表示。', '3000')
  })
  it('**には**構文 - 基本', async () => {
    await cmp('実行には;「あ」と表示;ここまで', 'あ')
  })
  it('**には**構文 - 配列カスタムソート', async () => {
    await cmp('A=[5,1,3];Aを配列カスタムソートするには(a,b);それはb-a;ここまで;Aを「:」で配列結合して表示', '5:3:1')
  })
  it('階乗計算 - 再帰', async () => {
    await cmp('●(VをAのBで)階乗計算とは;' +
      'もし、Bが0以下ならば、Vを戻す。;(V*A)をAの(B-1)で階乗計算して戻す。' +
      'ここまで。;1を2の3で階乗計算して表示。', '8')
  })
  it('連続文後の代入', async () => {
    await cmp('「2017/09/01T00:00:99」の「T」を「 」に置換して「 」まで切り取り、対象日に代入。対象日を表示。', '2017/09/01')
  })
  it('連続文後の=代入', async () => {
    await cmp('対象日=「2017/09/01T00:00:99」の「T」を「 」に置換して「 」まで切り取る。対象日を表示。', '2017/09/01')
  })
  it('関数の引数に関数呼び出しがある場合', async () => {
    await cmp('A=「ab」;「abcd」の1から(Aの文字数)だけ文字削除。それを表示。', 'cd')
  })
  it('配列カスタムソートの基本的な使い方例', async () => {
    await cmp('●MYSORT(a,b)とは\n' +
        '(INT(a) - INT(b))で戻る。\n' +
        'ここまで。\n' +
        'ARY=[8,3,4];' +
        '「MYSORT」でARYを配列カスタムソートしてJSONエンコードして表示', '[3,4,8]')
  })
  it('引数の順番を入れ替えて呼び出す(#342)その1', async () => {
    await cmp('『abc』の『a』を「*」に置換。表示', '*bc')
    await cmp('『a』を「*」に『abc』の置換。表示', '*bc')
    await cmp('「*」へ『a』から『abc』の置換。表示', '*bc')
    await cmp('「abcdefg」の1から3だけ文字削除して表示。', 'defg')
    await cmp('「abcdefg」の1から3を文字削除して表示。', 'defg')
    await cmp('1から3を「abcdefg」の文字削除して表示。', 'defg')
    await cmp('3を「abcdefg」の1から文字削除して表示。', 'defg')
    await cmp('3だけ「abcdefg」の1から文字削除して表示。', 'defg')
  })
  it('引数の順番を入れ替えて呼び出す(#342)その2', async () => {
    await cmp('[8,3,4]の配列カスタムソートには(a,b)\nそれは(a - b)\nここまで。それをJSONエンコードして表示', '[3,4,8]')
    await cmp('[8,3,4]を配列カスタムソートには(a,b)\nそれは(a - b)\nここまで。それをJSONエンコードして表示', '[3,4,8]')
    await cmp('[8,3,4]の配列カスタムソートには(a,b)\nそれは(INT(a) - INT(b))\nここまで。それをJSONエンコードして表示', '[3,4,8]')
  })
  it('引数の順番を入れ替えて呼び出す(#342)その3', async () => {
    await cmp('ARY=[8,3,4];' +
        'ARYの配列カスタムソートには(a,b)\n' +
        'aと255のXORをAに代入。bと255のXORをBに代入。' +
        'それは(INT(a) - INT(b))\n' +
        'ここまで。\n' +
        'ARYをJSONエンコードして表示', '[3,4,8]')
  })
  it('可変長引数 #729', async () => { // 経緯 #501 → #729
    await cmp('連続加算(1,2,3)を表示。', '6')
    await cmp('1と2と3を連続加算して表示。', '6')
    await cmp('1に2と3を連続加算して表示。', '6')
  })
  // ---
  it('関数呼び出し演算子に変更(1) #891', async () => {
    await cmp('表示←3', '3')
    await cmp('表示←3を', '3')
    await cmp('表示←INT←3.14', '3')
    await cmp('足す←2に3を;それを表示;', '5')
    await cmp('割る←10を2で;それを表示;', '5')
    await cmp('割る<--2で10を;それを表示', '5')
  })
  it('関数呼び出し演算子に変更(2) #891', async () => {
    await cmp('A=(割る<--10を2で)+2;Aを表示;', '7')
    await cmp('(割る←10を2で)を表示;', '5')
    await cmp('割る<--2で(割る←100を10で)を;それを表示', '5')
    await cmp('(割る←100を10で)を2で割って表示', '5')
  })
  it('関数呼び出し演算子に変更(ユーザー関数) #891', async () => {
    await cmp('●(Aを)AAA;それはA*2;ここまで;AAA←30;それを表示', '60')
    await cmp('●(AをBで)AAA;それはA/B;ここまで;AAA←30を3で;それを表示', '10')
  })
  it('エラー/関数の呼び出し演算子 #891/引数がない関数', async () => {
    const funcName = 'AAA'
    assert.throws(
      () => cmd(`●${funcName};それは5;ここまで;${funcName}←`),
      NakoSyntaxError, `引数がない関数『${funcName}』を関数呼び出し演算子で呼び出すことはできません。`
    )
  })
  it('エラー/関数の呼び出し演算子 #891/引数が異なる', async () => {
    const funcName = 'テスト'
    assert.throws(
      () => cmd(`●${funcName}(aとbを);それはa*b;ここまで;${funcName}<--8と`),
      NakoSyntaxError, `関数『${funcName}』呼び出しで引数の数(1)が定義(2)と違います。`
    )
  })
  it('ローカル変数が解決できない1 #1210', async () => {
    await cmp('S＝「あいうえお」;A＝「かきくけこ」;AをFテスト;●(Sを)Fテストとは;Sを表示;ここまで', 'かきくけこ')
  })
  it('ローカル変数が解決できない2 #1210', async () => {
    await cmp('S＝「あいうえお」;Fテスト;●Fテストとは;Sとは変数=30;Sを表示;ここまで', '30')
    await cmp('S＝「あいうえお」;Fテスト;Sを表示;●Fテストとは;Sとは変数=30;ここまで', 'あいうえお')
    await cmp('A=10;B=20;Aを三倍処理して表示;●(Bを)三倍処理とは;Aとは変数=3;A*Bを戻す;ここまで', '30')
  })
  it('ローカル変数の配列が解決できない2 #1213', async () => {
    await cmp(`
    変数 A＝空配列。
    B＝[10,20,30]
    BでAAテスト    
    ●(Aで)AAテスト
        もし(A[0]=10)かつ(A[1]=20)ならば「OK」を表示。
        違えば,「NG」を表示。# （えっ！）
    ここまで。
    `, 'OK')
  })
  it('ひらがなだけの関数名がエラーになる #1214', async () => {
    await cmp('あ。;●あとは;「A」と表示;ここまで', 'A')
    await cmp('おくら。;●おくらとは;「O」と表示;ここまで', 'O')
  })
  it('『ナデシコ続』で変数がクリアされてしまう #1246', async () => {
    await cmp('A=30;「Aを表示」をナデシコ続。', '30')
  })
  it('ユーザー引数で「それ」補完を行う', async () => {
    await cmp('●(SのAをBに)MY置換;SのAからBへ置換;ここまで;それは「123」;「1」を「x」にMY置換;「2」を「x」にMY置換;それを表示。', 'xx3')
  })
  it('ユーザー関数で引数が不足しているとき、それが補完されない場合がある #1316', async () => {
    await cmp('●(A,B,Cで)XXとは;[A,B,C]を「:」で配列結合すること;ここまで。それは"x";2,3でXXを表示', 'x:2:3')
  })
  it('代入文で関数呼び出し', async () => {
    const code = '' +
      '●AAAとは：\n' +
      '　　それは「あいうえお」\n' +
      '●(Nを)装飾処理とは：\n' +
      '  それは「<<{N}>>」\n' +
      'TMP=AAAを装飾処理\n' +
      'TMPを表示。\n'
    await cmp(code, '<<あいうえお>>')
  })
})
