var Stage = new Class(DisplayObjectContainer, function()
{
    this.__init__ = function(params)
    {
        DisplayObjectContainer.call(this);
        
        params = params || {};
        params.canvas     = params.canvas || null;
        params.width      = params.width | 0;
        params.height     = params.height | 0;
        params.frameRate  = params.frameRate || cs3.config.DEFAULT_FRAMERATE;
        params.align      = params.align || StageAlign.TOP_LEFT;
        params.scaleMode  = params.scaleMode || StageScaleMode.NO_SCALE;
        params.renderMode = params.renderMode || StageRenderMode.AUTO;/* all, dirty, auto */
        params.debug      = (params.debug) ? true : false;
        params.preventMouseWheel = (params.preventMouseWheel) ? true : false;
        params.preventTabKey     = (params.preventTabKey) ? true : false;
        
        cs3.core.debug = params.debug;
        
        this.__initialized = false;
        this.__rect = new Rectangle(0, 0, params.width ,params.height);
        this.__stageWidth = params.width;
        this.__stageHeight = params.height;
        this.__offsetX = 0;
        this.__offsetY = 0;
        this.__timer = null;
        this.__align = params.align;
        this.__scaleMode = params.scaleMode;
        this.__renderMode = params.renderMode;
        this.__mouseX = 0;
        this.__mouseY = 0;
        //wether the mouse is over the stage rect
        this.__mouseOverStage = false;
        //the current object under the mouse point.
        this.__objectUnderMouse = null;
        //the object that the mouse was pressed.
        //if this is NULL the mouse is not pressed.
        this.__mouseDownObject = null;
        //the last object that received a CLICK event.
        //if this object gets clicked again in 500ms DOUBLE_CLICK will be called.
        this.__mouseClickObject = null;
        this.__dragOffsetX = 0;
        this.__dragOffsetY = 0;
        this.__dragTarget = null;
        this.__dragBounds = null;
        this.__lockFrameEvent = false;
        this.__blockedFrameEvent = false;
        this.__renderAll = true;
        this.__redrawRegions = [];
        this.__keyPressTimer = null;
        this.__isKeyDown = false;
        this.__preventMouseWheel = params.preventMouseWheel;
        this.__preventTabKey = params.preventTabKey;
        this.__frameRate = params.frameRate;
        this.stageFocusRect = false;
        this.showRedrawRegions = params.showRedrawRegions;
        this.__canvasWidth = null;
        this.__canvasHeight = null;
        this.__stage = null;
        this.__root = null;
        
        //TODO start preloading
        
        //setup
        if (!window.document.body) {
            var stage = this;
            cs3.utils.addOnload(function()
            {
                stage.__setup(params);
            });
        }
        else {
            this.__setup(params);
        }
    };
    this.__setup = function(params)
    {
        //document should now be loaded
        //setup stage
        if (params.canvas instanceof HTMLCanvasElement) {
            this.canvas = params.canvas;
        }
        else if (typeof params.canvas == 'string') {
            this.canvas = document.getElementById(params.canvas);
        }
        
        if (!this.canvas) {
            this.canvas = cs3.utils.createCanvas(0, 0);
            document.body.appendChild(this.canvas);
        }
        
        this.__context = cs3.utils.getContext2d(this.canvas);
        this.__hiddenCanvas = cs3.utils.createCanvas(0, 0);
        this.__hiddenContext = cs3.utils.getContext2d(this.__hiddenCanvas);
        
        this.canvas.style.cursor = 'default';
        this.canvas.tabIndex = 1;//enable focus events
        this.canvas.style.outline = "none";
        //this.canvas.oncontextmenu = function() { return false; };
        
        //register stage for document events
        cs3.core.registerStage(this);
        
        //adjust stage size
        this.__resize();
        
        //TODO: IMPORTANT: testing required
        //if we render all on the first frame
        //DisplayObject.update() will not be called and it's globalBounds will not be set
        //so we should either force not to renderAll or to force update on stage.setup()
        this.__renderAll = false;
        
        //call children ADDED_TO_STAGE events
        __applyDown(this, function(stage, event)
        {
            this.__stage = this.__root = stage;
            this.dispatchEvent(event);
        }, [this, new Event(Event.ADDED_TO_STAGE, false, false)]);
        
        //start frame loops
        this.__initialized = true;
        this.__enterFrame();
    };
    this.__addRedrawRegion = function(rect)
    {
        rect = rect.clone();
        
        //only add parts inside of the stage rect
        if (!this.__rect.containsRect(rect)) {
            if (!this.__rect.intersects(rect)) {
                return;
            }
            rect = this.__rect.intersection(rect);
        }
        //rect = this.__rect.intersection(rect);
        //if (rect.isEmpty()) { return; }
        
        //convert float's to int's
        __ceilRect(rect);
        
        var redrawRegions = this.__redrawRegions;
        var i = redrawRegions.length;
        while (i--)
        {
            var region = redrawRegions[i];
            if (region.intersects(rect)) {
                //var intersection = region.intersection(rect);
                //if (intersection.width * intersection.height > rect.width * rect.height / 5) {
                    redrawRegions[i] = region.union(rect);
                    return;
                //}
            }
        }
        
        redrawRegions.push(rect);
    };
    this.__focusHandler = function(e)
    {
        //trace("focus");
        //Firefox needs to resize
        //solved by adding outline=none
        //this.__resize();
    };
    this.__blurHandler = function(e)
    {
        //trace("blur");
        //Firefox needs to resize
        //solved by adding outline=none
        //this.__resize();
    };
    this.__keyDownHandler = function(e)
    {
        clearTimeout(this.__keyPressTimer);
        this.__isKeyDown = true;
        
        if (cs3.core.isOpera) {
            this.__keyPressTimer = setTimeout(function(){ this.__keyPressHandler(e); }, 500);
        }
        
        var keyCode = e.keyCode;
        var charCode = 0;//todo
        var keyLocation = 0;//not supported
        this.dispatchEvent(new KeyboardEvent(KeyboardEvent.KEY_DOWN, true, false, charCode, keyCode, keyLocation, e.ctrlKey, e.altKey, e.shiftKey));
        
        if (this.__preventTabKey && keyCode === 9) {
            //disable tab focusing
            if (e.preventDefault) { e.preventDefault(); }
            e.returnValue = false;
        }
    };
    this.__keyPressHandler = function(e)
    {
        clearTimeout(this.__keyPressTimer);
        if (!this.__isKeyDown) { return; }
        
        this.__keyDownHandler(e);
        
        if (cs3.core.isOpera) {
            this.__keyPressTimer = setTimeout(function(){ this.__keyPressHandler(e); }, 33);
        }
    };
    this.__keyUpHandler = function(e)
    {
        this.__isKeyDown = false;
        clearTimeout(this.__keyPressTimer);
        
        var keyCode = e.keyCode;
        var charCode = 0;//todo
        var keyLocation = 0;//not supported
        this.dispatchEvent(new KeyboardEvent(KeyboardEvent.KEY_UP, true, false, charCode, keyCode, keyLocation, e.ctrlKey, e.altKey, e.shiftKey));
    };
    
    /**
     * TODO reactes different when the mouse goes out the stage
     */
    this.__mouseMoveHandler = function(e)
    {
        //TODO: fix the mouse position relative to canvas
        var x, y;
        var canvas = this.canvas;
        
        x = e.pageX - canvas.offsetLeft;
        y = e.pageY - canvas.offsetTop;
        
        /*
        if (this.__scaleX || this.__scaleY) {
            x = Math.round(x / this.__scaleX);
            y = Math.round(y / this.__scaleY);
        }
        */
        
        if (x === this.__mouseX && y === this.__mouseY) {
            return;
        }
        
        
        //mouse move events
        this.__mouseOverStage = false;
        if (this.__rect.contains(x, y) === true) {
            this.__mouseX = x;
            this.__mouseY = y;
            
            this.__mouseOverStage = true;
            this.__updateObjectUnderMouse();
            
            if (this.__objectUnderMouse) {
                this.__objectUnderMouse.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_MOVE, true, false));
            }
            else {
                //if there is no abject under the mouse point,
                //stage's mousemove event gets called
                this.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_MOVE, true, false));
            }
        }
        else if (this.__mouseDownObject) {
            //if the mouse is out of the stage but the mouse is down
            //stage's mousemove event gets called
            this.__mouseX = x;
            this.__mouseY = y;
            this.__objectUnderMouse = null;
            this.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_MOVE, true, false));
        }
        else {
            //mouse is out of the stage and mouse is not down
            this.__objectUnderMouse = null;
            return;
        }
        
        
        //handle startDrag
        var drag = this.__dragTarget;
        var bounds = this.__dragBounds;
        
        if (drag) {
            var newX = x - this.__dragOffsetX;
            var newY = y - this.__dragOffsetY;
            
            if (bounds) {
                if (newX < bounds.x) {
                    newX = bounds.x;
                }
                if (newY < bounds.y) {
                    newY = bounds.y;
                }
                if (newX > bounds.x + bounds.width) {
                    newX = bounds.x + bounds.width;
                }
                if (newY > bounds.y + bounds.height) {
                    newY = bounds.y + bounds.height;
                }
            }
            
            drag.setX(newX);
            drag.setY(newY);
        }
    };
    this.__mouseDownHandler = function(e)
    {
        //FIXED in opera and chrome we can't capture mousemove events while the contextmenu is open.
        //so without the code bellow if you right click then left click, the mouse position will not be updated.
        this.__mouseMoveHandler(e);
        
        var target = this.__objectUnderMouse;
        if (!target) { return; }
        
        //TODO fix MouseEvent arguments
        if (e.which === 1) {
            //left click
            //function(type, bubbles, cancelable, localX, localY, relatedObject, ctrlKey, altKey, shiftKey, buttonDown, delta)
            target.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_DOWN, true, false, 0, 0, null, e.ctrlKey, e.altKey, e.shiftKey, false, 0));
            this.__mouseDownObject = target;
        }
        else if (e.which === 2) {
            //middle click
            return;
        }
        else if (e.which === 3) {
            //right click
            return;
        }
    };
    this.__mouseUpHandler = function(e)
    {
        this.__mouseMoveHandler(e);
        var stage = this;
        var target = this.__objectUnderMouse;
        if (!target) {
            if (this.__mouseDownObject) {
                target = stage;
            }
            else {
                return;
            }
        }
        
        //TODO fix MouseEvent arguments
        if (e.which === 1) {
            //function(type, bubbles, cancelable, localX, localY, relatedObject, ctrlKey, altKey, shiftKey, buttonDown, delta)
            target.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_UP, true, false, 0, 0, null, e.ctrlKey, e.altKey, e.shiftKey, false, 0));
            if (this.__mouseDownObject === target) {
                target.dispatchEvent(new MouseEvent(MouseEvent.CLICK, true, false, 0, 0, null, e.ctrlKey, e.altKey, e.shiftKey, false, 0));
                
                //double click
                clearTimeout(this.__doubleClickTimer);
                if (this.__mouseClickObject === target) {
                    target.dispatchEvent(new MouseEvent(MouseEvent.DOUBLE_CLICK, true, false, 0, 0, null, e.ctrlKey, e.altKey, e.shiftKey, false, 0));
                    this.__mouseClickObject = null;
                }
                else {
                    this.__mouseClickObject = target;
                    this.__doubleClickTimer = setTimeout(function(){ stage.__mouseClickObject = null; }, 500);
                }
            }
            this.__mouseDownObject = null;
        }
        else if (e.which === 2) {
            //middle click
            return;
        }
        else if (e.which === 3) {
            //right click
            return;
        }
    };
    this.__mouseWheelHandler = function(e)
    {
        var target = this.__objectUnderMouse;
        
        var delta = 0;
        if (e.wheelDelta) { /* IE/Opera. */
                delta = e.wheelDelta/120;
                //if (cs3.core.isOpera) { delta = -delta; }
        }
        else if (e.detail) { /** Mozilla case. */
                delta = -e.detail/3;
        }
        
        if (delta) {
            //TODO MouseEvent arguments
            target.dispatchEvent(new MouseEvent(
                MouseEvent.MOUSE_WHEEL, true, false, 0, 0, null, false, false, false, false, delta));
        }
        if (this.__preventMouseWheel) {
            //disable browser scrolling
            if (e.preventDefault) { e.preventDefault(); }
            e.returnValue = false;
        }
    };
    this.__getObjectUnderPoint = function(point)
    {
        if (this.__rect.containsPoint(point) === false) { return null; }
        if (this.mouseChildren === false) { return this; }
        
        var context = this.__hiddenContext;
        context.clearRect(point.x, point.y, 1, 1);
        context.save();
        context.beginPath();
        context.rect(point.x, point.y, 1, 1);
        context.clip();
        var result = DisplayObjectContainer.prototype.__getObjectUnderPoint.call(this, context, new Matrix(), point);
        context.restore();
        return result || this;
    };
    this.__enterFrame = function()
    {
        //reserve next frame
        var self = this;
        clearTimeout(this.__timer);
        this.__timer = setTimeout(function(){ self.__enterFrame(); }, 1000 / this.__frameRate);
        
        //run user ENTER_FRAME event code
        __applyDown(this, this.dispatchEvent, [new Event(Event.ENTER_FRAME, false, false)]);
        
        this.__updateStage();
    };
    this.__updateStage = function()
    {
        if (!this.__initialized) { return; }
        var context = this.__context;
        var stageRect = this.__rect;
        
        //update the display list
        var redrawRegions;
        if (this.__renderMode == 'all' || this.__renderAll) {
            //force to render the entire stage
            redrawRegions = [stageRect];
        }
        else {
            //update modified objects and collect redraw regions
            this.__updateList(new Matrix());
            redrawRegions = this.__redrawRegions;
            
            if (this.__renderMode == 'auto' && redrawRegions.length > 50) {
                redrawRegions = [stageRect];
            }
        }
        
        if (redrawRegions.length) {
            //begin rendering
            context.save();
            
            //clear the redraw regions and clip for rendering
            context.beginPath();
            for (i = 0, l = redrawRegions.length; i < l; ++i)
            {
                var rect = redrawRegions[i];
                context.clearRect(rect.x, rect.y, rect.width, rect.height);
                context.rect(rect.x, rect.y, rect.width, rect.height);
            }
            context.clip();
            
            this.__renderList(context, new Matrix(), new ColorTransform());
            context.restore();
            
            //catch mouse events
            this.__updateObjectUnderMouse();
            
            //debug
            if (this.showRedrawRegions) {
                context.save();
                context.strokeStyle = "#FF0000";
                context.lineWidth = 1;
                context.beginPath();
                for (i = 0, l = redrawRegions.length; i < l; ++i)
                {
                    rect = redrawRegions[i];
                    context.rect(rect.x, rect.y, rect.width, rect.height);
                }
                context.stroke();
                context.restore();
            }
        }
        
        //clean up
        this.__renderAll = false;
        this.__redrawRegions = [];
    };
    this.__updateObjectUnderMouse = function()
    {
        //NOTE: do not call these events against the stage.
        if (this.__mouseOverStage === false) { return; }
        
        var stage = this;
        var last = (this.__objectUnderMouse !== stage) ? this.__objectUnderMouse : null;
        
        this.__objectUnderMouse = this.__getObjectUnderPoint(new Point(this.__mouseX, this.__mouseY));
        var current = (this.__objectUnderMouse !== stage) ? this.__objectUnderMouse : null;
        
        if (current !== last) {
            if (last) {
                //mouse out
                last.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_OUT, true, false));
                
                //roll out
                var rollOutEvent = new MouseEvent(MouseEvent.ROLL_OUT, false, false);
                if (current) {
                    //parents of "current" don't fire event
                    __applyUp(last, function(current, event)
                    {
                        if (this === current) { return; }
                        if (!(this instanceof DisplayObjectContainer) || !this.contains(current)) {
                            this.dispatchEvent(event);
                        }
                    }, [current, rollOutEvent]);
                }
                else {
                    last.dispatchEvent(rollOutEvent);
                }
                
                //this.__objectUnderMouse = null;
            }
            if (current) {
                //mouse over
                current.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_OVER, true, false));
                
                //roll over
                var rollOverEvent = new MouseEvent(MouseEvent.ROLL_OVER, false, false);
                if (last) {
                    //parents of "last" don't fire event
                    __applyUp(current, function(last, event)
                    {
                        if (this === last) { return; }
                        if (!(this instanceof DisplayObjectContainer) || !this.contains(last)) {
                            this.dispatchEvent(event);
                        }
                    }, [last, rollOverEvent]);
                }
                else {
                    current.dispatchEvent(rollOverEvent);
                }
                
                //this.__objectUnderMouse = current;
            }
        }
        
        //button mode
        //TODO buttonMode should effect children to
        var target = this.__objectUnderMouse;
        if (target && target.buttonMode && target.useHandCursor) {
            this.canvas.style.cursor = 'pointer';
        }
        else {
            this.canvas.style.cursor = 'default';
        }
    };
    this.__resize = function()
    {
        var canvas = this.canvas;
        var clientWidth = canvas.clientWidth;
        var clientHeight = canvas.clientHeight;
        
        if (this.__canvasWidth === clientWidth &&
            this.__canvasHeight === clientHeight) {
            return;
        }
        
        this.__canvasWidth = clientWidth;
        this.__canvasHeight = clientHeight;
        
        if (this.__scaleMode === StageScaleMode.NO_SCALE) {
            this.canvas.width = this.__canvasWidth;
            this.canvas.height = this.__canvasHeight;
            this.__hiddenCanvas.width = this.__canvasWidth;
            this.__hiddenCanvas.height = this.__canvasHeight;
            
            //force top left for now
            this.__rect = new Rectangle(0, 0, this.__canvasWidth, this.__canvasHeight);
            this.dispatchEvent(new Event(Event.RESIZE, false, false));
        }
        else if (this.__scaleMode === StageScaleMode.EXACT_FIT) {
            this.canvas.width = this.__stageWidth;
            this.canvas.height = this.__stageHeight;
            this.__hiddenCanvas.width = this.__stageWidth;
            this.__hiddenCanvas.height = this.__stageHeight;
            this.__scaleX = this.__canvasWidth / this.__stageWidth;
            this.__scaleY = this.__canvasHeight / this.__stageHeight;
            
            this.__rect = new Rectangle(0, 0, this.__stageWidth, this.__stageHeight);
        }
        
        //modifying the canvas size resets the context
        //so we have to redraw the entire stage
        this.__renderAll = true;
    };
    this.renderAll = function()
    {
        this.__renderAll = true;
    };
    this.startDrag = function(target, lockCenter, bounds)
    {
        this.__dragOffsetX = (lockCenter) ? 0 : this.__mouseX - target.x;
        this.__dragOffsetY = (lockCenter) ? 0 : this.__mouseY - target.y;
        this.__dragTarget = target;
        this.__dragBounds = bounds;
    };
    this.stopDrag = function()
    {
        this.__dragOffsetX = 0;
        this.__dragOffsetY = 0;
        this.__dragTarget = null;
        this.__dragBounds = null;
    };
    
    /* getters and setters */
    //override
    this.getMouseX = function()
    {
        return this.__mouseX;
    };
    //override
    this.getMouseY = function()
    {
        return this.__mouseY;
    };
    this.getStageWidth = function()
    {
        return this.__rect.width;
    };
    this.getStageHeight = function()
    {
        return this.__rect.height;
    };
    this.getFrameRate = function()
    {
        return this.__frameRate;
    };
    this.setFrameRate = function(v)
    {
        this.__frameRate = +v || 1;
    };
});
Stage.prototype.__defineGetter__("mouseX", Stage.prototype.getMouseX);
Stage.prototype.__defineGetter__("mouseY", Stage.prototype.getMouseY);
Stage.prototype.__defineGetter__("stageWidth", Stage.prototype.getStageWidth);
Stage.prototype.__defineGetter__("stageHeight", Stage.prototype.getStageHeight);
Stage.prototype.__defineGetter__("frameRate", Stage.prototype.getFrameRate);
Stage.prototype.__defineSetter__("frameRate", Stage.prototype.setFrameRate);
Stage.prototype.toString = function()
{
    return '[object Stage]';
};
