"use strict";

window.CAS = (function(CAS) {

CAS.Variable = function variable(name) {
    this.name = name;
}
CAS.Variable.prototype.toString =
CAS.Variable.prototype.toJSON = function() {return this.name};

return CAS;
})(window.CAS || {});
