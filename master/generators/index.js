module.exports = function(conf) {
  console.log('GENERATOR opts:'+JSON.stringify(conf));
  var generators = {};

  for(var g in conf) {
    console.log('GENERATOR:'+g);
    var generator = require('./' + g);
    // generators[g] = generator(conf[g]);
    generators[g] = generator;
  }

  return generators;
}
