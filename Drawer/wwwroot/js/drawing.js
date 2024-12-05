window.initialize = function (svgElement, dotNetHelper) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = svgElement;
    svg.setAttribute("width", 800);
    svg.setAttribute("height", 600);
    svg.style.border = "1px solid #ccc";
    svg.style.backgroundColor = "#fff";

    let shapes = [];
    let selectedShape = null;
    let isDrawing = false;
    let isMoving = false;
    let isResizing = false;
    let resizeHandleIndex = -1;
    let startX, startY;
    let currentTool;
    let currentColor;
    let currentElement = null;
    let isLocked;
    let selectionBox = null;

    const dotNet = dotNetHelper;

    document.addEventListener("click", (event) => {
        const contextMenu = document.getElementById("context-menu");

        if (contextMenu && !_isClickInsideContextMenu(event)) {
            dotNet.invokeMethodAsync('HideContextMenu');
        }

        const target = event.target;
        const isShape = target.dataset.id && shapes.some(shape => shape.id === target.dataset.id) && Object.values(shapeConfigs).some(config => config.tag === target.tagName.toLowerCase());
        const isResizeHandle = target.classList.contains('resize-handle');

        if (!isShape && !isResizeHandle && !_isClickInsideContextMenu(event)) {
            clearSelection();
        }
    });

    /**
     * Проверяет, был ли клик внутри контекстного меню.
     * @param {Event} event - Событие клика.
     * @returns {boolean} - true, если клик внутри меню, иначе false.
     */
    function _isClickInsideContextMenu(event) {
        const contextMenu = document.getElementById("context-menu");
        if (!contextMenu) return false;
        return contextMenu.contains(event.target);
    }

    /**
     * Генерирует уникальный идентификатор (UUID v4).
     * @returns {string} - Уникальный идентификатор.
     */
    function generateUniqueId() {
        return crypto.randomUUID();
    }

    /**
     * Конфигурационный объект для всех типов фигур.
     */
    const shapeConfigs = {
        rect: {
            tag: 'rect',
            defaultProps: {
                fill: '#0000ff',
                stroke: '#0000ff',
                'stroke-width': 2,
                opacity: 1
            },
            /**
             * Создаёт объект фигуры прямоугольника.
             */
            createShape: (id, x, y, color) => ({
                id,
                type: 'rect',
                x,
                y,
                width: 0,
                height: 0,
                fill: color,
                stroke: color,
                strokeWidth: 2,
                opacity: 1
            }),
            /**
             * Создаёт SVG элемент для прямоугольника.
             */
            createElement: (shape) => {
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', shape.x);
                rect.setAttribute('y', shape.y);
                rect.setAttribute('width', shape.width);
                rect.setAttribute('height', shape.height);
                rect.setAttribute('fill', shape.fill);
                rect.setAttribute('stroke', shape.stroke);
                rect.setAttribute('stroke-width', shape.strokeWidth);
                rect.setAttribute('opacity', shape.opacity);
                rect.dataset.id = shape.id;
                svg.appendChild(rect);
                return rect;
            },
            /**
             * Обновляет свойства SVG элемента прямоугольника.
             */
            updateElement: (element, shape) => {
                element.setAttribute('x', shape.x);
                element.setAttribute('y', shape.y);
                element.setAttribute('width', shape.width);
                element.setAttribute('height', shape.height);
                element.setAttribute('fill', shape.fill);
                element.setAttribute('stroke', shape.stroke);
                element.setAttribute('stroke-width', shape.strokeWidth);
                element.setAttribute('opacity', shape.opacity);
            },
            /**
             * Возвращает позиции ручек изменения размера для прямоугольника.
             */
            getResizeHandles: (shape) => ([
                { x: shape.x, y: shape.y },
                { x: shape.x + shape.width, y: shape.y },
                { x: shape.x, y: shape.y + shape.height },
                { x: shape.x + shape.width, y: shape.y + shape.height }
            ]),
            /**
             * Обновляет свойства прямоугольника при изменении размеров.
             */
            resize: (shape, handleIndex, currentX, currentY, startX, startY) => {
                const dx = currentX - startX;
                const dy = currentY - startY;

                switch (handleIndex) {
                    case "0":
                        shape.x += dx;
                        shape.y += dy;
                        shape.width -= dx;
                        shape.height -= dy;
                        break;
                    case "1":
                        shape.y += dy;
                        shape.width += dx;
                        shape.height -= dy;
                        break;
                    case "2":
                        shape.x += dx;
                        shape.width -= dx;
                        shape.height += dy;
                        break;
                    case "3":
                        shape.width += dx;
                        shape.height += dy;
                        break;
                }

                if (shape.width < 10) {
                    shape.width = 10;
                    if (handleIndex === "0" || handleIndex === "2") {
                        shape.x = shape.x + shape.width - 10;
                    }
                }
                if (shape.height < 10) {
                    shape.height = 10;
                    if (handleIndex === "0" || handleIndex === "1") {
                        shape.y = shape.y + shape.height - 10;
                    }
                }
            },
            /**
             * Обновляет свойства фигуры при рисовании.
             */
            updateShapeOnDraw: (shape, currentX, currentY, startX, startY) => {
                const width = currentX - startX;
                const height = currentY - startY;

                shape.width = Math.abs(width);
                shape.height = Math.abs(height);
                shape.x = width < 0 ? currentX : startX;
                shape.y = height < 0 ? currentY : startY;
            },
            /**
             * Обновляет свойства фигуры при перемещении.
             */
            updateShapeOnMove: (shape, dx, dy) => {
                shape.x += dx;
                shape.y += dy;
            },
            /**
             * Обновляет рамку выделения для прямоугольника.
             */
            updateSelectionBox: (selectionBox, shape) => {
                selectionBox.setAttribute("x", shape.x);
                selectionBox.setAttribute("y", shape.y);
                selectionBox.setAttribute("width", shape.width);
                selectionBox.setAttribute("height", shape.height);
            },
            /**
             * Создаёт рамку выделения для прямоугольника.
             */
            createSelectionBox: (shape) => {
                const box = document.createElementNS(svgNS, 'rect');
                box.setAttribute("x", shape.x);
                box.setAttribute("y", shape.y);
                box.setAttribute("width", shape.width);
                box.setAttribute("height", shape.height);
                box.setAttribute("class", "selection-box");
                box.style.fill = "none";
                box.style.stroke = "blue";
                box.style.strokeDasharray = "4";
                svg.appendChild(box);
                return box;
            },
            /**
             * Обновляет цвет фигуры.
             */
            updateColor: (shape, color) => {
                shape.fill = color;
                shape.stroke = color;
            },
            /**
             * Проверяет, должна ли фигура быть удалена.
             * @param {Object} shape - Фигура для проверки.
             * @returns {boolean} - true, если фигура должна быть удалена, иначе false.
             */
            shouldRemove: (shape) => {
                return shape.width === 0 || shape.height === 0;
            }
        },
        circle: {
            tag: 'circle',
            defaultProps: {
                fill: '#ff0000',
                stroke: '#ff0000',
                'stroke-width': 2,
                opacity: 1
            },
            /**
             * Создаёт объект фигуры круга.
             */
            createShape: (id, x, y, color) => ({
                id,
                type: 'circle',
                cx: x,
                cy: y,
                r: 0,
                fill: color,
                stroke: color,
                strokeWidth: 2,
                opacity: 1
            }),
            /**
             * Создаёт SVG элемент для круга.
             */
            createElement: (shape) => {
                const circle = document.createElementNS(svgNS, 'circle');
                circle.setAttribute('cx', shape.cx);
                circle.setAttribute('cy', shape.cy);
                circle.setAttribute('r', shape.r);
                circle.setAttribute('fill', shape.fill);
                circle.setAttribute('stroke', shape.stroke);
                circle.setAttribute('stroke-width', shape.strokeWidth);
                circle.setAttribute('opacity', shape.opacity);
                circle.dataset.id = shape.id;
                svg.appendChild(circle);
                return circle;
            },
            /**
             * Обновляет свойства SVG элемента круга.
             */
            updateElement: (element, shape) => {
                element.setAttribute('cx', shape.cx);
                element.setAttribute('cy', shape.cy);
                element.setAttribute('r', shape.r);
                element.setAttribute('fill', shape.fill);
                element.setAttribute('stroke', shape.stroke);
                element.setAttribute('stroke-width', shape.strokeWidth);
                element.setAttribute('opacity', shape.opacity);
            },
            /**
             * Возвращает позиции ручек изменения размера для круга.
             */
            getResizeHandles: (shape) => ([
                { x: shape.cx + shape.r, y: shape.cy },
                { x: shape.cx - shape.r, y: shape.cy },
                { x: shape.cx, y: shape.cy + shape.r },
                { x: shape.cx, y: shape.cy - shape.r }
            ]),
            /**
             * Обновляет свойства круга при изменении размеров.
             */
            resize: (shape, handleIndex, currentX, currentY, startX, startY) => {
                const dx = currentX - shape.cx;
                const dy = currentY - shape.cy;
                const newR = Math.sqrt(dx * dx + dy * dy);

                shape.r = Math.max(newR, 10);
            },
            /**
             * Обновляет свойства фигуры при рисовании.
             */
            updateShapeOnDraw: (shape, currentX, currentY, startX, startY) => {
                const dx = currentX - startX;
                const dy = currentY - startY;
                shape.r = Math.sqrt(dx * dx + dy * dy);
                shape.cx = startX;
                shape.cy = startY;
            },
            /**
             * Обновляет свойства фигуры при перемещении.
             */
            updateShapeOnMove: (shape, dx, dy) => {
                shape.cx += dx;
                shape.cy += dy;
            },
            /**
             * Обновляет рамку выделения для круга.
             */
            updateSelectionBox: (selectionBox, shape) => {
                selectionBox.setAttribute("cx", shape.cx);
                selectionBox.setAttribute("cy", shape.cy);
                selectionBox.setAttribute("r", shape.r);
            },
            /**
             * Создаёт рамку выделения для круга.
             */
            createSelectionBox: (shape) => {
                const box = document.createElementNS(svgNS, 'circle');
                box.setAttribute("cx", shape.cx);
                box.setAttribute("cy", shape.cy);
                box.setAttribute("r", shape.r);
                box.setAttribute("class", "selection-box");
                box.style.fill = "none";
                box.style.stroke = "blue";
                box.style.strokeDasharray = "4";
                svg.appendChild(box);
                return box;
            },
            /**
             * Обновляет цвет фигуры.
             */
            updateColor: (shape, color) => {
                shape.fill = color;
                shape.stroke = color;
            },
            /**
             * Проверяет, должна ли фигура быть удалена.
             * @param {Object} shape - Фигура для проверки.
             * @returns {boolean} - true, если фигура должна быть удалена, иначе false.
             */
            shouldRemove: (shape) => {
                return shape.r === 0;
            }
        }
    };

    /**
     * Создаёт ручки для изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function createResizeHandles(shape) {
        removeResizeHandles();

        if (!shape) return;

        const config = shapeConfigs[shape.type];
        if (!config) return;

        const handles = config.getResizeHandles(shape);

        handles.forEach((handle, index) => {
            let handleElement;
            if (config.tag === 'circle') {
                handleElement = document.createElementNS(svgNS, 'circle');
                handleElement.setAttribute('cx', handle.x);
                handleElement.setAttribute('cy', handle.y);
                handleElement.setAttribute('r', 6);
            } else {
                handleElement = document.createElementNS(svgNS, 'rect');
                handleElement.setAttribute('x', handle.x - 4);
                handleElement.setAttribute('y', handle.y - 4);
                handleElement.setAttribute('width', 8);
                handleElement.setAttribute('height', 8);
            }
            handleElement.classList.add('resize-handle');
            handleElement.setAttribute('data-index', index.toString());
            handleElement.style.fill = "white";
            handleElement.style.stroke = "black";
            handleElement.style.cursor = "nwse-resize";
            handleElement.style.pointerEvents = "all";

            handleElement.addEventListener('mousedown', (event) => {
                if (isLocked) return;
                event.stopPropagation();
                isResizing = true;
                resizeHandleIndex = event.currentTarget.getAttribute('data-index');
                const rect = svg.getBoundingClientRect();
                startX = event.clientX - rect.left;
                startY = event.clientY - rect.top;
            });

            svg.appendChild(handleElement);
        });

        const shapeElements = Array.from(svg.querySelectorAll('*')).filter(el => el.dataset.id === shape.id);
        shapeElements.forEach(el => el.classList.add("selected"));

        selectedShape = shape;
    }

    /**
     * Удаляет все существующие ручки изменения размера.
     */
    function removeResizeHandles() {
        const handles = svg.querySelectorAll('.resize-handle');
        handles.forEach(handle => handle.remove());
    }

    /**
     * Обновляет позиции ручек изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function updateResizeHandles(shape) {
        if (!shape || !selectionBox) return;

        const config = shapeConfigs[shape.type];
        if (!config) return;

        const handles = config.getResizeHandles(shape);
        const handleElements = svg.querySelectorAll('.resize-handle');

        handleElements.forEach((handleElement, index) => {
            const handle = handles[index];
            if (config.tag === 'circle') {
                handleElement.setAttribute('cx', handle.x);
                handleElement.setAttribute('cy', handle.y);
            } else {
                handleElement.setAttribute('x', handle.x - 4);
                handleElement.setAttribute('y', handle.y - 4);
            }
        });
    }

    /**
     * Очищает текущий выбор и удаляет рамку выделения.
     */
    function clearSelection() {
        selectedShape = null;
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
        removeResizeHandles();
        shapes.forEach(shape => {
            const shapeElements = Array.from(svg.querySelectorAll('*')).filter(el => el.dataset.id === shape.id);
            shapeElements.forEach(el => el.classList.remove("selected"));
        });

        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });

        dotNet.invokeMethodAsync('UpdateJson', JSON.stringify(dataOnlyShapes, null, 2));
    }

    /**
     * Выбирает фигуру и отображает рамку выделения.
     * @param {Object} shape - Фигура для выбора.
     */
    function selectShape(shape) {
        if (isLocked) return;

        clearSelection();
        selectedShape = shape;

        const config = shapeConfigs[shape.type];
        if (!config) return;

        selectionBox = config.createSelectionBox(shape);

        createResizeHandles(shape);
    }

    /**
     * Удаляет фигуру из SVG и массива фигур.
     * @param {string} shapeId - Уникальный идентификатор фигуры для удаления.
     */
    window.deleteShape = function (shapeId) {
        if (!shapeId) {
            return;
        }

        const shapeIndex = shapes.findIndex(s => s.id === shapeId);
        if (shapeIndex === -1) {
            return;
        }

        const shape = shapes[shapeIndex];
        const config = shapeConfigs[shape.type];
        if (!config) {
            return;
        }

        const shapeElements = Array.from(svg.querySelectorAll('*')).filter(el => el.dataset.id === shape.id);
        shapeElements.forEach(el => el.remove());

        shapes.splice(shapeIndex, 1);
        clearSelection();
        updateJson();
    }

    /**
     * Устанавливает текущий цвет для рисования.
     * @param {string} color - Код цвета.
     */
    window.setColor = function (color) {
        currentColor = color;

        if (currentElement) {
            const shapeId = currentElement.dataset.id;
            const shape = shapes.find(s => s.id === shapeId);
            if (shape) {
                shapeConfigs[shape.type].updateColor(shape, color);
                shapeConfigs[shape.type].updateElement(shape.element, shape);
                updateJson();
            }
        }
    }

    /**
     * Устанавливает текущий инструмент для рисования.
     * @param {string} tool - Название инструмента.
     */
    window.setTool = function (tool) {
        currentTool = tool;
    }

    /**
     * Возвращает текущие фигуры в формате JSON.
     * @returns {string} - JSON строка с фигурами.
     */
    window.getShapes = function () {
        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });
        return JSON.stringify(dataOnlyShapes, null, 2);
    }

    /**
     * Устанавливает состояние блокировки для предотвращения взаимодействий.
     * @param {boolean} lockState - true для блокировки, false для разблокировки.
     */
    window.setLock = function (lockState) {
        isLocked = lockState;

        if (isLocked) {
            svg.style.cursor = "not-allowed";
            svg.style.pointerEvents = "none";
        } else {
            svg.style.cursor = "default";
            svg.style.pointerEvents = "all";
        }

        if (isLocked) {
            clearSelection();
        }
    }

    /**
     * Обновляет SVG на основе переданного JSON.
     * @param {string} json - JSON строка с фигурами.
     */
    window.updateShapesFromJson = function (json) {
        try {
            const shapesData = json && json.trim() !== "" ? JSON.parse(json) : [];

            if (!Array.isArray(shapesData)) {
                console.error("JSON не является массивом фигур.");
                return;
            }

            shapes.forEach(shape => {
                const config = shapeConfigs[shape.type];
                if (config) {
                    const shapeElements = Array.from(svg.querySelectorAll('*')).filter(el => el.dataset.id === shape.id);
                    shapeElements.forEach(el => el.remove());
                }
            });
            shapes = [];

            shapesData.forEach(shapeData => {
                const config = shapeConfigs[shapeData.type];
                if (config) {
                    const newShape = config.createShape(
                        shapeData.id,
                        shapeData.x !== undefined ? shapeData.x : (shapeData.cx || 0),
                        shapeData.y !== undefined ? shapeData.y : (shapeData.cy || 0),
                        shapeData.fill || config.defaultProps.fill
                    );

                    Object.assign(newShape, shapeData);

                    newShape.element = config.createElement(newShape);

                    shapes.push(newShape);
                }
            });

            clearSelection();
        } catch (error) {
            console.error("Не удалось обновить фигуры из JSON:", error);
        }
    }

    /**
     * Обновляет JSON представление фигур и отправляет его в Blazor.
     */
    window.updateJson = function () {
        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });
        const json = JSON.stringify(dataOnlyShapes, null, 2);

        dotNet.invokeMethodAsync('UpdateJson', json);
    }

    /**
     * Обрабатывает событие mousedown на SVG.
     */
    svg.addEventListener("mousedown", (event) => {
        if (isLocked) return;
        if (isResizing) return;

        event.preventDefault();

        if (event.button !== 0) return;

        const rect = svg.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const target = event.target;
        const shapeId = target.dataset.id;

        if (shapeId) {
            const shape = shapes.find(s => s.id === shapeId);
            if (shape) {
                selectShape(shape);
                isMoving = true;
                startX = x;
                startY = y;

                dotNet.invokeMethodAsync('HideContextMenu');
            }
            return;
        }

        isDrawing = true;
        startX = x;
        startY = y;

        const id = generateUniqueId();
        const newShape = shapeConfigs[currentTool].createShape(id, x, y, currentColor);
        shapes.push(newShape);

        newShape.element = shapeConfigs[currentTool].createElement(newShape);
        currentElement = newShape.element;
    });

    /**
     * Обрабатывает событие mousemove глобально.
     */
    window.addEventListener("mousemove", (event) => {
        if (isLocked) return;

        const rect = svg.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;

        if (isDrawing && currentElement) {
            const shape = shapes[shapes.length - 1];
            const config = shapeConfigs[shape.type];
            if (!config) {
                return;
            }

            config.updateShapeOnDraw(shape, currentX, currentY, startX, startY);
            config.updateElement(shape.element, shape);
            updateJson();
        }

        if (isMoving && selectedShape) {
            const dx = currentX - startX;
            const dy = currentY - startY;

            const config = shapeConfigs[selectedShape.type];
            if (!config) {
                return;
            }

            config.updateShapeOnMove(selectedShape, dx, dy);
            config.updateElement(selectedShape.element, selectedShape);

            if (selectionBox) {
                config.updateSelectionBox(selectionBox, selectedShape);
            }

            updateResizeHandles(selectedShape);

            startX = currentX;
            startY = currentY;

            updateJson();
        }

        if (isResizing && selectedShape) {
            const config = shapeConfigs[selectedShape.type];
            if (!config) {
                return;
            }

            config.resize(selectedShape, resizeHandleIndex, currentX, currentY, startX, startY);

            config.updateElement(selectedShape.element, selectedShape);

            if (selectionBox) {
                config.updateSelectionBox(selectionBox, selectedShape);
            }

            updateResizeHandles(selectedShape);

            startX = currentX;
            startY = currentY;

            updateJson();
        }
    });

    /**
     * Обрабатывает событие mouseup глобально.
     */
    window.addEventListener("mouseup", () => {
        if (isLocked) return;

        if (isDrawing) {
            isDrawing = false;

            const lastShape = shapes[shapes.length - 1];
            let shouldRemove = false;

            if (lastShape) {
                const config = shapeConfigs[lastShape.type];
                if (config && config.shouldRemove(lastShape)) {
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                shapes.pop();

                if (lastShape.element) {
                    lastShape.element.remove();
                }

                updateJson();
            } else {
                updateJson();
            }
        }

        if (isMoving) {
            isMoving = false;
            updateJson();
        }

        if (isResizing) {
            isResizing = false;
            updateJson();
        }
    });

    /**
     * Обрабатывает событие contextmenu (правый клик) на SVG.
     */
    svg.addEventListener("contextmenu", (event) => {
        if (isLocked) return;

        event.preventDefault();

        const rect = svg.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const target = event.target;
        const shapeId = target.dataset.id;

        if (shapeId) {
            const shape = shapes.find(s => s.id === shapeId);
            if (shape) {
                selectShape(shape);
                dotNet.invokeMethodAsync('OnShapeRightClicked', x, y, shape.id);
            }
        } else {
            clearSelection();
        }
    });
};

/**
 * Обновленные методы resize в shapeConfigs
 */
const shapeConfigs = {
    rect: {
        tag: 'rect',
        defaultProps: {
            fill: '#0000ff',
            stroke: '#0000ff',
            'stroke-width': 2,
            opacity: 1
        },
        /**
         * Создаёт объект фигуры прямоугольника.
         */
        createShape: (id, x, y, color) => ({
            id,
            type: 'rect',
            x,
            y,
            width: 0,
            height: 0,
            fill: color,
            stroke: color,
            strokeWidth: 2,
            opacity: 1
        }),
        /**
         * Создаёт SVG элемент для прямоугольника.
         */
        createElement: (shape) => {
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', shape.x);
            rect.setAttribute('y', shape.y);
            rect.setAttribute('width', shape.width);
            rect.setAttribute('height', shape.height);
            rect.setAttribute('fill', shape.fill);
            rect.setAttribute('stroke', shape.stroke);
            rect.setAttribute('stroke-width', shape.strokeWidth);
            rect.setAttribute('opacity', shape.opacity);
            rect.dataset.id = shape.id;
            svg.appendChild(rect);
            return rect;
        },
        /**
         * Обновляет свойства SVG элемента прямоугольника.
         */
        updateElement: (element, shape) => {
            element.setAttribute('x', shape.x);
            element.setAttribute('y', shape.y);
            element.setAttribute('width', shape.width);
            element.setAttribute('height', shape.height);
            element.setAttribute('fill', shape.fill);
            element.setAttribute('stroke', shape.stroke);
            element.setAttribute('stroke-width', shape.strokeWidth);
            element.setAttribute('opacity', shape.opacity);
        },
        /**
         * Возвращает позиции ручек изменения размера для прямоугольника.
         */
        getResizeHandles: (shape) => ([
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x, y: shape.y + shape.height },
            { x: shape.x + shape.width, y: shape.y + shape.height }
        ]),
        /**
         * Обновляет свойства прямоугольника при изменении размеров.
         */
        resize: (shape, handleIndex, currentX, currentY, startX, startY) => {
            const dx = currentX - startX;
            const dy = currentY - startY;

            switch (handleIndex) {
                case "0":
                    shape.x += dx;
                    shape.y += dy;
                    shape.width -= dx;
                    shape.height -= dy;
                    break;
                case "1":
                    shape.y += dy;
                    shape.width += dx;
                    shape.height -= dy;
                    break;
                case "2":
                    shape.x += dx;
                    shape.width -= dx;
                    shape.height += dy;
                    break;
                case "3":
                    shape.width += dx;
                    shape.height += dy;
                    break;
            }

            if (shape.width < 10) {
                shape.width = 10;
                if (handleIndex === "0" || handleIndex === "2") {
                    shape.x = shape.x + shape.width - 10;
                }
            }
            if (shape.height < 10) {
                shape.height = 10;
                if (handleIndex === "0" || handleIndex === "1") {
                    shape.y = shape.y + shape.height - 10;
                }
            }
        },
        /**
         * Обновляет свойства фигуры при рисовании.
         */
        updateShapeOnDraw: (shape, currentX, currentY, startX, startY) => {
            const width = currentX - startX;
            const height = currentY - startY;

            shape.width = Math.abs(width);
            shape.height = Math.abs(height);
            shape.x = width < 0 ? currentX : startX;
            shape.y = height < 0 ? currentY : startY;
        },
        /**
         * Обновляет свойства фигуры при перемещении.
         */
        updateShapeOnMove: (shape, dx, dy) => {
            shape.x += dx;
            shape.y += dy;
        },
        /**
         * Обновляет рамку выделения для прямоугольника.
         */
        updateSelectionBox: (selectionBox, shape) => {
            selectionBox.setAttribute("x", shape.x);
            selectionBox.setAttribute("y", shape.y);
            selectionBox.setAttribute("width", shape.width);
            selectionBox.setAttribute("height", shape.height);
        },
        /**
         * Создаёт рамку выделения для прямоугольника.
         */
        createSelectionBox: (shape) => {
            const box = document.createElementNS(svgNS, 'rect');
            box.setAttribute("x", shape.x);
            box.setAttribute("y", shape.y);
            box.setAttribute("width", shape.width);
            box.setAttribute("height", shape.height);
            box.setAttribute("class", "selection-box");
            box.style.fill = "none";
            box.style.stroke = "blue";
            box.style.strokeDasharray = "4";
            svg.appendChild(box);
            return box;
        },
        /**
         * Обновляет цвет фигуры.
         */
        updateColor: (shape, color) => {
            shape.fill = color;
            shape.stroke = color;
        },
        /**
         * Проверяет, должна ли фигура быть удалена.
         * @param {Object} shape - Фигура для проверки.
         * @returns {boolean} - true, если фигура должна быть удалена, иначе false.
         */
        shouldRemove: (shape) => {
            return shape.width === 0 || shape.height === 0;
        }
    },
    circle: {
        tag: 'circle',
        defaultProps: {
            fill: '#ff0000',
            stroke: '#ff0000',
            'stroke-width': 2,
            opacity: 1
        },
        /**
         * Создаёт объект фигуры круга.
         */
        createShape: (id, x, y, color) => ({
            id,
            type: 'circle',
            cx: x,
            cy: y,
            r: 0,
            fill: color,
            stroke: color,
            strokeWidth: 2,
            opacity: 1
        }),
        /**
         * Создаёт SVG элемент для круга.
         */
        createElement: (shape) => {
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', shape.cx);
            circle.setAttribute('cy', shape.cy);
            circle.setAttribute('r', shape.r);
            circle.setAttribute('fill', shape.fill);
            circle.setAttribute('stroke', shape.stroke);
            circle.setAttribute('stroke-width', shape.strokeWidth);
            circle.setAttribute('opacity', shape.opacity);
            circle.dataset.id = shape.id;
            svg.appendChild(circle);
            return circle;
        },
        /**
         * Обновляет свойства SVG элемента круга.
         */
        updateElement: (element, shape) => {
            element.setAttribute('cx', shape.cx);
            element.setAttribute('cy', shape.cy);
            element.setAttribute('r', shape.r);
            element.setAttribute('fill', shape.fill);
            element.setAttribute('stroke', shape.stroke);
            element.setAttribute('stroke-width', shape.strokeWidth);
            element.setAttribute('opacity', shape.opacity);
        },
        /**
         * Возвращает позиции ручек изменения размера для круга.
         */
        getResizeHandles: (shape) => ([
            { x: shape.cx + shape.r, y: shape.cy },
            { x: shape.cx - shape.r, y: shape.cy },
            { x: shape.cx, y: shape.cy + shape.r },
            { x: shape.cx, y: shape.cy - shape.r }
        ]),
        /**
         * Обновляет свойства круга при изменении размеров.
         */
        resize: (shape, handleIndex, currentX, currentY, startX, startY) => {
            const dx = currentX - shape.cx;
            const dy = currentY - shape.cy;
            const newR = Math.sqrt(dx * dx + dy * dy);

            shape.r = Math.max(newR, 10);
        },
        /**
         * Обновляет свойства фигуры при рисовании.
         */
        updateShapeOnDraw: (shape, currentX, currentY, startX, startY) => {
            const dx = currentX - startX;
            const dy = currentY - startY;
            shape.r = Math.sqrt(dx * dx + dy * dy);
            shape.cx = startX;
            shape.cy = startY;
        },
        /**
         * Обновляет свойства фигуры при перемещении.
         */
        updateShapeOnMove: (shape, dx, dy) => {
            shape.cx += dx;
            shape.cy += dy;
        },
        /**
         * Обновляет рамку выделения для круга.
         */
        updateSelectionBox: (selectionBox, shape) => {
            selectionBox.setAttribute("cx", shape.cx);
            selectionBox.setAttribute("cy", shape.cy);
            selectionBox.setAttribute("r", shape.r);
        },
        /**
         * Создаёт рамку выделения для круга.
         */
        createSelectionBox: (shape) => {
            const box = document.createElementNS(svgNS, 'circle');
            box.setAttribute("cx", shape.cx);
            box.setAttribute("cy", shape.cy);
            box.setAttribute("r", shape.r);
            box.setAttribute("class", "selection-box");
            box.style.fill = "none";
            box.style.stroke = "blue";
            box.style.strokeDasharray = "4";
            svg.appendChild(box);
            return box;
        },
        /**
         * Обновляет цвет фигуры.
         */
        updateColor: (shape, color) => {
            shape.fill = color;
            shape.stroke = color;
        },
        /**
         * Проверяет, должна ли фигура быть удалена.
         * @param {Object} shape - Фигура для проверки.
         * @returns {boolean} - true, если фигура должна быть удалена, иначе false.
         */
        shouldRemove: (shape) => {
            return shape.r === 0;
        }
    }
};
