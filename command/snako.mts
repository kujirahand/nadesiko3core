#!/usr/bin/env node
import fs from 'fs'
import com from '../index.mjs'
import { NakoGlobal } from '../src/nako_global.mjs'

/** コマンドラインオプション */
class CommandOptions {
  isDebug: boolean;
  filename: string;
  nodePath: string;
  scriptPath: string;
  evalStr: string;
  constructor () {
    this.nodePath = ''
    this.scriptPath = ''
    this.filename = ''
    this.evalStr = ''
    this.isDebug = false
  }
}

/** メイン処理 */
function main (argvOrg: string[]): void {
  // コマンドラインオプションを確認
  const argv: string[] = [...argvOrg]
  const opt: CommandOptions = new CommandOptions()
  opt.nodePath = argv.shift() || ''
  opt.scriptPath = argv.shift() || ''
  while (argv.length > 0) {
    const arg = argv.shift() || ''
    if (arg === '-d' || arg === '--debug') { opt.isDebug = true }
    if (arg === '-e' || arg === '--eval') {
      opt.evalStr = argv.shift() || ''
      continue
    }
    if (opt.filename === '') { opt.filename = arg }
  }
  // なでしこのコンパイラを生成
  const nako = new com.NakoCompiler()
  // 実行前にイベントを挟みたいとき
  nako.addListener('beforeRun', (g: NakoGlobal) => {
    g.__varslist[0]['ナデシコ種類'] = 'snako'
  })
  // logger を設定 --- リスナーを登録することでデバッグレベルを指定
  const logger = nako.getLogger()
  if (opt.isDebug) {
    logger.addListener('trace', (data) => { // --debug オプションを指定したとき
      console.log(data.nodeConsole)
    })
  }
  logger.addListener('stdout', (data) => { // 「表示」命令を実行したとき
    console.log(data.noColor)
  })
  // -e オプションを実行したとき
  if (opt.evalStr) {
    nako.run(opt.evalStr)
    return
  }
  // パラメータが空だったとき
  if (opt.filename === '') {
    showHelp()
    return
  }
  // ソースコードをファイルから読み込む
  const code: string = fs.readFileSync(opt.filename, 'utf-8')
  // 実行
  nako.run(code, opt.filename)
}

/** 使い方を表示 */
function showHelp (): void {
  console.log('●なでしこ(簡易版) # v.' + com.version.version)
  console.log('[使い方] node snako.mjs [--debug|-d] (filename)')
  console.log('[使い方] node snako.mjs [--eval|-e] (source)')
}

/** メイン処理を実行 */
main(process.argv)
