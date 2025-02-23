/* eslint-disable no-undef */
import assert from 'assert'
import { NakoCompiler } from '../src/nako3.mjs'

describe('calc_test.js', async () => {
  const cmp = async (/** @type {string} */ code, /** @type {string} */ res) => {
    const nako = new NakoCompiler()
    assert.strictEqual((await nako.runAsync(code, 'main.nako3')).log, res)
  }
  const errorTest = async (/** @type {string} */ code, /** @type {string} */ errorType, /** @type {string} */ partOfErrorStr) => {
    const nako = new NakoCompiler()
    try {
      await nako.runAsync(code, 'main.nako3')
    } catch (err) {
      assert.strictEqual(errorType, err.type)
      assert.strictEqual(err.msg.indexOf(partOfErrorStr) >= 0, true)
    }
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
  it('MAX', async () => {
    await cmp('10と20のMAXを表示', '20')
    await cmp('MAX(10, 20)を表示', '20')
    await cmp('MAX(10, 20, 30)を表示', '30')
  })
  it('最大値', async () => {
    await cmp('10と20の最大値を表示', '20')
    await cmp('10と20と30の最大値を表示', '30')
    await cmp('10と10の最大値を表示', '10')
  })
  it('MIN', async () => {
    await cmp('10と20のMINを表示', '10')
    await cmp('MIN(10, 20)を表示', '10')
    await cmp('MIN(5, 10, 20, 30)を表示', '5')
  })
  it('最小値', async () => {
    await cmp('10と20の最小値を表示', '10')
    await cmp('5と10と20と30の最小値を表示', '5')
    await cmp('10と10の最小値を表示', '10')
  })
  it('CLAMP', async () => {
    await cmp('10の20から30までのCLAMPを表示', '20')
    await cmp('40を20から30でCLAMPして表示', '30')
    await cmp('25の20から30までのCLAMPを表示', '25')
    await cmp('CLAMP(10, 20, 30)を表示', '20')
    await cmp('CLAMP(20, 20, 30)を表示', '20')
    await cmp('CLAMP(30, 20, 30)を表示', '30')
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
    await cmp('(!1)を表示', 'false')
    await cmp('(!0)を表示', 'true')
    await cmp('(!オン)を表示', 'false')
    await cmp('(!オフ)を表示', 'true')
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
  it('連文呼び出しにおけるスタックの余剰チェックを厳しくする #87', async () => {
    await cmp('3に5を足して2を掛けて表示', '16')
    await cmp('「  あああ  」の「あ」を「え」に置換して空白除去して表示', 'えええ')
    await errorTest('3の「  あああ  」の「あ」を「え」に置換して空白除去して表示', 'NakoSyntaxError', '未解決の単語があります')
    await errorTest('9の1に2を足して5を足して表示', 'NakoSyntaxError', '未解決の単語があります')
  })
  it('代入文における連文 #88', async () => {
    await cmp('N=「あああ」の「あ」を「え」に置換して空白除去。Nを表示。', 'えええ')
    await errorTest('N=30の「あああ」の「あ」を「え」に置換して空白除去。Nを表示。', 'NakoSyntaxError', '未解決の単語があります')
  })
  it('演算子「**」(#1424)', async () => {
    await cmp('2**3を表示;', '8')
    await cmp('2^3を表示;', '8')
    await cmp('2**4を表示;', '16')
  })
  it('代入文における関数呼び出し(#1449)', async () => {
    await cmp('N=(「abc」の文字数)+1;Nを表示;', '4')
    await cmp('N=「abc」の文字数+1;Nを表示;', '4')
    await cmp('N=1に2を足して5を掛ける+1;Nを表示;', '16')
    await cmp('N=文字数("abc")+1;Nを表示;', '4')
    await cmp('N=1に2を足す+2に3を掛ける;Nを表示;', '15')
  })
  it('bigint足し算', async () => {
    await cmp('3n+5nを表示', '8')
    await cmp('1234567890123456789n+9876543219876543210nを表示', '11111111109999999999')
    await cmp('a=1234567890123456789n;a+9876543219876543210nを表示', '11111111109999999999')
    await cmp('a=1234567890123456789n;b=9876543219876543210n;a+bを表示', '11111111109999999999')
  })
  it('bigint四則演算', async () => {
    await cmp('3n-5nを表示', '-2')
    await cmp('9876543219876543210n-1234567890123456789nを表示', '8641975329753086421')
    await cmp('a=9876543219876543210n;a-1234567890123456789nを表示', '8641975329753086421')
    await cmp('a=9876543219876543210n;1234567890123456789n-aを表示', '-8641975329753086421')
    await cmp('a=9876543219876543210n;b=1234567890123456789n;a-bを表示', '8641975329753086421')

    await cmp('3n*5nを表示', '15')
    await cmp('1234567890123456789n*9876543219876543210nを表示', '12193263124676116323609205901126352690')
    await cmp('a=1234567890123456789n;a*9876543219876543210nを表示', '12193263124676116323609205901126352690')
    await cmp('a=1234567890123456789n;9876543219876543210n*aを表示', '12193263124676116323609205901126352690')
    await cmp('a=1234567890123456789n;b=9876543219876543210n;a*bを表示', '12193263124676116323609205901126352690')

    await cmp('10n/3nを表示', '3')
    await cmp('10n/-3nを表示', '-3')
    await cmp('-10n/3nを表示', '-3')
    await cmp('-10n/-3nを表示', '3')
    await cmp('98765432198765432109876543210n/1234567890123456789nを表示', '80000000801')
    await cmp('98765432198765432109876543210987654321987654321n/1234567890123456789nを表示', '80000000801000007290800066347')
    await cmp('a=98765432198765432109876543210987654321987654321n;a/1234567890123456789nを表示', '80000000801000007290800066347')
    await cmp('b=1234567890123456789n;98765432198765432109876543210987654321987654321n/bを表示', '80000000801000007290800066347')
    await cmp('a=98765432198765432109876543210987654321987654321n;b=1234567890123456789n;a/bを表示', '80000000801000007290800066347')

    await cmp('10n%3nを表示', '1')
    await cmp('10n%-3nを表示', '1')
    await cmp('-10n%3nを表示', '-1')
    await cmp('-10n%-3nを表示', '-1')
    await cmp('98765432198765432109876543210n%1234567890123456789nを表示', '9000987655221')
    await cmp('98765432198765432109876543210987654321987654321n%1234567890123456789nを表示', '13091059800074538')
    await cmp('a=98765432198765432109876543210987654321987654321n;a%1234567890123456789nを表示', '13091059800074538')
    await cmp('b=1234567890123456789n;98765432198765432109876543210987654321987654321n%bを表示', '13091059800074538')
    await cmp('a=98765432198765432109876543210987654321987654321n;b=1234567890123456789n;a%bを表示', '13091059800074538')

    await cmp('10n ** 3nを表示', '1000')
    await cmp('3n ** 60nを表示', '42391158275216203514294433201')
    await cmp('-3n ** 60nを表示', '42391158275216203514294433201')
    await cmp('-3n ** 61nを表示', '-127173474825648610542883299603')
  })
  it('bigint単項演算子', async () => {
    await cmp('-3n*5nを表示', '-15')
    await cmp('-1234567890123456789n*9876543219876543210nを表示', '-12193263124676116323609205901126352690')
    await cmp('1234567890123456789n*-9876543219876543210nを表示', '-12193263124676116323609205901126352690')
    await cmp('-1234567890123456789n*-9876543219876543210nを表示', '12193263124676116323609205901126352690')

    await cmp('a=1234567890123456789n;a*-9876543219876543210nを表示', '-12193263124676116323609205901126352690')
  })


  it('bigint比較演算子', async () => {
    await cmp('a= 1234567890123456789n > 9876543219876543210n; aを表示', 'false')
    await cmp('a= 1234567890123456789n > 9876543219876543210; aを表示', 'false')
    await cmp('a= 1234567890123456789 > 9876543219876543210n; aを表示', 'false')
    await cmp('a= 1234567890123456789n < 9876543219876543210n; aを表示', 'true')
    await cmp('a= 1234567890123456789n < 9876543219876543210; aを表示', 'true')
    await cmp('a= 1234567890123456789 < 9876543219876543210n; aを表示', 'true')
  })

  it('bigintビット演算', async () => {
    await cmp('1234567890123456789n<<60nを表示', '1423359869420436337641010675071320064')
    await cmp('123456789012345678901234567890123456789n>>60nを表示', '107081695084215790682')
  })

  it('似たフォント問題：なでしこ3で「✕」で掛け算させる #1781', async () => {
    // multiple
    await cmp('(2*3)を表示', '6')
    await cmp('(2✕3)を表示', '6') // 0x2715
    await cmp('(2✖3)を表示', '6') // 0x2716
    await cmp('(2✗3)を表示', '6') // 0x2717
    await cmp('(2✘3)を表示', '6') // 0x2718
    await cmp('(2❌3)を表示', '6') // 0x274C
    // others
    await cmp('(2➕3)を表示', '5')
    await cmp('(20➖3)を表示', '17')
    await cmp('(21÷3)を表示', '7')
    await cmp('(21➗3)を表示', '7')
    await cmp('(20➖3)を表示', '17')
    await cmp('A🟰3;Aを表示', '3')
  })

  it('「増やす」「減らす」文の対象が文字列のとき文字列結合してしまう #1956', async () => {
    await cmp('N="1";Nを1増やす。Nを表示。', '2')
    await cmp('N="2";Nを1減らす。Nを表示。', '1')
    await cmp('N="2";Nを"1"減らす。Nを表示。', '1')
  })
})
