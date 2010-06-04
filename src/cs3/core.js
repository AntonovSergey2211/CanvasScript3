/*
    CanvasScript3
    Copyright (c) 2010 ARAKI Hayato
    
    MIT License
    
    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:
    
    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
*/
if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.createImageData && window.ImageData) {
    CanvasRenderingContext2D.prototype.createImageData = function(w, h) { return new ImageData(w, h); };
}
if (Object.prototype.__defineGetter__ == undefined) {
    Object.prototype.__defineGetter__ = function(){};
    Object.prototype.__defineSetter__ = function(){};
}
var cs3 = {
    core: {
        initialized: false,
        debug: false,
        isOpera: false,
        stages: [],
        instanceId: 0,
        resizeTimeout: null,
        testCanvas: null,
        testContext: null,
        nextInstanceId: function()
        {
            ++this.instanceId;
            return this.instanceId;
        },
        init: function()
        {
            if (this.initialized) { return; }
            
            if (!document.body) {
                alert('document not loaded');
                return;
            }
            
            
            //canvas for testing
            this.testCanvas = document.createElement("CANVAS");
            if (!this.testCanvas.getContext) {
                try {
                    G_vmlCanvasManager.initElement(this.testCanvas);
                }
                catch (e) {
                    alert('no canvas support');
                    return;
                }
            }
            this.testContext = this.testCanvas.getContext('2d');
            
            
            //TODO add beter browser detection
            this.isOpera = (window.opera) ? true : false;
            
            window.onresize = this.resizeHandler;
            
            this.initialized = true;
        },
        resizeHandler: function(e)
        {
            e = e || window.event;
            var c = cs3.core;
            var t = c.resizeTimeout;
            clearTimeout(t);
            t = setTimeout(c.lazyResizeHandler, 10);
        },
        lazyResizeHandler: function(e)
        {
            var s = cs3.core.stages;
            for (var i = 0, l = s.length; i < l; ++i) {
                s[i].__resize();
            }
        },
        registerStage: function(stage)
        {
            this.init();
            var canvas = stage.canvas;
            
            //mouse events
            cs3.utils.addEventListener(canvas, 'mousemove', function(e) { stage.__mouseMoveHandler(e); });
            cs3.utils.addEventListener(canvas, 'mousedown', function(e) { stage.__mouseDownHandler(e); });
            cs3.utils.addEventListener(canvas, 'mouseup', function(e) { stage.__mouseUpHandler(e); });
            //Firefox
            if (window.addEventListener) {
                canvas.addEventListener('DOMMouseScroll', function(e) { stage.__mouseWheelHandler(e); }, false);
            }
            //Opera, Chrome
            cs3.utils.addEventListener(canvas, 'mousewheel', function(e) { stage.__mouseWheelHandler(e); });
            
            //focus events
            cs3.utils.addEventListener(canvas, 'focus', function(e) { stage.__focusHandler(e); });
            cs3.utils.addEventListener(canvas, 'blur', function(e) { stage.__blurHandler(e); });
            
            //key events
            cs3.utils.addEventListener(canvas, 'keydown', function(e) { stage.__keyDownHandler(e); });
            cs3.utils.addEventListener(canvas, 'keyup', function(e) { stage.__keyUpHandler(e); });
            
            this.stages.push(stage);
        }
    },
    utils: {
        __events: {},
        addOnload: function(func)
        {
            var self = this;
            this.addEventListener(window, 'load', function()
            {
                func();
                //self.removeEventListener(window, 'load', arguments.callee);
            });
        },
        /**
         * unsafely add a single event listener
         * should only be called after your sure the handler exists
         */
        __addEventListener: function(element, type, listener)
        {
            this.__events[element][type].push(listener);
        },
        /**
         * unsafely remove a single event listener
         * should only be called after your sure the handler exists
         */
        __removeEventListener: function(element, type, listener)
        {
            var events = this.__events[element][type];
            for (var i = 1, l = events.length; i < l; ++i)
            {
                if (events[i] == listener) {
                    events.splice(i, 1);
                    return;
                }
            }
        },
        /**
         * unsafely remove all event listeners associated with type by removing the handler
         * should only be called after your sure the handler exists
         */
        __removeEventListeners: function(element, type)
        {
            var handler = this.__events[element][type][0];
            if (window.removeEventListener) {
                element.removeEventListener(type, handler, false);
            }
            else if (window.detachEvent) {
                element.detachEvent(type, handler);
            }
            else {
                if (element['on' + type] == handler) {
                    element['on' + type] = null;
                }
            }
            this.__events[element][type] = null;
            delete this.__events[element][type];
        },
        /**
         * check if the element has an event listener associated with type
         */
        __hasEventListener: function(element, type)
        {
            var events = this.__events;
            if (events[element] == undefined) { return false; }
            if (events[element][type] == undefined) { return false; }
            if (events[element][type].length === 0) { return false; }
            return true;
        },
        /**
         * make the actual function to handle the events
         * should only be called after your sure the handler doesn't exists
         */
        __makeEventHandler: function(element, type)
        {
            if (this.__events[element] === undefined) {
                this.__events[element] = {};
            }
            this.__events[element][type] = [];
            var listeners = this.__events[element][type];
            var handler = function(event)
            {
                for (var i = 1, l = listeners.length; i < l; ++i)
                {
                    listeners[i](event);
                }
            };
            listeners[0] = handler;
            
            if (window.addEventListener) {
                element.addEventListener(type, handler, false);
            }
            else if (window.attachEvent) {
                element.attachEvent('on' + type, handler);
            }
            else {
                var old = element['on' + type];
                if (typeof(old) !== 'function') {
                    element['on' + type] = handler;
                }
                else {
                    element['on' + type] = function() {
                        old();
                        handler(window.event);
                    };
                }
            }
        },
        /**
         * add a single event listener
         */
        addEventListener: function(element, type, listener)
        {
            if (this.__hasEventListener(element, type) === false) {
                this.__makeEventHandler(element, type);
            }
            this.__addEventListener(element, type, listener);
        },
        /**
         * remove a single event listener
         */
        removeEventListener: function(element, type, listener)
        {
            if (this.__hasEventListener(element, type)) {
                this.__removeEventListener(element, type, listener);
                if (this.__events[element][type].length === 1) {
                    //if it was the last listener remove the handler
                    this.__removeEventListeners(element, type);
                }
            }
        },
        /**
         * remove all event listeners associated with type
         */
        removeEventListeners: function(element, type)
        {
            if (this.__hasEventListener(element, type)) {
                this.__removeEventListeners(element, type);
            }
        },
        /**
         * remove all event listeners from an element
         */
        removeAllEventListeners: function(element)
        {
            if (this.__events[element]) {
                for (type in this.__events[element])
                {
                    this.__removeEventListeners(element, type);
                }
            }
            this.__events[element] = null;
            delete this.__events[element];
        },
        createXMLHttpRequest: function()
        {
            var req = null;
            if (window.XMLHttpRequest) {
                req = new XMLHttpRequest();
                //req.overrideMimeType('text/xml');
            }
            else if (window.ActiveXObject) {
                try {
                    req = new ActiveXObject('Msxml2.XMLHTTP');
                }
                catch (e) {
                    req = new ActiveXObject('Microsoft.XMLHTTP');
                }
            }
            return req;
        },
        createCanvas: function(id, width, height)
        {
            var canvas = document.createElement('CANVAS');
            canvas.id = id || null;
            canvas.width = width | 0;
            canvas.height = height | 0;
            return canvas;
        },
        getContext2d: function(canvas)
        {
            if (!canvas.getContext) {
                try {
                    G_vmlCanvasManager.initElement(canvas);
                }
                catch (e) {
                    throw new Error('canvas is not available');
                }
            }
            return canvas.getContext('2d');
        },
        timeit: function(scope, func, args)
        {
            var s = (new Date()).getTime();
            func.apply(scope, args);
            trace((new Date()).getTime() - s);
        }
    }
};
/**
 * Fix rectangle coords from floats to integers
 */
function __ceilRect(rect)
{
    var x = rect.x;
    var y = rect.y;
    rect.x = Math.floor(x);
    rect.y = Math.floor(y);
    rect.width = Math.ceil(rect.width + (x - rect.x));
    rect.height = Math.ceil(rect.height + (y - rect.y));
}
/**
 * apply a function up towards the display list root(including your self)
 */
function __applyUp(self, func, args)
{
    func.apply(self, args);
    if (self.__parent) {
        __applyUp(self.__parent, func, args);
    }
}
/**
 * apply a function down the display list(including your self)
 */
function __applyDown(self, func, args)
{
    func.apply(self, args);
    if (self.__children) {
        var c = self.__children;
        for (var i = 0, l = c.length; i < l; ++i)
        {
            __applyDown(c[i], func, args);
        }
    }
}
/**
 * convert hexadecimal rgb color to css format
 * eg. 0xFF00FF -> rgb(255, 0, 255)
 */
function __toRGB(color)
{
    var r = color >> 16 & 0xFF;
    var g = color >> 8  & 0xFF;
    var b = color & 0xFF;
    return "rgb(" + r + ", " + g + ", " + b + ")";
}
/**
 * convert hexadecimal argb color to css format
 * eg. 0xFF00FF00 -> rgba(0, 255, 0, 1)
 */
function __toRGBA(color)
{
    var a = color >> 24 & 0xFF;
    var r = color >> 16 & 0xFF;
    var g = color >> 8  & 0xFF;
    var b = color & 0xFF;
    return "rgba(" + r + ", " + g + ", " + b + ", " + (a / 255) + ")";
}
function __noImp(name)
{
    throw new Error(name + ' is not implemented');
}


var trace = (function()
{
    if (window.console) {
        return function(msg) {
            console.log(msg);
        };
    }
    else {
        return function(msg){};
    }
})();
function Class(e, o)
{
    if (e === undefined) { e = {}; }
    if (o === undefined) { o = e; e = Object; }
    if (typeof(o) === 'function') { o = new o(); }
    if (o.__init__ === undefined) { o.__init__ = function(){}; }
    var c = o.__init__;
    var f = function(){};
    f.prototype = e.prototype;
    c.prototype = new f();
    c.prototype.constructor = c;
    for (var p in o) { if (p != '__init__') { c.prototype[p] = o[p]; } }
    return c;
}


var ArgumentError = function(message)
{
    Error.apply(this, arguments);
    this.name = 'ArgumentError';
    this.message = message;
};
ArgumentError.prototype = new Error();


var SimpleTween = new Class(Object, function()
{
    this.__init__ = function(displayObject, property, from, to, frames)
    {
        var range = to - from;
        var frame = 0;
        displayObject[property] = from;
        displayObject.addEventListener(Event.ENTER_FRAME, function(e)
        {
            ++frame;
            var ratio = SimpleTween.Elastic.easeOut(frame / frames);
            var next = from + (range * ratio);
            displayObject[property] = next;
            if (frame == frames) {
                displayObject[property] = to;
                displayObject.removeEventListener(Event.ENTER_FRAME, arguments.callee);
            }
        });
    };
});
SimpleTween.Back = {
    easeIn: function(t) {
        return 3 * t * t * t - 2 * t * t;
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Bounce = {
    DH: 1 / 22,
    D1: 1 / 11,
    D2: 2 / 11,
    D3: 3 / 11,
    D4: 4 / 11,
    D5: 5 / 11,
    D7: 7 / 11,
    IH: 1 / this.DH,
    I1: 1 / this.D1,
    I2: 1 / this.D2,
    I4D: 1 / this.D4 / this.D4,
    easeIn: function(t) {
        var s;
        if (t < this.D1) {
            s = t - this.DH;
            s = this.DH - s * s * this.IH;
        } else if (t < this.D3) {
            s = t - this.D2;
            s = this.D1 - s * s * this.I1;
        } else if (t < this.D7) {
            s = t - this.D5;
            s = this.D2 - s * s * this.I2;
        } else {
            s = t - 1;
            s = 1 - s * s * this.I4D;
        }
        return s;
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Circ = {
    easeIn: function(t) {
        return 1.0 - Math.sqrt(1.0 - t * t);
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Cubic = {
    easeIn: function(t) {
        return t * t * t;
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Elastic = {
    easeIn: function(t) {
        return 1.0 - this.easeOut(1.0 - t);
    },
    easeOut: function(t) {
        var s = 1 - t;
        return 1 - Math.pow(s, 8) + Math.sin(t * t * 6 * Math.PI) * s * s;
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Linear = {
    easeIn: function(t) {
        return t;
    },
    easeOut: function(t) {
        return t;
    },
    easeInOut: function(t) {
        return t;
    }
};
SimpleTween.Quad = {
    easeIn: function(t) {
        return t * t;
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Quart = {
    easeIn: function(t) {
        return t * t * t * t;
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Quint = {
    easeIn: function(t) {
        return t * t * t * t * t;
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};
SimpleTween.Sine = {
    _HALF_PI: Math.PI / 2,
    easeIn: function(t) {
        return 1.0 - Math.cos(t * this._HALF_PI);
    },
    easeOut: function(t) {
        return 1.0 - this.easeIn(1.0 - t);
    },
    easeInOut: function(t) {
        return (t < 0.5) ? this.easeIn(t * 2.0) * 0.5 : 1 - this.easeIn(2.0 - t * 2.0) * 0.5;
    }
};


var XML = new Class(Object, function()
{
    this.__init__ = function(str)
    {
        this.__str = str;
        this.__xml = null;
        if (window.DOMParser) {
            var parser = new DOMParser();
            this.__xml = parser.parseFromString(str, "text/xml");
        }
        else {
            this.__xml = new ActiveXObject("Microsoft.XMLDOM");
            this.__xml.async="false";
            this.__xml.loadXML(str); 
        }
        return this.__xml;
    };
});
XML.prototype.toString = function()
{
    return '[object XML]';
};