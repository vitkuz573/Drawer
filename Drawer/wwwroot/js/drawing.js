window.initialize = function (svgElement, dotNetHelper) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = svgElement;
    svg.setAttribute("width", 800);
    svg.setAttribute("height", 600);
    svg.style.border = "1px solid #ccc";
    svg.style.backgroundColor = "#fff";

    let shapes = [];
    let selectedShapes = [];
    let isDrawing = false;
    let isMoving = false;
    let isResizing = false;
    let isSelecting = false;
    let resizeHandleIndex = -1;
    let selectionStartX, selectionStartY;
    let selectionRect = null;
    let selectionDragRect = null;
    let currentTool;
    let currentColor;
    let currentElement = null;
    let isLocked;
    let startX = 0, startY = 0;
    let resizeStartX = 0, resizeStartY = 0;

    const dotNet = dotNetHelper;

    /**
     * Генерирует уникальный идентификатор (UUID v4).
     * @returns {string} Уникальный UUID.
     */
    function generateUniqueId() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        } else {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
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
             * Создаёт ручку изменения размера для прямоугольника.
             */
            createResizeHandle: (handle, index) => {
                const handleElement = document.createElementNS(svgNS, 'rect');
                handleElement.setAttribute('x', handle.x - 4);
                handleElement.setAttribute('y', handle.y - 4);
                handleElement.setAttribute('width', 8);
                handleElement.setAttribute('height', 8);
                handleElement.setAttribute('fill', 'white');
                handleElement.setAttribute('stroke', 'black');
                handleElement.setAttribute('stroke-width', 1);
                handleElement.setAttribute('data-index', index.toString());
                handleElement.classList.add('resize-handle');
                handleElement.style.cursor = "nwse-resize";
                return handleElement;
            },
            /**
             * Обновляет свойства прямоугольника при изменении размеров.
             */
            resize: (shape, handleIndex, currentX, currentY, startX, startY) => {
                let newX = shape.x;
                let newY = shape.y;
                let newWidth = shape.width;
                let newHeight = shape.height;

                switch (handleIndex) {
                    case "0":
                        newX = currentX;
                        newY = currentY;
                        newWidth = shape.x + shape.width - currentX;
                        newHeight = shape.y + shape.height - currentY;
                        break;
                    case "1":
                        newY = currentY;
                        newWidth = currentX - shape.x;
                        newHeight = shape.y + shape.height - currentY;
                        break;
                    case "2":
                        newX = currentX;
                        newWidth = shape.x + shape.width - currentX;
                        newHeight = currentY - shape.y;
                        break;
                    case "3":
                        newWidth = currentX - shape.x;
                        newHeight = currentY - shape.y;
                        break;
                }

                if (newWidth < 10) {
                    if (handleIndex === "0" || handleIndex === "2") {
                        newX -= (10 - newWidth);
                    }
                    newWidth = 10;
                }

                if (newHeight < 10) {
                    if (handleIndex === "0" || handleIndex === "1") {
                        newY -= (10 - newHeight);
                    }
                    newHeight = 10;
                }

                shape.x = newX;
                shape.y = newY;
                shape.width = newWidth;
                shape.height = newHeight;
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
                if (shape.type === 'rect') {
                    shape.x += dx;
                    shape.y += dy;
                }
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
             * Создаёт ручку изменения размера для круга.
             */
            createResizeHandle: (handle, index) => {
                const handleElement = document.createElementNS(svgNS, 'circle');
                handleElement.setAttribute('cx', handle.x);
                handleElement.setAttribute('cy', handle.y);
                handleElement.setAttribute('r', 6);
                handleElement.setAttribute('fill', 'white');
                handleElement.setAttribute('stroke', 'black');
                handleElement.setAttribute('stroke-width', 1);
                handleElement.setAttribute('data-index', index.toString());
                handleElement.classList.add('resize-handle');
                handleElement.style.cursor = "nwse-resize";
                return handleElement;
            },
            /**
             * Обновляет свойства круга при изменении размеров.
             */
            resize: (shape, handleIndex, currentX, currentY, startX, startY) => {
                let newR;

                switch (handleIndex) {
                    case "0": // Восток
                    case "1": // Запад
                        newR = Math.abs(currentX - shape.cx);
                        break;
                    case "2": // Юг
                    case "3": // Север
                        newR = Math.abs(currentY - shape.cy);
                        break;
                    default:
                        newR = Math.sqrt((currentX - shape.cx) ** 2 + (currentY - shape.cy) ** 2);
                }

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
             * Обновляет цвет фигуры.
             */
            updateColor: (shape, color) => {
                shape.fill = color;
                shape.stroke = color;
            },
            /**
             * Проверяет, должна ли фигура быть удалена.
             */
            shouldRemove: (shape) => {
                return shape.r === 0;
            }
        }
    };

    /**
    * Создаёт рамку выделения, охватывающую все выбранные фигуры.
    * @param {Array} shapes - Массив выбранных фигур.
    * @returns {Object} Объект с координатами и размерами рамки.
    */
    function getShapesBoundingBox(shapes) {
        if (shapes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        shapes.forEach(shape => {
            if (shape.type === 'rect') {
                minX = Math.min(minX, shape.x);
                minY = Math.min(minY, shape.y);
                maxX = Math.max(maxX, shape.x + shape.width);
                maxY = Math.max(maxY, shape.y + shape.height);
            } else if (shape.type === 'circle') {
                minX = Math.min(minX, shape.cx - shape.r);
                minY = Math.min(minY, shape.cy - shape.r);
                maxX = Math.max(maxX, shape.cx + shape.r);
                maxY = Math.max(maxY, shape.cy + shape.r);
            }
        });

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * Создаёт ручки для изменения размеров выбранных фигур и управляет рамкой выделения.
     * @param {Array} shapes - Массив выбранных фигур.
     */
    function createResizeHandles(shapes) {
        console.log("Creating resize handles for shapes:", shapes);
        removeResizeHandles();

        // Удаляем любые существующие selection-box элементы
        const existingSelectionBoxes = svg.querySelectorAll('rect.selection-box');
        existingSelectionBoxes.forEach(box => box.remove());

        if (!shapes || shapes.length === 0) return;

        const shape = shapes[0];
        const config = shapeConfigs[shape.type];
        if (!config) return;

        if (shapes.length === 1) { // Создаём ручки только для одной фигуры
            const handles = config.getResizeHandles(shape);

            handles.forEach((handle, index) => {
                const handleElement = config.createResizeHandle(handle, index);

                handleElement.addEventListener('mousedown', (event) => {
                    if (isLocked) return;
                    event.stopPropagation();
                    isResizing = true;
                    resizeHandleIndex = event.currentTarget.getAttribute('data-index');
                    const rect = svg.getBoundingClientRect();
                    resizeStartX = event.clientX - rect.left;
                    resizeStartY = event.clientY - rect.top;
                });

                svg.appendChild(handleElement);
            });
        }

        shapes.forEach(shape => {
            const shapeElements = Array.from(svg.querySelectorAll('*')).filter(el => el.dataset.id === shape.id);
            shapeElements.forEach(el => el.classList.add("selected"));
        });

        // Управление selectionBox вне shapeConfigs
        if (selectionRect) {
            const bounds = getShapesBoundingBox(shapes);
            console.log("Updating selectionBox to bounds:", bounds);
            selectionRect.setAttribute("x", bounds.x);
            selectionRect.setAttribute("y", bounds.y);
            selectionRect.setAttribute("width", bounds.width);
            selectionRect.setAttribute("height", bounds.height);
        } else {
            selectionRect = document.createElementNS(svgNS, 'rect');
            const bounds = getShapesBoundingBox(shapes);
            console.log("Creating new selectionBox with bounds:", bounds);
            selectionRect.setAttribute("x", bounds.x);
            selectionRect.setAttribute("y", bounds.y);
            selectionRect.setAttribute("width", bounds.width);
            selectionRect.setAttribute("height", bounds.height);
            selectionRect.setAttribute("class", "selection-box");
            selectionRect.style.fill = "rgba(0, 120, 215, 0.3)";
            selectionRect.style.stroke = "blue";
            selectionRect.style.strokeDasharray = "4";
            selectionRect.style.pointerEvents = "none";
            svg.appendChild(selectionRect);
        }
    }

    /**
     * Удаляет все существующие ручки изменения размера.
     */
    function removeResizeHandles() {
        const handles = svg.querySelectorAll('.resize-handle');
        handles.forEach(handle => handle.remove());
    }

    /**
     * Очищает текущий выбор и удаляет рамки выделения.
     */
    function clearSelection() {
        console.log("Clearing selection");
        selectedShapes = [];

        // Удаляем selectionBox
        if (selectionRect) {
            selectionRect.remove();
            selectionRect = null;
        }

        // Удаляем все selectionDragRect элементы
        const existingDragBoxes = svg.querySelectorAll('rect.selection-drag-box');
        existingDragBoxes.forEach(box => box.remove());
        selectionDragRect = null;

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
     * Выбирает фигуры и отображает рамку выделения.
     * @param {Array} shapes - Массив фигур для выбора.
     */
    function selectShapes(shapes) {
        console.log("Selecting shapes:", shapes);
        if (isLocked) return;

        clearSelection();
        selectedShapes = shapes;

        if (selectedShapes.length === 0) return;

        const config = shapeConfigs[selectedShapes[0].type];
        if (!config) return;

        createResizeHandles(selectedShapes);
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
     * Удаляет несколько фигур из SVG и массива фигур.
     * @param {Array} shapeIds - Массив уникальных идентификаторов фигур для удаления.
     */
    window.deleteSelectedShapes = function (shapeIds) {
        if (!shapeIds || shapeIds.length === 0) {
            return;
        }

        shapeIds.forEach(shapeId => {
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
        });

        clearSelection();
        updateJson();
    }

    /**
     * Устанавливает текущий цвет для рисования.
     * @param {string} color - Новый цвет заливки.
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
     * @param {string} tool - Название инструмента (например, 'rect', 'circle', 'select').
     */
    window.setTool = function (tool) {
        if (shapeConfigs[tool] || tool === 'select') {
            currentTool = tool;
        } else {
            console.warn(`Инструмент "${tool}" не поддерживается.`);
        }

        if (currentTool !== 'select') {
            clearSelection();
        }
    }

    /**
     * Возвращает текущие фигуры в формате JSON.
     * @returns {string} JSON строка с данными фигур.
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
     * @param {boolean} lockState - Состояние блокировки (true - заблокировано, false - разблокировано).
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
     * @param {string} json - JSON строка с данными фигур.
     */
    window.updateShapesFromJson = function (json) {
        try {
            const shapesData = json && json.trim() !== "" ? JSON.parse(json) : [];

            if (!Array.isArray(shapesData)) {
                console.error("JSON не является массивом фигур.");
                return;
            }

            // Удаляем все текущие фигуры
            shapes.forEach(shape => {
                const shapeElements = Array.from(svg.querySelectorAll('*')).filter(el => el.dataset.id === shape.id);
                shapeElements.forEach(el => el.remove());
            });
            shapes = [];

            // Создаём новые фигуры из JSON
            shapesData.forEach(shapeData => {
                const config = shapeConfigs[shapeData.type];
                if (config) {
                    const newShape = config.createShape(
                        shapeData.id || generateUniqueId(),
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
     * @param {MouseEvent} event - Событие мыши.
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
                if (currentTool === 'select') {
                    const isShiftPressed = event.shiftKey;

                    if (isShiftPressed) {
                        if (selectedShapes.includes(shape)) {
                            selectedShapes = selectedShapes.filter(s => s.id !== shape.id);
                        } else {
                            selectedShapes.push(shape);
                        }
                    } else {
                        selectShapes([shape]);
                    }

                    if (selectedShapes.length > 0) {
                        isMoving = true;
                        startX = x;
                        startY = y;

                        dotNet.invokeMethodAsync('HideContextMenu');
                    }
                }
                return;
            }
        }

        if (currentTool === 'select') {
            isSelecting = true;
            selectionStartX = x;
            selectionStartY = y;

            // Удаляем любые существующие selectionDragRect
            const existingDragBoxes = svg.querySelectorAll('rect.selection-drag-box');
            existingDragBoxes.forEach(box => box.remove());

            // Создаём selectionDragRect
            selectionDragRect = document.createElementNS(svgNS, 'rect');
            selectionDragRect.setAttribute("x", x);
            selectionDragRect.setAttribute("y", y);
            selectionDragRect.setAttribute("width", 0);
            selectionDragRect.setAttribute("height", 0);
            selectionDragRect.setAttribute("class", "selection-drag-box");
            selectionDragRect.style.fill = "rgba(0, 120, 215, 0.3)";
            selectionDragRect.style.stroke = "blue";
            selectionDragRect.style.strokeDasharray = "4";
            selectionDragRect.style.pointerEvents = "none";
            svg.appendChild(selectionDragRect);
        } else {
            isDrawing = true;

            let newShape;
            if (currentTool === 'rect') {
                newShape = shapeConfigs.rect.createShape(generateUniqueId(), x, y, currentColor);
            } else if (currentTool === 'circle') {
                newShape = shapeConfigs.circle.createShape(generateUniqueId(), x, y, currentColor);
            } else {
                return;
            }

            shapes.push(newShape);
            newShape.element = shapeConfigs[newShape.type].createElement(newShape);
            currentElement = newShape.element;
        }
    });

    /**
     * Обрабатывает событие mousemove глобально.
     * @param {MouseEvent} event - Событие мыши.
     */
    window.addEventListener("mousemove", (event) => {
        if (isLocked) return;

        const rect = svg.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;

        if (isSelecting && selectionDragRect) {
            const width = currentX - selectionStartX;
            const height = currentY - selectionStartY;

            selectionDragRect.setAttribute("x", width < 0 ? currentX : selectionStartX);
            selectionDragRect.setAttribute("y", height < 0 ? currentY : selectionStartY);
            selectionDragRect.setAttribute("width", Math.abs(width));
            selectionDragRect.setAttribute("height", Math.abs(height));

            return;
        }

        if (isDrawing && currentElement) {
            const shape = shapes[shapes.length - 1];
            const config = shapeConfigs[shape.type];
            if (!config) {
                return;
            }

            let startXCoord, startYCoord;
            if (shape.type === 'rect') {
                startXCoord = shape.x;
                startYCoord = shape.y;
            } else if (shape.type === 'circle') {
                startXCoord = shape.cx;
                startYCoord = shape.cy;
            }

            config.updateShapeOnDraw(shape, currentX, currentY, startXCoord, startYCoord);
            config.updateElement(shape.element, shape);
            updateJson();
        }

        if (isMoving && selectedShapes.length > 0) {
            const dx = currentX - startX;
            const dy = currentY - startY;

            selectedShapes.forEach(shape => {
                const config = shapeConfigs[shape.type];
                if (!config) return;

                config.updateShapeOnMove(shape, dx, dy);
                config.updateElement(shape.element, shape);
            });

            createResizeHandles(selectedShapes); // Обновляем рамку и ручки

            startX = currentX;
            startY = currentY;

            updateJson();
        }

        if (isResizing && selectedShapes.length === 1) {
            const shape = selectedShapes[0];
            const config = shapeConfigs[shape.type];
            if (!config) {
                return;
            }

            config.resize(shape, resizeHandleIndex, currentX, currentY, resizeStartX, resizeStartY);
            config.updateElement(shape.element, shape);

            if (selectionRect) {
                const bounds = getShapesBoundingBox(selectedShapes);
                console.log("Updating selectionBox during resizing to bounds:", bounds);
                selectionRect.setAttribute("x", bounds.x);
                selectionRect.setAttribute("y", bounds.y);
                selectionRect.setAttribute("width", bounds.width);
                selectionRect.setAttribute("height", bounds.height);
            }

            createResizeHandles(selectedShapes); // Обновляем рамку и ручки

            updateJson();
        }
    });

    /**
     * Обрабатывает событие mouseup глобально.
     */
    window.addEventListener("mouseup", () => {
        if (isLocked) return;

        if (isSelecting && selectionDragRect) {
            isSelecting = false;

            const rect = {
                x: parseFloat(selectionDragRect.getAttribute("x")),
                y: parseFloat(selectionDragRect.getAttribute("y")),
                width: parseFloat(selectionDragRect.getAttribute("width")),
                height: parseFloat(selectionDragRect.getAttribute("height"))
            };

            const newlySelectedShapes = shapes.filter(shape => {
                if (shape.type === 'rect') {
                    return (
                        shape.x < rect.x + rect.width &&
                        shape.x + shape.width > rect.x &&
                        shape.y < rect.y + rect.height &&
                        shape.y + shape.height > rect.y
                    );
                } else if (shape.type === 'circle') {
                    const distX = Math.max(rect.x, Math.min(shape.cx, rect.x + rect.width));
                    const distY = Math.max(rect.y, Math.min(shape.cy, rect.y + rect.height));
                    const distance = Math.sqrt((shape.cx - distX) ** 2 + (shape.cy - distY) ** 2);
                    return distance < shape.r;
                }
                return false;
            });

            if (newlySelectedShapes.length > 0) {
                selectShapes(newlySelectedShapes);
                const existingDragBoxes = svg.querySelectorAll('rect.selection-drag-box');
                existingDragBoxes.forEach(box => box.remove());
                selectionDragRect = null;
            } else {
                clearSelection();
            }

            return;
        }

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
     * @param {MouseEvent} event - Событие мыши.
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
                if (currentTool === 'select') {
                    if (!selectedShapes.includes(shape)) {
                        selectShapes([shape]);
                    }
                }
                dotNet.invokeMethodAsync('OnShapeRightClicked', x, y, shape.id);
            }
        } else {
            clearSelection();
        }
    });

    /**
     * Обработчик кликов по документу для скрытия контекстного меню при клике вне его.
     * @param {MouseEvent} event - Событие мыши.
     */
    document.addEventListener("click", (event) => {
        const contextMenu = document.getElementById("context-menu");

        if (contextMenu && !_isClickInsideContextMenu(event)) {
            dotNet.invokeMethodAsync('HideContextMenu');
        }

        const target = event.target;
        const isShape = target.dataset.id &&
            shapes.some(shape => shape.id === target.dataset.id) &&
            Object.values(shapeConfigs).some(config => config.tag === target.tagName.toLowerCase());
        const isResizeHandle = target.classList.contains('resize-handle');

        if (!isShape && !isResizeHandle && !_isClickInsideContextMenu(event)) {
            clearSelection();
        }
    });

    /**
     * Проверяет, был ли клик внутри контекстного меню.
     * @param {MouseEvent} event - Событие мыши.
     * @returns {boolean} True, если клик был внутри контекстного меню, иначе False.
     */
    function _isClickInsideContextMenu(event) {
        const contextMenu = document.getElementById("context-menu");
        if (!contextMenu) return false;
        return contextMenu.contains(event.target);
    }
};
