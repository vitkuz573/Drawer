window.initialize = function (svgElement, dotNetHelper) {
    const svg = d3.select(svgElement)
        .attr("width", 800)
        .attr("height", 600)
        .style("border", "1px solid #ccc")
        .style("background-color", "#fff");

    let shapes = [];
    let selectedShape = null;
    let isDrawing = false;
    let isMoving = false;
    let isResizing = false;
    let resizeHandleIndex = -1;
    let startX, startY;
    let currentTool = "rect";
    let currentColor = "#0000ff";
    let currentElement = null;
    let isLocked = false;
    let selectionBox = null;

    const dotNet = dotNetHelper;

    document.addEventListener("click", (event) => {
        const contextMenu = document.getElementById("context-menu");

        if (contextMenu && !_isClickInsideContextMenu(event)) {
            dotNet.invokeMethodAsync('HideContextMenu');
        }

        const target = event.target;
        const isShape = d3.select(target).datum() && d3.select(target).datum().id;
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
     * Генерирует уникальный идентификатор для фигур.
     * @returns {string} - Уникальный идентификатор.
     */
    function generateUniqueId() {
        return 'shape-' + Math.random().toString(36).slice(2, 11);
    }

    /**
     * Конфигурационный объект для всех типов фигур.
     * Добавление нового типа фигуры требует добавления новой записи здесь.
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
                Type: 'rect',
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
            createElement: (svg, shape) => {
                return svg.append('rect')
                    .attr('x', shape.x)
                    .attr('y', shape.y)
                    .attr('width', shape.width)
                    .attr('height', shape.height)
                    .attr('fill', shape.fill)
                    .attr('stroke', shape.stroke)
                    .attr('stroke-width', shape.strokeWidth)
                    .attr('opacity', shape.opacity)
                    .attr('data-id', shape.id)
                    .datum(shape);
            },
            /**
             * Обновляет свойства SVG элемента прямоугольника.
             */
            updateElement: (element, shape) => {
                element
                    .attr('x', shape.x)
                    .attr('y', shape.y)
                    .attr('width', shape.width)
                    .attr('height', shape.height)
                    .attr('fill', shape.fill)
                    .attr('stroke', shape.stroke)
                    .attr('stroke-width', shape.strokeWidth)
                    .attr('opacity', shape.opacity);
            },
            /**
             * Возвращает позиции ручек изменения размера для прямоугольника.
             */
            getResizeHandles: (shape) => [
                { x: shape.x, y: shape.y },
                { x: shape.x + shape.width, y: shape.y },
                { x: shape.x, y: shape.y + shape.height },
                { x: shape.x + shape.width, y: shape.y + shape.height }
            ],
            /**
             * Обновляет свойства прямоугольника при изменении размеров.
             */
            resize: (shape, handleIndex, dx, dy) => {
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
                selectionBox
                    .attr("x", shape.x)
                    .attr("y", shape.y)
                    .attr("width", shape.width)
                    .attr("height", shape.height);
            },
            /**
             * Создаёт рамку выделения для прямоугольника.
             */
            createSelectionBox: (svg, shape) => {
                return svg.append("rect")
                    .attr("x", shape.x)
                    .attr("y", shape.y)
                    .attr("width", shape.width)
                    .attr("height", shape.height)
                    .attr("class", "selection-box")
                    .style("fill", "none")
                    .style("stroke", "blue")
                    .style("stroke-dasharray", "4");
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
                Type: 'circle',
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
            createElement: (svg, shape) => {
                return svg.append('circle')
                    .attr('cx', shape.cx)
                    .attr('cy', shape.cy)
                    .attr('r', shape.r)
                    .attr('fill', shape.fill)
                    .attr('stroke', shape.stroke)
                    .attr('stroke-width', shape.strokeWidth)
                    .attr('opacity', shape.opacity)
                    .attr('data-id', shape.id)
                    .datum(shape);
            },
            /**
             * Обновляет свойства SVG элемента круга.
             */
            updateElement: (element, shape) => {
                element
                    .attr('cx', shape.cx)
                    .attr('cy', shape.cy)
                    .attr('r', shape.r)
                    .attr('fill', shape.fill)
                    .attr('stroke', shape.stroke)
                    .attr('stroke-width', shape.strokeWidth)
                    .attr('opacity', shape.opacity);
            },
            /**
             * Возвращает позиции ручек изменения размера для круга.
             */
            getResizeHandles: (shape) => [
                { x: shape.cx + shape.r, y: shape.cy },
                { x: shape.cx - shape.r, y: shape.cy },
                { x: shape.cx, y: shape.cy + shape.r },
                { x: shape.cx, y: shape.cy - shape.r }
            ],
            /**
             * Обновляет свойства круга при изменении размеров.
             */
            resize: (shape, handleIndex, currentX, currentY) => {
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
                selectionBox
                    .attr("cx", shape.cx)
                    .attr("cy", shape.cy)
                    .attr("r", shape.r);
            },
            /**
             * Создаёт рамку выделения для круга.
             */
            createSelectionBox: (svg, shape) => {
                return svg.append("circle")
                    .attr("cx", shape.cx)
                    .attr("cy", shape.cy)
                    .attr("r", shape.r)
                    .attr("class", "selection-box")
                    .style("fill", "none")
                    .style("stroke", "blue")
                    .style("stroke-dasharray", "4");
            }
        }
    };

    /**
     * Создаёт ручки для изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function createResizeHandles(shape) {
        svg.selectAll(".resize-handle").remove();

        if (!shape) return;

        const config = shapeConfigs[shape.Type];
        if (!config) return;

        const handles = config.getResizeHandles(shape);

        if (config.tag === 'circle') {
            svg.selectAll(".resize-handle")
                .data(handles)
                .enter()
                .append("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", 6)
                .attr("class", "resize-handle")
                .attr("data-index", (d, i) => i)
                .style("fill", "white")
                .style("stroke", "black")
                .style("cursor", "nwse-resize")
                .on("mousedown", (event, d) => {
                    if (isLocked) return;
                    event.stopPropagation();
                    isResizing = true;
                    resizeHandleIndex = d3.select(event.currentTarget).attr("data-index");
                    const [x, y] = d3.pointer(event, svg.node());
                    startX = x;
                    startY = y;
                });
        } else {
            svg.selectAll(".resize-handle")
                .data(handles)
                .enter()
                .append("rect")
                .attr("x", d => d.x - 4)
                .attr("y", d => d.y - 4)
                .attr("width", 8)
                .attr("height", 8)
                .attr("class", "resize-handle")
                .attr("data-index", (d, i) => i)
                .style("fill", "white")
                .style("stroke", "black")
                .style("cursor", "nwse-resize")
                .on("mousedown", (event, d) => {
                    if (isLocked) return;
                    event.stopPropagation();
                    isResizing = true;
                    resizeHandleIndex = d3.select(event.currentTarget).attr("data-index");
                    const [x, y] = d3.pointer(event, svg.node());
                    startX = x;
                    startY = y;
                });
        }

        svg.selectAll(`${config.tag}`)
            .filter(d => d && d.id === shape.id)
            .classed("selected", true);

        selectedShape = shape;
    }

    /**
     * Обновляет позиции ручек изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function updateResizeHandles(shape) {
        if (!shape || !selectionBox) return;

        const config = shapeConfigs[shape.Type];
        if (!config) return;

        const handles = config.getResizeHandles(shape);

        if (config.tag === 'circle') {
            svg.selectAll(".resize-handle")
                .data(handles)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        } else {
            svg.selectAll(".resize-handle")
                .data(handles)
                .attr("x", d => d.x - 4)
                .attr("y", d => d.y - 4);
        }
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
        svg.selectAll(".resize-handle").remove();
        svg.selectAll(Object.keys(shapeConfigs).map(type => shapeConfigs[type].tag).join(', '))
            .classed("selected", false);

        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });

        dotNet.invokeMethodAsync('UpdateJson', JSON.stringify(dataOnlyShapes));
    }

    /**
     * Выбирает фигуру и отображает рамку выделения.
     * @param {Object} shape - Фигура для выбора.
     */
    function selectShape(shape) {
        if (isLocked) return;

        clearSelection();
        selectedShape = shape;

        const config = shapeConfigs[shape.Type];
        if (!config) return;

        selectionBox = config.createSelectionBox(svg, shape);

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
        const config = shapeConfigs[shape.Type];
        if (!config) {
            return;
        }

        svg.selectAll(config.tag)
            .filter(d => d && d.id === shape.id)
            .remove();

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
            const shapeId = currentElement.attr('data-id');
            const shape = shapes.find(s => s.id === shapeId);
            if (shape) {
                if (shapeConfigs[shape.Type].defaultProps.fill) {
                    shape.fill = color;
                }
                if (shapeConfigs[shape.Type].defaultProps.stroke) {
                    shape.stroke = color;
                }
                shapeConfigs[shape.Type].updateElement(shape.element, shape);
                updateJson();
            }
        }
    };

    /**
     * Устанавливает текущий инструмент для рисования.
     * @param {string} tool - Название инструмента (например, 'rect').
     */
    window.setTool = function (tool) {
        currentTool = tool;
    };

    /**
     * Возвращает текущие фигуры в формате JSON.
     * @returns {string} - JSON строка с фигурами.
     */
    window.getShapes = function () {
        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });
        return JSON.stringify(dataOnlyShapes);
    };

    /**
     * Устанавливает состояние блокировки для предотвращения взаимодействий.
     * @param {boolean} lockState - true для блокировки, false для разблокировки.
     */
    window.setLock = function (lockState) {
        isLocked = lockState;

        if (isLocked) {
            svg.style("cursor", "not-allowed");
            svg.style("pointer-events", "none");
        } else {
            svg.style("cursor", "default");
            svg.style("pointer-events", "all");
        }

        if (isLocked) {
            clearSelection();
        }
    };

    /**
     * Обновляет SVG на основе переданного JSON.
     * @param {string} json - JSON строка с фигурами.
     */
    window.updateShapesFromJson = function (json) {
        try {
            const shapesData = JSON.parse(json);
            if (!Array.isArray(shapesData)) {
                return;
            }

            shapes.forEach(shape => {
                const config = shapeConfigs[shape.Type];
                if (config) {
                    svg.selectAll(`[data-id='${shape.id}']`).remove();
                }
            });
            shapes = [];

            shapesData.forEach(shapeData => {
                const config = shapeConfigs[shapeData.Type];
                if (config) {
                    const newShape = config.createShape(
                        shapeData.id,
                        shapeData.x !== undefined ? shapeData.x : (shapeData.cx || 0),
                        shapeData.y !== undefined ? shapeData.y : (shapeData.cy || 0),
                        shapeData.fill || config.defaultProps.fill
                    );

                    Object.assign(newShape, shapeData);

                    newShape.element = config.createElement(svg, newShape);

                    shapes.push(newShape);
                }
            });

            clearSelection();
        } catch (error) { }
    };

    /**
     * Обновляет JSON представление фигур и отправляет его в Blazor.
     */
    window.updateJson = function () {
        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });
        const json = JSON.stringify(dataOnlyShapes);

        dotNet.invokeMethodAsync('UpdateJson', json);
    };

    svg.on("mousedown", (event) => {
        if (isLocked) return;
        if (isResizing) return;

        event.preventDefault();

        if (event.button !== 0) return;

        const [x, y] = d3.pointer(event, svg.node());

        const target = event.target;
        const datum = d3.select(target).datum();

        if (datum && datum.id) {
            const shape = shapes.find(s => s.id === datum.id);
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

        newShape.element = shapeConfigs[currentTool].createElement(svg, newShape);
        currentElement = newShape.element;
    });

    window.addEventListener("mousemove", (event) => {
        if (isLocked) return;

        const [currentX, currentY] = d3.pointer(event, svg.node());

        if (isDrawing && currentElement) {
            const shape = shapes[shapes.length - 1];
            const config = shapeConfigs[shape.Type];
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

            const config = shapeConfigs[selectedShape.Type];
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
            const [currentX, currentY] = d3.pointer(event, svg.node());

            const config = shapeConfigs[selectedShape.Type];
            if (!config) {
                return;
            }

            if (selectedShape.Type === 'circle') {
                config.resize(selectedShape, resizeHandleIndex, currentX, currentY);
            } else {
                const dx = currentX - startX;
                const dy = currentY - startY;
                config.resize(selectedShape, resizeHandleIndex, dx, dy);
            }

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

    window.addEventListener("mouseup", () => {
        if (isLocked) return;

        if (isDrawing) {
            isDrawing = false;

            const lastShape = shapes[shapes.length - 1];
            let shouldRemove = false;

            if (lastShape) {
                if (lastShape.Type === 'rect') {
                    if (lastShape.width === 0 || lastShape.height === 0) {
                        shouldRemove = true;
                    }
                } else if (lastShape.Type === 'circle') {
                    if (lastShape.r === 0) {
                        shouldRemove = true;
                    }
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

    svg.on("contextmenu", (event) => {
        if (isLocked) return;

        event.preventDefault();

        const containerRect = svgElement.parentElement.getBoundingClientRect();

        const x = event.clientX - containerRect.left;
        const y = event.clientY - containerRect.top;

        const target = event.target;
        const datum = d3.select(target).datum();

        if (datum && datum.id) {
            const shape = shapes.find(s => s.id === datum.id);
            if (shape) {
                selectShape(shape);
                dotNet.invokeMethodAsync('OnShapeRightClicked', x, y, shape.id);
            }
        } else {
            clearSelection();
        }
    });
};
