/**
 * nadesiko v3
 */
// types
import { Token, Ast, FuncList, FuncListItem, FuncArgs, NakoEvent, CompilerOptions, NakoComEventName, NakoDebugOption } from './nako_types.mjs'
// parser / lexer
import { NakoParser } from './nako_parser3.mjs'
import { NakoLexer } from './nako_lexer.mjs'
import { NakoPrepare } from './nako_prepare.mjs'
import { NakoGen, generateJS, NakoGenOptions, NakoGenResult } from './nako_gen.mjs'
import { NakoGenASync } from './nako_gen_async.mjs'
import { convertInlineIndent, convertIndentSyntax } from './nako_indent_inline.mjs'
import { convertDNCL } from './nako_from_dncl.mjs'
import { convertDNCL2 } from './nako_from_dncl2.mjs'
import { SourceMappingOfTokenization, SourceMappingOfIndentSyntax, OffsetToLineColumn, subtractSourceMapByPreCodeLength } from './nako_source_mapping.mjs'
import { NakoLexerError, NakoImportError, NakoSyntaxError, InternalLexerError } from './nako_errors.mjs'
import { NakoLogger } from './nako_logger.mjs'
import { NakoGlobal } from './nako_global.mjs'
// version info
import coreVersion from './nako_core_version.mjs'
// basic plugins
import PluginSystem from './plugin_system.mjs'
import PluginMath from './plugin_math.mjs'
import PluginCSV from './plugin_csv.mjs'
import PluginPromise from './plugin_promise.mjs'
import PluginTest from './plugin_test.mjs'

const cloneAsJSON = (x: any): any => JSON.parse(JSON.stringify(x))

export interface NakoCompilerOption {
  useBasicPlugin: boolean;
}

/** インタプリタに「取り込み」文を追加するために用意するオブジェクト */
export interface LoaderToolTask<T> {
  task: Promise<T>;
}
export interface LoaderTool {
  // type: 'nako3' | 'js' | 'invalid' | 'mjs'
  resolvePath: (name: string, token: Token, fromFile: string) => { type: string, filePath: string };
  readNako3: (filePath: string, token: Token) => LoaderToolTask<string>;
  readJs: (filePath: string, token: Token) => LoaderToolTask<any>;
}

interface DependenciesItem {
  tokens: Token[];
  alias: Set<string>;
  addPluginFile: () => void;
  funclist: any;
}
type Dependencies = { [key:string]:DependenciesItem }

interface LexResult {
  commentTokens: Token[];
  tokens: Token[];
  requireTokens: Token[];
}

type NakoVars = {[key: string]: any}

export interface NakoResetOption {
  needToClearPlugin: boolean
}

/** コンパイラ実行オプションを生成 */
export function newCompilerOptions (initObj: any = {}): CompilerOptions {
  if (typeof initObj !== 'object') { initObj = {} }
  initObj.testOnly = initObj.testOnly || false
  initObj.resetEnv = initObj.resetEnv || false
  initObj.resetAll = initObj.resetAll || false
  initObj.preCode = initObj.preCode || ''
  initObj.nakoGlobal = initObj.nakoGlobal || null
  return initObj
}

/** なでしこコンパイラ */
export class NakoCompiler {
  private nakoFuncList: FuncList;
  private funclist: FuncList;
  private pluginFunclist: Record<string, FuncListItem>;
  private pluginfiles: Record<string, any>;
  private commandlist: Set<string>;
  private prepare: NakoPrepare;
  private parser: NakoParser;
  private lexer: NakoLexer;
  private dependencies: Dependencies;
  private usedFuncs: Set<string>;
  private codeGenerateor: {[key: string]: any};
  protected logger: NakoLogger;
  protected eventList: NakoEvent[];
  // global objects
  __varslist: NakoVars[];
  __locals: NakoVars;
  __self: NakoCompiler;
  __vars: NakoVars;
  __v0: NakoVars;
  __v1: NakoVars;
  __globals: NakoGlobal[];
  __globalObj: NakoGlobal|null; // 現在のNakoGlobalオブジェクト
  __module: Record<string, Record<string, FuncListItem>>;
  numFailures: number; // エラーレポートの数を記録
  public version: string;
  public coreVersion: string;
  public filename: string;
  public debugOption: NakoDebugOption;
  /**
   * @param {undefined | {'useBasicPlugin':true|false}} options
   */
  constructor (options: NakoCompilerOption | undefined = undefined) {
    if (options === undefined) {
      options = { useBasicPlugin: true }
    }
    // 環境のリセット
    this.__varslist = [{}, {}, {}] // このオブジェクトは変更しないこと (this.gen.__varslist と共有する)
    this.__locals = {} // ローカル変数
    this.__self = this
    this.__vars = this.__varslist[2]
    this.__v0 = this.__varslist[0]
    this.__v1 = this.__varslist[1]
    // バージョンを設定
    this.version = coreVersion.version
    this.coreVersion = coreVersion.version
    this.__globals = [] // 生成した NakoGlobal のインスタンスを保持
    this.__globalObj = null
    this.__module = {} // requireなどで取り込んだモジュールの一覧
    this.pluginFunclist = {} // プラグインで定義された関数
    this.funclist = {} // プラグインで定義された関数 + ユーザーが定義した関数
    this.pluginfiles = {} // 取り込んだファイル一覧
    this.commandlist = new Set() // プラグインで定義された定数・変数・関数の名前
    this.nakoFuncList = {} // __v1に配置するJavaScriptのコードで定義された関数
    this.eventList = [] // 実行前に環境を変更するためのイベント
    this.codeGenerateor = {} // コードジェネレータ
    this.debugOption = { useDebug: false, waitTime: 0 }

    this.logger = new NakoLogger()
    this.filename = 'main.nako3'

    /**
     * 取り込み文を置換するためのオブジェクト。
     * 正規化されたファイル名がキーになり、取り込み文の引数に指定された正規化されていないファイル名はaliasに入れられる。
     * JavaScriptファイルによるプラグインの場合、contentは空文字列。
     * funclistはシンタックスハイライトの高速化のために事前に取り出した、ファイルが定義する関数名のリスト。
     */
    this.dependencies = {}
    this.usedFuncs = new Set()
    this.numFailures = 0

    if (options.useBasicPlugin) { this.addBasicPlugins() }
    // 必要なオブジェクトを覚えておく
    this.prepare = NakoPrepare.getInstance()
    this.parser = new NakoParser(this.logger)
    this.lexer = new NakoLexer(this.logger)
    // 関数一覧を設定
    this.lexer.setFuncList(this.funclist)
  }

  /** モジュール(名前空間)の一覧を取得する */
  getModList (): string[] {
    return this.lexer.modList
  }

  getLogger (): NakoLogger {
    return this.logger
  }

  getNakoFuncList (): FuncList {
    return this.nakoFuncList
  }

  getNakoFunc (name: string): FuncListItem|undefined {
    return this.nakoFuncList[name]
  }

  getPluginfiles (): Record<string, any> {
    return this.pluginfiles
  }

  /**
   * 基本的なプラグインを追加する
   */
  addBasicPlugins () {
    this.addPluginObject('PluginSystem', PluginSystem)
    this.addPluginObject('PluginMath', PluginMath)
    this.addPluginObject('PluginPromise', PluginPromise)
    this.addPluginObject('PluginAssert', PluginTest)
    this.addPluginObject('PluginCSV', PluginCSV)
  }

  /**
   * loggerを新しいインスタンスで置き換える。
   */
  replaceLogger () {
    const logger = this.lexer.logger = this.parser.logger = this.logger = new NakoLogger()
    return logger
  }

  /**
   * ファイル内のrequire文の位置を列挙する。出力の配列はstartでソートされている。
   * @param {Token[]} tokens rawtokenizeの出力
   */
  static listRequireStatements (tokens: Token[]): Token[] {
    const requireStatements: Token[] = []
    for (let i = 0; i + 2 < tokens.length; i++) {
      // not (string|string_ex) '取り込み'
      if (!(tokens[i].type === 'not' &&
        (tokens[i + 1].type === 'string' || tokens[i + 1].type === 'string_ex') &&
        tokens[i + 2].value === '取込')) {
        continue
      }
      requireStatements.push({
        ...tokens[i],
        start: i,
        end: i + 3,
        value: tokens[i + 1].value + '',
        firstToken: tokens[i],
        lastToken: tokens[i + 2]
      })
      i += 2
    }
    return requireStatements
  }

  /**
   * プログラムが依存するファイルを再帰的に取得する。
   * - 依存するファイルがJavaScriptファイルの場合、そのファイルを実行して評価結果をthis.addPluginFileに渡す。
   * - 依存するファイルがなでしこ言語の場合、ファイルの中身を取得して変数に保存し、再帰する。
   *
   * @param {string} code
   * @param {string} filename
   * @param {string} preCode
   * @param {LoaderTool} tools 実行環境 (ブラウザ or Node.js) によって外部ファイルの取得・実行方法は異なるため、引数でそれらを行う関数を受け取る。
   *  - resolvePath は指定した名前をもつファイルを検索し、正規化されたファイル名を返す関数。返されたファイル名はreadNako3かreadJsの引数になる。
   *  - readNako3は指定されたファイルの中身を返す関数。
   *  - readJsは指定したファイルをJavaScriptのプログラムとして実行し、`export default` でエクスポートされた値を返す関数。
   * @returns {Promise<unknown> | void}
   * @protected
   */
  _loadDependencies (code: string, filename: string, preCode: string, tools: LoaderTool) {
    const dependencies: Dependencies = {}
    const compiler = new NakoCompiler({ useBasicPlugin: true })
    const defaultNamespace: string = NakoLexer.filenameToModName(this.filename)
    /**
     * @param {any} item
     * @param {any} tasks
     */
    const loadJS = (item: any, tasks: any) => {
      // jsならプラグインとして読み込む。(ESMでは必ず動的に読む)
      const obj = tools.readJs(item.filePath, item.firstToken)
      tasks.push(obj.task.then((res: any) => {
        const pluginFuncs = res()
        this.addPluginFile(item.value, item.filePath, pluginFuncs, false)
        dependencies[item.filePath].funclist = pluginFuncs
        dependencies[item.filePath].addPluginFile = () => { this.addPluginFile(item.value, item.filePath, pluginFuncs, false) }
      }))
    }
    const loadNako3 = (item: any, tasks: any) => {
      // nako3ならファイルを読んでdependenciesに保存する。
      const content = tools.readNako3(item.filePath, item.firstToken)
      const registerFile = (code: string) => {
        // シンタックスハイライトの高速化のために、事前にファイルが定義する関数名のリストを取り出しておく。
        // preDefineFuncはトークン列に変更を加えるため、事前にクローンしておく。
        // 「プラグイン名設定」を行う (#956)
        const modName = NakoLexer.filenameToModName(item.filePath)
        code = `『${modName}』にプラグイン名設定;『${modName}』に名前空間設定;` + code +
          `『メイン』にプラグイン名設定;『${defaultNamespace}』に名前空間設定。`
        const tokens = this.rawtokenize(code, 0, item.filePath)
        dependencies[item.filePath].tokens = tokens
        const funclist = {}
        NakoLexer.preDefineFunc(cloneAsJSON(tokens), this.logger, funclist)
        dependencies[item.filePath].funclist = funclist
        // 再帰
        return loadRec(code, item.filePath, '')
      }
      // 取り込み構文における問題を減らすため、必ず非同期でプログラムを読み込む仕様とした #1219
      tasks.push(content.task.then((res) => registerFile(res)))
    }
    const loadRec = (code: string, filename: string, preCode: string): Promise<unknown>|void => {
      const tasks: Promise<unknown>[] = []
      // 取り込みが必要な情報一覧を調べる(トークン分割して、取り込みタグを得る)
      const tags = NakoCompiler.listRequireStatements(compiler.rawtokenize(code, 0, filename, preCode))
      // パスを解決する
      const tagsResolvePath = tags.map((v) => ({ ...v, ...tools.resolvePath(v.value, v.firstToken as Token, filename) }))
      // 取り込み開始
      for (const item of tagsResolvePath) {
        // 2回目以降の読み込み
        // eslint-disable-next-line no-prototype-builtins
        if (dependencies.hasOwnProperty(item.filePath)) {
          dependencies[item.filePath].alias.add(item.value)
          continue
        }

        // 初回の読み込み
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        dependencies[item.filePath] = { tokens: [], alias: new Set([item.value]), addPluginFile: ():void => {}, funclist: {} }
        if (item.type === 'js' || item.type === 'mjs') {
          loadJS(item, tasks)
        } else if (item.type === 'nako3') {
          loadNako3(item, tasks)
        } else {
          throw new NakoImportError(`ファイル『${item.value}』を読み込めません。ファイルが存在しないか未対応の拡張子です。`,
            (item.firstToken as Token).file, (item.firstToken as Token).line)
        }
      }
      if (tasks.length > 0) {
        return Promise.all(tasks)
      }
      return undefined
    }

    try {
      const result = loadRec(code, filename, preCode)

      // 非同期な場合のエラーハンドリング
      if (result !== undefined) {
        result.catch((err) => {
          // 読み込みに失敗したら処理を中断する
          this.logger.error(err.msg)
          this.numFailures++
        })
      }

      // すべてが終わってからthis.dependenciesに代入する。そうしないと、「実行」ボタンを連打した場合など、
      // loadDependencies() が並列実行されるときに正しく動作しない。
      this.dependencies = dependencies
      return result
    } catch (err) {
      // 同期処理では素直に例外を投げる
      this.logger.error('' + err)
      throw err
    }
  }

  /**
   * コードを単語に分割する
   * @param code なでしこのプログラム
   * @param line なでしこのプログラムの行番号
   * @param filename
   * @param preCode
   * @returns トークンのリスト
   */
  rawtokenize (code: string, line: number, filename: string, preCode = ''): Token[] {
    if (!code.startsWith(preCode)) {
      throw new Error('codeの先頭にはpreCodeを含める必要があります。')
    }
    // 名前空間のモジュールリストに自身を追加
    const modName = NakoLexer.filenameToModName(filename)
    const modList = this.getModList()
    if (modList.indexOf(modName) < 0) { modList.unshift(modName) }
    // 全角半角の統一処理
    const preprocessed = this.prepare.convert(code)
    const tokenizationSourceMapping = new SourceMappingOfTokenization(code.length, preprocessed)
    const indentationSyntaxSourceMapping = new SourceMappingOfIndentSyntax(code, [], [])
    const offsetToLineColumn = new OffsetToLineColumn(code)

    // トークン分割
    let tokens: Token[]
    try {
      tokens = this.lexer.tokenize(preprocessed.map((v) => v.text).join(''), line, filename)
    } catch (err) {
      if (!(err instanceof InternalLexerError)) {
        throw err
      }
      // エラー位置をソースコード上の位置に変換して返す
      const dest = indentationSyntaxSourceMapping.map(tokenizationSourceMapping.map(err.preprocessedCodeStartOffset), tokenizationSourceMapping.map(err.preprocessedCodeEndOffset))
      const line: number|undefined = dest.startOffset === null ? err.line : offsetToLineColumn.map(dest.startOffset, false).line
      const map = subtractSourceMapByPreCodeLength({ ...dest, line }, preCode)
      throw new NakoLexerError(err.msg, map.startOffset, map.endOffset, map.line, filename)
    }
    // DNCL ver2 (core #41)
    tokens = convertDNCL2(tokens)
    // DNCL ver1 (#1140)
    tokens = convertDNCL(tokens)
    // インデント構文を変換 #596
    tokens = convertIndentSyntax(tokens)
    // インラインインデントを変換 #1215
    tokens = convertInlineIndent(tokens)

    // ソースコード上の位置に変換
    tokens = tokens.map((token) => {
      const dest = indentationSyntaxSourceMapping.map(
        tokenizationSourceMapping.map(token.preprocessedCodeOffset || 0),
        tokenizationSourceMapping.map((token.preprocessedCodeOffset || 0) + (token.preprocessedCodeLength || 0))
      )
      let line = token.line
      let column = 0
      if (token.type === 'eol' && dest.endOffset !== null) {
        // eolはnako_genで `line = ${eolToken.line};` に変換されるため、
        // 行末のeolのlineは次の行の行数を表す必要がある。
        const out = offsetToLineColumn.map(dest.endOffset, false)
        line = out.line
        column = out.column
      } else if (dest.startOffset !== null) {
        const out = offsetToLineColumn.map(dest.startOffset, false)
        line = out.line
        column = out.column
      }
      return {
        ...token,
        ...subtractSourceMapByPreCodeLength({ line, column, startOffset: dest.startOffset, endOffset: dest.endOffset }, preCode),
        rawJosi: token.josi
      }
    })
    return tokens
  }

  /**
   * 単語の属性を構文解析に先立ち補正する
   * @param {Token[]} tokens トークンのリスト
   * @param {boolean} isFirst 最初の呼び出しかどうか
   * @param {string} filename
   * @returns コード (なでしこ)
   */
  converttoken (tokens: Token[], isFirst: boolean, filename: string): Token[] {
    const tok = this.lexer.replaceTokens(tokens, isFirst, filename)
    return tok
  }

  /**
   * 環境のリセット
   * {NakoResetOption|undefined}
   */
  reset (options: NakoResetOption|undefined = undefined) {
    if (!options || options.needToClearPlugin) {
      // (メモ) #1245
      // 通常、リセット処理では、プラグインの!クリアを呼ぶ。
      // しかし、エディタではクリアイベントを呼ぶと、時計などのコンテンツが止まってしまう
      // そのため、例外的にオプションを指定すると、プラグインのクリアイベントを呼ばない
      this.clearPlugins()
    }
    /**
     * なでしこのローカル変数をスタックで管理
     * __varslist[0] プラグイン領域
     * __varslist[1] なでしこグローバル領域
     * __varslist[2] 最初のローカル変数 ( == __vars }
     */
    this.__varslist = [this.__varslist[0], {}, {}]
    this.__v0 = this.__varslist[0]
    this.__v1 = this.__varslist[1]
    this.__vars = this.__varslist[2]
    this.__locals = {}

    // プラグイン命令以外を削除する。
    this.funclist = {}
    for (const name of Object.keys(this.__v0)) {
      const original = this.pluginFunclist[name]
      if (!original) {
        continue
      }
      this.funclist[name] = JSON.parse(JSON.stringify(original))
    }

    this.lexer.setFuncList(this.funclist)
    this.logger.clear()
  }

  /**
   * typeがcodeのトークンを単語に分割するための処理
   * @param {string} code
   * @param {number} line
   * @param {string} filename
   * @param {number | null} startOffset
   * @returns
   * @private
   */
  lexCodeToken (code: string, line: number, filename: string, startOffset: number|null): {commentTokens: Token[], tokens: Token[]} {
    // 単語に分割
    let tokens = this.rawtokenize(code, line, filename, '')

    // 文字列内位置からファイル内位置へ変換
    if (startOffset === null) {
      for (const token of tokens) {
        token.startOffset = undefined
        token.endOffset = undefined
      }
    } else {
      for (const token of tokens) {
        if (token.startOffset !== undefined) {
          token.startOffset += startOffset
        }
        if (token.endOffset !== undefined) {
          token.endOffset += startOffset
        }
      }
    }

    // convertTokenで消されるコメントのトークンを残す
    const commentTokens = tokens.filter((t) => t.type === 'line_comment' || t.type === 'range_comment')
      .map((v) => ({ ...v })) // clone

    tokens = this.converttoken(tokens, false, filename)

    return { tokens, commentTokens }
  }

  /**
   * 再帰的にrequire文を置換する。
   * .jsであれば削除し、.nako3であればそのファイルのトークン列で置換する。
   * @param {TokenWithSourceMap[]} tokens
   * @param {Set<string>} [includeGuard]
   * @returns {Token[]} 削除された取り込み文のトークン
   */
  replaceRequireStatements (tokens: Token[], includeGuard:Set<string> = new Set()): Token[] {
    /** @type {TokenWithSourceMap[]} */
    const deletedTokens = []
    for (const r of NakoCompiler.listRequireStatements(tokens).reverse()) {
      // C言語のinclude guardと同じ仕組みで無限ループを防ぐ。
      if (includeGuard.has(r.value)) {
        deletedTokens.push(...tokens.splice((r.start || 0), (r.end || 0) - (r.start || 0)))
        continue
      }
      const filePath = Object.keys(this.dependencies).find((key) => this.dependencies[key].alias.has(r.value))
      if (filePath === undefined) {
        if (!r.firstToken) { throw new Error(`ファイル『${r.value}』が読み込まれていません。`) }
        throw new NakoLexerError(`ファイル『${r.value}』が読み込まれていません。`,
          (r.firstToken as Token).startOffset || 0,
          (r.firstToken as Token).endOffset || 0,
          (r.firstToken as Token).line, (r.firstToken as Token).file)
      }
      this.dependencies[filePath].addPluginFile()
      const children = cloneAsJSON(this.dependencies[filePath].tokens)
      includeGuard.add(r.value)
      deletedTokens.push(...this.replaceRequireStatements(children, includeGuard))
      deletedTokens.push(...tokens.splice(r.start || 0, (r.end || 0) - (r.start || 0), ...children))
    }
    return deletedTokens
  }

  /**
   * replaceRequireStatementsのシンタックスハイライト用の実装。
   * @param {TokenWithSourceMap[]} tokens
   * @returns {TokenWithSourceMap[]} 削除された取り込み文のトークン
   */
  removeRequireStatements (tokens: Token[]): Token[] {
    /** @type {TokenWithSourceMap[]} */
    const deletedTokens = []
    for (const r of NakoCompiler.listRequireStatements(tokens).reverse()) {
      // プラグイン命令のシンタックスハイライトのために、addPluginFileを呼んで関数のリストをthis.dependencies[filePath].funclistに保存させる。
      const filePath = Object.keys(this.dependencies).find((key) => this.dependencies[key].alias.has(r.value))
      if (filePath !== undefined) {
        this.dependencies[filePath].addPluginFile()
      }

      // 全ての取り込み文を削除する。そうしないとトークン化に時間がかかりすぎる。
      deletedTokens.push(...tokens.splice(r.start || 0, (r.end || 0) - (r.start || 0)))
    }
    return deletedTokens
  }

  /** 字句解析を行う */
  lex (code: string, filename = 'main.nako3', preCode = '', syntaxHighlighting = false): LexResult {
    // 単語に分割
    let tokens = this.rawtokenize(code, 0, filename, preCode)

    // require文を再帰的に置換する
    const requireStatementTokens = syntaxHighlighting ? this.removeRequireStatements(tokens) : this.replaceRequireStatements(tokens, undefined)
    for (const t of requireStatementTokens) {
      if (t.type === 'word' || t.type === 'not') {
        t.type = 'require'
      }
    }
    if (requireStatementTokens.length >= 3) {
      // modList を更新
      for (let i = 0; i < requireStatementTokens.length; i += 3) {
        let modName = requireStatementTokens[i + 1].value
        modName = NakoLexer.filenameToModName(modName)
        if (this.lexer.modList.indexOf(modName) < 0) {
          this.lexer.modList.push(modName)
        }
      }
    }

    // convertTokenで消されるコメントのトークンを残す
    const commentTokens: Token[] = tokens.filter((t) => t.type === 'line_comment' || t.type === 'range_comment')
      .map((v) => ({ ...v })) // clone

    tokens = this.converttoken(tokens, true, filename)

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] && tokens[i].type === 'code') {
        const children = this.lexCodeToken(tokens[i].value, tokens[i].line, filename, tokens[i].startOffset || 0)
        commentTokens.push(...children.commentTokens)
        tokens.splice(i, 1, ...children.tokens)
        i--
      }
    }

    this.logger.trace('--- lex ---\n' + JSON.stringify(tokens, null, 2))

    return { commentTokens, tokens, requireTokens: requireStatementTokens }
  }

  /**
   * コードをパースしてASTにする
   */
  parse (code: string, filename: string, preCode = ''): Ast {
    // 関数リストを字句解析と構文解析に登録
    this.lexer.setFuncList(this.funclist)
    this.parser.setFuncList(this.funclist)
    // 字句解析を行う
    const lexerOutput = this.lex(code, filename, preCode)

    // 構文木を作成
    let ast: Ast
    try {
      this.parser.genMode = 'sync' // set default
      ast = this.parser.parse(lexerOutput.tokens, filename)
    } catch (err: any) {
      if (typeof err.startOffset !== 'number') {
        throw NakoSyntaxError.fromNode(err.message, lexerOutput.tokens[this.parser.getIndex()])
      }
      throw err
    }
    // 使用したシステム関数の一覧を this.usedFuns に入れる(エディタなどで利用される)
    this.usedFuncs = this.parser.usedFuncs // 全ての関数呼び出し
    this.deleteUnNakoFuncs() // システム関数以外を削除
    this.logger.trace('--- ast ---\n' + JSON.stringify(ast, null, 2))
    return ast
  }

  getUsedFuncs (ast: Ast): Set<string> {
    const queue = [ast]
    this.usedFuncs = new Set()

    while (queue.length > 0) {
      const ast_ = queue.pop()

      if (ast_ !== null && ast_ !== undefined && ast_.block !== null && ast_.block !== undefined) {
        this.getUsedAndDefFuncs(queue, JSON.parse(JSON.stringify(ast_.block)))
      }
    }
    return this.deleteUnNakoFuncs()
  }

  getUsedAndDefFuncs (astQueue: Ast[], blockQueue: Ast[]): void {
    while (blockQueue.length > 0) {
      const block = blockQueue.pop()

      if (block !== null && block !== undefined) {
        this.getUsedAndDefFunc(block, astQueue, blockQueue)
      }
    }
  }

  getUsedAndDefFunc (block: Ast, astQueue: any[], blockQueue: Ast[]): void {
    if (['func', 'func_pointer'].includes(block.type) && block.name !== null && block.name !== undefined) {
      this.usedFuncs.add(block.name as string)
    }
    astQueue.push([block, block.block as Ast])
    blockQueue.push.apply(blockQueue, [block.value].concat(block.args))
  }

  deleteUnNakoFuncs (): Set<string> {
    for (const func of this.usedFuncs) {
      if (!this.commandlist.has(func)) {
        this.usedFuncs.delete(func)
      }
    }
    return this.usedFuncs
  }

  /**
   * プログラムをコンパイルしてランタイム用のJavaScriptのコードを返す
   * @param code コード (なでしこ)
   * @param filename
   * @param isTest テストかどうか
   * @param preCode
   */
  compile (code: string, filename: string, isTest = false, preCode = ''): string {
    const opt = newCompilerOptions()
    opt.testOnly = isTest
    opt.preCode = preCode
    const res = this.compileFromCode(code, filename, opt)
    return res.runtimeEnv
  }

  /** parse & generate  */
  compileFromCode (code: string, filename: string, options: CompilerOptions|undefined = undefined): NakoGenResult {
    if (filename === '') { filename = 'main.nako3' }
    if (options === undefined) { options = newCompilerOptions() }
    try {
      if (options.resetEnv) { this.reset() }
      if (options.resetAll) { this.clearPlugins() }
      // onBeforeParse
      this.eventList.filter(o => o.eventName === 'beforeParse').map(e => e.callback(code))
      // parse
      const ast = this.parse(code, filename, options.preCode)
      // onBeforeGenerate
      this.eventList.filter(o => o.eventName === 'beforeGenerate').map(e => e.callback(ast))
      // generate
      const outCode = this.generateCode(ast, new NakoGenOptions(options.testOnly))
      // onAfterGenerate
      this.eventList.filter(o => o.eventName === 'afterGenerate').map(e => e.callback(outCode))
      return outCode
    } catch (e: any) {
      this.logger.error(e)
      throw e
    }
  }

  /**
   * プログラムをコンパイルしてJavaScriptのコードオブジェクトを返す
   * @param ast
   * @param opt テストかどうか
   */
  generateCode (ast: Ast, opt: NakoGenOptions): NakoGenResult {
    // Select Code Generator #637
    const mode: string = ast.genMode || ''
    // normal mode
    if (mode === 'sync') {
      return generateJS(this, ast, opt)
    }
    // 非推奨の非同期モード #1164
    if (mode === '非同期モード') {
      this.logger.warn('『!非同期モード』の利用は非推奨です。[詳細](https://github.com/kujirahand/nadesiko3/issues/1164)')
      return NakoGenASync.generate(this, ast, opt.isTest)
    }
    // その他のコードジェネレータ(PHPなど)
    const genObj: any|undefined = this.codeGenerateor[mode]
    if (!genObj) {
      throw new Error(`コードジェネレータの「${mode}」はサポートされていません。`)
    }
    return genObj.generate(this, ast, opt.isTest)
  }

  /** コードジェネレータを追加する */
  addCodeGenerator (mode: string, obj: any) {
    this.codeGenerateor[mode] = obj
  }

  /** (非推奨)
   * @param code
   * @param fname
   * @param isReset
   * @param isTest テストかどうか。stringの場合は1つのテストのみ。
   * @param [preCode]
   * @deprecated 代わりにrunAsyncメソッドを使ってください。(core #52)
   */
  async _run (code: string, fname: string, isReset: boolean, isTest: boolean, preCode = ''): Promise<NakoGlobal> {
    const opts: CompilerOptions = newCompilerOptions({
      resetEnv: isReset,
      resetAll: isReset,
      testOnly: isTest,
      preCode
    })
    return this._runEx(code, fname, opts)
  }

  /** 各プラグインをリセットする */
  clearPlugins () {
    // 他に実行している「なでしこ」があればクリアする
    this.__globals.forEach((sys: NakoGlobal) => {
      sys.reset()
    })
    this.__globals = [] // clear
  }

  /**
   * 環境を指定してJavaScriptのコードを実行する
   * @param code JavaScriptのコード
   * @param nakoGlobal 実行環境
   */
  private evalJS (code: string, nakoGlobal: NakoGlobal): void {
    // 実行前に環境を初期化するイベントを実行(beforeRun)
    this.eventList.filter(o => o.eventName === 'beforeRun').map(e => e.callback(nakoGlobal))
    this.__globalObj = nakoGlobal // 現在のnakoGlobalを記録
    this.__globalObj.lastJSCode = code
    try {
      // eslint-disable-next-line no-new-func
      const f = new Function(code)
      f.apply(nakoGlobal)
    } catch (err: any) {
      // なでしこコードのエラーは抑止してログにのみ記録
      nakoGlobal.numFailures++
      this.getLogger().error(err)
      throw err
    }
    // 実行後に終了イベントを実行(finish)
    this.eventList.filter(o => o.eventName === 'finish').map(e => e.callback(nakoGlobal))
  }

  /**
   * 同期的になでしこのプログラムcodeを実行する
   * @param code なでしこのプログラム
   * @param filename ファイル名
   * @param options オプション
   * @returns 実行に利用したグローバルオブジェクト
   * @deprecated 代わりにrunAsyncメソッドを使ってください。(core #52)
   */
  public runSync (code: string, filename: string, options: CompilerOptions|undefined = undefined): NakoGlobal {
    // コンパイル
    options = newCompilerOptions(options)
    const out = this.compileFromCode(code, filename, options)
    // 実行前に環境を生成
    const nakoGlobal = this.getNakoGlobal(options, out.gen)
    // 実行
    this.evalJS(out.runtimeEnv, nakoGlobal)
    return nakoGlobal
  }

  /**
   * 非同期になでしこのプログラムcodeを実行する
   * @param code なでしこのプログラム
   * @param filename ファイル名
   * @param options オプション
   * @returns 実行に利用したグローバルオブジェクト
   */
  public async runAsync (code: string, filename: string, options: CompilerOptions|undefined = undefined): Promise<NakoGlobal> {
    // コンパイル
    options = newCompilerOptions(options)
    const out = this.compileFromCode(code, filename, options)
    // 実行前に環境を生成
    const nakoGlobal = this.getNakoGlobal(options, out.gen)
    // 実行
    this.evalJS(out.runtimeEnv, nakoGlobal)
    return nakoGlobal
  }

  private getNakoGlobal (options: CompilerOptions, gen: NakoGen): NakoGlobal {
    // オプションを参照
    let g: NakoGlobal|null = options.nakoGlobal
    if (!g) {
      // 空ならば前回の値を参照(リセットするなら新規で作成する)
      if (this.__globals.length > 0 && options.resetAll === false && options.resetEnv === false) {
        g = this.__globals[this.__globals.length - 1]
      } else {
        g = new NakoGlobal(this, gen, (this.__globals.length + 1))
      }
    }
    if (this.__globals.indexOf(g) < 0) { this.__globals.push(g) }
    return g
  }

  /**
   * イベントを登録する
   * @param eventName イベント名
   * @param callback コールバック関数
   */
  addListener (eventName: NakoComEventName, callback: (event:any) => void) {
    this.eventList.push({ eventName, callback })
  }

  /**
   * テストを実行する
   * @param code
   * @param fname
   * @param preCode
   * @param testOnly
   */
  test (code: string, fname: string, preCode = '', testOnly = false) {
    const options = newCompilerOptions()
    options.preCode = preCode
    options.testOnly = testOnly
    return this.runSync(code, fname, options)
  }

  /**
   * なでしこのプログラムを実行（他に実行しているインスタンスはそのまま）
   * @param code
   * @param fname
   * @param [preCode]
   * @deprecated 代わりに runAsync を使ってください。
   */
  run (code: string, fname = 'main.nako3', preCode = ''): NakoGlobal {
    const options = newCompilerOptions()
    options.preCode = preCode
    return this.runSync(code, fname, options)
  }

  /**
   * JavaScriptのみで動くコードを取得する場合
   * @param code
   * @param filename
   * @param opt
   */
  compileStandalone (code: string, filename: string, opt: NakoGenOptions|null = null): string {
    if (opt === null) { opt = new NakoGenOptions() }
    const ast = this.parse(code, filename)
    return this.generateCode(ast, opt).standalone
  }

  /**
   * プラグイン・オブジェクトを追加
   * @param po プラグイン・オブジェクト
   * @param persistent falseのとき、次以降の実行では使えない
   */
  addPlugin (po: {[key: string]: any}, persistent = true): void {
    // 変数のメタ情報を確認
    const __v0 = this.__varslist[0]
    if (__v0.meta === undefined) { __v0.meta = {} }

    // プラグインの値をオブジェクトにコピー
    for (const key in po) {
      const v = po[key]
      this.funclist[key] = v
      if (persistent) {
        this.pluginFunclist[key] = JSON.parse(JSON.stringify(v))
      }
      if (v.type === 'func') {
        __v0[key] = v.fn
      } else if (v.type === 'const' || v.type === 'var') {
        __v0[key] = v.value
        __v0.meta[key] = {
          readonly: (v.type === 'const')
        }
      } else {
        console.error('[プラグイン追加エラー]', v)
        throw new Error('プラグインの追加でエラー。')
      }
      // コマンドを登録するか?
      if (key === '初期化' || key.substring(0, 1) === '!') { // 登録しない関数名
        continue
      }
      this.commandlist.add(key)
    }
  }

  /**
   * プラグイン・オブジェクトを追加(ブラウザ向け)
   * @param objName オブジェクト名
   * @param po 関数リスト
   * @param persistent falseのとき、次以降の実行では使えない
   */
  addPluginObject (objName: string, po: {[key: string]: any}, persistent = true): void {
    this.__module[objName] = po
    this.pluginfiles[objName] = '*'
    // 初期化をチェック
    if (typeof (po['初期化']) === 'object') {
      const def = po['初期化']
      delete po['初期化']
      const initKey = `!${objName}:初期化`
      po[initKey] = def
    }
    // メタ情報をチェック (#1034)
    if (po.meta && po.meta.value && typeof (po.meta) === 'object') {
      const meta = po.meta
      delete po.meta
      const pluginName = meta.value.pluginName || objName
      const metaKey = `__${pluginName}`.replace('-', '__')
      po[metaKey] = meta
    }
    this.addPlugin(po, persistent)
  }

  /**
   * プラグイン・ファイルを追加(Node.js向け)
   * @param objName オブジェクト名
   * @param fpath ファイルパス
   * @param po 登録するオブジェクト
   * @param persistent falseのとき、次以降の実行では使えない
   */
  addPluginFile (objName: string, fpath: string, po: {[key: string]: any}, persistent = true): void {
    // Windowsのパスがあると、JSファイル書き出しでエラーになるので、置換する
    if (objName.indexOf('\\') >= 0) {
      objName = objName.replace(/\\/g, '/')
    }
    this.addPluginObject(objName, po, persistent)
    if (this.pluginfiles[objName] === undefined) {
      this.pluginfiles[objName] = fpath
    }
  }

  /**
   * 関数を追加する
   * @param {string} key 関数名
   * @param {string[][]} josi 助詞
   * @param {Function} fn 関数
   * @param {boolean} returnNone 値を返す関数の場合はfalseを指定
   * @param {boolean} asyncFn Promiseを返す関数かを指定
   */
  addFunc (key: string, josi: FuncArgs, fn: any, returnNone = true, asyncFn = false): void {
    this.funclist[key] = { josi, fn, type: 'func', return_none: returnNone, asyncFn }
    this.pluginFunclist[key] = cloneAsJSON(this.funclist[key])
    this.__varslist[0][key] = fn
  }

  /** (非推奨) 互換性のため ... 関数を追加する
   * @deprecated 代わりにaddFuncを使ってください
  */
  public setFunc (key: string, josi: FuncArgs, fn: any, returnNone = true, asyncFn = false): void {
    this.addFunc(key, josi, fn, returnNone, asyncFn)
  }

  /**
   * プラグイン関数を参照する
   * @param key プラグイン関数の関数名
   * @returns プラグイン・オブジェクト
   */
  getFunc (key: string): FuncListItem {
    return this.funclist[key]
  }

  /** 同期的になでしこのプログラムcodeを実行する
   * @deprecated 代わりにrunAsyncメソッドを使ってください。(core #52)
   */
  private _runEx (code: string, filename: string, opts: CompilerOptions, preCode = '', nakoGlobal: NakoGlobal|undefined = undefined): NakoGlobal {
    // コンパイル
    opts.preCode = preCode
    if (nakoGlobal) { opts.nakoGlobal = nakoGlobal }
    return this.runSync(code, filename, opts)
  }

  /** 同期的になでしこのプログラムcodeを実行する
   * @param code
   * @param fname
   * @param opts
   * @param [preCode]
   * @deprecated 代わりにrunAsyncメソッドを使ってください。(core #52)
   */
  public runEx (code: string, fname: string, opts: CompilerOptions, preCode = '') {
    return this._runEx(code, fname, opts, preCode)
  }

  /**
   * (非推奨) なでしこのプログラムを実行（他に実行しているインスタンスもリセットする)
   * @param code
   * @param fname
   * @param [preCode]
   */
  async runReset (code: string, fname = 'main.nako3', preCode = ''): Promise<NakoGlobal> {
    const opts = newCompilerOptions({ resetAll: true, resetEnv: true })
    return this._runEx(code, fname, opts, preCode)
  }
}
