import { countIndent, checkSpecialRetMark, replaceRetMark, removeCommentsFromLine } from './nako_indent.mjs'

// インラインインデント構文を処理するために文字列内の改行を置換
// 複数行にまたがる文字列やコメント内にある改行を全部特殊文字に置き換える
class StrCommentTrimmer {
  specialMark: string
  constructor () {
    this.specialMark = '__ありえない改行マーク__' // beginEditでユニークな値に変更される
  }

  beginEdit (code: string): string {
    // 文字列とコメント内の改行を置換
    this.specialMark = checkSpecialRetMark(code)
    return replaceRetMark(code)
  }

  endEdit (code: string): string {
    return code.split(this.specialMark).join('\n')
  }
}

export function convert (code: string): string {
  // 挿入する「ここまで」
  const KOKOMADE = ';ここまで'
  // 一時的に文字列とコメントを特殊マークに置換する
  const trimmer = new StrCommentTrimmer()
  code = trimmer.beginEdit(code)
  const blockIndents: number[] = []
  code = code.split('\r\n').join('\n')
  // ソース末尾に空白があるかチェック(意外と重要)
  let lastSpace = ''
  const lastm = code.match(/(\s+)$/)
  if (lastm) { lastSpace = lastm[1] }
  code = code.replace(/\s+$/, '') // 末尾の空白を除去
  const lines: string[] = code.split('\n')
  let checkICount = -1
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    // ブロックの終了をチェック
    // インデントチェック中か?
    if (checkICount >= 0) {
      // 0:3回
      // 2:・・「あ」を表示
      // 0:
      const lineICount = countIndent(line)
      while (checkICount >= lineICount) {
        const prevLine = removeCommentsFromLine(lines[i - 1])
        // eslint-disable-next-line no-irregular-whitespace
        const lineTrimed = line.replace(/^[ 　・\t]+/, '')
        if (lineTrimed.charAt(0) === '違' || lineTrimed.substring(0, 6) === 'エラーならば') {
          // この場合、ここまでは不要
        } else {
          lines[i - 1] = prevLine + KOKOMADE
        }
        // 現在のブロックの処理が完了
        blockIndents.pop()
        checkICount = (blockIndents.length > 0) ? blockIndents[blockIndents.length - 1] : -1
        if (checkICount === -1) {
          break
        }
      }
    }
    // ブロックの開始をチェック
    if (line.indexOf(':') >= 0 || line.indexOf('：') >= 0) {
      const lineICount = countIndent(line)
      line = removeCommentsFromLine(line).replace(/\s+$/, '')
      const c = line.substring(line.length - 1)
      if (c === '：' || c === ':') {
        blockIndents.push(lineICount)
        lines[i] = line.substring(0, line.length - 1)
        checkICount = lineICount
      }
    }
  }
  // ブロックの残りをまとめて処理
  for (let i = 0; i < blockIndents.length; i++) {
    const last = lines.length - 1
    lines[last] = removeCommentsFromLine(lines[last]) + KOKOMADE
  }
  // 特殊マークを実際の文字列とコメントに置換する
  code = trimmer.endEdit(lines.join('\n'))
  return code + lastSpace
}

export default {
  convert
}
