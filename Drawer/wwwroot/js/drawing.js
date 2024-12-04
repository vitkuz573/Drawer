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

    // Глобальный обработчик кликов для скрытия контекстного меню при клике вне его
    document.addEventListener("click", (event) => {
        const contextMenu = document.getElementById("context-menu");
        if (contextMenu && !_isClickInsideContextMenu(event)) {
            dotNet.invokeMethodAsync('HideContextMenu')
                .catch(error => console.error("HideContextMenu error:", error));
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
                opacity: 0.8
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
                opacity: 0.8
            }),
            /**
             * Создаёт SVG элемент для прямоугольника.
             */
            createElement: (svg, shape) => {
                console.log("Creating shape:", shape);
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
                    case "0": // Верхний левый
                        shape.x += dx;
                        shape.y += dy;
                        shape.width -= dx;
                        shape.height -= dy;
                        break;
                    case "1": // Верхний правый
                        shape.y += dy;
                        shape.width += dx;
                        shape.height -= dy;
                        break;
                    case "2": // Нижний левый
                        shape.x += dx;
                        shape.width -= dx;
                        shape.height += dy;
                        break;
                    case "3": // Нижний правый
                        shape.width += dx;
                        shape.height += dy;
                        break;
                }

                // Предотвращаем отрицательные размеры
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
                opacity: 0.8
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
                opacity: 0.8
            }),
            /**
             * Создаёт SVG элемент для круга.
             */
            createElement: (svg, shape) => {
                console.log("Creating shape:", shape);
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
                // Вычисляем новое расстояние от центра до текущей позиции курсора
                const dx = currentX - shape.cx;
                const dy = currentY - shape.cy;
                const newR = Math.sqrt(dx * dx + dy * dy);

                // Устанавливаем новый радиус, обеспечивая минимальный размер
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
        // Добавьте другие типы фигур здесь
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
            // Создаём ручки в виде кругов
            svg.selectAll(".resize-handle")
                .data(handles)
                .enter()
                .append("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", 6) // Радиус ручки увеличен для удобства
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
            // Создаём ручки в виде прямоугольников для других фигур
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

        // Добавляем класс "selected" только к выбранной фигуре
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
            // Обновляем позиции ручек в виде кругов
            svg.selectAll(".resize-handle")
                .data(handles)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        } else {
            // Обновляем позиции ручек в виде прямоугольников
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

        // Создаём новый массив без свойства 'element'
        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });

        dotNet.invokeMethodAsync('UpdateJson', JSON.stringify(dataOnlyShapes))
            .catch(error => console.error(error));
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

        // Создаём рамку выделения на основе типа фигуры
        selectionBox = config.createSelectionBox(svg, shape);

        createResizeHandles(shape);
    }

    /**
     * Удаляет фигуру из SVG и массива фигур.
     * @param {string} shapeId - Уникальный идентификатор фигуры для удаления.
     */
    window.deleteShape = function (shapeId) {
        if (!shapeId) {
            console.error("deleteShape: shapeId is null or undefined.");
            return;
        }

        console.log(`deleteShape: Attempting to delete shape with ID = ${shapeId}`);

        const shapeIndex = shapes.findIndex(s => s.id === shapeId);
        if (shapeIndex === -1) {
            console.error(`deleteShape: Shape with ID = ${shapeId} not found.`);
            return;
        }

        const shape = shapes[shapeIndex];
        const config = shapeConfigs[shape.Type];
        if (!config) {
            console.error(`deleteShape: No config found for shape Type = ${shape.Type}`);
            return;
        }

        // Удаляем SVG элемент фигуры
        svg.selectAll(config.tag)
            .filter(d => d && d.id === shape.id)
            .each(function (d) {
                console.log(`deleteShape: Found SVG element for shape ID = ${d.id}`);
            })
            .remove();

        console.log(`deleteShape: Removing shape from shapes array at index ${shapeIndex}`);
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
                console.log(`setColor: Updated color for shape ID = ${shape.id}`);
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
        console.log(`setTool: Current tool set to ${tool}`);
    };

    /**
     * Возвращает текущие фигуры в формате JSON.
     * @returns {string} - JSON строка с фигурами.
     */
    window.getShapes = function () {
        // Создаём новый массив без свойства 'element'
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

        console.log(`setLock: Lock state set to ${isLocked}`);
    };

    /**
     * Обновляет JSON представление фигур и отправляет его в Blazor.
     */
    window.updateJson = function () {
        // Создаём новый массив, исключая свойство 'element'
        const dataOnlyShapes = shapes.map(shape => {
            const { element, ...data } = shape;
            return data;
        });
        const json = JSON.stringify(dataOnlyShapes);
        console.log(`updateJson: Sending JSON data = ${json}`);
        dotNet.invokeMethodAsync('UpdateJson', json)
            .catch(error => console.error("updateJson Invoke error:", error));
    };

    /**
     * Обработчик события mousedown для SVG.
     * Начинает процесс рисования новой фигуры или перемещения существующей.
     * @param {Event} event - Событие мыши.
     */
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
                console.log(`mousedown: Selected shape ID = ${shape.id} for moving.`);

                // Скрываем контекстное меню при начале перемещения
                dotNet.invokeMethodAsync('HideContextMenu')
                    .catch(error => console.error("HideContextMenu error:", error));
            }
            return;
        }

        // Начало рисования новой фигуры
        isDrawing = true;
        startX = x;
        startY = y;

        const id = generateUniqueId();
        const newShape = shapeConfigs[currentTool].createShape(id, x, y, currentColor);
        shapes.push(newShape);
        console.log(`mousedown: Created new shape with ID = ${id}`);

        newShape.element = shapeConfigs[currentTool].createElement(svg, newShape);
        currentElement = newShape.element;
    });

    /**
     * Обработчик события mousemove для окна.
     * Управляет процессами рисования и перемещения фигур.
     * @param {Event} event - Событие мыши.
     */
    window.addEventListener("mousemove", (event) => {
        if (isLocked) return;

        const [currentX, currentY] = d3.pointer(event, svg.node());

        if (isDrawing && currentElement) {
            const shape = shapes[shapes.length - 1];
            const config = shapeConfigs[shape.Type];
            if (!config) {
                console.error(`mousemove: No config found for shape Type = ${shape.Type}`);
                return;
            }

            // Обновление свойств фигуры при рисовании
            config.updateShapeOnDraw(shape, currentX, currentY, startX, startY);
            console.log(`mousemove: Drawing shape ID = ${shape.id}, width = ${shape.width}, height = ${shape.height}`);

            // Обновляем SVG элемент фигуры
            config.updateElement(shape.element, shape);
            updateJson();
        }

        if (isMoving && selectedShape) {
            const dx = currentX - startX;
            const dy = currentY - startY;

            const config = shapeConfigs[selectedShape.Type];
            if (!config) {
                console.error(`mousemove: No config found for shape Type = ${selectedShape.Type}`);
                return;
            }

            // Обновление позиций фигуры при перемещении
            config.updateShapeOnMove(selectedShape, dx, dy);
            console.log(`mousemove: Moving shape ID = ${selectedShape.id}, dx = ${dx}, dy = ${dy}`);

            // Обновляем SVG элемент фигуры
            config.updateElement(selectedShape.element, selectedShape);

            // Обновляем рамку выделения
            if (selectionBox) {
                config.updateSelectionBox(selectionBox, selectedShape);
            }

            // Обновляем ручки изменения размера
            updateResizeHandles(selectedShape);

            startX = currentX;
            startY = currentY;

            updateJson();
        }

        if (isResizing && selectedShape) {
            const [currentX, currentY] = d3.pointer(event, svg.node());

            const config = shapeConfigs[selectedShape.Type];
            if (!config) {
                console.error(`mousemove: No config found for shape Type = ${selectedShape.Type}`);
                return;
            }

            if (selectedShape.Type === 'circle') {
                // Для круга устанавливаем радиус на основе текущей позиции курсора
                config.resize(selectedShape, resizeHandleIndex, currentX, currentY);
                console.log(`mousemove: Resizing shape ID = ${selectedShape.id}, new radius = ${selectedShape.r}`);
            } else {
                // Для других фигур используем существующую логику
                const dx = currentX - startX;
                const dy = currentY - startY;
                config.resize(selectedShape, resizeHandleIndex, dx, dy);
                console.log(`mousemove: Resizing shape ID = ${selectedShape.id}, dx = ${dx}, dy = ${dy}`);
            }

            // Обновляем SVG элемент фигуры
            config.updateElement(selectedShape.element, selectedShape);

            // Обновляем рамку выделения
            if (selectionBox) {
                config.updateSelectionBox(selectionBox, selectedShape);
            }

            // Обновляем ручки изменения размера
            updateResizeHandles(selectedShape);

            startX = currentX;
            startY = currentY;

            updateJson();
        }
    });

    /**
     * Обработчик события mouseup для окна.
     * Завершает процессы рисования, перемещения или изменения размеров.
     */
    window.addEventListener("mouseup", () => {
        if (isLocked) return;

        if (isDrawing) {
            isDrawing = false;
            console.log("mouseup: Finished drawing.");

            // Получаем последнюю фигуру из массива
            const lastShape = shapes[shapes.length - 1];
            let shouldRemove = false;

            if (lastShape) {
                if (lastShape.Type === 'rect') {
                    // Проверяем, имеет ли прямоугольник ненулевую ширину и высоту
                    if (lastShape.width === 0 || lastShape.height === 0) {
                        shouldRemove = true;
                    }
                } else if (lastShape.Type === 'circle') {
                    // Проверяем, имеет ли круг ненулевой радиус
                    if (lastShape.r === 0) {
                        shouldRemove = true;
                    }
                }
                // Добавьте дополнительные проверки для других типов фигур, если необходимо
            }

            if (shouldRemove) {
                console.log(`mouseup: Removing zero-size shape ID = ${lastShape.id}`);

                // Удаляем фигуру из массива
                shapes.pop();

                // Удаляем SVG-элемент фигуры из DOM
                if (lastShape.element) {
                    lastShape.element.remove();
                }

                // Обновляем JSON после удаления фигуры
                updateJson();
            } else {
                // Если фигура имеет ненулевые размеры, просто обновляем JSON
                updateJson();
            }
        }

        if (isMoving) {
            isMoving = false;
            console.log("mouseup: Finished moving.");
            updateJson();
        }

        if (isResizing) {
            isResizing = false;
            console.log("mouseup: Finished resizing.");
            updateJson();
        }
    });

    /**
     * Обработчик правого клика на фигуре для отображения контекстного меню.
     * @param {Event} event - Событие мыши.
     */
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
                console.log(`Right-clicked on shape: ID = ${shape.id}, Type = ${shape.Type}`);
                dotNet.invokeMethodAsync('OnShapeRightClicked', x, y, shape.id)
                    .then(() => console.log("OnShapeRightClicked invoked successfully."))
                    .catch(error => console.error("Invoke error:", error));
            }
        } else {
            clearSelection();
        }
    });
};
