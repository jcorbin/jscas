"use strict";

window.CAS = (function(CAS) {

function groupby(vals, key) {
    var r = [], buf = [], i = -1, cur = null;
    vals.forEach(function(val) {
        var kv = key(val);
        if (kv != cur) {
            if (buf.length)
                r.push({"key": cur, "vals": buf});
            cur = kv;
            buf = [];
        }
        buf.push(val);
    });
    r.push({"key": cur, "vals": buf});
    return r;
}

CAS.Grammar = function() {
    this.first_token = -1;
    this.tokens = [
        (new CAS.Token(/^\s*()$/))
    ];
};
CAS.Grammar.prototype = {
    "compile": function() {
        var rs = this.tokens.map(function(r) {return r.regex.source});
        rs = groupby(rs, function(s) {
            s = s.substr(0, 4);
            return s == "^\\s*" ? s : null;
        });
        rs = rs.map(function(group) {
            var vals = group.vals.join("|");
            if (group.key)
                vals = group.key + "(?:" + vals + ")";
            return vals;
        });
        if (rs.length > 1)
            rs = rs.join("|");
        else
            rs = rs[0];
        this.regex = new RegExp(rs)
    },

    "recognize": function(input) {
        var match = this.regex.exec(input);
        if (! match) return null;
        for (var i=1; i<match.length; i++)
            if (match[i] != undefined) {
                var token = Object.create(this.tokens[i-1]);
                token.consumed = match[0].length;
                token.value = match[i];
                return token;
            }
        return null;
    },

    "parse": function(input) {
        if (! this.regex)
            this.compile();
        var parser = new CAS.Parser(this.recognize.bind(this), input);
        return parser.expression();
    },

    "addToken": function(token) {
        this.tokens.splice(-1, 0, token);
        delete this.recognizer;
        return token;
    },

    "addSymbol": function(symbol) {
        this.tokens.splice(this.first_token, 0, symbol);
        this.first_token++;
        delete this.recognizer;
        return symbol;
    },

    "token": function(token, regex, nud) {
        return this.addToken(new CAS.Token(regex, 0, nud));
    },

    "symbol": function(symbol, bp, nud, led) {
        return this.addSymbol(new CAS.Symbol(symbol, bp, nud, led));
    }
};

return CAS;
})(window.CAS || {});
