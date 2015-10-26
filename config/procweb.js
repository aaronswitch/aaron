/*
 * Aaron is page generator, so it has little bi different semantics than procmail.
 */
var Spool = {
  Identity: {
    '1': {where: {}},
    '2': {where: {}},
    '*': {where: {}},
  },
  Statement: {
  }
}

var Recipe = {
  Identity: {
  },
  Statement: {
  }
}

module.exports = {
  spool: Spool,
  recipe: Recipe
}
