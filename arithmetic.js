"use strict";

window.CAS = (function(CAS) {

CAS.Arithmetic = new CAS.Grammar();

CAS.Arithmetic.symbol(")");
CAS.Arithmetic.symbol("(").nud = function(parser) {
    var expr = parser.expression();
    parser.take(")");
    return expr;
};
CAS.Arithmetic.token("number", /^\s*(-?\d+(?:\.\d+)?(?:E-?\d+)?)/,
    function(parser) {
        var n = Number(this.value);
        if (isNaN(n))
            token.error("not a number");
        return n;
    });

CAS.Arithmetic.operator("+", 50);
CAS.Arithmetic.operator("-", 50);
CAS.Arithmetic.operator("*", 60);
CAS.Arithmetic.operator("/", 60);

CAS.Negative = function(expr) {
    this.expr = expr;
}
CAS.Negative.make = function(expr) {
    if (typeof expr == "number") {
        return -1 * expr;
    } else if (expr instanceof RationalNumber) {
        return new RationalNumber(expr.numer * -1, expr.denom);
    } else if (expr instanceof CAS.Negative) {
        return expr.expr;
    } else {
        return new CAS.Negative(expr);
    }
};
CAS.Negative.prototype.toString = function() {
    return "-" + this.expr.toString();
};
CAS.Negative.prototype.toJSON = function() {
    return ["-", this.expr];
};

CAS.Arithmetic.symbol("-").nud = function(parser) {
    return CAS.Negative.make(parser.expression(70));
};

return CAS;
})(window.CAS || {});
