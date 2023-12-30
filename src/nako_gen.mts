/**
 * パーサーが生成した中間オブジェクトを実際のJavaScriptのコードに変換する。
 * なお速度優先で忠実にJavaScriptのコードを生成する。
 */

import { NakoSyntaxError } from './nako_errors.mjs'
import { Ast, FuncList, FuncArgs, Token, NakoDebugOption } from './nako_types.mjs'
import { NakoCompiler } from './nako3.mjs'

// なでしこで定義した関数の開始コードと終了コード
const topOfFunction = '(function(){\n'
const endOfFunction = '})'
const topOfFunctionAsync = '(async function(){\n'

interface VarsSet {
  isFunction: boolean;
  names: Set<string>;
  readonly: Set<string>;
}
interface SpeedMode {
  lineNumbers: number; // 行番号を出力しない
  implicitTypeCasting: number; // 数値加算でparseFloatを出力しない
  invalidSore: number; // 「それ」を用いない
  forcePure: number; // 全てのシステム命令をpureとして扱う。命令からローカル変数への参照が出来なくなる。
}
interface PerformanceMonitor {
  userFunction: number; // 呼び出されたユーザ関数
  systemFunction: number; // システム関数(呼び出しコードを含む)
  systemFunctionBody: number; // システム関数(呼び出しコードを除く)
  mumeiId: number;
}
interface FindVarResult {
  i: number;
  name: string;
  isTop: boolean;
  js: string
}
/** コード生成オプション */
export class NakoGenOptions {
  isTest: boolean
  importFiles: string[]
  codeStandalone: string
  codeEnv: string
  constructor (isTest = false, importFiles: string[] = [], codeStandalone = '', convEnv = '') {
    this.isTest = isTest
    this.codeStandalone = codeStandalone
    this.codeEnv = convEnv
    this.importFiles = ['plugin_system.mjs', 'plugin_math.mjs', 'plugin_csv.mjs', 'plugin_promise.mjs', 'plugin_test.mjs']
    for (const fname of importFiles) {
      this.importFiles.push(fname)
    }
  }
}

/**
 * 構文木からJSのコードを生成するクラス
 */
export class NakoGen {
  private nakoFuncList: FuncList // なでしこ自身で定義した関数の一覧
  private nakoTestFuncs: FuncList // テストのための関数
  private usedFuncSet: Set<string> // 利用があった関数をメモする
  private usedAsyncFn: boolean // 非同期関数が使われているか判定
  private loopId: number // ループを生成する際にダミーのループ変数を管理するため
  private flagLoop: boolean // 変換中のソースがループの中かどうかを判定する
  private constPools: Array<any> // 定数プール用
  private constPoolsTemplate: string[] // 定数プール生成用テンプレート
  // コード生成オプション
  private speedMode: SpeedMode
  private performanceMonitor: PerformanceMonitor
  private warnUndefinedVar: boolean
  private warnUndefinedReturnUserFunc: number
  private warnUndefinedCallingUserFunc: number
  private warnUndefinedCallingSystemFunc: number
  private warnUndefinedCalledUserFuncArgs: number
  // 変数管理
  private varslistSet: VarsSet[] // [システム変数一覧, グローバル変数一覧, ローカル変数一覧]で変数セットを記録
  private varsSet: VarsSet // ローカルな変数を記録
  public debugOption: NakoDebugOption
  // public
  numAsyncFn: number
  __self: NakoCompiler
  genMode: string
  lastLineNo: string | null // `l123:main.nako3`形式

  /** constructor
   * @param com コンパイラのインスタンス
   */
  constructor (com: NakoCompiler) {
    /**
     * 出力するJavaScriptコードのヘッダー部分で定義する必要のある関数。fnはjsのコード。
     * プラグイン関数は含まれない。
     */
    this.nakoFuncList = { ...com.getNakoFuncList() }

    /**
     * なでしこで定義したテストの一覧
     */
    this.nakoTestFuncs = {}

    /**
     * プログラム内で参照された関数のリスト。プラグインの命令を含む。
     * JavaScript単体で実行するとき、このリストにある関数の定義をJavaScriptコードの先頭に付け足す。
     */
    this.usedFuncSet = new Set()

    /**
     * ループ時の一時変数が被らないようにIDで管理
     */
    this.loopId = 1

    /**
     * 非同関数を何回使ったか
     */
    this.numAsyncFn = 0

    /**
     * 関数定義の際、関数の中でasyncFn=trueの関数を呼び出したかどうかを調べる @see convDefFuncCommon
     */
    this.usedAsyncFn = false

    /** 変換中の処理が、ループの中かどうかを判定する */
    this.flagLoop = false

    this.__self = com

    /** コードジェネレータの種類 */
    this.genMode = 'sync'

    /** 行番号とファイル名が分かるときは `l123:main.nako3`、行番号だけ分かるときは `l123`、そうでなければ任意の文字列。 */
    this.lastLineNo = null

    /** スタック */
    this.varslistSet = com.__varslist.map((v) => ({ isFunction: false, names: new Set(Object.keys(v)), readonly: new Set() }))

    /** スタックトップ */
    this.varsSet = { isFunction: false, names: new Set(), readonly: new Set() }
    this.varslistSet[2] = this.varsSet

    // 1以上のとき高速化する。
    // 実行速度優先ブロック内で1増える。
    this.speedMode = {
      lineNumbers: 0, // 行番号を出力しない
      implicitTypeCasting: 0, // 数値加算でparseFloatを出力しない
      invalidSore: 0, // 「それ」を用いない
      forcePure: 0 // 全てのシステム命令をpureとして扱う。命令からローカル変数への参照が出来なくなる。
    }

    // 1以上のとき測定をinjectする。
    // パフォーマンスモニタのブロック内で1増える。
    this.performanceMonitor = {
      userFunction: 0, // 呼び出されたユーザ関数
      systemFunction: 0, // システム関数(呼び出しコードを含む)
      systemFunctionBody: 0, // システム関数(呼び出しコードを除く)
      mumeiId: 0
    }

    /**
     * 未定義の変数の警告を行う
     */
    this.warnUndefinedVar = true
    this.constPools = []
    this.constPoolsTemplate = []

    // 暫定変数
    this.warnUndefinedReturnUserFunc = 1
    this.warnUndefinedCallingUserFunc = 1
    this.warnUndefinedCallingSystemFunc = 1
    this.warnUndefinedCalledUserFuncArgs = 1

    this.debugOption = com.debugOption
  }

  static isValidIdentifier (name: string) {
    // TODO: いらなそうな部分は削る
    // https://stackoverflow.com/a/9337047
    // eslint-disable-next-line no-misleading-character-class
    return /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[$A-Z_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/.test(name)
  }

  /**
   * 改行を埋め込む
   */
  convLineno (node: Ast, forceUpdate = false, incLine = 0): string {
    // スピードモードでは行番号を埋め込まない
    if (this.speedMode.lineNumbers > 0) { return '' }

    const lineNo: number = node.line + incLine
    let lineNoStr: string
    if (typeof node.line !== 'number') {
      lineNoStr = 'unknown'
    } else if (typeof node.file !== 'string') {
      lineNoStr = `l${lineNo}`
    } else {
      lineNoStr = `l${lineNo}:${node.file}`
    }

    // 強制的に行番号をアップデートするか
    if (!forceUpdate) {
      if (lineNoStr === this.lastLineNo) { return '' }
      this.lastLineNo = lineNoStr
    }
    // 実行行のデータ
    const lineDataJSON = JSON.stringify(lineNoStr)
    // デバッグ実行か
    let debugCode = ''
    if (this.debugOption.useDebug) {
      // messageAction
      if (this.debugOption.messageAction) {
        debugCode += `window.postMessage({action:'${this.debugOption.messageAction}',` +
          `line: ${lineDataJSON}});`
      }
      // waitTime
      if (lineNo >= 1) {
        if (this.debugOption.waitTime > 0) {
          debugCode += `await __v0['秒待'](${this.debugOption.waitTime},__self);`
        }
        // breakpoints
        this.numAsyncFn += 1
        this.usedAsyncFn = true
        debugCode += `await __v0['__DEBUG_BP_WAIT'](${lineNo}, __self);`
      }
      // end
      debugCode += 'if(__v0.forceClose){return-1};'
    }
    // 例: __v0.line='l1:main.nako3'
    return `__v0.line=${lineDataJSON};` + debugCode
  }

  /**
   * ローカル変数のJavaScriptコードを生成する。
   * @param {string} name
   */
  varname (name: string): string {
    if (this.varslistSet.length === 3) {
      // グローバル
      return `__varslist[${2}][${JSON.stringify(name)}]`
    } else {
      // 関数内
      if (NakoGen.isValidIdentifier(name)) {
        return name
      } else {
        return `__vars[${JSON.stringify(name)}]`
      }
    }
  }

  /**
   * @param {string} name
   * @returns {string}
  */
  static getFuncName (name: string): string {
    if (name.indexOf('__') >= 0) { // スコープがある場合
      const a = name.split('__')
      const scope = a[0]
      const name3 = NakoGen.getFuncName(a[1])
      return `${scope}__${name3}`
    }
    let name2 = name.replace(/[ぁ-ん]+$/, '')
    if (name2 === '') { name2 = name }
    return name2
  }

  /** @param {Ast} node */
  static convPrint (node: Ast): string {
    return `__print(${node});`
  }

  /** @param {Ast} node */
  convRequire (node: Ast): string {
    const moduleName = node.value
    return this.convLineno(node, false) +
      `__module['${moduleName}'] = require('${moduleName}');\n`
  }

  /**
   * プログラムの実行に必要な関数定義を書き出す(グローバル領域)
   * convGenの結果を利用するため、convGenの後に呼び出すこと。
   * @param com
   * @param opt
   */
  getDefFuncCode (com: NakoCompiler, opt: NakoGenOptions): string {
    let code = ''
    // よく使う変数のショートカット
    code += `const nakoVersion = { version: ${JSON.stringify(com.version)} }\n`
    code += 'const __self = self;\n'
    code += 'self.__self = self;\n'
    code += 'const __varslist = self.__varslist;\n'
    code += 'const __module = self.__module;\n'
    code += 'const __v0 = self.__v0 = self.__varslist[0];\n'
    code += 'const __v1 = self.__v1 = self.__varslist[1];\n'
    code += 'const __vars = self.__vars = self.__varslist[2];\n'
    code += `const __modList = self.__modList = ${JSON.stringify(com.getModList())}\n`
    code += '__v0.line = 0;\n'
    code += '__v0.forceClose = false;\n'
    code += `__v0.useDebug = ${this.debugOption.useDebug};\n`
    // 定数を埋め込む
    code += 'self.constPools = ' + JSON.stringify(this.constPools) + ';\n'
    code += 'self.constPoolsTemplate = ' + JSON.stringify(this.constPoolsTemplate) + ';\n'
    // なでしこの関数定義を行う
    let nakoFuncCode = ''
    for (const key in this.nakoFuncList) {
      const f = this.nakoFuncList[key].fn
      const isAsync = this.nakoFuncList[key].asyncFn ? 'true' : 'false'
      nakoFuncCode += '' +
        `//[DEF_FUNC name='${key}' asyncFn=${isAsync}]\n` +
        `self.__varslist[1]["${key}"]=${f};\n;` +
        `//[/DEF_FUNC name='${key}']\n`
    }
    if (nakoFuncCode !== '') { code += '__v0.line=\'関数の定義\';\n' + nakoFuncCode }

    // テストの定義を行う
    if (opt.isTest) {
      let testCode = 'const __tests = [];\n'

      for (const key in this.nakoTestFuncs) {
        const f = this.nakoTestFuncs[key].fn
        testCode += `${f};\n;`
      }

      if (testCode !== '') {
        code += '__v0.line=\'テストの定義\';\n'
        code += testCode + '\n'
      }
    }

    return code
  }

  /**
   * プラグイン・オブジェクトを追加
   * @param po プラグイン・オブジェクト
   */
  addPlugin (po: FuncList): void {
    return this.__self.addPlugin(po)
  }

  /**
   * プラグイン・オブジェクトを追加(ブラウザ向け)
   * @param name オブジェクト名
   * @param po 関数リスト
   */
  addPluginObject (name: string, po: FuncList): void {
    this.__self.addPluginObject(name, po)
  }

  /**
   * プラグイン・ファイルを追加(Node.js向け)
   * @param objName オブジェクト名
   * @param path ファイルパス
   * @param po 登録するオブジェクト
   */
  addPluginFile (objName: string, path: string, po: FuncList): void {
    this.__self.addPluginFile(objName, path, po)
  }

  /**
   * 関数を追加する
   * @param key 関数名
   * @param josi 助詞
   * @param fn 関数
   */
  addFunc (key: string, josi: FuncArgs, fn: any) {
    this.__self.addFunc(key, josi, fn)
  }

  /**
   * プラグイン関数を参照する
   * @param key プラグイン関数の関数名
   * @returns プラグイン・オブジェクト
   */
  getFunc (key: string) {
    return this.__self.getFunc(key)
  }

  /**
   * 関数を先に登録してしまう
   */
  registerFunction (ast: Ast) {
    if (ast.type !== 'block') { throw NakoSyntaxError.fromNode('構文解析に失敗しています。構文は必ずblockが先頭になります', ast) }

    /** 関数一覧 */
    const funcList: {name: string; node:Ast}[] = []
    // なでしこ関数を定義して this.nako_func[name] に定義する
    const registFunc = (node: Ast) => {
      if (!node.block) { return }
      const blockList: Ast[] = (node.block instanceof Array) ? node.block : [node.block]
      for (let i = 0; i < blockList.length; i++) {
        const t = blockList[i]
        if (t.type === 'def_func') {
          if (!t.name) { throw new Error('[System Error] 関数の定義で関数名が指定されていない') }
          const name: string = (t.name as Token).value
          this.usedFuncSet.add(name)
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          this.__self.__varslist[1][name] = function () { } // 事前に適当な値を設定
          this.varslistSet[1].names.add(name) // global
          const meta = ((t.name) as Ast).meta // todo: 強制変換したが正しいかチェック
          this.nakoFuncList[name] = {
            josi: meta.josi,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            fn: () => {},
            type: 'func',
            asyncFn: t.asyncFn,
            isExport: t.isExport
          }
          funcList.push({ name, node: t })
        // eslint-disable-next-line brace-style
        }
        // 実行速度優先 などのオプションが付いている場合の処理
        else if (t.type === 'speed_mode') {
          if (!t.block) { continue }
          if ((t.block as Ast).type === 'block') {
            registFunc(t.block as Ast)
          } else {
            registFunc(t)
          }
        } else if (t.type === 'performance_monitor') {
          if (!t.block) { continue }
          if ((t.block as Ast).type === 'block') {
            registFunc(t.block as Ast)
          } else {
            registFunc(t)
          }
        }
      }
    }
    // 関数の登録
    registFunc(ast)

    // __self.__varslistの変更を反映
    const initialNames: Set<string> = new Set()
    if (this.speedMode.invalidSore === 0) {
      initialNames.add('それ')
    }
    this.varsSet = { isFunction: false, names: initialNames, readonly: new Set() }
    this.varslistSet = this.__self.__varslist.map((v) => ({ isFunction: false, names: new Set(Object.keys(v)), readonly: new Set() }))
    this.varslistSet[2] = this.varsSet
  }

  /**
   * @param node
   * @param opt
   */
  convGen (node: Ast, opt: NakoGenOptions): string {
    const result = this.convLineno(node, false) + this._convGen(node, true)
    if (opt.isTest) {
      return ''
    } else {
      return result
    }
  }

  /**
   * @param {Ast} node
   * @param {boolean} isExpression
   */
  _convGen (node: Ast|null, isExpression: boolean): string {
    if (!node) { return '' }
    let code = ''
    if (node instanceof Array) {
      for (let i = 0; i < node.length; i++) {
        const n = node[i]
        code += this._convGen(n, isExpression)
      }
      return code
    }
    if (node === null) { return 'null' }
    if (node === undefined) { return 'undefined' }
    if (typeof (node) !== 'object') { return '' + node }
    // switch
    switch (node.type) {
      case 'nop':
        break
      case 'block':
        if (!node.block) { return code }
        // eslint-disable-next-line no-case-declarations
        const blocks: any = (node.block instanceof Array) ? node.block : [node.block]
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]
          code += this._convGen(b, false)
        }
        break
      case 'comment':
      case 'eol':
        code += this.convComment(node)
        break
      case 'break':
        code += this.convCheckLoop(node, 'break')
        break
      case 'continue':
        code += this.convCheckLoop(node, 'continue')
        break
      case 'end':
        code += '__v0[\'終\'](__self);'
        break
      case 'number':
        code += node.value
        break
      case 'bigint':
        code += node.value
        break
      case 'string':
        code += this.convString(node)
        break
      case 'def_local_var':
        code += this.convDefLocalVar(node)
        break
      case 'def_local_varlist':
        code += this.convDefLocalVarlist(node)
        break
      case 'let':
        code += this.convLet(node)
        break
      case 'inc':
        code += this.convInc(node)
        break
      case 'word':
      case 'variable':
        code += this.convGetVar(node)
        break
      case 'op':
      case 'calc':
        code += this.convOp(node)
        break
      case 'renbun':
        code += this.convRenbun(node)
        break
      case 'not':
        code += '((' + this._convGen(node.value as Ast, true) + ')?false:true)'
        break
      case 'func':
      case 'func_pointer':
      case 'calc_func':
        code += this.convCallFunc(node, isExpression)
        break
      case 'if':
        code += this.convIf(node)
        break
      case 'tikuji':
        code += this.convTikuji(node)
        break
      case 'for':
        code += this.convFor(node)
        break
      case 'foreach':
        code += this.convForeach(node)
        break
      case 'repeat_times':
        code += this.convRepeatTimes(node)
        break
      case 'speed_mode':
        code += this.convSpeedMode(node, isExpression)
        break
      case 'performance_monitor':
        code += this.convPerformanceMonitor(node, isExpression)
        break
      case 'while':
        code += this.convWhile(node)
        break
      case 'atohantei':
        code += this.convAtohantei(node)
        break
      case 'switch':
        code += this.convSwitch(node)
        break
      case 'let_array':
        code += this.convLetArray(node)
        break
      case '配列参照':
        code += this.convRefArray(node)
        break
      case 'json_array':
        code += this.convJsonArray(node)
        break
      case 'json_obj':
        code += this.convJsonObj(node)
        break
      case 'func_obj':
        code += this.convFuncObj(node)
        break
      case 'bool':
        code += (node.value) ? 'true' : 'false'
        break
      case 'null':
        code += 'null'
        break
      case 'def_test':
        code += this.convDefTest(node)
        break
      case 'def_func':
        code += this.convDefFunc(node)
        break
      case 'return':
        code += this.convReturn(node)
        break
      case 'try_except':
        code += this.convTryExcept(node)
        break
      case 'require':
        code += this.convRequire(node)
        break
      default:
        throw new Error('System Error: unknown_type=' + node.type)
    }
    return code
  }

  /** 変数を検索 */
  findVar (name: string): FindVarResult|null {
    // __vars ? (ローカル変数)
    if (this.varslistSet.length > 3 && this.varsSet.names.has(name)) {
      return { i: this.varslistSet.length - 1, name, isTop: true, js: this.varname(name) }
    }
    // __varslist ?
    for (let i = 2; i >= 0; i--) {
      if (this.varslistSet[i].names.has(name)) {
        // ユーザーの定義したグローバル変数 (__varslist[2]) は、変数展開されている（そのままの名前で定義されている）可能性がある。
        // それ以外の変数は、必ず__varslistに入っている。
        return { i, name, isTop: false, js: `__varslist[${i}][${JSON.stringify(name)}]` }
      }
    }

    return null
  }

  /**
   * 定義済みの変数の参照
   * @param {string} name
   * @param {Ast} position
   */
  genVar (name: string, position: Ast): string {
    const res = this.findVar(name)
    const lno = position.line
    if (res === null) {
      // 定義されていない名前の参照は変数の定義とみなす。
      // 多くの場合はundefined値を持つ変数であり分かりづらいバグを引き起こすが、
      // 「ナデシコする」などの命令の中で定義された変数の参照の場合があるため警告に留める。
      // ただし、自動的に定義される変数『引数』『それ』などは例外 #952
      if (name === '引数' || name === 'それ' || name === '対象' || name === '対象キー') {
        // デフォルト定義されている変数名
      } else {
        if (this.warnUndefinedVar) {
          // main__は省略して表示するように。 #1223
          const dispName = name.replace(/^main__(.+)$/, '$1')
          this.__self.getLogger().warn(`変数『${dispName}』は定義されていません。`, position)
        }
      }
      this.varsSet.names.add(name)
      return this.varname(name)
    }

    const i = res.i
    // システム関数・変数の場合
    if (i === 0) {
      const pv = this.__self.getNakoFunc(name)
      if (!pv) { return `${res.js}/*err:${lno}*/` }
      if (pv.type === 'const' || pv.type === 'var') { return res.js }
      if (pv.type === 'func') {
        if (!pv.josi || pv.josi.length === 0) { return `(${res.js}())` }

        throw NakoSyntaxError.fromNode(`『${name}』が複文で使われました。単文で記述してください。(v1非互換)`, position)
      }
      throw NakoSyntaxError.fromNode(`『${name}』は関数であり参照できません。`, position)
    }
    return res.js
  }

  convGetVar (node: Ast): string {
    const name = node.value
    return this.genVar(name, node)
  }

  convComment (node:Ast): string {
    let commentSrc = String(node.value)
    commentSrc = commentSrc.replace(/\n/g, '¶')
    const lineNo = this.convLineno(node, false)
    if (commentSrc === '' && lineNo === '') { return ';' }
    if (commentSrc === '') {
      return ';' + lineNo + '\n'
    }
    return ';' + lineNo + '//' + commentSrc + '\n'
  }

  convReturn (node: Ast): string {
    // 関数の中であれば利用可能
    if (this.varsSet.names.has('!関数')) { throw NakoSyntaxError.fromNode('『戻る』がありますが、関数定義内のみで使用可能です。', node) }

    const lno = this.convLineno(node, false)
    let value
    if (node.value) {
      value = this._convGen(node.value, true)
    } else
      if (this.speedMode.invalidSore === 0) {
        value = this.varname('それ')
      } else {
        return lno + 'return;'
      }
    if (this.warnUndefinedReturnUserFunc === 0) {
      return lno + `return ${value};`
    } else {
      const poolIndex = this.addConstPool('ユーザ関数からundefinedが返されています', [], node.file, node.line)
      return lno + `return (__self.chk(${value}, ${poolIndex}));`
    }
  }

  getConstPoolsTemplateId (msg: string): number {
    let id = this.constPoolsTemplate.indexOf(msg)
    if (id < 0) {
      id = this.constPoolsTemplate.length
      this.constPoolsTemplate[id] = msg
    }
    return id
  }

  addConstPool (msg: string, args: string[], file: any, line: any): number {
    // file
    file = '' + file
    const fileNo = this.getConstPoolsTemplateId(file)
    // msg
    const msgNo = this.getConstPoolsTemplateId(msg)
    // args
    const args2: number[] = []
    for (const i in args) {
      const arg = '' + args[i]
      const argNo = this.getConstPoolsTemplateId(arg)
      args2.push(argNo)
    }
    const poolIndex = this.constPools.length
    this.constPools.push([msgNo, args2, fileNo, line])
    return poolIndex
  }

  convCheckLoop (node: Ast, cmd: string): string {
    // ループの中であれば利用可能
    if (!this.flagLoop) {
      const cmdj = (cmd === 'continue') ? '続ける' : '抜ける'
      throw NakoSyntaxError.fromNode(`『${cmdj}』文がありますが、それは繰り返しの中で利用してください。`, node)
    }
    return this.convLineno(node) + cmd + ';'
  }

  convDefFuncCommon (node: Ast, name: string): string {
    // パフォーマンスモニタ:ユーザ関数のinjectの定義
    let performanceMonitorInjectAtStart = ''
    let performanceMonitorInjectAtEnd = ''
    if (this.performanceMonitor.userFunction !== 0) {
      let key = name
      if (!key) {
        if (typeof this.performanceMonitor.mumeiId === 'undefined') {
          this.performanceMonitor.mumeiId = 0
        }
        this.performanceMonitor.mumeiId++
        key = `anous_${this.performanceMonitor.mumeiId}`
      }
      performanceMonitorInjectAtStart = 'const performanceMonitorEnd = (function (key, type) {\n' +
        'const uf_start = performance.now() * 1000;\n' +
        'return function () {\n' +
        'const el_time = performance.now() * 1000 - uf_start;\n' +
        'if (!__self.__performance_monitor) {\n' +
        '__self.__performance_monitor={};\n' +
        '__self.__performance_monitor[key] = { called:1, totel_usec: el_time, min_usec: el_time, max_usec: el_time, type: type };\n' +
        '} else if (!__self.__performance_monitor[key]) {\n' +
        '__self.__performance_monitor[key] = { called:1, totel_usec: el_time, min_usec: el_time, max_usec: el_time, type: type };\n' +
        '} else {\n' +
        '__self.__performance_monitor[key].called++;\n' +
        '__self.__performance_monitor[key].totel_usec+=el_time;\n' +
        'if(__self.__performance_monitor[key].min_usec>el_time){__self.__performance_monitor[key].min_usec=el_time;}\n' +
        'if(__self.__performance_monitor[key].max_usec<el_time){__self.__performance_monitor[key].max_usec=el_time;}\n' +
        `}};})('${key}', 'user');` +
        'try {\n'
      performanceMonitorInjectAtEnd = '} finally { performanceMonitorEnd(); }\n'
    }
    let variableDeclarations = ''
    const popStack = ''
    const initialNames: Set<string> = new Set()
    if (this.speedMode.invalidSore === 0) {
      initialNames.add('それ')
    }
    this.varsSet = { isFunction: true, names: initialNames, readonly: new Set() }
    // ローカル変数をPUSHする
    this.varslistSet.push(this.varsSet)
    // JSの引数と引数をバインド
    variableDeclarations += '  var 引数 = arguments;\n'
    // ローカル変数を生成
    variableDeclarations += '  var __vars = {};\n'
    // 宣言済みの名前を保存
    const varsDeclared = Array.from(this.varsSet.names.values())
    let code = ''
    // 引数をローカル変数に設定
    const meta = (!name) ? node.meta : (node.name as Ast).meta
    for (let i = 0; i < meta.varnames.length; i++) {
      const word = meta.varnames[i]
      if (this.warnUndefinedCalledUserFuncArgs === 0) {
        code += `  ${this.varname(word)} = arguments[${i}];\n`
      } else
        if (name) {
          code += `  ${this.varname(word)} = (function(a){if(a===undefined){__self.logger.warn('ユーザ関数(${name})の引数(${this.varname(word)})にundefinedが渡されました',{file:'${node.file}',line:${node.line}});};return a;})(arguments[${i}]);\n`
        } else {
          code += `  ${this.varname(word)} = (function(a){if(a===undefined){__self.logger.warn('匿名関数の引数(${this.varname(word)})にundefinedが渡されました',{file:'${node.file}',line:${node.line}});};return a;})(arguments[${i}]);\n`
        }
      this.varsSet.names.add(word)
    }
    // 関数定義は、グローバル領域で。
    if (name) {
      this.usedFuncSet.add(name)
      this.varslistSet[1].names.add(name)
      if (this.nakoFuncList[name] === undefined) {
        // 既に generate で作成済みのはず(念のため)
        this.nakoFuncList[name] = {
          josi: (node.name as Ast).meta.josi,
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          fn: () => {},
          type: 'func',
          asyncFn: false,
          isExport: null
        }
        this.__self.getLogger().warn(`generateで未定義の状態の関数『${name}』が動的に登録されています。`)
      }
    }
    // ブロックを解析
    const oldUsedAsyncFn = this.usedAsyncFn
    this.usedAsyncFn = false || this.debugOption.useDebug
    const block = this._convGen(node.block as Ast, false)
    code += block.split('\n').map((line) => '  ' + line).join('\n') + '\n'
    // 関数の最後に、変数「それ」をreturnするようにする
    if (this.speedMode.invalidSore === 0) {
      code += `  return (${this.varname('それ')});\n`
    }
    // パフォーマンスモニタ:ユーザ関数のinject
    code += performanceMonitorInjectAtEnd
    // ブロックでasyncFnを使ったか
    if (name && this.usedAsyncFn) {
      this.nakoFuncList[name].asyncFn = true
    }
    // 関数の末尾に、ローカル変数をPOP

    // 関数内で定義されたローカル変数の宣言
    for (const name of Array.from(this.varsSet.names.values())) {
      if (!varsDeclared.includes(name)) {
        if (NakoGen.isValidIdentifier(name)) {
          variableDeclarations += `  var ${name};\n`
        }
      }
    }
    if (this.speedMode.invalidSore === 0) {
      if (NakoGen.isValidIdentifier('それ')) {
        variableDeclarations += '  var それ = \'\';\n'
      } else {
        variableDeclarations += `  ${this.varname('それ')} = '';`
      }
    }
    // usedAsyncFnの値に応じて関数定義の方法を変更
    const tof = (this.usedAsyncFn) ? topOfFunctionAsync : topOfFunction
    // 関数コード全体を構築
    const lineInfo = '  ' + this.convLineno(node, true, 1) + '\n'
    code = tof + performanceMonitorInjectAtStart + variableDeclarations + lineInfo + code + popStack
    code += endOfFunction

    // 名前があれば、関数を登録する
    if (name) {
      this.nakoFuncList[name].fn = code
      this.nakoFuncList[name].asyncFn = this.usedAsyncFn
      meta.asyncFn = this.usedAsyncFn
    }
    this.usedAsyncFn = oldUsedAsyncFn // 以前の値を戻す

    this.varslistSet.pop()
    this.varsSet = this.varslistSet[this.varslistSet.length - 1]
    if (name) { this.__self.__varslist[1][name] = code }
    return code
  }

  convDefTest (node: Ast): string {
    const name = (node.name as Ast).value
    let code = `__tests.push({ name: '${name}', f: () => {\n`

    // ブロックを解析
    const block = this._convGen(node.block as Ast, false)

    code += `   ${block}\n` +
      '}});'

    this.nakoTestFuncs[name] = {
      josi: (node.name as Ast).meta.josi,
      fn: code,
      type: 'test_func'
    }

    // ★この時点ではテストコードを生成しない★
    // プログラム冒頭でコード生成時にテストの定義を行う
    return ''
  }

  convDefFunc (node: Ast): string {
    // ※ [関数定義のメモ]
    // ※ 関数の定義はプログラムの冒頭に移される。
    // ※ そのため、生成されたコードはここでは返さない
    // ※ registerFunction を参照
    if (!node.name) { return '' }
    const name = NakoGen.getFuncName((node.name as Ast).value as string)
    this.convDefFuncCommon(node, name)
    return ''
  }

  convFuncObj (node: Ast): string {
    return this.convDefFuncCommon(node, '')
  }

  convJsonObj (node: Ast): string {
    const list = node.value
    const codelist = list.map((e: {key: Ast, value: Ast}) => {
      const key = this._convGen(e.key, true)
      const val = this._convGen(e.value, true)
      return `${key}:${val}`
    })
    return '{' + codelist.join(',') + '}'
  }

  convJsonArray (node: Ast): string {
    const list = node.value
    const codelist = list.map((e: Ast) => {
      return this._convGen(e, true)
    })
    return '[' + codelist.join(',') + ']'
  }

  convRefArray (node: Ast): string {
    const name = this._convGen(node.name as Ast, true)
    const list: Ast[] | undefined = node.index
    let code = name
    if (!list) { return code }
    for (let i = 0; i < list.length; i++) {
      const idx = this._convGen(list[i] as Ast, true)
      code += '[' + idx + ']'
    }
    return code
  }

  convLetArray (node: Ast): string {
    const name = this._convGen(node.name as Ast, true)
    const list: Ast[] = node.index || []
    let codeInit = ''
    let code = name
    let codeArray = ''
    // codeInit?
    if (node.checkInit) {
      const arrayDefCode = '[0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0]'
      codeInit += `\n/*配列初期化*/if (!(${name} instanceof Array)) { ${name} = ${arrayDefCode}; /*console.log('初期化:${name}')*/ };`
      for (let i = 0; i < list.length - 1; i++) {
        const idx = this._convGen(list[i], true)
        codeArray += `[${idx}]`
        codeInit += `\n/*配列初期化${i}*/if (!(${name}${codeArray} instanceof Array)) { ${name}${codeArray} = ${arrayDefCode}; };`
        // codeInit += `\n/*配列初期化${i}*/if (!(${name}${codeArray} instanceof Array)) { ${name}${codeArray} = ${arrayDefCode}; console.log('初期化:${i}:${name}${codeArray}',JSON.stringify(${name})) }; `
      }
      codeInit += '\n'
    }
    // array
    for (let i = 0; i < list.length; i++) {
      const idx = this._convGen(list[i], true)
      code += '[' + idx + ']'
    }
    // value
    let value = null
    if (this.speedMode.invalidSore === 0) { value = this.varname('それ') }
    if (node.value) { value = this._convGen(node.value, true) }
    if (value == null) {
      throw NakoSyntaxError.fromNode('代入する先の変数名がありません。', node)
    }
    code += ' = ' + value + ';\n'
    // generate code
    const src = this.convLineno(node, false) + codeInit + code
    return src
  }

  convGenLoop (node: Ast): string {
    const tmpflag = this.flagLoop
    this.flagLoop = true
    try {
      return this._convGen(node, false)
    } finally {
      this.flagLoop = tmpflag
    }
  }

  convFor (node: Ast): string {
    // ループ変数について
    let word
    if (node.word !== null) { // ループ変数を使う時
      const varName = (node.word as Token).value // todo: Forの最初のパラメータが Token か Astか確認
      this.varsSet.names.add(varName)
      word = this.varname(varName)
    } else {
      this.varsSet.names.add('dummy')
      word = this.varname('dummy')
    }
    const idLoop = this.loopId++
    const varI = `$nako_i${idLoop}`
    // ループ条件を確認
    const kara = this._convGen(node.from as Ast, true)
    const made = this._convGen(node.to as Ast, true)
    const flagDown = node.flagDown
    let inc = '1'
    if (node.inc && node.inc !== 'null') {
      inc = this._convGen(node.inc as Ast, true)
    }
    // ループ内のブロック内容を得る
    const block = this.convGenLoop(node.block as Ast)
    // ループ条件を変数に入れる用
    const varFrom = `$nako_from${idLoop}`
    const varTo = `$nako_to${idLoop}`
    let sorePrefex = ''
    if (this.speedMode.invalidSore === 0) {
      sorePrefex = `${this.varname('それ')} = `
    }
    const code =
      `\n//[FOR id=${idLoop}]\n` +
      `const ${varFrom} = ${kara};\n` +
      `const ${varTo} = ${made};\n` +
      `if (${varFrom} <= ${varTo}) { // up\n` +
      `  for (let ${varI} = ${varFrom}; ${varI} <= ${varTo}; ${varI}+= ${inc}) {\n` +
      `    ${sorePrefex}${word} = ${varI};\n` +
      `    ${block}\n` +
      '  };\n' +
      '} else { // down\n' +
      `  if (${flagDown}) {` +
      `    for (let ${varI} = ${varFrom}; ${varI} >= ${varTo}; ${varI}-= ${inc}) {\n` +
      `      ${sorePrefex}${word} = ${varI};` + '\n' +
      `      ${block}\n` +
      '    }\n' +
      '  };\n' +
      `};\n//[/FOR id=${idLoop}]\n`
    return this.convLineno(node, false) + code
  }

  convForeach (node: Ast): string {
    let target
    if (node.target === null) {
      if (this.speedMode.invalidSore === 0) {
        target = this.varname('それ')
      } else {
        throw NakoSyntaxError.fromNode('『反復』の対象がありません。', node)
      }
    } else { target = this._convGen(node.target as Ast, true) }

    // blockより早く変数を定義する必要がある
    let nameS = '__v0["対象"]'
    if (node.name) {
      nameS = this.varname((node.name as Ast).value)
      this.varsSet.names.add((node.name as Ast).value)
    }

    const block = this.convGenLoop(node.block as Ast)
    const id = this.loopId++
    const key = '__v0["対象キー"]'
    let sorePrefex = ''
    if (this.speedMode.invalidSore === 0) {
      sorePrefex = `${this.varname('それ')} = `
    }
    const code =
      `let $nako_foreach_v${id}=${target};\n` +
      `for (let $nako_i${id} in $nako_foreach_v${id})` + '{\n' +
      `  if ($nako_foreach_v${id}.hasOwnProperty($nako_i${id})) {\n` +
      `    ${nameS} = ${sorePrefex}$nako_foreach_v${id}[$nako_i${id}];` + '\n' +
      `    ${key} = $nako_i${id};\n` +
      `    ${block}\n` +
      '  }\n' +
      '};\n'
    return this.convLineno(node, false) + code
  }

  convRepeatTimes (node: Ast): string {
    const id = this.loopId++
    const value = this._convGen(node.value, true)
    const block = this.convGenLoop(node.block as Ast)
    const kaisu = '__v0["回数"]'
    let sorePrefex = ''
    if (this.speedMode.invalidSore === 0) {
      sorePrefex = `${this.varname('それ')} = `
    }
    const code =
      `let $nako_times_v${id} = ${value};\n` +
      `for(var $nako_i${id} = 1; $nako_i${id} <= $nako_times_v${id}; $nako_i${id}++)` + '{\n' +
      `  ${sorePrefex}${kaisu} = $nako_i${id};` + '\n' +
      '  ' + block + '\n}\n'
    return this.convLineno(node, false) + code
  }

  /**
   * @param {Ast} node
   * @param {boolean} isExpression
   */
  convSpeedMode (node: Ast, isExpression: boolean): string {
    if (!node.options) { return '' }
    const prev = { ...this.speedMode }
    if (node.options['行番号無し']) {
      this.speedMode.lineNumbers++
    }
    if (node.options['暗黙の型変換無し']) {
      this.speedMode.implicitTypeCasting++
    }
    if (node.options['強制ピュア']) {
      this.speedMode.forcePure++
    }
    if (node.options['それ無効']) {
      this.speedMode.invalidSore++
    }
    try {
      return this._convGen(node.block as Ast, isExpression)
    } finally {
      this.speedMode = prev
    }
  }

  /**
   * @param {Ast} node
   * @param {boolean} isExpression
   */
  convPerformanceMonitor (node: Ast, isExpression: boolean): string {
    const prev = { ...this.performanceMonitor }
    if (!node.options) { return '' }
    if (node.options['ユーザ関数']) {
      this.performanceMonitor.userFunction++
    }
    if (node.options['システム関数本体']) {
      this.performanceMonitor.systemFunctionBody++
    }
    if (node.options['システム関数']) {
      this.performanceMonitor.systemFunction++
    }
    try {
      return this._convGen(node.block as Ast, isExpression)
    } finally {
      this.performanceMonitor = prev
    }
  }

  convWhile (node: Ast): string {
    const cond = this._convGen(node.cond as Ast, true)
    const block = this.convGenLoop(node.block as Ast)
    const code =
      `while (${cond})` + '{\n' +
      `  ${block}` + '\n' +
      '}\n'
    return this.convLineno(node, false) + code
  }

  convAtohantei (node: Ast): string {
    const id = this.loopId++
    const varId = `$nako_i${id}`
    const cond = this._convGen(node.cond as Ast, true)
    const block = this.convGenLoop(node.block as Ast)
    const code =
      'for(;;) {\n' +
      `  ${block}\n` +
      `  let ${varId} = ${cond};\n` +
      `  if (${varId}) { continue } else { break }\n` +
      '}\n\n'
    return this.convLineno(node, false) + code
  }

  convSwitch (node: Ast): string {
    const value: string = this._convGen(node.value, true)
    const cases: any[] = node.cases || []
    let body = ''
    for (let i = 0; i < cases.length; i++) {
      const cvalue = cases[i][0]
      const cblock = this.convGenLoop(cases[i][1])
      if (cvalue.type === '違えば') {
        body += '  default:\n'
      } else {
        const cvalueCode = this._convGen(cvalue, true)
        body += `  case ${cvalueCode}:\n`
      }
      body += `    ${cblock}\n` +
              '    break\n'
    }
    const code =
      `switch (${value})` + '{\n' +
      `${body}` + '\n' +
      '}\n'
    return this.convLineno(node, false) + code
  }

  convIf (node: Ast): string {
    const expr = this._convGen(node.expr as Ast, true)
    const block = this._convGen(node.block as Ast, false)
    const falseBlock = (node.false_block === null)
      ? ''
      : 'else {' + this._convGen(node.false_block as Ast, false) + '};\n'
    return this.convLineno(node, false) +
      `if (${expr}) {\n  ${block}\n}` + falseBlock + ';\n'
  }

  convTikuji (node: Ast): string {
    // #1164 により「逐次実行」構文は近いうちに廃止する
    const pid = this.loopId++
    // gen tikuji blocks
    const curName = `__tikuji${pid}`
    let code = `const ${curName} = []\n`
    const blocks: Ast[] = (node.blocks) ? node.blocks : []
    for (let i = 0; i < blocks.length; i++) {
      const block = this._convGen(blocks[i], false).replace(/\s+$/, '') + '\n'
      const blockLineNo = this.convLineno(blocks[i], true)
      const blockCode =
        `${curName}.push(async function(resolve, reject) {\n` +
        '  __self.resolve = resolve;\n' +
        '  __self.reject = reject;\n' +
        '  __self.resolveCount = 0;\n' +
        `  ${blockLineNo}\n` +
        `  ${block}` +
        '  if (__self.resolveCount === 0) resolve();\n' +
        // eslint-disable-next-line no-template-curly-in-string
        '}); // end of tikuji__${pid}[{$i}]\n'
      code += blockCode
    }
    code += `// end of ${curName} \n`
    // gen error block
    let errorCode =
      `  ${curName}.splice(0);\n` + // clear
      '  __v0["エラーメッセージ"]=errMsg;\n'
    if (node.errorBlock != null) {
      const errBlock = this._convGen(node.errorBlock as Ast, false).replace(/\s+$/, '') + '\n'
      errorCode += errBlock
    }
    code += `const ${curName}__reject = function(errMsg){\n${errorCode}};\n`
    // gen run block
    code += '__self.resolve = undefined;\n'
    code += `const ${curName}__resolve = function(){\n`
    code += '  setTimeout(async function(){\n'
    code += `    if (${curName}.length == 0) {return}\n`
    code += `    const f = ${curName}.shift()\n`
    code += `    await f(${curName}__resolve, ${curName}__reject);\n`
    code += '  }, 0);\n'
    code += '};\n'
    code += `${curName}__resolve()\n`
    return this.convLineno(node, false) + code
  }

  convFuncGetArgsCalcType (_funcName: string, _func: any, node: Ast): [any, any] {
    const args = []
    const opts: {[key: string]: boolean} = {}
    const nodeArgs = (node.args) ? node.args : []
    for (let i = 0; i < nodeArgs.length; i++) {
      const arg = nodeArgs[i]
      if (i === 0 && arg === null && this.speedMode.invalidSore === 0) {
        args.push(this.varname('それ'))
        opts.sore = true
      } else {
        args.push(this._convGen(arg, true))
      }
    }
    return [args, opts]
  }

  getPluginList () {
    const r = []
    for (const name in this.__self.__module) { r.push(name) }
    return r
  }

  /**
   * 関数の呼び出し
   * @param {Ast} node
   * @param {boolean} isExpression
   * @returns string コード
   */
  convCallFunc (node: Ast, isExpression: boolean): string {
    const funcName = NakoGen.getFuncName(node.name as string)
    const res = this.findVar(funcName)
    if (res === null) {
      throw NakoSyntaxError.fromNode(`関数『${funcName}』が見当たりません。有効プラグイン=[` + this.getPluginList().join(', ') + ']', node)
    }
    // どの関数を呼び出すのか関数を特定する
    let func
    if (res.i === 0) { // plugin function
      func = this.__self.getFunc(funcName)
      if (!func) { throw new Error(`[System Error] 関数「${funcName}」NakoCompiler.nakoFuncList の不整合があります。`) }
      if (func.type !== 'func') {
        throw NakoSyntaxError.fromNode(`『${funcName}』は関数ではありません。`, node)
      }
    } else {
      func = this.nakoFuncList[funcName]
      // 無名関数の可能性
      if (func === undefined) { func = { return_none: false } }
    }
    // 関数の参照渡しか？
    if (node.type === 'func_pointer') {
      return res.js
    }

    // 関数の参照渡しでない場合
    // 関数定義より助詞を一つずつ調べる
    const argsInfo = this.convFuncGetArgsCalcType(funcName, func, node)
    const args = argsInfo[0]
    const argsOpts = argsInfo[1]
    // function
    this.usedFuncSet.add(funcName)
    if (funcName === '名前空間設定') {
      return `\n// --- 名前空間(${args[0]}) ---\n__varslist[0]['名前空間設定'](${args[0]}, __self);__self.__modName=${args[0]};\n`
    } else if (funcName === 'プラグイン名設定') {
      return `\n__varslist[0]['プラグイン名設定'](${args[0]}, __self);\n`
    }

    // 関数呼び出しで、引数の末尾にthisを追加する-システム情報を参照するため
    args.push('__self')
    let funcDef = 'function'
    let funcBegin = ''
    let funcEnd = ''
    // setter?
    if (node.setter) {
      funcBegin += ';__self.isSetter = true;\n'
      funcEnd += ';__self.isSetter = false;\n'
    }
    // 関数内 (__varslist.length > 3) からプラグイン関数 (res.i === 0) を呼び出すとき、 そのプラグイン関数がpureでなければ
    // 呼び出しの直前に全てのローカル変数をthis.__localsに入れる。
    if (res.i === 0 && this.varslistSet.length > 3 && func.pure !== true && this.speedMode.forcePure === 0) { // undefinedはfalseとみなす
      // 展開されたローカル変数の列挙
      const localVars = []
      for (const name of Array.from(this.varsSet.names.values())) {
        if (NakoGen.isValidIdentifier(name)) {
          localVars.push({ str: JSON.stringify(name), js: this.varname(name) })
        }
      }

      // --- 実行前 ---

      // 全ての展開されていないローカル変数を __self.__locals にコピーする
      funcBegin += '__self.__locals = __vars;\n'

      // 全ての展開されたローカル変数を __self.__locals に保存する
      for (const v of localVars) {
        funcBegin += `__self.__locals[${v.str}] = ${v.js};\n`
      }

      // --- 実行後 ---

      // 全ての展開されたローカル変数を __self.__locals から受け取る
      // 「それ」は関数の実行結果を受け取るために使うためスキップ。
      for (const v of localVars) {
        if (v.js !== 'それ') {
          funcEnd += `${v.js} = __self.__locals[${v.str}];\n`
        }
      }
    }
    // 変数「それ」が補完されていることをヒントとして出力
    if (argsOpts.sore) { funcBegin += '/*[sore]*/' }

    const indent = (text: string, n: number) => {
      let result = ''
      for (const line of text.split('\n')) {
        if (line !== '') {
          result += '  '.repeat(n) + line + '\n'
        }
      }
      return result
    }

    // 引数チェックの例外 #1260
    const noCheckFuncs: {[key: string]: boolean} = { 'TYPEOF': true, '変数型確認': true }
    // 関数呼び出しコードの構築
    let argsCode: string
    if ((this.warnUndefinedCallingUserFunc === 0 && res.i !== 0) || (this.warnUndefinedCallingSystemFunc === 0 && res.i === 0)) {
      argsCode = args.join(',')
    } else {
      const argsA: string[] = []
      args.forEach((arg: string) => {
        if (arg === '__self' || noCheckFuncs[funcName] === true) { // #1260
          argsA.push(`${arg}`)
        } else {
          // 引数のundefinedチェックのコードを入れる
          const msg = (res.i === 0) ? '命令『$0』の引数にundefinedを渡しています。' : 'ユーザ命令『$0』の引数にundefinedを渡しています。'
          const poolIndex = this.addConstPool(msg, [funcName], node.file, node.line)
          // argが空になる対策 #1315
          const argStr = (arg === '') ? '""' : arg
          argsA.push(`(__self.chk(${argStr}, ${poolIndex}))`)
        }
      })
      argsCode = argsA.join(', ')
    }

    let funcCall = `${res.js}(${argsCode})`
    if (func.asyncFn) {
      funcDef = `async ${funcDef}`
      funcCall = `await ${funcCall}`
      this.numAsyncFn++
      this.usedAsyncFn = true
    }
    if (res.i === 0 && this.performanceMonitor.systemFunctionBody !== 0) {
      let key = funcName
      if (!key) {
        if (typeof this.performanceMonitor.mumeiId === 'undefined') {
          this.performanceMonitor.mumeiId = 0
        }
        this.performanceMonitor.mumeiId++
        key = `anous_${this.performanceMonitor.mumeiId}`
      }
      funcCall = `(${funcDef} (key, type) {\n` +
        'const sbf_start = performance.now() * 1000;\n' +
        'try {\n' +
        'return ' + funcCall + ';\n' +
        '} finally {\n' +
        'const sbl_time = performance.now() * 1000 - sbf_start;\n' +
        'if (!__self.__performance_monitor) {\n' +
        '__self.__performance_monitor={};\n' +
        '__self.__performance_monitor[key] = { called:1, totel_usec: sbl_time, min_usec: sbl_time, max_usec: sbl_time, type: type };\n' +
        '} else if (!__self.__performance_monitor[key]) {\n' +
        '__self.__performance_monitor[key] = { called:1, totel_usec: sbl_time, min_usec: sbl_time, max_usec: sbl_time, type: type };\n' +
        '} else {\n' +
        '__self.__performance_monitor[key].called++;\n' +
        '__self.__performance_monitor[key].totel_usec+=sbl_time;\n' +
        'if(__self.__performance_monitor[key].min_usec>sbl_time){__self.__performance_monitor[key].min_usec=sbl_time;}\n' +
        'if(__self.__performance_monitor[key].max_usec<sbl_time){__self.__performance_monitor[key].max_usec=sbl_time;}\n' +
        `}}})('${funcName}_body', 'sysbody')\n`
    }

    let code = ''
    if (func.return_none) {
      // 戻り値のない関数の場合
      if (funcEnd === '') {
        if (funcBegin === '') {
          code = `${funcCall};\n`
        } else {
          code = `${funcBegin} ${funcCall};\n`
        }
      } else {
        code = `${funcBegin}try {\n${indent(funcCall, 1)};\n} finally {\n${indent(funcEnd, 1)}}\n`
      }
    } else {
      // 戻り値のある関数の場合
      let sorePrefex = ''
      if (this.speedMode.invalidSore === 0) {
        sorePrefex = `${this.varname('それ')} = `
      }
      if (funcBegin === '' && funcEnd === '') {
        code = `(${sorePrefex}${funcCall})`
      } else {
        if (funcEnd === '') {
          code = `(${funcDef}(){\n${indent(`${funcBegin};\nreturn ${sorePrefex} ${funcCall}`, 1)}}).call(this)`
        } else {
          code = `(${funcDef}(){\n${indent(`${funcBegin}try {\n${indent(`return ${sorePrefex}${funcCall};`, 1)}\n} finally {\n${indent(funcEnd, 1)}}`, 1)}}).call(this)`
        }
      }
      // ...して
      if (node.josi === 'して' || (node.josi === '' && !isExpression)) { code += ';\n' }
    }

    if (res.i === 0 && this.performanceMonitor.systemFunction !== 0) {
      code = '(function (key, type) {\n' +
        'const sf_start = performance.now() * 1000;\n' +
        'try {\n' +
        'return ' + code + ';\n' +
        '} finally {\n' +
        'const sl_time = performance.now() * 1000 - sf_start;\n' +
        'if (!__self.__performance_monitor) {\n' +
        '__self.__performance_monitor={};\n' +
        '__self.__performance_monitor[key] = { called:1, totel_usec: sl_time, min_usec: sl_time, max_usec: sl_time, type: type };\n' +
        '} else if (!__self.__performance_monitor[key]) {\n' +
        '__self.__performance_monitor[key] = { called:1, totel_usec: sl_time, min_usec: sl_time, max_usec: sl_time, type: type };\n' +
        '} else {\n' +
        '__self.__performance_monitor[key].called++;\n' +
        '__self.__performance_monitor[key].totel_usec+=sl_time;\n' +
        'if(__self.__performance_monitor[key].min_usec>sl_time){__self.__performance_monitor[key].min_usec=sl_time;}\n' +
        'if(__self.__performance_monitor[key].max_usec<sl_time){__self.__performance_monitor[key].max_usec=sl_time;}\n' +
        `}}})('${funcName}_sys', 'system')\n`
    }

    return code
  }

  convRenbun (node: Ast): string {
    const right = this._convGen(node.right as Ast, true)
    const left = this._convGen(node.left as Ast, false)
    this.numAsyncFn++
    this.usedAsyncFn = true
    return `/*連文*/await (async function(){ ${left}; return ${right} }).call(this)`
  }

  convOp (node: Ast): string {
    // トークン名からJS演算子への変換 - 単純な変換が可能なものをここで定義
    const OP_TBL: {[key: string]: string} = {
      '&': '+""+',
      eq: '==',
      noteq: '!=',
      '===': '===',
      '!==': '!==',
      gt: '>',
      lt: '<',
      gteq: '>=',
      lteq: '<=',
      and: '&&',
      or: '||',
      shift_l: '<<',
      shift_r: '>>',
      shift_r0: '>>>',
      '÷': '/'
    }
    let op: string = node.operator || '' // 演算子
    let right = this._convGen(node.right as Ast, true)
    let left = this._convGen(node.left as Ast, true)
    if (op === '+' && this.speedMode.implicitTypeCasting === 0) {
      if (node.left && (node.left as Ast).type !== 'number' && (node.left as Ast).type !== 'bigint') {
        left = `self.__parseFloatOrBigint(${left})`
      }
      if (node.right && (node.right as Ast).type !== 'number' && (node.right as Ast).type !== 'bigint') {
        right = `self.__parseFloatOrBigint(${right})`
      }
    }
    // 階乗
    if (op === '^' || op === '**') { return `((${left}) ** (${right}))` }
    // 整数の割り算 #1152
    if (op === '÷÷') { return `(Math.floor(${left} / ${right}))` }

    // 一般的なオペレータに変換
    if (OP_TBL[op]) { op = OP_TBL[op] }
    //
    return `(${left} ${op} ${right})`
  }

  convInc (node: Ast): string {
    // もし値が省略されていたら、変数「それ」に代入する
    let value = null
    if (this.speedMode.invalidSore === 0) { value = this.varname('それ') }
    if (node.value) { value = this._convGen(node.value, true) }
    if (value == null) {
      throw NakoSyntaxError.fromNode('加算する先の変数名がありません。', node)
    }
    // 配列への代入か(core#86)
    let code = ''
    let jsName
    const nodeName = node.name as Ast
    if (nodeName.type === '配列参照') {
      jsName = this.convRefArray(nodeName)
    } else {
      // 変数名
      const name: string = nodeName.value
      let res = this.findVar(name)
      if (res === null) {
        this.varsSet.names.add(name)
        res = this.findVar(name)
        if (!res) { throw new Error('『増』または『減』で変数が見当たりません。') }
      }
      jsName = res.js
    }
    // 自動初期化するか
    code += `if (typeof(${jsName}) === 'undefined') { ${jsName} = 0; }`
    code += `${jsName} += ${value}`
    return ';' + this.convLineno(node, false) + code + '\n'
  }

  convLet (node: Ast): string {
    // もし値が省略されていたら、変数「それ」に代入する
    let value = null
    if (this.speedMode.invalidSore === 0) { value = this.varname('それ') }
    if (node.value) { value = this._convGen(node.value, true) }
    if (value == null) {
      throw NakoSyntaxError.fromNode('代入する先の変数名がありません。', node)
    }
    // 変数名
    const name: string = (node.name as Ast).value
    const res = this.findVar(name)
    let code = ''
    if (res === null) {
      this.varsSet.names.add(name)
      code = `${this.varname(name)} = ${value};`
    } else {
      // 定数ならエラーを出す
      if (this.varslistSet[res.i].readonly.has(name)) {
        throw NakoSyntaxError.fromNode(
          `定数『${name}』は既に定義済みなので、値を代入することはできません。`, node)
      }
      code = `${res.js} = ${value};`
    }

    return ';' + this.convLineno(node, false) + code + '\n'
  }

  convDefLocalVar (node: Ast): string {
    const value = (node.value === null) ? 'null' : this._convGen(node.value, true)
    const name = (node.name as Ast).value
    const vtype = node.vartype // 変数 or 定数
    // 二重定義？
    if (this.varsSet.names.has(name)) { throw NakoSyntaxError.fromNode(`${vtype}『${name}』の二重定義はできません。`, node) }

    //
    this.varsSet.names.add(name)
    if (vtype === '定数') {
      this.varsSet.readonly.add(name)
    }
    const code = `${this.varname(name)}=${value};\n`
    return this.convLineno(node, false) + code
  }

  // #563 複数変数への代入
  convDefLocalVarlist (node: Ast): string {
    let code = ''
    const vtype = node.vartype // 変数 or 定数
    const value = (node.value === null) ? 'null' : this._convGen(node.value, true)
    const id = this.loopId++
    const varI = `$nako_i${id}`
    code += `const ${varI}=${value}\n`
    code += `if (!(${varI} instanceof Array)) { ${varI}=[${varI}] }\n`
    const names: Ast[] = (node.names) ? node.names : []
    for (let i = 0; i < names.length; i++) {
      const nameObj = names[i]
      const name = nameObj.value
      // 二重定義？
      if (this.varsSet.names.has(name)) {
        // 複数変数文では、二重定義も許容する #1027
        // throw NakoSyntaxError.fromNode(`${vtype}『${name}』の二重定義はできません。`, node)
      }
      this.varsSet.names.add(name)
      if (vtype === '定数') {
        this.varsSet.readonly.add(name)
      }
      const vname = this.varname(name)
      code += `${vname}=${varI}[${i}];\n`
    }
    return this.convLineno(node, false) + code
  }

  convString (node: Ast): string {
    let value = '' + node.value
    const mode = node.mode
    value = value.replace(/\\/g, '\\\\')
    value = value.replace(/"/g, '\\"')
    value = value.replace(/\r/g, '\\r')
    value = value.replace(/\n/g, '\\n')
    if (mode === 'ex') {
      const rf = (a: string, name: string) => {
        return '"+' + this.genVar(name, node) + '+"'
      }
      value = value.replace(/\{(.+?)\}/g, rf)
      value = value.replace(/｛(.+?)｝/g, rf)
    }
    return '"' + value + '"'
  }

  convTryExcept (node: Ast): string {
    const block = this._convGen(node.block as Ast, false)
    const errBlock = this._convGen(node.errBlock as Ast, false)
    return this.convLineno(node, false) +
      `try {\n${block}\n} catch (e) {\n` +
      '  __v0["エラーメッセージ"] = e.message;\n' +
      ';\n' +
      `${errBlock}}\n`
  }

  getUsedFuncSet (): Set<string> {
    return this.usedFuncSet
  }

  getPluginInitCode (): string {
    // プラグインの初期化関数を実行する
    let code = ''
    let pluginCode = ''
    for (const name in this.__self.__module) {
      const initkey = `!${name}:初期化`
      if (this.varslistSet[0].names.has(initkey)) {
        this.usedFuncSet.add(`!${name}:初期化`)
        pluginCode += `__v0["!${name}:初期化"](__self);\n`
      }
    }
    if (pluginCode !== '') { code += '__v0.line=\'l0:プラグインの初期化\';\n' + pluginCode }
    return code
  }
}

export interface NakoGenResult {
  // なでしこの実行環境ありの場合
  runtimeEnv: string;
  // JavaScript単体で動かす場合
  standalone: string;
  // コード生成に使ったNakoGenのインスタンス
  gen: any
}

/** template of standalone js code */
const STANDALONE_CODE = `
// === generated by nadesiko3 ===
// <nadesiko3standalone>
// --- import
import path from 'path'
import { NakoRuntimeError } from './nako3runtime/nako_errors.mjs'
__codeImportFiles__
// --- init global self
const self = {}
self.coreVersion = '__coreVersion__'
self.version = '__version__'
self.logger = {
  error: (message) => { console.error(message) },
  warn: (message) => { console.warn(message) },
  send: (level, message) => { console.log(message) },
  runtimeError: (message, lineInfo) => { console.error(message, lineInfo) }
};
self.__varslist = [{}, {}, {}]
self.__v0 = self.__varslist[0]
self.initFuncList = []
self.clearFuncList = []
// --- jsInit ---
__jsInit__
// --- Copy module functions ---
for (const mod of __importNames__) {
  for (const funcName in mod) {
    // プラグインの初期化とクリア関数を登録
    if (funcName === '初期化') {
      self.initFuncList.push(mod[funcName].fn)
      continue
    }
    if (funcName === '!クリア') {
      self.clearFuncList.push(mod[funcName].fn)
      continue
    }
    // 関数や定数を登録
    const f = mod[funcName]
    if (f.type === 'func') { // 関数
      self.__varslist[0][funcName] = f.fn
    } else { // 定数
      self.__varslist[0][funcName] = f.value
    }
  }
}
self.__vars = self.__varslist[2];
self.__module = {};
self.__locals = {};
self.__genMode = 'sync';
// プラグインの初期化コードを実行
self.initFuncList.map(f => f(self))
try {
// ---------------------------
// <prepareMainCode>
__codeStandalone__
// </prepareMainCode>
// ---------------------------
// <mainCode>
__codeJS__
// </mainCode>
// ---------------------------
  // standaloneCodeでは、即時プラグインのクリアコードを実行
  self.clearFuncList.map(f => f(self))
} catch (err) {
  self.logger.error(err);
  throw err;
}
// </nadesiko3standalone>
`

/**
 * @param com
 * @param ast
 * @param opt
 */
export function generateJS (com: NakoCompiler, ast: Ast, opt: NakoGenOptions): NakoGenResult {
  // NakoGenのインスタンスを作成
  const gen = new NakoGen(com)

  // ※ [関数定義に関するコード生成のヒント]
  // ※ 関数の名前だけを(1)で登録して、(2)で実際に関数のコードを生成する。
  // ※ ただし(2)では生成するだけなので、(3)でプログラム冒頭に関数定義のコードを記述する。
  // この順番を変えることはできない (グローバル変数が認識できなくなったり、関数定義のタイミングがずれる)

  // (1) ユーザー定義関数をシステムに登録する
  gen.registerFunction(ast)

  // (2) JSコードを生成する
  let js = gen.convGen(ast, opt)

  // (3) JSコードを実行するための事前ヘッダ部分の生成
  const jsInit = gen.getDefFuncCode(com, opt)

  // ランダムな関数名を生成
  const funcID = '' + (new Date()).getTime() + '_' + Math.floor(0xFFFFFFFF * Math.random())
  // テストの実行
  if (js && opt.isTest) {
    js += '\n__self._runTests(__tests);\n'
  }
  // async method
  if (gen.numAsyncFn > 0 || gen.debugOption.useDebug) {
    const asyncMain = '__eval_nako3async_' + funcID + '__'
    js = `
// --------------------------------------------------
// <nadesiko3::gen::async id="${funcID}" times="${gen.numAsyncFn}">
async function ${asyncMain}(self) {
  // --- code_begin ---
${js}
  // --- code_end ---
  // __処理末尾__ // ← テストなどで必要なので消さない
} // end of ${asyncMain}
${asyncMain}.call(self, self)
.then(() => {
  // ok
})
.catch(err => {
  if (err.message === '__終わる__') { return }
  self.numFailures++
  // send errors to logger
  let rterr = self.logger.runtimeError(err, self.__v0.line)
  self.logger.error(rterr)
})
// </nadesiko3::gen::async id="${funcID}">
// --------------------------------------------------
`
  } else {
    const syncMain = '__eval_nako3sync_' + funcID + '__'
    js = `
// --------------------------------------------------
// <nadesiko3::gen::syncMode>
function ${syncMain}(self) {
try {
  ${js}
  // __処理末尾__ // ← テストなどで必要なので消さない
} catch (err) {
  if (err.message === '__終わる__') { return }
  self.numFailures++
  throw self.logger.runtimeError(err, self.__v0.line)
}
} // end of ${syncMain}
${syncMain}(self)
// </nadesiko3::gen::syncMode>
// --------------------------------------------------
`
  }
  // デバッグメッセージ
  com.getLogger().trace('--- generate ---\n' + js)
  let codeImportFiles = ''
  const importNames = []
  for (const f of opt.importFiles) {
    if (f === 'nako_errors.mjs') { continue }
    const ff = 'nako3runtime_' + f.replace(/\.(js|mjs)$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
    importNames.push(ff)
    codeImportFiles += `import ${ff} from './nako3runtime/${f}'\n`
  }
  // ---
  const initCode = gen.getPluginInitCode()
  const runtimeEnvCode = `
// <runtimeEnvCode>
const self = this
${opt.codeEnv}
${jsInit}
${initCode}
${js}
// </runtimeEnvCode>
`
  return {
    // なでしこの実行環境ありの場合(thisが有効)
    runtimeEnv: runtimeEnvCode,
    // JavaScript単体で動かす場合
    standalone: replaceTemplateCode(STANDALONE_CODE, {
      codeImportFiles,
      'coreVersion': com.coreVersion,
      'version': com.version,
      'importNames': ('[' + importNames.join(', ') + ']'),
      'codeStandalone': opt.codeStandalone,
      'codeJS': js,
      jsInit
    }),
    // コード生成に使ったNakoGenのインスタンス
    gen
  }
}
// template
function replaceTemplateCode (template: string, values: any): string {
  for (const key in values) {
    const pat = `__${key}__`
    const val = values[key]
    template = template.split(pat).join(val)
  }
  return template
}
