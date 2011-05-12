"use strict";

window.CAS = (function(CAS) {

function gcd(a, b) {
    if (b > a) return gcd(b, a);
    return b == 0 ? a : gcd(b, a % b);
}

CAS.Rational = function rational(numer, denom) {
    var d = gcd(numer, denom);
    this.numer = numer / d;
    this.denom = denom / d;
}
CAS.Rational.make = function(numer, denom) {
    var m = 1;
    if (numer < 0) {
        m *= -1;
        numer *= -1;
    }
    if (denom < 0) {
        m *= -1;
        denom *= -1;
    }
    var d = gcd(numer, denom);
    numer /= d;
    denom /= d;
    numer *= m;
    return denom == 1 ? numer*m : new CAS.Rational(numer*m, denom);
};
CAS.Rational.prototype.reciprocal = function() {
    return new CAS.Rational(this.denom, this.numer);
};
CAS.Rational.prototype.add = function(other) {
    if (typeof other == "number") {
        return new CAS.Rational(
            this.numer + this.denom * other,
            this.denom
        );
    } else if (other instanceof CAS.Rational) {
        var d = gcd(this.denom, other.denom);
        return new CAS.Rational(
            this.numer * other.denom/d + other.numer * this.denom/d,
            this.denom * other.denom
        );
    } else {
        throw new Error('unimplemented');
    }
};
CAS.Rational.prototype.subtract = function(other) {
    if (typeof other == "number") {
        return new CAS.Rational(
            this.numer - this.denom * other,
            this.denom
        );
    } else if (other instanceof CAS.Rational) {
        var d = gcd(this.denom, other.denom);
        return new CAS.Rational(
            this.numer * other.denom/d - other.numer * this.denom/d,
            this.denom * other.denom
        );
    } else {
        throw new Error('unimplemented');
    }
};
CAS.Rational.prototype.multiply = function(other) {
    if (typeof other == "number") {
        return new CAS.Rational(
            this.numer * other,
            this.denom
        );
    } else if (other instanceof CAS.Rational) {
        return new CAS.Rational(
            this.numer * other.numer,
            this.denom * other.denom
        );
    } else {
        throw new Error('unimplemented');
    }
};
CAS.Rational.prototype.divide = function(other) {
    if (typeof other == "number") {
        return new CAS.Rational(
            this.numer,
            this.denom * other
        );
    } else if (other instanceof CAS.Rational) {
        return new CAS.Rational(
            this.numer * other.denom,
            this.denom * other.numer
        );
    } else {
        throw new Error('unimplemented');
    }
};
CAS.Rational.prototype.toString = function() {
    return this.numer.toString()+"/"+this.denom.toString();
};
CAS.Rational.prototype.toJSON = function() {
    return ["/", this.numer, this.denom];
};

return CAS;
})(window.CAS || {});
