"use strict";

window.CAS = (function(CAS) {

CAS.Variable = function(name) {
    this.name = name;
}
CAS.Variable.prototype = {
    "toString": function() {return this.name}
};
CAS.Variable.prototype.toJSON = CAS.Variable.prototype.toString;

return CAS;
})(window.CAS || {});
