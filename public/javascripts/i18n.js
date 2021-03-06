var sprintf=function(){function a(a){return Object.prototype.toString.call(a).slice(8,-1).toLowerCase()}function b(a,b){for(var c=[];b>0;c[--b]=a);return c.join("")}var c=function(){return c.cache.hasOwnProperty(arguments[0])||(c.cache[arguments[0]]=c.parse(arguments[0])),c.format.call(null,c.cache[arguments[0]],arguments)};return c.format=function(c,d){var e,f,g,h,i,j,k,l=1,m=c.length,n="",o=[];for(f=0;m>f;f++)if(n=a(c[f]),"string"===n)o.push(c[f]);else if("array"===n){if(h=c[f],h[2])for(e=d[l],g=0;g<h[2].length;g++){if(!e.hasOwnProperty(h[2][g]))throw sprintf('[sprintf] property "%s" does not exist',h[2][g]);e=e[h[2][g]]}else e=h[1]?d[h[1]]:d[l++];if(/[^s]/.test(h[8])&&"number"!=a(e))throw sprintf("[sprintf] expecting number but found %s",a(e));switch(h[8]){case"b":e=e.toString(2);break;case"c":e=String.fromCharCode(e);break;case"d":e=parseInt(e,10);break;case"e":e=h[7]?e.toExponential(h[7]):e.toExponential();break;case"f":e=h[7]?parseFloat(e).toFixed(h[7]):parseFloat(e);break;case"o":e=e.toString(8);break;case"s":e=(e=String(e))&&h[7]?e.substring(0,h[7]):e;break;case"u":e=Math.abs(e);break;case"x":e=e.toString(16);break;case"X":e=e.toString(16).toUpperCase()}e=/[def]/.test(h[8])&&h[3]&&e>=0?"+"+e:e,j=h[4]?"0"==h[4]?"0":h[4].charAt(1):" ",k=h[6]-String(e).length,i=h[6]?b(j,k):"",o.push(h[5]?e+i:i+e)}return o.join("")},c.cache={},c.parse=function(a){for(var b=a,c=[],d=[],e=0;b;){if(null!==(c=/^[^\x25]+/.exec(b)))d.push(c[0]);else if(null!==(c=/^\x25{2}/.exec(b)))d.push("%");else{if(null===(c=/^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(b)))throw"[sprintf] huh?";if(c[2]){e|=1;var f=[],g=c[2],h=[];if(null===(h=/^([a-z_][a-z_\d]*)/i.exec(g)))throw"[sprintf] huh?";for(f.push(h[1]);""!==(g=g.substring(h[0].length));)if(null!==(h=/^\.([a-z_][a-z_\d]*)/i.exec(g)))f.push(h[1]);else{if(null===(h=/^\[(\d+)\]/.exec(g)))throw"[sprintf] huh?";f.push(h[1])}c[2]=f}else e|=2;if(3===e)throw"[sprintf] mixing positional and named placeholders is not (yet) supported";d.push(c)}b=b.substring(c[0].length)}return d},c}(),vsprintf=function(a,b){return b.unshift(a),sprintf.apply(null,b)};

var I18n = function(options){
    for (var prop in options) {
        this[prop] = options[prop];
    };

    this.setLocale(this.locale);
};

I18n.localeCache = {};

I18n.prototype = {
    defaultLocale: "en",
    directory: "/locales",
    extension: ".min.json",

    getLocale: function(){
        return this.locale;
    },

    setLocale: function(locale){
        if(!locale)
            locale = $("html").attr("lang");

        if(!locale)
            locale = this.defaultLocale;

        this.locale = locale;

        if(locale in I18n.localeCache) return;
        else this.getLocaleFileFromServer();
    },

    getLocaleFileFromServer: function(){
        localeFile = null;

        $.ajax({
            url: this.directory + "/" + this.locale + this.extension,
            async: false,
            dataType: 'json',
            success: function(data){
                localeFile = data;
            }
        });

        I18n.localeCache[this.locale] = localeFile;
    },

    __: function(){
        var msg = I18n.localeCache[this.locale][arguments[0]];

        if (arguments.length > 1)
            msg = vsprintf(msg, Array.prototype.slice.call(arguments, 1));

        return msg;
    },

    __n: function(singular, count){
        var msg = I18n.localeCache[this.locale][singular];

        count = parseInt(count, 10);
        if(count === 0)
            msg = msg.zero;
        else
            msg = count > 1 ? msg.other : msg.one;

        msg = vsprintf(msg, [count]);

        if (arguments.length > 2)
            msg = vsprintf(msg, Array.prototype.slice.call(arguments, 2));

        return msg;
    }
};
