import version from './src/nako_version.mjs'
import { NakoCompiler } from './src/nako3.mjs'
import { NakoLogger } from './src/nako_logger.mjs'
import { NakoError, NakoRuntimeError, NakoImportError } from './src/nako_errors.mjs'
import { NakoParser } from './src/nako_parser3.mjs'
import { NakoPrepare } from './src/nako_prepare.mjs'
export default {
    // version
    version,
    // compiler
    NakoCompiler,
    // loggger
    NakoLogger,
    // error
    NakoError,
    NakoRuntimeError,
    NakoImportError,
    // tools etc..
    NakoParser,
    NakoPrepare,
}
