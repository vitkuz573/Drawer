window.initialize = function (svgElement, dotNetHelper) {
    const svg = d3.select(svgElement)
        .attr("width", 800)
        .attr("height", 600)
        .style("border", "1px solid #ccc")
        .style("background-color", "#fff");

    let shapes = [];
    let selectedShapeId = null;
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

    /**
     * Генерирует уникальный идентификатор для фигур.
     * @returns {string} - Уникальный идентификатор.
     */
    function generateUniqueId() {
        return 'shape-' + Math.random().toString(36).slice(2, 11);
    }

    /**
     * Создаёт ручки для изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function createResizeHandles(shape) {
        svg.selectAll(".resize-handle").remove();

        if (!shape) return;

        if (shape.Type === "rect") {
            const corners = [
                { x: shape.X, y: shape.Y },
                { x: shape.X + shape.Width, y: shape.Y },
                { x: shape.X, y: shape.Y + shape.Height },
                { x: shape.X + shape.Width, y: shape.Y + shape.Height }
            ];

            svg.selectAll(".resize-handle")
                .data(corners)
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

        svg.selectAll("rect")
            .filter(d => d && d.Id === shape.Id)
            .classed("selected", true);

        selectedShapeId = shape.Id;
    }

    /**
     * Обновляет позиции ручек изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function updateResizeHandles(shape) {
        if (!shape || !selectionBox) return;

        if (shape.Type === "rect") {
            const corners = [
                { x: shape.X, y: shape.Y },
                { x: shape.X + shape.Width, y: shape.Y },
                { x: shape.X, y: shape.Y + shape.Height },
                { x: shape.X + shape.Width, y: shape.Y + shape.Height }
            ];

            svg.selectAll(".resize-handle")
                .data(corners)
                .attr("x", d => d.x - 4)
                .attr("y", d => d.y - 4);
        }
    }

    /**
     * Очищает текущий выбор и удаляет рамку выделения.
     */
    function clearSelection() {
        selectedShapeId = null;
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
        svg.selectAll(".resize-handle").remove();
        svg.selectAll(".selected").classed("selected", false);
        dotNet.invokeMethodAsync('UpdateJson', JSON.stringify(shapes))
            .catch(error => console.error(error));
    }

    /**
     * Выбирает фигуру и отображает рамку выделения.
     * @param {Object} shape - Фигура для выбора.
     */
    function selectShape(shape) {
        if (isLocked) return;

        clearSelection();
        selectedShapeId = shape.Id;

        if (shape.Type === "rect") {
            selectionBox = svg.append("rect")
                .attr("x", shape.X)
                .attr("y", shape.Y)
                .attr("width", shape.Width)
                .attr("height", shape.Height)
                .attr("class", "selection-box")
                .style("fill", "none")
                .style("stroke", "blue")
                .style("stroke-dasharray", "4");
        }

        createResizeHandles(shape);
    }

    /**
     * Удаляет фигуру из SVG и массива фигур.
     * @param {string} shapeId - Уникальный идентификатор фигуры для удаления.
     */
    window.deleteShape = function (shapeId) {
        if (!shapeId) return;

        const shapeIndex = shapes.findIndex(s => s.Id === shapeId);
        if (shapeIndex === -1) return;

        svg.selectAll("rect")
            .filter(d => d && d.Id === shapeId)
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
            currentElement.attr("fill", currentColor).attr("stroke", currentColor);
        }
    };

    /**
     * Устанавливает текущий инструмент для рисования.
     * @param {string} tool - Название инструмента (например, 'rect').
     */
    window.setTool = function (tool) {
        if (tool === "rect") {
            currentTool = tool;
        }
    };

    /**
     * Возвращает текущие фигуры в формате JSON.
     * @returns {string} - JSON строка с фигурами.
     */
    window.getShapes = function () {
        return JSON.stringify(shapes);
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
     * Обновляет JSON представление фигур и отправляет его в Blazor.
     */
    window.updateJson = function () {
        const json = JSON.stringify(shapes);
        dotNet.invokeMethodAsync('UpdateJson', json)
            .catch(error => console.error(error));
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

        if (datum) {
            selectShape(datum);
            isMoving = true;
            startX = x;
            startY = y;
            return;
        }

        isDrawing = true;
        startX = x;
        startY = y;

        let newShape = {};
        if (currentTool === "rect") {
            newShape = {
                Id: generateUniqueId(),
                Type: "rect",
                X: x,
                Y: y,
                Width: 0,
                Height: 0,
                Fill: currentColor,
                Stroke: currentColor,
                StrokeWidth: 2
            };
            currentElement = svg.append("rect")
                .attr("x", x)
                .attr("y", y)
                .attr("width", 0)
                .attr("height", 0)
                .attr("fill", currentColor)
                .attr("stroke", currentColor)
                .attr("stroke-width", 2)
                .attr("opacity", 0.8)
                .on("click", () => {
                    selectShape(newShape);
                });
        }

        shapes.push(newShape);
        currentElement.datum(newShape);
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
            if (currentTool === "rect") {
                const width = currentX - startX;
                const height = currentY - startY;

                currentElement
                    .attr("width", Math.abs(width))
                    .attr("height", Math.abs(height))
                    .attr("x", width < 0 ? currentX : startX)
                    .attr("y", height < 0 ? currentY : startY);

                const shape = currentElement.datum();
                shape.Width = Math.abs(width);
                shape.Height = Math.abs(height);
                shape.X = width < 0 ? currentX : startX;
                shape.Y = height < 0 ? currentY : startY;
            }

            updateJson();
        }

        if (isMoving && selectedShapeId) {
            const dx = currentX - startX;
            const dy = currentY - startY;

            const shape = shapes.find(s => s.Id === selectedShapeId);
            if (shape && shape.Type === "rect") {
                shape.X += dx;
                shape.Y += dy;

                svg.selectAll("rect")
                    .filter(d => d && d.Id === shape.Id)
                    .attr("x", shape.X)
                    .attr("y", shape.Y);

                if (selectionBox) {
                    selectionBox
                        .attr("x", shape.X)
                        .attr("y", shape.Y);
                }

                updateResizeHandles(shape);
            }

            startX = currentX;
            startY = currentY;

            updateJson();
        }

        if (isResizing && selectedShapeId) {
            const [currentX, currentY] = d3.pointer(event, svg.node());
            const dx = currentX - startX;
            const dy = currentY - startY;

            const shape = shapes.find(s => s.Id === selectedShapeId);
            if (shape && shape.Type === "rect") {
                switch (resizeHandleIndex) {
                    case "0":
                        shape.X += dx;
                        shape.Y += dy;
                        shape.Width -= dx;
                        shape.Height -= dy;
                        break;
                    case "1":
                        shape.Y += dy;
                        shape.Width += dx;
                        shape.Height -= dy;
                        break;
                    case "2":
                        shape.X += dx;
                        shape.Width -= dx;
                        shape.Height += dy;
                        break;
                    case "3":
                        shape.Width += dx;
                        shape.Height += dy;
                        break;
                }

                if (shape.Width < 10) {
                    shape.Width = 10;
                    if (resizeHandleIndex === "0" || resizeHandleIndex === "2") {
                        shape.X = shape.X + shape.Width - 10;
                    }
                }
                if (shape.Height < 10) {
                    shape.Height = 10;
                    if (resizeHandleIndex === "0" || resizeHandleIndex === "1") {
                        shape.Y = shape.Y + shape.Height - 10;
                    }
                }

                svg.selectAll("rect")
                    .filter(d => d && d.Id === shape.Id)
                    .attr("x", shape.X)
                    .attr("y", shape.Y)
                    .attr("width", shape.Width)
                    .attr("height", shape.Height);

                if (selectionBox) {
                    selectionBox
                        .attr("x", shape.X)
                        .attr("y", shape.Y)
                        .attr("width", shape.Width)
                        .attr("height", shape.Height);
                }

                updateResizeHandles(shape);
            }

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
            updateJson();
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

        if (datum && datum.Type === "rect") {
            selectShape(datum);
            dotNet.invokeMethodAsync('OnShapeRightClicked', x, y, datum.Id)
                .catch(error => console.error("Invoke error:", error));
        } else {
            clearSelection();
        }
    });
};
