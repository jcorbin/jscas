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

return CAS;
})(window.CAS || {});
