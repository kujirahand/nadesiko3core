import com from '../index.mjs'
import fs from 'fs'

class CommandOptions {
  isDebug: boolean;
  filename: string;
  nodePath: string;
  scriptPath: string;
  constructor () {
    this.nodePath = ''
    this.scriptPath = ''
    this.filename = ''
    this.isDebug = false
  }
}

function showHelp (): void {
  console.log('●なでしこ # v.' + com.version.version)
  console.log('[使い方] node cnakoc.mjs [--debug|-d] (filename)')
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
    if (opt.filename === '') { opt.filename = arg }
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
  // load
  const code: string = fs.readFileSync(opt.filename, 'utf-8')
  // run
  nako.run(code, opt.filename)
}

main(process.argv)
