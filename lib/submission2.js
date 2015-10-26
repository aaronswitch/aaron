var extend = require('util')._extend;

var identityApi = {
  headers: function(data, headers) {
    headers = headers || {};

    return extend(headers, {
      From: data.id,
      To: data.id, // ???
      Date: data.updated_at,
      Type: 'identity',
    })
  },
  schema: {
    id: true,
    created_at: true,
    updated_at: true,
    name: true,
    display_name: true,
    password: false,
    avatar: null,
    agenda: null,
    citizenship: null,
    bdfl: false,
    locked: false,
    deleted: false,
    verified: false,
    upvotes: null,
    downvotes: null
  }
}

var statementApi = {
  headers: function(data, headers) {
    headers = headers || {};

    return extend({
      From: data.author_id,
      To: data.identity_id,
      Cc: data.author_id,
      Date: data.updated_at,
      Type: 'statement',
    })
  },
  schema: {
    id: true,
    created_at: true,
    updated_at: true,
    identity_id: true,
    author_id: true,
    area_id: true,
    content: true,
    note: null,
    upd_counter: null,
    sticky: false,
    closed: true,
    archived: null,
    downvotes: null,
    upvotes: null,
    ccounter: null,
    ovotable: null,
    moderate: true
  }
}

var commentApi = {
  headers: function(data, headers) {
    headers = headers || {};

    return extend(headers, {
      From: data.identity_id,
      // To: statement.identity_id ???
      Date: data.updated_at,
      Type: 'comment',
    })
  },
  schema: {
    id: true,
    created_at: true,
    updated_at: true,
    identity_id: true,
    statement_id: true,
    parent_id: true,
    opinion_id: true,
    area_id: true,
    content: true,
    expertise: true,
    note: null,
    report: true,
    upd_counter: true,
    downvotes: null,
    upvotes: null,
    ncounter: false,
    ovotable: null,
    approved: true
  }
}

function verifyApi(apiDef) {
  function verifyObject(data) {
    var filtered = {};

    for(var k in apiDef.schema) {
      if(apiDef.schema[k] === true) {
        if('undefined' === typeof data[k]) {
          return undefined;
        }
        filtered[k] = data[k];
      } else if(apiDef.schema[k] === null && 'undefined' !== typeof data[k]) {
        filtered[k] = data[k];
      }
    }

    return filtered;
  }

  function verifyArray(data) {
    var filtered = [];

    data.forEach(function(oItem) {
      var item = verifyObject(oItem);

       if(!item) {
         filtered = undefined;
         return false;
       }

       filtered.push(item);
    })

    return filtered;
  }

  return function(data) {
    if('object' === typeof data) {
      var msg = apiDef.headers(data);

      if(!Array.isArray(data)) {
        msg.body = verifyObject(data);
      } else {
        msg.body = verifyArray(data);
      }

      return msg;
    }
  }
}

module.exports = {
  name: 'aaron.v1',
  version: '1.0.0',
  cleanup: {
    identity: verifyApi(identityApi),
    statement: verifyApi(statementApi),
    comment: verifyApi(commentApi),
  }
}

var m = module.exports.cleanup.statement({id: 1, created_at: 1, updated_at: 2, identity_id: 1, author_id:2, content: "Lala", area_id: 3, closed: false, moderate: 500});
console.log(JSON.stringify(m));

