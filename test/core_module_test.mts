/* eslint-disable no-undef */
import assert from 'assert'
import core from '../index.mjs'

// eslint-disable-next-line no-undef
describe('core_module_test', () => {
  const nako = new core.NakoCompiler()
  const cmp = (code: string, res: string) => {
    nako.logger.debug('code=' + code)
    assert.strictEqual(nako.run(code).log, res)
  }
  it('hello', () => {
    cmp('「こんにちは」と表示', 'こんにちは')
  })
  it('calc', () => {
    cmp('3+5*2と表示', '13')
  })
  it('funccall', () => {
    cmp('MID("123456789",3,2)を表示', '34')
  })
})
