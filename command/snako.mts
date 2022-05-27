import com from '../index.mjs'
import fs from 'fs'
import { NakoCompiler } from '../src/nako3.mjs';

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

function showHelp (): void {
  console.log('●なでしこ(簡易版) # v.' + com.version.version)
  console.log('[使い方] node snako.mjs [--debug|-d] (filename)')
  console.log('[使い方] node snako.mjs [--eval|-e] (source)')
}

function main (argvOrg: string[]): void {
  // check arguments
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
  if (opt.evalStr) {
    evalStr(opt.evalStr)
    return
  }
  if (opt.filename === '') {
    showHelp()
    return
  }
  // compiler
  const nako = new com.NakoCompiler()
  // set logger
  const logger = nako.getLogger()
  // set debug
  logger.addListener('trace', (data) => {
    if (opt.isDebug) {
      console.log(data.nodeConsole)
    }
  })
  // set stdout
  logger.addListener('stdout', (data) => {
    console.log(data.noColor)
  })
  // load soruce file
  const code: string = fs.readFileSync(opt.filename, 'utf-8')
  // run
  nako.run(code, opt.filename)
}

function evalStr (src: string): void {
  const nako = new NakoCompiler()
  const g = nako.run(src, 'main.nako3')
  console.log(g.log)
}

main(process.argv)
