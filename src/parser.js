import nearley from 'nearley'
import { Writable } from 'stream'

import grammar from './grammar'
import { takeLocations, formatLocation, translateLocation } from './location'

class ParserStream extends Writable {
  constructor(parser, options) {
    super(options)
    this._parser = parser
  }
  _write(chunk, encoding, callback) {
    try {
      this._parser.feed(chunk.toString())
      callback()
    } catch (e) {
      callback(e)
    }
  }
}

function dumpCharts(parser) {
  process.stderr.write(`Table length: ${parser.table.length}\n`)
  parser.table.forEach((chart, chartNumber) => {
    process.stderr.write(`\nChart: ${chartNumber}\n`)
    chart.forEach((state, stateNumber) => {
      process.stderr.write(`${stateNumber}: ${state}\n`)
    })
  })
}

export function parseStream(input, callback, options = {}) {
  return new Promise((resolve, reject) => {
    const parser = new nearley.Parser(grammar.ParserRules, grammar.ParserStart)
    input
      .pipe(new ParserStream(parser))
      .on('error', e => {
        const locs = takeLocations()
        if (options.dumpChartsOnError || options.verbose > 1) {
          dumpCharts(parser)
        }
        reject(('offset' in e) ? Error(`Parse error at ${formatLocation(translateLocation(e.offset, locs))}`) : e)
      })
      .on('finish', () => {
        takeLocations()
        const { results } = parser
        if (options.dumpAst || results.length > 1) {
          process.stderr.write(require('util').inspect(results, { colors: true, depth: null }))
          process.stderr.write('\n')
        }
        if (results.length == 1) {
          resolve(callback(results[0]))
        } else {
          reject(Error(`Ambiguous parse: got ${results.length} results`))
        }
      })
  })
}
