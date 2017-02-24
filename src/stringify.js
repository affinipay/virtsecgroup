
function stringifyInterpolation(s, start) {
  let result = ''
  for (let i = start; i < s.length; ++i) {
    const c = s.charAt(i)
    switch (c) {
      case '}':
        return {
          out: result,
          pos: i
        }
      case '"': {
        const { out, pos } = stringifyString(s, i + 1, '"')
        result += '"' + out
        i = pos
        if (i < s.length) {
          result += s.charAt(i)
        }
        break
      }
      default:
        result += c
    }
  }
  return {
    out: result,
    pos: s.length
  }
}


function stringifyString(s, start) {
  let result = ''
  for (let i = start; i < s.length; ++i) {
    const c = s.charAt(i)
    switch (c) {
      case '"':
        return {
          out: result,
          pos: i
        }
      case '\\':
        if (i + 1 < s.length) {
          result += '\\' + s.charAt(++i)
        } else {
          result += c
        }
        break
      case '$':
        if (s.charAt(i + 1) == '{') {
          const { out, pos } = stringifyInterpolation(s, i)
          result += out
          i = pos
          if (i < s.length) {
            result += s.charAt(i)
          }
          break
        }
        // fall through
      default:
        result += c
    }
  }
  return result
}

export function stringify(s) {
  let result = '"'
  for (let i = 0; i < s.length; ++i) {
    const c = s.charAt(i)
    switch (c) {
      case '\\':
      case '"':
        result += '\\' + c
        break
      case '$':
        if (s.charAt(i + 1) == '{') {
          const { out, pos } = stringifyInterpolation(s, i)
          result += out
          i = pos
          if (i < s.length) {
            result += s.charAt(i)
          }
          break
        }
        // fall through
      default:
        result += c
    }
  }
  result += '"'
  return result
}
