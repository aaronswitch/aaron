if (typeof Object.create !== 'function') {
  Object.create = function (o) {
    function F() {}
    F.prototype = o;
    return new F();
  }
}

var JSONRequest = function(req, done) {
  var xhr = typeof XMLHttpRequest != 'undefined'
    ? new XMLHttpRequest()
    : new ActiveXObject('Microsoft.XMLHTTP');

  var method = req.method || 'get',
    params = req.params || {},
    opts = req.opts || {},
    headers = req.headers || {};

  if(!('async' in opts)) {
    opts.async = true;
  }

  var location = req.url;

  if(params && Object.keys(params).length) {
    var paramArr = [];

    for(var p in req.params) {
      paramArr.push(p + '=' + req.params[p]);
    }
    location += '?' + paramArr.join('&');
  }

  xhr.open(method, location, opts.async);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8")
  
  if('function' === typeof req.headers) {
    headers = req.headers();
  }

  //alert('HEADERS:'+JSON.stringify(headers)+','+JSON.stringify(req));
  for(var h in headers) {
    xhr.setRequestHeader(h, headers[h]);
  }

  if(opts.xhr) {
    for(var i in opts.xhr) {
      xhr[i] = opts.xhr[i];
    }
  }

  xhr.onreadystatechange = function() {
    // http://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate
    if (xhr.readyState == 4) { // `DONE`
      var status;
      var response;

      if (xhr.status == 200) {
        status = 0;

        try {
          response = JSON.parse(xhr.responseText);
        } catch(e) {
          response = {error: 444, message: 'Parse error'};
        }
      } else if(xhr.status) {
        status = xhr.status;

        try {
          response = JSON.parse(xhr.responseText);
        } catch(e) {
          response = {error: 444, message: 'Parse error'};
        }
      } else {
        status = 444;
        response = {error: 444, message: 'Status 0'};
      }
      done(status, response);
    }
  }
  xhr.send(JSON.stringify(req.data));
}

function Jails(opts) {
  this.opts = opts.opts;

  this.url = function(path, https) {
    path = path || '';

    if(https) {
      return opts.https + path; // Bug!
    }

    return (opts.prefix + path).replace(/\/+/g, '/');
  }

  this.method = function(request, callback) {
    var self = this;

    if('get' == request.method) {
      request.params = request.data || {};
      delete request.data;
    }

    JSONRequest(request, function(status, response) {
      callback.call(self, status, response);
    })
  }

  opts.locales = opts.locales || {};
  opts.locales.extension = opts.locales.extension || '.json';

  this.i18n = new I18n(opts.locales);
  this.t = this.i18n.__.bind(this.i18n);

  if(opts.views) {
    window.Views = {};
    var partials = {};

    this.method.call(this, {
      method: 'get',
      url: opts.views,
      opts: {async: false}
    }, function(status, data) {
      if(status) {
        alert('Error loading views: ' + opts.views);
        return;
      }

      function mustacheSetup(template) {
        Mustache.parse(partials[template]);

        return function(dict) {
          return Mustache.render(partials[template], dict, partials);
        }
      }

      for(var view in data) {
        window.Views[view] = mustacheSetup(view);
        partials[view] = data[view][view];

        for(var tmpl in data[view]) {
          if(tmpl != view) {
            window.Views[view][tmpl] = mustacheSetup(view + '.' + tmpl);
            partials[view + '.' + tmpl] = data[view][tmpl];
          }
        }
      }
    })

    if(opts.routes) {
      window.Routes = {};

      function compilePath(path, data) {
        var parts = path.split('/');
        var content = {}, p = [];

        for(var i in data) {
          content[i] = data[i];
        }

        parts.forEach(function(item) {
          if(item[0] === ':') {
            var key = item.slice(1);

            if(key in data) {
              p.push(data[key]);
              delete content[key];
            } else {
              p.push(item);
            }
          } else {
            p.push(item);
          }
        })

        return {
          url: p.join('/'),
          data: content
        }
      }

      function routeSetup(app, route, params) {
        var method = route[0].toLowerCase();
        var path = route[1];
        var xopts = params.https ? {xhr: {withCredentials: true}} : {async: params.async};

        var controller = params.controller;
        var action = params.action;

        return function(data, callback) {
          if('function' === typeof data) {
            callback = data;
            data = {};
          }

          var req = compilePath(path.slice(1), data);
          var url = app.url(req.url, params.https);

          app.method ({
            method: method,
            url: url,
            data: req.data,
            opts: xopts,
            headers: params.headers
          }, callback);

          return false;
        }
      }

      for(var route in opts.routes) {
        var params = opts.routes[route];

        window.Routes[params.controller] = window.Routes[params.controller] || {};
        window.Routes[params.controller][params.action] = routeSetup(this, route.split(' '), params);
      }
    }
  }

  if('function' === typeof opts.refresh) {
    opts.expires = opts.expires || 900;
    var timeout = (opts.expires - 5) * 1000;
    opts.refresh();

    setTimeout(function doSomething() {
      opts.refresh();
      setTimeout(doSomething, timeout);
    }, timeout);
  }
}
