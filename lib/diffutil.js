/* See LICENSE file for terms of use */

function map(arr, mapper, that) {
  if (Array.prototype.map) {
    return Array.prototype.map.call(arr, mapper, that);
  }

  var other = new Array(arr.length);

  for (var i = 0, n = arr.length; i < n; i++) {
    other[i] = mapper.call(that, arr[i], i, arr);
  }
  return other;
}

var splitLines = function(value) {
  var retLines = [];
  var lines = value.split(/^/m);

  for(var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var lastLine = lines[i - 1];

    // Merge lines that may contain windows new lines
    if (line === '\n' && lastLine && lastLine[lastLine.length - 1] === '\r') {
      retLines[retLines.length - 1] += '\n';
    } else if (line) {
      retLines.push(line);
    }
  }

  return retLines;
}

function clonePath(path) {
  return { newPos: path.newPos, components: path.components.slice(0) };
}

function contextLines(lines) {
  return map(lines, function(entry) { return ' ' + entry; });
}

function extractCommon(basePath, newString, oldString, diagonalPath) {
  var newLen = newString.length;
  var oldLen = oldString.length;
  var newPos = basePath.newPos;
  var oldPos = newPos - diagonalPath;
  var commonCount = 0;

  // while (newPos+1 < newLen && oldPos+1 < oldLen && equals(newString[newPos+1], oldString[oldPos+1])) {
  while (newPos+1 < newLen && oldPos+1 < oldLen && newString[newPos+1] === oldString[oldPos+1]) {
    newPos++;
    oldPos++;
    commonCount++;
  }

  if (commonCount) {
    basePath.components.push({count: commonCount});
  }

  basePath.newPos = newPos;
  return oldPos;
}

function pushComponent(components, added, removed) {
  var last = components[components.length-1];
  if (last && last.added === added && last.removed === removed) {
    // We need to clone here as the component clone operation is just
    // as shallow array clone
    components[components.length-1] = {count: last.count + 1, added: added, removed: removed };
  } else {
    components.push({count: 1, added: added, removed: removed });
  }
}

function buildValues(components, newString, oldString, useLongestToken) {
  var componentPos = 0;
  var componentLen = components.length;
  var newPos = 0;
  var oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    var component = components[componentPos];
    if (!component.removed) {
      if (!component.added && useLongestToken) {
        var value = newString.slice(newPos, newPos + component.count);
        value = map(value, function(value, i) {
          var oldValue = oldString[oldPos + i];
          return oldValue.length > value.length ? oldValue : value;
        });

        component.value = value.join('');
      } else {
        component.value = newString.slice(newPos, newPos + component.count).join('');
      }
      newPos += component.count;

      // Common case
      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = oldString.slice(oldPos, oldPos + component.count).join('');
      oldPos += component.count;
    }
  }

  return components;
}

function createDiffComp(oldString, newString) {
  // Handle the identity case (this is due to unrolling editLength == 0
  if (newString === oldString) {
    return [{ value: newString }];
  }
  if (!newString) {
    return [{ value: oldString, removed: true }];
  }
  if (!oldString) {
    return [{ value: newString, added: true }];
  }

  newString = splitLines(newString);
  oldString = splitLines(oldString);

  var newLen = newString.length, oldLen = oldString.length;
  var maxEditLength = newLen + oldLen;
  var bestPath = [{ newPos: -1, components: [] }];

  // Seed editLength = 0, i.e. the content starts with the same values
  var oldPos = extractCommon(bestPath[0], newString, oldString, 0);
  if (bestPath[0].newPos+1 >= newLen && oldPos+1 >= oldLen) {
    // Identity per the equality and tokenizer
    return [{value: newString.join('')}];
  }

  // Main worker method. checks all permutations of a given edit length for acceptance.
  function execEditLength() {
    for (var diagonalPath = -1*editLength; diagonalPath <= editLength; diagonalPath+=2) {
      var basePath;
      var addPath = bestPath[diagonalPath-1],
      removePath = bestPath[diagonalPath+1];
      oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
      if (addPath) {
        // No one else is going to attempt to use this value, clear it
        bestPath[diagonalPath-1] = undefined;
      }

      var canAdd = addPath && addPath.newPos+1 < newLen;
      var canRemove = removePath && 0 <= oldPos && oldPos < oldLen;
      if (!canAdd && !canRemove) {
        // If this path is a terminal then prune
        bestPath[diagonalPath] = undefined;
        continue;
      }

      // Select the diagonal that we want to branch from. We select the prior
      // path whose position in the new string is the farthest from the origin
      // and does not pass the bounds of the diff graph
      if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
        basePath = clonePath(removePath);
        pushComponent(basePath.components, undefined, true);
      } else {
        basePath = addPath;   // No need to clone, we've pulled it from the list
        basePath.newPos++;
        pushComponent(basePath.components, true, undefined);
      }

      var oldPos = extractCommon(basePath, newString, oldString, diagonalPath);

      // If we have hit the end of both strings, then we are done
      if (basePath.newPos+1 >= newLen && oldPos+1 >= oldLen) {
        // return done(buildValues(basePath.components, newString, oldString, self.useLongestToken));
        return buildValues(basePath.components, newString, oldString);
      } else {
        // Otherwise track this path as a potential candidate and continue.
        bestPath[diagonalPath] = basePath;
      }
    }

    editLength++;
  }

  // Performs the length of edit iteration. Is a bit fugly as this has to support the 
  // sync and async mode which is never fun. Loops over execEditLength until a value
  // is produced.
  var editLength = 1;
  while(editLength <= maxEditLength) {
    var ret = execEditLength();
    if (ret) {
      return ret;
    }
  }
}

function diff(opts) {
  var ret = [];

  if(false !== opts.header) {
    if(opts.index) {
      ret.push('Index: ' + opts.index);
    }
    //ret.push('===================================================================');
    ret.push('--- ' + opts.a + (typeof opts.aTs === 'undefined' ? '' : '\t' + opts.aTs));
    ret.push('+++ ' + opts.b + (typeof opts.bTs === 'undefined' ? '' : '\t' + opts.bTs));
  }

  if(opts.body) {
    ret.push(opts.body);
    return ret.join('\n');
  }

  var diffComp = createDiffComp(opts.orig, opts.current);

  if (!diffComp[diffComp.length-1].value) {
    diffComp.pop();   // Remove trailing newline add
  }
  diffComp.push({value: '', lines: []});   // Append an empty value to make cleanup easier

  function eofNL(curRange, i, current) {
    var last = diffComp[diffComp.length-2],
        isLast = i === diffComp.length-2,
        isLastOfType = i === diffComp.length-3 && (current.added !== last.added || current.removed !== last.removed);

    // Figure out if this is the last line for the given file and missing NL
    if (!/\n$/.test(current.value) && (isLast || isLastOfType)) {
      curRange.push('\\ No newline at end of file');
    }
  }

  var oldRangeStart = 0, newRangeStart = 0, curRange = [],
      oldLine = 1, newLine = 1;

  for (var i = 0; i < diffComp.length; i++) {
    var current = diffComp[i];
    var lines = current.lines || current.value.replace(/\n$/, '').split('\n');
    current.lines = lines;

    if (current.added || current.removed) {
      if (!oldRangeStart) {
        var prev = diffComp[i-1];
        oldRangeStart = oldLine;
        newRangeStart = newLine;

        if (prev) {
          curRange = contextLines(prev.lines.slice(-4));
          oldRangeStart -= curRange.length;
          newRangeStart -= curRange.length;
        }
      }
      curRange.push.apply(curRange, map(lines, function(entry) { return (current.added?'+':'-') + entry; }));
      eofNL(curRange, i, current);

      if (current.added) {
        newLine += lines.length;
      } else {
        oldLine += lines.length;
      }
    } else {
      if (oldRangeStart) {
        // Close out any changes that have been output (or join overlapping)
        if (lines.length <= 8 && i < diffComp.length-2) {
          // Overlapping
          curRange.push.apply(curRange, contextLines(lines));
        } else {
          // end the range and output
          var contextSize = Math.min(lines.length, 4);
          ret.push(
              '@@ -' + oldRangeStart + ',' + (oldLine-oldRangeStart+contextSize)
              + ' +' + newRangeStart + ',' + (newLine-newRangeStart+contextSize)
              + ' @@');
          ret.push.apply(ret, curRange);
          ret.push.apply(ret, contextLines(lines.slice(0, contextSize)));
          if (lines.length <= 4) {
            eofNL(ret, i, current);
          }

          oldRangeStart = 0;  newRangeStart = 0; curRange = [];
        }
      }
      oldLine += lines.length;
      newLine += lines.length;
    }
  }
  return ret.join('\n') + '\n';
}

function patch(opts) {
  var diffstr = opts.diff.split('\n');
  var diffArr = [];
  var remEOFNL = false,
      addEOFNL = false;

  //for (var i = (diffstr[0][0]==='I'?3:0); i < diffstr.length; i++) {
  for (var i = 2; i < diffstr.length; i++) {
    if(diffstr[i][0] === '@') {
      var meh = diffstr[i].split(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
      diffArr.unshift({
        start:meh[3],
        oldlength:meh[2],
        oldlines:[],
        newlength:meh[4],
        newlines:[]
      });
    } else if(diffstr[i][0] === '+') {
      diffArr[0].newlines.push(diffstr[i].substr(1));
    } else if(diffstr[i][0] === '-') {
      diffArr[0].oldlines.push(diffstr[i].substr(1));
    } else if(diffstr[i][0] === ' ') {
      diffArr[0].newlines.push(diffstr[i].substr(1));
      diffArr[0].oldlines.push(diffstr[i].substr(1));
    } else if(diffstr[i][0] === '\\') {
      if (diffstr[i-1][0] === '+') {
        remEOFNL = true;
      } else if(diffstr[i-1][0] === '-') {
        addEOFNL = true;
      }
    }
  }

  var str = opts.orig.split('\n');
  for (var i = diffArr.length - 1; i >= 0; i--) {
    var d = diffArr[i];
    for (var j = 0; j < d.oldlength; j++) {
      if(str[d.start-1+j] !== d.oldlines[j]) {
        return false;
      }
    }
    Array.prototype.splice.apply(str,[d.start-1,+d.oldlength].concat(d.newlines));
  }

  if (remEOFNL) {
    while (!str[str.length-1]) {
      str.pop();
    }
  } else if (addEOFNL) {
    str.push('');
  }
  return str.join('\n');
}

module.exports = {
  diff: diff,
  patch: patch
}
