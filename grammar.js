"use strict";

window.CAS = (function(CAS) {

CAS.Operator = function(symbol, bp, rbp) {
    CAS.Symbol.call(this, symbol, bp);
    if (rbp != undefined)
        this.rbp = rbp;
    else if (bp != undefined)
        this.rbp = bp;

    this.expression = function() {
        CAS.Operator.Expression.apply(this, arguments);
    }
    this.expression.prototype = new CAS.Operator.Expression();
    this.expression.prototype.constructor = this.expression;
    this.expression.prototype.op = this;
}
CAS.Operator.prototype = new CAS.Symbol();
CAS.Operator.prototype.constructor = CAS.Operator;

CAS.Operator.Expression = function() {
    for (var i=0; i<arguments.length; i++)
        this.push(arguments[i]);
};
CAS.Operator.Expression.prototype = new Array();
CAS.Operator.Expression.prototype.constructor = CAS.Operator.Expression;

CAS.Operator.Expression.prototype.toJSON = function() {
    var a = [this.op.symbol];
    for (var i=0; i<this.length; i++) a.push(this[i]);
    return a;
};

CAS.BinaryOperator = function(symbol, bp, associative, commutative) {
    if (associative == undefined) this.associative = associative;
    if (commutative == undefined) this.commutative = commutative;
    CAS.Operator.call(this, symbol, bp);
    this.expression.prototype.toString = function() {
        return this
            .map(function(arg) {
                if (arg instanceof CAS.Operator.Expression
                    && this.bp >= arg.op.bp)
                    return "(" + arg + ")";
                else
                    return arg;
            }, this.op)
            .join(" " + this.op.symbol + " ");
    };
};
CAS.BinaryOperator.prototype = new CAS.Operator();
CAS.BinaryOperator.prototype.constructor = CAS.BinaryOperator;
delete CAS.BinaryOperator.prototype.expression;

CAS.BinaryOperator.prototype.associative = true;
CAS.BinaryOperator.prototype.commutative = true;
CAS.BinaryOperator.prototype.led = function(parser, left) {
    var expr = parser.expression(this.rbp);
    if (this.associative && left instanceof this.expression)
        left.push(expr);
    else
        left = new this.expression(left, expr);
    return left;
};

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
    this.symbols = {};
};
CAS.Grammar.prototype.compile = function() {
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
};
CAS.Grammar.prototype.recognize = function(input) {
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
};
CAS.Grammar.prototype.parse = function(input) {
    if (! this.regex)
        this.compile();
    var parser = new CAS.Parser(this.recognize.bind(this), input);
    return parser.expression();
};
CAS.Grammar.prototype.addToken = function(token) {
    this.tokens.splice(-1, 0, token);
    delete this.recognizer;
    return token;
};
CAS.Grammar.prototype.token = function(token, regex, nud) {
    return this.addToken(new CAS.Token(regex, 0, nud));
};
CAS.Grammar.prototype.addSymbol = function(symbol) {
    if (symbol.symbol in this.symbols)
        throw new Error('symbol ' + symbol.symbol + ' already defined');
    this.symbols[symbol.symbol] = symbol;
    this.tokens.splice(this.first_token, 0, symbol);
    this.first_token++;
    delete this.recognizer;
    return symbol;
};
CAS.Grammar.prototype.symbol = function(symbol, bp, nud, led) {
    if (symbol in this.symbols) {
        if (arguments.length > 1)
            throw new Error('symbol ' + symbol + ' already defined, too many args');
        return this.symbols[symbol];
    } else {
        return this.addSymbol(new CAS.Symbol(symbol, bp, nud, led));
    }
};
CAS.Grammar.prototype.operator = function(symbol, bp, a, c) {
    return this.addSymbol(new CAS.BinaryOperator(symbol, bp, a, c));
};

return CAS;
})(window.CAS || {});
