function sessCheck() {
  return $.cookie('aid');
}

function trimVal(el) {
  var val = $(el).val();

  if(val) {
    val = $.trim(val);
  }

  return val;
}

function toggleElement(e, type) {
  type = type || 'fast';

  $(e).slideToggle(type);
  return false;
}

function getQueryParams() {
  var params = {},
      href = window.location.href.split('#') [0],
      hashes = href.slice(href.indexOf('?') + 1).split('&'),
      hash;

  for(var i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    params[hash[0]] = params[hash[0]] || [];
    params[hash[0]].push(hash[1]);
  }

  if(Object.keys(params).length) {
    Aaron.patch = false;
  }

  return params;
}

function previewMarkdown(e) {
  var input = $(e).find('.statement_input');
  var preview = $(e).find('.preview');
  var content = trimVal(input);

  if($(preview).is(':hidden')) {
    var markdown = SnuOwnd.getParser().render(content);
    $(preview).html(markdown);
  }

  $(preview).toggle();
  return false;
}

function previewOpinions(e) {
  var input = $(e).find('.statement_input');
  var preview = $(e).find('.preview');
  var content = trimVal(input);

  if($(preview).is(':hidden')) {
    var groups = $(el).val().split('\n\n');
    var ops = {};

    groups.forEach(function(g, i) {
      var opinions = g.split('\n');
      ops[i] = ops[i] || [];

      opinions.forEach(function(o, ii) {
        ops[i].push({group: i, value: ii, text: o}); 
      })
    })

    var str = Views.previews.test({opinions: ops});
    $(preview).html(str);
  }
  $(preview).toggle();
  return false;
}

function previewMessage(e) {
  previewMarkdown($(e).parent());
  //previewOpinions(oEl, oDst);
  return false;
}

function Wait(sec, callback) {
  if(sec < 0) {
    $('#wait').hide();
    return;
  }

  $('#wait').show();

  if(sec > 0) {
    setTimeout(function() {
      $('#wait').hide();

      if(callback) {
        callback();
      }
    }, sec*1000)
  }
}

function loginRequired() {
  //$('.logged-in').addClass('hidden');
  //$('.not-logged-in').removeClass('hidden');
  $('.logged-in').hide();
  $('.not-logged-in').show();
  delete window.User;
}

function loginNotRequired() {
  //$('.logged-in').removeClass('hidden');
  //$('.not-logged-in').addClass('hidden');
  $('.logged-in').show();
  $('.not-logged-in').hide();
}

function selfRequired(params) {
  params = params || {};
  params.selector = params.selector || '.self';

  if(params.hide) {
    $(params.selector).addClass('hidden');
    return;
  }

  var self = window.user;

  if(window.User) {
    $(params.selector).each(function() {
      var attr = 'data-identity';

      if($(this).hasClass('author')) {
        attr = 'data-author';
      }

      if(window.User == $(this).attr(attr)) {
        $(this).removeClass('hidden');
      } else {
        $(this).addClass('hidden');
      }
    })
  }
}

// Return votes - window.Votes or get JSON
function getVoteCache(callback) {
  if(window.Votes) {
    if(callback) {
      callback(0, window.Votes);
    }
    return;
  }

  Routes.users.votes(function(status, voteCache) {
    if(!status) {
      window.Votes = voteCache;
    }

    if(callback) {
      callback(status, voteCache);
    }
  })
}

function removeVotes() {
  $('.vote').each(function() {
    $(this).removeClass('vote');
    $(this).prop('checked', false);
  })
  $('.ovote').each(function() {
    $(this).prop('checked', false);
  })
  delete window.Votes;
}

function setVote(key, vote) {
  // alert('set vote:'+key+','+vote);
  $(".vote_pair[data-key='" + key + "']").find(".votable[data-val='" + vote + "']").addClass('vote');
}

function setVotes(status, votes) {
  if(!status) {
    votes = votes || window.Votes;

    if(votes && Object.keys(votes).length) {
      for(var v in votes) {
        var vote = votes[v].split(':');
        setVote(v, vote[0]);
      }
    }
  }
}

function Initialize() {
  Aaron.params = getQueryParams();
}

function InitializeNew() {
  var notice = Views.notice({});
  $('#notice').html(notice);

  if(sessCheck()) {
    getVoteCache(setVotes);
  } else {
    loginRequired();
  }
}

function loginSubmit(form) {
  var email = trimVal('#email'),
      pwd = trimVal('#pwd');

  Routes.users.login({
    email: email,
    password: pwd
  }, function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }

    window.Session = sessCheck();
    window.User = response.user;

    var rnd = '?' + Math.random();
    $('#self_img').attr('src', response.user.avatar + rnd);
    $('#self_link').attr('href', '/' + response.user.category + '/' + response.user.name);
    /*var i = $('#self').attr('data-identity');

    if(i != response.identity.id) {
      delete window.Votes;
    }*/

    loginNotRequired();
    getVoteCache(setVotes);
    selfRequired();
    checkUpdates();
    return false;
  })

  return false;
}

function logoutSetup() {
  if(Aaron && Aaron.intervalId) {
    clearInterval(Aaron.intervalId);
    delete Aaron.intervalId;
  }

  loginRequired();
  removeVotes();
  selfRequired({hide: true});
  delete window.User;
  delete window.Roles;
  // delete window.Session;
}

function logoutSubmit() {
  Routes.users.logout(function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }

    logoutSetup();
  })

  return false;
}

function resetPassword(elem) {
  var email = trimVal('#email'),
      token = trimVal('#token');

  if(!email || !token) {
    var notice = Views.notice({message: 'Error, please provide e-mail address'});
    $('#notice').html(notice);
    return false;
  }

  Routes.users.reset({email: email, token: token}, function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }
  })
  return false;
}

function passwordReset(elem) {
  var email = trimVal('#email'),
      token = $(elem).data('token'),
      pwd1 = $('#pwd1').val(),
      pwd2 = $('#pwd2').val();

  if(!email || pwd1 != pwd2) {
    var notice = Views.notice({message: 'Error'});
    $('#notice').html(notice);
    return false;
  }

  Routes.users.password({email: email, password: pwd1, token: token}, function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }
  })
  return false;
}

function registerSubmit(form) {
  var email = trimVal('#register_email'),
      user = trimVal('#register_user'),
      passwd1 = trimVal('#register_pwd1'),
      passwd2 = trimVal('#register_pwd2'),
      display_name = trimVal('#register_display_name');

  if(!user || !email || !passwd1 || !passwd2 || !display_name) {
    var notice = Views.notice({message: 'Wrong registration data'});
    $('#notice').html(notice);
    return false;
  }

  if(passwd1 != passwd2) {
    var notice = Views.notice({message: 'Password mismatch'});
    $('#notice').html(notice);
    return false;
  }

  Routes.users.create({
    email: email,
    name: user,
    password: passwd1,
    display_name: display_name
  }, function(status, response) {
    if(status || response.error) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }

    if(window.User.key != response.user.key) {
      delete window.Votes;
    }

    Wait(2, function() {
      loginNotRequired();
      selfRequired();
    })
  })

  return false;
}

function Vote(e, value) {
  var mode = $(e).data('mode'),
      parent = $(e).parent(),
      key = $(parent).data('key');

  var hasSession = sessCheck();
  var loginRequired = $(e).hasClass('login-required');

  if(!key) {
    return false;
  }

  if(loginRequired && !hasSession) {
    var notice = Views.notice({message: 'Please login to vote'});
    $('#notice').html(notice);
    return false;
  }

  if($(e).hasClass('vote')) {
    mode = 'revoke';
    value = undefined;
  }

  Routes.messages.vote({
    id: key,
    value: value
  }, function(status, response) {
    if(status || response.error || !response.record) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }

    $(parent).find('.votable').removeClass('vote');
    window.Votes = window.Votes || [];
    //window.Votes.push(response.record);
    var vote = response.record.split(':')
    $(parent).find(".votable[data-val='" + vote[3] + "']").addClass('vote');
    setVotes(0, [response.record]);
  })

  return false;
}

function Compose(e) {
  //$("form[data-id='" + id + "']").toggle();
  $(e).siblings('.reply_message').toggle();
  return false;
}

function sendMessage(e) {
  /*if(!sessCheck()) {
    var notice = Views.notice({message: 'Please login to submit'});
    $('#notice').html(notice);
    return false;
  }*/

  var params = {
    Content: trimVal($(e).find('.statement_input')),
    To: trimVal($(e).find('.to_addr')),
    Key: $(e).data('id'),
    whitelist: trimVal($(e).find('.whitelist')),
    blacklist: trimVal($(e).find('.blacklist')),
  }

  if(!params.Content) {
    return false;
  }

  Routes.messages.new(params, function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }

    if(!Object.keys(response).length) {
      return false;
    }

    response.Content = SnuOwnd.getParser().render(response.Content);
    var str = Views.mbox.message(response);

    if(response.References && response.References.length) {
      var parent = response.References[response.References.length - 1];
      $("form[data-id='" + parent + "']").siblings('.children').prepend(str);
      $(e).toggle();
    } else {
      $('#mbox_header').after(str);
    }

    //$(input).val('');
    $(e).find('.statement_input').val('');
    return false;
  })

  return false;
}

function forwardMessage(e) {
  /*if(!sessCheck()) {
    var notice = Views.notice({message: 'Please login to submit'});
    $('#notice').html(notice);
    return false;
  }*/

  var input = $(e).find('.statement_input');
  var to = trimVal($(e).find('.to_addr'));

  if(to) {
    var key = $(e).data('id');

    //alert(JSON.stringify({Key: key, To: to}));

    Routes.messages.forward({Key: key, To: to}, function(status, response) {
      if(status) {
        var notice = Views.notice(response);
        $('#notice').html(notice);
        return false;
      }

      /*response.Content = SnuOwnd.getParser().render(response.Content);
      var str = Views.mbox.message(response);
      $(e).siblings('.children').prepend(str);*/
      $(input).val('');
      return false;
    })
  }

  return false;
}

function goTo(ref, comment) {
  var link = '/s/' + ref + '.html';

  if(comment && ref != comment) {
    link += '#' + comment;
  }

  window.location = link;
  return false;
}

function closePrivateMessages() {
  $('#priv_messages_anchor').hide();
  $('#incoming_messages_anchor').hide();
  $('#messages_anchor').show();
  return false;
}

function loadPrivateMessages(key) {
  if($('#priv_messages_anchor').is(':visible')) {
    $('#priv_messages_anchor').hide();
    return false;
  }

  Routes.messages.private({Key: key}, function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }
    $('#priv_messages_anchor').show();
    return false;
  })

  return false;
}

function loadIncomingMessages() {
  if($('#incoming_messages_anchor').is(':visible')) {
    $('#incoming_messages_anchor').hide();
    return false;
  }

  Routes.messages.private({Key: '123456789'}, function(status, response) {
    if(status) {
      var notice = Views.notice(response);
      $('#notice').html(notice);
      return false;
    }
    for(var i in response) {
      response[i] = JSON.parse(response[i]);
    }

    var out = Views.mbox.incoming({incoming: response});
    $('#incoming_messages_anchor').html(out);
    $('#incoming_messages_anchor').show();
    return false;
  })

  return false;
}

function refreshSession(callback) {
  var session = $.cookie('aid');

  if(session) {
    if(session != window.Session) {
      logoutSetup();
      window.Session = session;
    }

    Routes.users.show({key: 0}, function(status, data) {
      if(!status) {
        loginNotRequired();
        selfRequired();
        window.User = data;
      }

      var rnd = '?' + Math.random();
      $('#self_img').attr('src', data.avatar + rnd);
      $('#self_link').attr('href', '/' + data.category + '/' + data.name);
      // $('#self_link').attr('href');

      if(callback) {
        callback(status, data);
      }
    })
  } else if(window.Votes) {
    removeVotes();
    loginRequired();
    selfRequired({hide: true});

    if(callback) {
      callback(403);
    }
  }
}

var Aaron;
window.Session = $.cookie('aid');

function checkUpdates() {
  var session = $.cookie('aid');

  if(session) {
    if(session != window.Session) {
      logoutSetup();
      window.Session = session;

      Routes.users.show({key: 0}, function(status, data) {
        if(!status) {
          loginNotRequired();
          selfRequired();
          window.User = data;
        }
      })
    }

    var key = trimVal($('#announcement_form').find('.to_addr')),
        ts = $('body').attr('data-ts');

    if(!key || !ts) {
      return;
    }

    Routes.cache.show({key: key, ts: ts}, function(status, data) {
      if(!status) {
        for(var i = 0; i < data.length; i = i + 2) {
          var item = JSON.parse(data[i]),
              out = Views.mbox.message(item),
              msgTs = parseInt(data[i + 1]);

          if(msgTs <= ts) {
            continue;
          }

          ts = msgTs;
          $('body').attr('data-ts', ts);

          var e = $(out),
              form = $(e).children('form'),
              id = $(form).data('id'),
              parent;

   
          if(item.References && item.References.length) {
            parent = item.References[item.References.length - 1]
          }

          var content = $(e).find('.content');
          $(content).html(SnuOwnd.getParser().render($(content).text()));

          if(id) {
            var exists = $("form[data-id='" + id + "']");

            if($(exists).length) {
              $(exists).parent().replaceWith(e);
            } else if(parent) {
              $("form[data-id='" + parent + "']").siblings('.children').prepend(e);
            } else {
              $(e).insertAfter('#mbox_header');
            }
          }
          //alert(id);
        }
        loginNotRequired();
        selfRequired();
      } else {
        logoutSetup();
      } 
    })
  }
}

$(document).ready(function() {
  Aaron = new Jails({
    host: 'lab.demokracija.hr',
    prefix: '/',
    https: 'https://lab.demokracija.hr/',
    views: '/views.json',
    refresh: refreshSession,
    //expires: 1500,
    expires: 120,
    opts: {
      anonymous: 1,
      patchInterval: 60*1000
    },
    locales: {
      directory: 'https://lab.demokracija.hr/locales',
      defaultLocale: 'hr',
    },
    routes: {
      "GET /cache/:key/:ts": {
        controller: "cache",
        action: "show",
      },
      "POST /users": {
        controller: "users",
        action: "create",
      },
      "POST /users/passwd/:token": {
        controller: "users",
        action: "password",
      },
      "POST /reset/:email": {
        controller: "users",
        action: "reset",
      },
      "GET /users/:key": {
        controller: "users",
        action: "show",
      },
      "GET /votes": {
        controller: "users",
        action: "votes",
      },
      "POST /reset": {
        controller: "identity",
        action: "reset",
      },
      "GET /refresh": {
        controller: "refresh",
        action: "get",
        // headers: setTsHeader
      },
      "POST /login": {
        controller: "users",
        action: "login",
      },
      "POST /logout": {
        controller: "users",
        action: "logout",
      },
      "GET /messages/:id": {
        controller: "messages",
        action: "show"
      },
      "GET /messages/:Key/private": {
        controller: "messages",
        action: "private"
      },
      "POST /messages": {
        controller: "messages",
        action: "new"
      },
      "POST /messages/:Key/forward": {
        controller: "messages",
        action: "forward"
      },
      "POST /messages/:id": {
        controller: "messages",
        action: "update"
      },
      "POST /messages/:id/vote": {
        controller: "messages",
        action: "vote"
      }
    }
  })

  checkUpdates();
  setInterval(checkUpdates, 60*1000);

  if(sessCheck()) {
    selfRequired();

    Routes.users.votes(function(status, votes) {
      setVotes(status, votes);
    })
  } else {
    loginRequired();
  }
  Initialize();
})
