"use strict";

window.CAS = (function(CAS) {

CAS.Plot = function(canvas) {
    this.canvas = canvas || document.createElement('canvas');
    this.functions = [];
};
CAS.Plot.prototype = {
    "scale": 6,
    "axisStyle": "#333",
    "axisLabelStyle": "#666",

    "addFunction": function(f, color) {
        this.functions.push({
            "function": f,
            "color": color || "#6f6"
        });
        this.redraw();
    },

    "redraw": function() {
        this.canvas.width = this.canvas.width;
        this.draw();
    },

    "step": 1/2,

    "draw": function() {
        var ctx = this.canvas.getContext("2d"),
            w = ctx.canvas.width,
            h = ctx.canvas.height,
            y_axis = 0, //Math.floor(w/2),
            x_axis = Math.floor(h/2),
            scale = Math.floor(w/this.scale);

        function translate(f) {
            return function(x) {
                var val = f((x - y_axis)/scale);
                if (val == undefined || val == null || isNaN(val))
                    return undefined;
                else
                    return x_axis + scale * -1 * val;
            };
        }

        function line(x1, y1, x2, y2) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.closePath();
        }

        var ts = scale/25;
        function x_tick(x, label) {
            line(x, x_axis + ts, x, x_axis - ts);
            if (label) {
                var w = ctx.measureText(label).width;
                ctx.fillText(label, x - w/2, x_axis - ts);
            }
        }
        function y_tick(y, label) {
            line(y_axis + ts, y, y_axis - ts, y);
            if (label) {
                var h = ctx.measureText(label).height;
                ctx.fillText(label, y_axis - ts, y - h/2);
            }
        }

        ctx.strokeStyle = this.axisStyle;
        line(0, x_axis, w, x_axis);
        line(y_axis, 0, y_axis, h);

        ctx.fillStyle = this.axisLabelStyle;

        for (var i=(y_axis % scale); i<w; i+=scale)
            x_tick(i);
        for (var i=(x_axis % scale); i<h; i+=scale)
            y_tick(i);

        var step = this.step;
        this.functions.forEach(function(fn) {
            var y = translate(fn.function);
            ctx.strokeStyle = fn.color;
            ctx.beginPath();
            var data = [];
            var last = undefined;
            for (var x=0; x<w; x+=step) {
                var cur = y(x);
                if (cur != undefined) {
                    if (last == undefined)
                        ctx.moveTo(x, cur);
                    else
                        ctx.lineTo(x, cur);
                }
                last = cur;
                if (cur != undefined) {
                    data.push([
                        (x - y_axis)/scale,
                        cur = -1 * (cur - x_axis) / scale
                    ]);
                }
            }
            if (last != undefined)
                ctx.lineTo(w, y(w));
            ctx.stroke();
            ctx.closePath();
        }, this);
    }
};

CAS.AnimatedPlot = function(canvas) {
    this.t = 0;
    CAS.Plot.call(this, canvas);
};
CAS.AnimatedPlot.prototype = Object.create(CAS.Plot.prototype);
CAS.AnimatedPlot.prototype.animateFunction = function(f) {
    return function(x) {
        return f(x, this.t);
    }.bind(this);
};
CAS.AnimatedPlot.prototype.addAnimatedFunction = function(f, color) {
    this.addFunction(this.animateFunction(f), color);
};
CAS.AnimatedPlot.prototype.running = null;
CAS.AnimatedPlot.prototype.animationStep = 1;
CAS.AnimatedPlot.prototype.animationInterval = 1000/24;
CAS.AnimatedPlot.prototype.play = function(step, interval) {
    step = step || this.animationStep;
    interval = interval || this.animationInterval;
    if (this.running) {
        if (step == this.animationStep &&
            interval == this.animationInterval)
            return;
        clearInterval(this.running);
        delete this.running;
    }
    this.animationStep = step;
    this.animationInterval = interval;
    this.running = setInterval(function () {
        this.t += step;
        this.redraw();
    }.bind(this), interval);
};
CAS.AnimatedPlot.prototype.stop = function(step, interval) {
    step = step || 1;
    if (! this.running) return;
    clearInterval(this.running);
    delete this.running;
};

return CAS;
})(window.CAS || {});
