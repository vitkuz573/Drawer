// wwwroot/js/drawing.js

window.initialize = function (svgElement, dotNetHelper) {
    /**
     * Инициализирует SVG элемент и настраивает все необходимые обработчики событий.
     * @param {HTMLElement} svgElement - Ссылка на SVG элемент.
     * @param {DotNetObjectReference} dotNetHelper - Ссылка на объект .NET для взаимодействия.
     */
    const svg = d3.select(svgElement)
        .attr("width", 800)
        .attr("height", 600)
        .style("border", "1px solid #ccc")
        .style("background-color", "#fff");

    let shapes = []; // Массив для хранения фигур
    let selectedShapeId = null; // Id выбранной фигуры
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
        return 'shape-' + Math.random().toString(36).substr(2, 9);
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
                    startX = event.clientX;
                    startY = event.clientY;
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

        // Находим индекс фигуры в массиве
        const shapeIndex = shapes.findIndex(s => s.Id === shapeId);
        if (shapeIndex === -1) return;

        // Удаляем фигуру из SVG
        svg.selectAll("rect")
            .filter(d => d && d.Id === shapeId)
            .remove();

        // Удаляем фигуру из массива
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
        console.log("Отправка JSON в Blazor:", json);
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

        if (event.button !== 0) return; // Отвечаем только на левый клик

        const [x, y] = d3.pointer(event);

        const target = event.target;
        const datum = d3.select(target).datum();

        if (datum) {
            selectShape(datum);
            isMoving = true;
            startX = event.clientX;
            startY = event.clientY;
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

        if (isDrawing && currentElement) {
            const [x, y] = d3.pointer(event, svg.node());
            const currentX = x;
            const currentY = y;

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
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            const shape = shapes.find(s => s.Id === selectedShapeId);
            if (shape && shape.Type === "rect") {
                shape.X += dx;
                shape.Y += dy;

                svg.selectAll("rect")
                    .filter(d => d.Id === shape.Id)
                    .attr("x", shape.X)
                    .attr("y", shape.Y);

                if (selectionBox) {
                    selectionBox
                        .attr("x", shape.X)
                        .attr("y", shape.Y);
                }

                updateResizeHandles(shape);
            }

            startX = event.clientX;
            startY = event.clientY;

            updateJson();
        }

        if (isResizing && selectedShapeId) {
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

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

                // Предотвращение отрицательных размеров
                if (shape.Width < 0) {
                    shape.Width = 0;
                }
                if (shape.Height < 0) {
                    shape.Height = 0;
                }

                svg.selectAll("rect")
                    .filter(d => d.Id === shape.Id)
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

            startX = event.clientX;
            startY = event.clientY;

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

        const svgRect = svgElement.getBoundingClientRect();
        const containerRect = svgElement.parentElement.getBoundingClientRect();

        // Координаты относительно контейнера
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
