var Message = {
  "text/plain": function() {
    return function(text, render) {
      var content = [];

      this.Body.forEach(function(item) {
        var fragment = [];
        var msg = render(item.Content);

        if(msg) {
          content.push(msg);
        }

        if(item.Opinions) {
          item.Opinions.forEach(function(o) {
            fragment.push(render(o));
          })
        }

        content.push(fragment.join(', '));
      })

      return content.join('');
    }
  },
  "text/html": function() {
    return function(text, render) {
      console.log('TEXT/HTML:'+Object.keys(this));
      var tmpl = [
        '{{&Content}}<div class="row">{{#Opinions}}',
        '<div class="opinion_group">',
        '<div class="section">{{&Name}}</div><div>{{#Values}}<input type="radio" name="{{&Message-ID}}_{{&Name}}" value="{{id}}">{{Val}}<br>{{/Values}}</div>',
        '</div>{{/Opinions}}</div>',
      ].join('\n');

      var content = [render(tmpl)];
      return content.join('\n');
    }
  }
}

module.exports = {
  mbox: {
    message: Message,
  }
}
