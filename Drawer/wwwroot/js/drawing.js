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
        .style("background-color", "#fff")
        .on("contextmenu", (event) => {
            event.preventDefault();
            hideContextMenu();
        });

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
    let contextMenuVisible = false;
    let isLocked = false;
    let selectionBox = null;

    const dotNet = dotNetHelper;

    /**
     * Создаёт и настраивает контекстное меню.
     */
    const contextMenu = d3.select("body")
        .append("div")
        .attr("id", "custom-context-menu")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid #ccc")
        .style("box-shadow", "0 2px 10px rgba(0,0,0,0.2)")
        .style("padding", "8px")
        .style("display", "none")
        .style("z-index", "1000")
        .style("min-width", "150px")
        .style("border-radius", "4px");

    /**
     * Добавляет элементы меню для удаления и выполнения пользовательских действий.
     */
    contextMenu.append("div")
        .attr("class", "menu-item")
        .style("padding", "8px 12px")
        .style("cursor", "pointer")
        .style("hover", "background-color: #f0f0f0;")
        .text("Delete Selected Shape")
        .on("click", () => {
            if (selectedShape && !isLocked) {
                deleteShape(selectedShape);
                hideContextMenu();
                dotNet.invokeMethodAsync('UpdateJson', JSON.stringify(shapes))
                    .catch(error => console.error(error));
            }
        });

    contextMenu.append("div")
        .attr("class", "menu-item")
        .style("padding", "8px 12px")
        .style("cursor", "pointer")
        .style("hover", "background-color: #f0f0f0;")
        .text("Custom Action")
        .on("click", () => {
            if (selectedShape && !isLocked) {
                dotNet.invokeMethodAsync('CustomAction')
                    .catch(error => console.error(error));
                hideContextMenu();
            }
        });

    /**
     * Отображает контекстное меню в заданных координатах.
     * @param {number} x - Координата X.
     * @param {number} y - Координата Y.
     */
    function showContextMenu(x, y) {
        if (isLocked) return;
        contextMenu.style("left", `${x}px`)
            .style("top", `${y}px`)
            .style("display", "block");
        contextMenuVisible = true;
    }

    /**
     * Скрывает контекстное меню.
     */
    function hideContextMenu() {
        contextMenu.style("display", "none");
        contextMenuVisible = false;
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
            .filter(d => d === shape)
            .classed("selected", true);

        selectedShape = shape;
        dotNet.invokeMethodAsync('OnShapeSelected', shape)
            .catch(error => console.error(error));
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
        selectedShape = null;
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
     * @param {Object} shape - Выбранная фигура.
     */
    function selectShape(shape) {
        if (isLocked) return;

        clearSelection();
        selectedShape = shape;

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
     * @param {Object} shape - Фигура для удаления.
     */
    function deleteShape(shape) {
        if (!shape) return;

        svg.selectAll("*")
            .filter(d => d === shape)
            .remove();

        shapes = shapes.filter(s => s !== shape);
        clearSelection();
        dotNet.invokeMethodAsync('UpdateJson', JSON.stringify(shapes))
            .catch(error => console.error(error));
    }

    /**
     * Устанавливает текущий цвет для рисования
     * @param {string} color - Код цвета
     */
    window.setColor = function (color) {
        currentColor = color;

        if (currentElement) {
            currentElement.attr("fill", currentColor).attr("stroke", currentColor);
        }
    };

    /**
     * Устанавливает текущий инструмент для рисования.
     * @param {string} tool - Название инструмента ('rect').
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
            hideContextMenu();
        }
    };

    /**
     * Обновляет JSON представление фигур и отправляет его в Blazor.
     */
    window.updateJson = function () {
        const json = JSON.stringify(shapes);
        console.log("Sending JSON to Blazor:", json);
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
                shape.Width = width;
                shape.Height = height;
            }

            updateJson();
        }

        if (isMoving && selectedShape) {
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            if (selectedShape.Type === "rect") {
                selectedShape.X += dx;
                selectedShape.Y += dy;

                svg.selectAll("rect")
                    .filter(d => d === selectedShape)
                    .attr("x", selectedShape.X)
                    .attr("y", selectedShape.Y);

                if (selectionBox) {
                    selectionBox
                        .attr("x", selectedShape.X)
                        .attr("y", selectedShape.Y);
                }

                updateResizeHandles(selectedShape);
            }

            startX = event.clientX;
            startY = event.clientY;

            updateJson();
        }

        if (isResizing && selectedShape) {
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            if (selectedShape.Type === "rect") {
                switch (resizeHandleIndex) {
                    case "0":
                        selectedShape.X += dx;
                        selectedShape.Y += dy;
                        selectedShape.Width -= dx;
                        selectedShape.Height -= dy;
                        break;
                    case "1":
                        selectedShape.Y += dy;
                        selectedShape.Width += dx;
                        selectedShape.Height -= dy;
                        break;
                    case "2":
                        selectedShape.X += dx;
                        selectedShape.Width -= dx;
                        selectedShape.Height += dy;
                        break;
                    case "3":
                        selectedShape.Width += dx;
                        selectedShape.Height += dy;
                        break;
                }

                if (selectedShape.Width < 0) {
                    selectedShape.Width = 0;
                }
                if (selectedShape.Height < 0) {
                    selectedShape.Height = 0;
                }

                svg.selectAll("rect")
                    .filter(d => d === selectedShape)
                    .attr("x", selectedShape.X)
                    .attr("y", selectedShape.Y)
                    .attr("width", selectedShape.Width)
                    .attr("height", selectedShape.Height);

                if (selectionBox) {
                    selectionBox
                        .attr("x", selectedShape.X)
                        .attr("y", selectedShape.Y)
                        .attr("width", selectedShape.Width)
                        .attr("height", selectedShape.Height);
                }

                updateResizeHandles(selectedShape);
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
        const [x, y] = d3.pointer(event, window);
        const target = event.target;
        const datum = d3.select(target).datum();

        if (datum && datum.Type === "rect") {
            selectShape(datum);
            showContextMenu(event.clientX, event.clientY);
        } else {
            clearSelection();
            hideContextMenu();
        }
    });
};
