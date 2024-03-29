'use strict'
const { TextEdit, languages, Range, Position } = require('vscode')
const CleanCSS = require('clean-css')

class CSSFormatter {
  /**
   *
   * @param {import('vscode').TextDocument} document
   * @param {*} options
   * @returns
   */
  registerDocumentProvider(document, options) {
    return new Promise((resolve, reject) => {
      let cleaner = new CleanCSS({
        inline: false,
        rebase: false,
        level: {
          1: {
            all: false,
          },
        },
        format: {
          breaks: {
            // controls where to insert breaks
            afterAtRule: true, // controls if a line break comes after an at-rule; e.g. `@charset`; defaults to `false`
            afterBlockBegins: true, // controls if a line break comes after a block begins; e.g. `@media`; defaults to `false`
            afterBlockEnds: true, // controls if a line break comes after a block ends, defaults to `false`
            afterComment: true, // controls if a line break comes after a comment; defaults to `false`
            afterProperty: true, // controls if a line break comes after a property; defaults to `false`
            afterRuleBegins: true, // controls if a line break comes after a rule begins; defaults to `false`
            afterRuleEnds: true, // controls if a line break comes after a rule ends; defaults to `false`
            beforeBlockEnds: true, // controls if a line break comes before a block ends; defaults to `false`
            betweenSelectors: true, // controls if a line break comes between selectors; defaults to `false`
          },
          breakWith: '\n', // controls the new line character, can be `'\r\n'` or `'\n'` (aliased as `'windows'` and `'unix'` or `'crlf'` and `'lf'`); defaults to system one, so former on Windows and latter on Unix
          indentBy: 0, // controls number of characters to indent with; defaults to `0`
          indentWith: 'space', // controls a character to indent with, can be `'space'` or `'tab'`; defaults to `'space'`
          spaces: {
            // controls where to insert spaces
            aroundSelectorRelation: true, // controls if spaces come around selector relations; e.g. `div > a`; defaults to `false`
            beforeBlockBegins: true, // controls if a space comes before a block begins; e.g. `.block {`; defaults to `false`
            beforeValue: true, // controls if a space comes before a value; e.g. `width: 1rem`; defaults to `false`
          },
          wrapAt: false, // controls maximum line length; defaults to `false`
          semicolonAfterLastProperty: true, // controls removing trailing semicolons in rule; defaults to `false` - means remove
        },
      })

      let css = document.getText()
      let css2 = css.replace(/\/\*(?!=!)/g, '/*!##tokens') //comment
      css2 = css2.replace(/(\r?\n){2,}/g, '$1/*!-#tokens-#*/$1')
      let output = cleaner.minify(css2)
      if (output) {
        css2 = output.styles
        if (css2 == css) {
          resolve()
        } else {
          let lastLine = document.lineAt(document.lineCount - 1)
          let range = new Range(new Position(0, 0), lastLine.range.end)

          css2 = css2.replace(/\/\*!##tokens/g, '/*')
          css2 = css2.replace(/\/\*!-#tokens-#\*\//g, '')
          css2 = css2.replace(/(\r?\n){2,}/g, '$1$1')
          css2 = css2.replace(/;\/\*/g, ';\n/*')

          let lines = css2.split(/\r?\n/g)
          let arr = []
          let braces = 0
          let inRule = false
          let inBlockComment = false
          for (let i = 0, len = lines.length; i < len; i++) {
            let line = lines[i]

            if (inRule && inBlockComment == false) {
              if (line.endsWith('{')) {
                if (arr[arr.length - 1] != ' ') {
                  arr.push('  ')
                }
              } else if (line.endsWith(',')) {
                arr.push('  ')
              } else if (braces == 1 && line.endsWith('*/')) {
                arr.push('  ')
              }
            }

            if (line.startsWith('/*') && line.endsWith('*/') == false) {
              inBlockComment = true
            }

            arr.push(line)

            if (inBlockComment) {
              if (line.endsWith('*/')) {
                inBlockComment = false
              } else {
                arr.push('\n')
                continue
              }
            }

            if (line == '') {
              if (braces == 0) {
                arr.push('\n')
              }
            } else if (line.endsWith('}')) {
              arr.push('\n')
            } else if (line.endsWith('*/')) {
              if (inRule && braces == 1) {
                arr.push('\n')
              } else if (braces == 0) {
                arr.push('\n')
              } else {
                arr.push(' ')
              }
            } else if (line.endsWith(',')) {
              arr.push(' ')
            } else if (line.startsWith('@') == false) {
              arr.push(' ')
            } else if (line.startsWith('@') && line.endsWith(';')) {
              arr.push('\n')
            }

            if (line.endsWith('{')) {
              braces++

              if (line.startsWith('@')) {
                inRule = true
                arr.push('\n')
              }
            } else if (line.endsWith('}')) {
              braces--

              if (inRule && braces == 0) {
                inRule = false
              }
            }
          }

          // css2 = css2.replace(/;([-\w])/g, '; $1')
          resolve([new TextEdit(range, arr.join(''))])
        }
      } else {
        reject(output.errors)
      }
    })
  }
}

exports.activate = (context) => {
  let pcf = new CSSFormatter()

  context.subscriptions.push(
    languages.registerDocumentFormattingEditProvider('css', {
      provideDocumentFormattingEdits: (document, options, token) => {
        if (document.uri.fsPath.toLowerCase().endsWith('.min.css')) {
          return
        } else {
          return pcf.registerDocumentProvider(document, options)
        }
      },
    })
  )
}

exports.deactivate = () => { }
