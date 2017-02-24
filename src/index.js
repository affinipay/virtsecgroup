#!/usr/bin/env node

import options from 'commander'
import fs from 'fs'
import path from 'path'

import { parseStream } from './parser'
import { Transform } from './transform'

let inputPath = '<stdin>'
let input = process.stdin
let output = process.stdout
options
  .option('--dump-ast', 'Dump parse AST')
  .option('--dump-charts-on-error', 'Dump parse charts if an error occurs')
  .option('-o, --output <output-file>', 'Specify the Terraform output filename')
  .option('-v, --verbose', 'Increase verbosity of output', (v, total) => total + 1, 0)
  .arguments('[input-file]')
  .action(file => {
    inputPath = path.resolve(file)
    input = fs.createReadStream(inputPath)
  })
  .parse(process.argv)
if (options.output) {
  output = fs.createWriteStream(options.output)
}

parseStream(input, ast => new Transform(options).transformFile(inputPath, ast, output), options).catch(e => {
  process.stderr.write(e + '\n')
})
