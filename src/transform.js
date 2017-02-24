import fs from 'fs'
import path from 'path'

import { IdRef, CidrBlock, Range, Rule, SecGroup, Defaults, Import } from './ast'
import { formatLocation } from './location'
import { parseStream } from './parser'
import { Ruleset } from './ruleset'
import { stringify } from './stringify'

function optQuote(s) {
  return /^[A-Za-z_]\w*$/.test(s) ? s : stringify(s)
}

function dumpTerraformEntries(output, obj, indent = '') {
  Object.keys(obj).forEach(key => {
    output.write(`${indent}${optQuote(key)} = ${stringify(obj[key])}\n`)
  })
}

function dirTypes(dir) {
  switch (dir) {
    case 'in': return ['ingress']
    case 'out': return ['egress']
    default: return ['ingress', 'egress']
  }
}

function processMetaRule(forGroup, fromGroup, rule, nvDescendents, ruleset) {
  for (const type of dirTypes(rule.dir)) {
    const egress = type == 'egress'
    for (const proto of rule.protos) {
      const ports = proto == 'all' ? [0] : rule.ports
      for (const portOrRange of ports) {
        let fromPort, toPort
        if (portOrRange instanceof Range) {
          fromPort = portOrRange.from
          toPort = portOrRange.to
        } else {
          fromPort = toPort = portOrRange
        }
        const { srcDsts } = rule
        if (srcDsts && srcDsts.length > 0) {
          if (srcDsts[0] instanceof CidrBlock) {
            ruleset.addRule(egress, proto, fromPort, toPort, srcDsts.map(i => i.cidr), 'cidr', fromGroup)
          } else {
            const srcSgids = new Set()
            for (const srcDst of srcDsts) {
              const { id } = srcDst
              if (!srcDst.target.virtual) {
                srcSgids.add(id)
              }
              const nvds = nvDescendents[id]
              if (nvds) {
                for (const nvd of nvds) {
                  srcSgids.add(nvd.id)
                }
              }
            }
            for (const srcSgid of srcSgids) {
              if (srcSgid == forGroup.id) {
                ruleset.addRule(egress, proto, fromPort, toPort, 'self', 'self', fromGroup)
              } else {
                ruleset.addRule(egress, proto, fromPort, toPort, srcSgid, 'sg', fromGroup)
              }
            }
          }
        }
      }
    }
  }
}

function processMetaRules(forGroup, fromGroup, nvDescendents, ruleset) {
  const { members } = fromGroup
  if (members) {
    members.forEach(member => {
      if (member instanceof Rule) {
        processMetaRule(forGroup, fromGroup, member, nvDescendents, ruleset)
      }
    })
  }
}

function dumpRule(output, props) {
  output.write(`resource "aws_security_group_rule" "${props.id}" {\n`)
  if (props.provider) {
    output.write(`  provider = ${stringify(props.provider)}\n`)
  }
  output.write(`  security_group_id = "\${aws_security_group.${props.sgid}.id}"
  type = "${props.type}"
  protocol = "${props.protocol}"
  from_port = ${props.from_port}
  to_port = ${props.to_port}\n`)
  if (props.cidr_blocks) {
    output.write(`  cidr_blocks = [${props.cidr_blocks.map(stringify).join(', ')}]\n`)
  }
  if (props.source_sgid) {
    output.write(`  source_security_group_id = "\${aws_security_group.${props.source_sgid}.id}"\n`)
  }
  if (props.self) {
    output.write('  self = true\n')
  }
  output.write('}\n')
}

function dumpRules(output, sg, ruleset) {
  output.write(`# ${sg.id} rules:\n`)
  let cidrNames = {
    '0.0.0.0/0': 'any'
  }
  let nextCidrIndex = 1
  for (const rule of ruleset) {
    const origins = Array.from(rule.origins).filter(x => x != sg).map(x => x.id).join(', ')
    if (origins) {
      output.write(`# inherited from ${origins}\n`)
    }
    const tfRule = {
      sgid: sg.id,
      type: rule.egress ? 'egress' : 'ingress',
      protocol: rule.protocol == 'all' ? '-1' : rule.protocol,
      from_port: rule.fromPort,
      to_port: rule.toPort
    }
    if (sg.args) {
      const provider = sg.args.provider
      if (provider) {
        tfRule.provider = provider
      }
    }
    let ruleId = `${sg.id}_${tfRule.type}_${rule.protocol}`
    if (rule.protocol != 'all') {
      if (rule.fromPort == rule.toPort || rule.toPort == -1) {
        ruleId += `_${rule.fromPort}`
      } else {
        ruleId += `_${rule.fromPort}_${rule.toPort}`
      }
    }
    switch (rule.srcDstType) {
      case 'cidr': {
        let cidrName = cidrNames[rule.srcDst]
        if (cidrName === undefined) {
          cidrNames[rule.srcDst] = cidrName = 'cidr' + nextCidrIndex++
        }
        ruleId += '_' + cidrName
        tfRule.cidr_blocks = rule.srcDst
        break
      }
      case 'self':
        ruleId += '_self'
        tfRule.self = true
        break
      case 'sg':
        ruleId += '_' + rule.srcDst
        tfRule.source_sgid = rule.srcDst
        break
      default:
        throw Error(`Unknown rule type: ${rule.srcDstType}`)
    }
    tfRule.id = ruleId
    dumpRule(output, tfRule)
  }
}

function getAllBases(sg, result = new Set()) {
  const { baseIds } = sg
  if (baseIds) {
    baseIds.forEach(ref => {
      const { target } = ref
      if (!result.has(target)) {
        result.add(target)
        getAllBases(target, result)
      }
    })
  }
  return result
}

function dumpGroups(output, secgroups, options) {
  // find transitive closures of base security groups, ensure that none are
  // self-referential, and track non-virtual descendents for each group
  const nvDescendents = {}
  secgroups.forEach(sg => {
    if (sg.baseIds) {
      const allBasesSet = getAllBases(sg)
      const allBases = Array.from(allBasesSet)
      if (allBasesSet.has(sg)) {
        throw Error(`Self-referential inheritance found for ${sg.declType} ${sg.id}: ` +
          allBases.map(base => base.id).join(', '))
      }
      sg.setAllBases(allBases)
      if (!sg.virtual) {
        allBases.forEach(base => {
          let list = nvDescendents[base.id]
          if (!list) {
            nvDescendents[base.id] = list = []
          }
          list.push(sg)
        })
      }
    }
  })
  // write out security group definitions
  let nvGroups = 0
  secgroups.forEach(sg => {
    if (!sg.virtual && sg.defined) {
      ++nvGroups
      output.write(`resource "aws_security_group" "${sg.id}" {\n`)
      output.write(`  name = "${sg.id}"\n`)
      const { args, members, allBases } = sg
      if (args) {
        dumpTerraformEntries(output, args, '  ')
      }
      let tags
      if (members) {
        const desc = members.find(m => m.declType == 'desc')
        if (desc) {
          output.write(`  description = ${stringify(desc.text)}\n`)
        }
        const tagsNode = members.find(m => m.declType == 'tags')
        tags = tagsNode ? tagsNode.tags : {}
        if (!('Name' in tags)) {
          tags = Object.assign({}, tags, { Name: sg.id })
        }
        if (allBases.length > 0 && !('Bases' in tags)) {
          tags = Object.assign({}, tags, { Bases: allBases.map(base => base.id).join() })
        }
      } else {
        tags = { Name: sg.id }
      }
      output.write('  tags {\n')
      dumpTerraformEntries(output, tags, '    ')
      output.write('  }\n')
      output.write('}\n')
    }
  })
  // write out security group rules
  let totalRules = 0
  let maxRules = 0
  let maxRulesPerCidr = 0
  secgroups.forEach(sg => {
    if (!sg.virtual && sg.defined) {
      const ruleset = new Ruleset()
      processMetaRules(sg, sg, nvDescendents, ruleset)
      const { allBases } = sg
      for (const base of allBases) {
        processMetaRules(sg, base, nvDescendents, ruleset)
      }
      dumpRules(output, sg, ruleset)
      totalRules += ruleset.size()
      maxRules = Math.max(maxRules, ruleset.size())
      let rulesPerCidr = 0
      for (const rule of ruleset) {
        if (rule.srcDstType == 'cidr') {
          rulesPerCidr += rule.srcDst.length
        } else {
          ++rulesPerCidr
        }
      }
      maxRulesPerCidr = Math.max(maxRulesPerCidr, rulesPerCidr)
    }
  })
  if (options.verbose) {
    process.stderr.write(`Wrote ${nvGroups} security groups with ${totalRules} total rules and ${maxRules} maximum rules\n`)
    if (maxRulesPerCidr > maxRules) {
      process.stderr.write(`  (${maxRulesPerCidr} maximum rules counting each CIDR block separately)\n`)
    }
  }
}

export class Transform {
  constructor(options) {
    this.options = options
    this.allImports = {}
    this.stats = {
      totalMetaRules: 0,
      maxMetaRules: 0
    }
  }

  transformFile(path, ast, output) {
    return new FileTransform(this, path).transform(ast, output)
  }
}

export class FileTransform {
  constructor(context, path) {
    this.context = context
    this.path = path
    this.imports = {}
    this.symbols = {}
    this.secgroups = []
    this.resolved = false
  }

  transform(ast, output) {
    return this.processSymbols(ast).then(() => {
      this.resolveRefs()
      const { options } = this.context
      if (options.verbose) {
        const { stats } = this.context
        process.stderr.write(`Read ${this.secgroups.length} security groups` +
          ` with ${stats.totalMetaRules} total rules and ${stats.maxMetaRules} maximum rules\n`)
      }
      dumpGroups(output, this.secgroups, options)
    })
  }

  processSymbols(ast, defaults = {}) {
    // build symbol table containing all declarations; each can be defined at
    // most once, so only the definition or initial declaration are retained
    const { options } = this.context
    const importPromises = []
    for (const decl of ast) {
      if (decl instanceof Defaults) {
        defaults = Object.assign({}, defaults, decl.defaults)
        continue
      }
      if (decl instanceof Import) {
        importPromises.push(this.processImport(decl, defaults))
        continue
      }
      const { declType, id, location } = decl
      if (!id) {
        throw Error(`${declType} at ${formatLocation(location)} has no ID`)
      }
      const existing = this.symbols[id]
      if (existing != null) {
        if (declType != existing.declType) {
          throw Error(`${declType} ${id} at ${formatLocation(location)}: ` +
            `${id} already defined as ${existing.declType} at ${formatLocation(existing.location)}`)
        }
        if (decl.defined) {
          if (existing.defined) {
            throw Error(`${declType} ${id} at ${formatLocation(location)}: ` +
              `${id} already defined at ${formatLocation(existing.location)}`)
          }
          decl.setArgs(defaults)
          this.symbols[id] = decl
        } else if (options.verbose) {
          console.warn(`Ignoring redeclaration of ${declType} ${id} at ${formatLocation(location)}`)
        }
      } else {
        decl.setArgs(defaults)
        this.symbols[id] = decl
      }
    }
    return Promise.all(importPromises)
  }

  processImport(decl, defaults) {
    const absPath = path.resolve(path.dirname(this.path), decl.path)
    let importFileTransform = this.context.allImports[absPath]
    if (importFileTransform == null) {
      importFileTransform = new FileTransform(this.context, absPath)
      this.context.allImports[absPath] = importFileTransform
      this.imports[absPath] = importFileTransform

      const input = fs.createReadStream(absPath)
      return parseStream(input, ast => {
        return importFileTransform.processSymbols(ast, defaults).then(() => {
          importFileTransform.resolveRefs()
          return importFileTransform
        })
      }, this.context.options)
    }

    if (absPath in this.imports) {
      throw Error(`Duplicate import of ${absPath} at ${formatLocation(decl.location)}`)
    }
    if (!importFileTransform.resolved) {
      throw Error(`Circular import of ${absPath} at ${formatLocation(decl.location)}`)
    }
    this.imports[absPath] = importFileTransform
    return Promise.resolve(importFileTransform)
  }

  resolveRefs() {
    // resolve all refererences in the AST
    const { stats } = this.context
    for (const id of Object.keys(this.symbols)) {
      const decl = this.symbols[id]
      if (decl instanceof SecGroup) {
        const { baseIds, members } = decl
        if (baseIds) {
          baseIds.forEach(ref => {
            const base = this.resolveRef(ref)
            if (!(base instanceof SecGroup)) {
              throw Error(`Base ${ref.id} at ${formatLocation(ref.location)} ` +
                `of ${decl.declType} ${id} is not a security group`)
            } else if (!base.defined && !base.virtual) {
              throw Error(`Non-virtual base ${ref.id} at ${formatLocation(ref.location)} ` +
                `of ${decl.declType} ${id} is declared but not defined`)
            }
          })
        }
        if (members) {
          let ruleCount = 0
          members.forEach(member => {
            if (member instanceof Rule) {
              const { srcDsts } = member
              srcDsts.forEach(srcDst => {
                if (srcDst instanceof IdRef) {
                  this.resolveRef(srcDst)
                }
              })
              ++ruleCount
            }
          })
          stats.totalMetaRules += ruleCount
          stats.maxMetaRules = Math.max(stats.maxMetaRules, ruleCount)
        }
        this.secgroups.push(decl)
      } else {
        throw Error('Unrecognized declaration: ' + decl)
      }
    }
    this.resolved = true
  }

  resolveRef(ref) {
    if (!ref.target) {
      let target = this.symbols[ref.id]
      if (!target) {
        // if not declared in this file, search each of the direct imports;
        // it is an error if more than one declares the symbol
        let importedFrom
        for (const importFile of Object.keys(this.imports)) {
          const importTransform = this.imports[importFile]
          const imported = importTransform.symbols[ref.id]
          if (imported) {
            if (!target) {
              target = imported
              importedFrom = importFile
            } else {
              throw Error(`Ambiguous imported refererence to ${ref.id} at ${formatLocation(ref.location)}` +
                `; imported from both ${importedFrom} and ${importFile}`)
            }
          }
        }
      }
      if (!target) {
        throw Error(`Unresolved refererence to ${ref.id} at ${formatLocation(ref.location)}`)
      }
      ref.resolve(target)
    }
    return ref.target
  }
}
