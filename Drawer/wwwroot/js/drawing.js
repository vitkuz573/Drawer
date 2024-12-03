// wwwroot/js/drawing.js

window.initialize = function (svgElement, dotNetHelper) {
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
    let isLocked = false; // Переменная для блокировки
    let selectionBox = null; // Текущая рамка выделения

    // Ссылка на Blazor
    const dotNet = dotNetHelper;

    // Настройка контекстного меню
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

    // Добавление пунктов в контекстное меню
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
     * Показывает контекстное меню в указанных координатах.
     * @param {number} x - Координата X.
     * @param {number} y - Координата Y.
     */
    function showContextMenu(x, y) {
        if (isLocked) return; // Предотвращает показ контекстного меню при блокировке
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

    // Скрыть контекстное меню при клике вне его
    d3.select("body").on("click", () => {
        if (contextMenuVisible) {
            hideContextMenu();
        }
    });

    /**
     * Создает ручки для изменения размеров выбранной фигуры.
     * @param {Object} shape - Выбранная фигура.
     */
    function createResizeHandles(shape) {
        // Удаляем существующие ручки
        svg.selectAll(".resize-handle").remove();

        if (!shape) return;

        if (shape.Type === "rect") {
            // Ручки для прямоугольника (4 угла)
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
                    if (isLocked) return; // Предотвращает изменение размера при блокировке
                    event.stopPropagation();
                    isResizing = true;
                    resizeHandleIndex = d3.select(event.currentTarget).attr("data-index");
                    startX = event.clientX;
                    startY = event.clientY;
                });
        } else if (shape.Type === "circle") {
            // Ручка для круга (точка на окружности)
            const handle = svg.append("circle")
                .attr("cx", shape.Cx + shape.R)
                .attr("cy", shape.Cy)
                .attr("r", 4)
                .attr("class", "resize-handle")
                .style("fill", "white")
                .style("stroke", "black")
                .style("cursor", "ew-resize")
                .on("mousedown", (event) => {
                    if (isLocked) return; // Предотвращает изменение размера при блокировке
                    event.stopPropagation();
                    isResizing = true;
                    resizeHandleIndex = 0;
                    startX = event.clientX;
                    startY = event.clientY;
                });
        } else if (shape.Type === "line") {
            // Ручки для линии (два конца)
            const ends = [
                { x: shape.X1, y: shape.Y1 },
                { x: shape.X2, y: shape.Y2 }
            ];

            svg.selectAll(".resize-handle")
                .data(ends)
                .enter()
                .append("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", 4)
                .attr("class", "resize-handle")
                .attr("data-index", (d, i) => i)
                .style("fill", "white")
                .style("stroke", "black")
                .style("cursor", "ew-resize")
                .on("mousedown", (event, d) => {
                    if (isLocked) return; // Предотвращает изменение размера при блокировке
                    event.stopPropagation();
                    isResizing = true;
                    resizeHandleIndex = d3.select(event.currentTarget).attr("data-index");
                    startX = event.clientX;
                    startY = event.clientY;
                });
        }

        // Выделение выбранной фигуры
        if (shape.Type === "rect") {
            svg.selectAll("rect")
                .filter(d => d === shape)
                .classed("selected", true);
        } else if (shape.Type === "circle") {
            svg.selectAll("circle")
                .filter(d => d === shape)
                .classed("selected", true);
        } else if (shape.Type === "line") {
            svg.selectAll("line")
                .filter(d => d === shape)
                .classed("selected", true);
        }

        selectedShape = shape;
        dotNet.invokeMethodAsync('OnShapeSelected', shape) // Исправлено имя класса
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
        } else if (shape.Type === "circle") {
            const handlePos = { x: shape.Cx + shape.R, y: shape.Cy };

            svg.selectAll(".resize-handle")
                .attr("cx", handlePos.x)
                .attr("cy", handlePos.y);
        } else if (shape.Type === "line") {
            const ends = [
                { x: shape.X1, y: shape.Y1 },
                { x: shape.X2, y: shape.Y2 }
            ];

            svg.selectAll(".resize-handle")
                .data(ends)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        }
    }

    /**
     * Очищает выбор и удаляет рамку выделения.
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
        if (isLocked) return; // Предотвращает выбор при блокировке

        clearSelection();
        selectedShape = shape;

        // Создаем рамку выделения и сохраняем ссылку на нее
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
        } else if (shape.Type === "circle") {
            selectionBox = svg.append("circle")
                .attr("cx", shape.Cx)
                .attr("cy", shape.Cy)
                .attr("r", shape.R + 5)
                .attr("class", "selection-box")
                .style("fill", "none")
                .style("stroke", "blue")
                .style("stroke-dasharray", "4");
        } else if (shape.Type === "line") {
            selectionBox = svg.append("line")
                .attr("x1", shape.X1)
                .attr("y1", shape.Y1)
                .attr("x2", shape.X2)
                .attr("y2", shape.Y2)
                .attr("class", "selection-box")
                .style("stroke", "blue")
                .style("stroke-dasharray", "4");
        }

        // Создаем ручки изменения размеров
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
     * Устанавливает текущий инструмент для рисования.
     * @param {string} tool - Название инструмента ('rect', 'circle', 'line').
     */
    window.setTool = function (tool) {
        currentTool = tool;
    };

    /**
     * Возвращает текущие фигуры в формате JSON.
     * @returns {string} - JSON строка с фигурами.
     */
    window.getShapes = function () {
        return JSON.stringify(shapes);
    };

    /**
     * Устанавливает состояние блокировки.
     * @param {boolean} lockState - true для блокировки, false для разблокировки.
     */
    window.setLock = function (lockState) {
        isLocked = lockState;

        // Визуальная индикация блокировки
        if (isLocked) {
            svg.style("cursor", "not-allowed");
            svg.style("pointer-events", "none"); // Отключаем взаимодействие
        } else {
            svg.style("cursor", "default");
            svg.style("pointer-events", "all"); // Включаем взаимодействие
        }

        // Если заблокировано, очищаем выбор и скрываем контекстное меню
        if (isLocked) {
            clearSelection();
            hideContextMenu();
        }
    };

    /**
     * Обновляет JSON представление фигур.
     */
    window.updateJson = function () {
        const json = JSON.stringify(shapes);
        console.log("Sending JSON to Blazor:", json); // Отладка
        dotNet.invokeMethodAsync('UpdateJson', json)
            .catch(error => console.error(error));
    };

    /**
     * Обработчик события mousedown для SVG.
     */
    svg.on("mousedown", (event) => {
        if (isLocked) return; // Prevent interactions when locked
        if (isResizing) return; // Не начинаем рисовать, если происходит изменение размера

        event.preventDefault();

        // Левый клик только
        if (event.button !== 0) return;

        const [x, y] = d3.pointer(event);

        // Проверяем, был ли клик на существующей фигуре
        const target = event.target;
        const datum = d3.select(target).datum();

        if (datum) {
            // Выбираем фигуру
            selectShape(datum);
            isMoving = true;
            startX = event.clientX;
            startY = event.clientY;
            return;
        }

        // Начинаем рисовать новую фигуру
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
        } else if (currentTool === "circle") {
            newShape = {
                Type: "circle",
                Cx: x,
                Cy: y,
                R: 0,
                Fill: currentColor,
                Stroke: currentColor,
                StrokeWidth: 2
            };
            currentElement = svg.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 0)
                .attr("fill", currentColor)
                .attr("stroke", currentColor)
                .attr("stroke-width", 2)
                .attr("opacity", 0.8)
                .on("click", () => {
                    selectShape(newShape);
                });
        } else if (currentTool === "line") {
            newShape = {
                Type: "line",
                X1: x,
                Y1: y,
                X2: x,
                Y2: y,
                Fill: currentColor,
                Stroke: currentColor,
                StrokeWidth: 2
            };
            currentElement = svg.append("line")
                .attr("x1", x)
                .attr("y1", y)
                .attr("x2", x)
                .attr("y2", y)
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
     */
    window.addEventListener("mousemove", (event) => {
        if (isLocked) return; // Prevent interactions when locked

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
            } else if (currentTool === "circle") {
                const dx = currentX - startX;
                const dy = currentY - startY;
                const r = Math.sqrt(dx * dx + dy * dy);

                currentElement
                    .attr("r", r);

                const shape = currentElement.datum();
                shape.R = r;
            } else if (currentTool === "line") {
                currentElement
                    .attr("x2", currentX)
                    .attr("y2", currentY);

                const shape = currentElement.datum();
                shape.X2 = currentX;
                shape.Y2 = currentY;
            }

            // Обновляем JSON
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

                // Обновляем рамку выделения
                if (selectionBox) {
                    selectionBox
                        .attr("x", selectedShape.X)
                        .attr("y", selectedShape.Y);
                }

                // Обновляем ручки
                updateResizeHandles(selectedShape);
            } else if (selectedShape.Type === "circle") {
                selectedShape.Cx += dx;
                selectedShape.Cy += dy;

                svg.selectAll("circle")
                    .filter(d => d === selectedShape)
                    .attr("cx", selectedShape.Cx)
                    .attr("cy", selectedShape.Cy);

                // Обновляем рамку выделения
                if (selectionBox) {
                    selectionBox
                        .attr("cx", selectedShape.Cx)
                        .attr("cy", selectedShape.Cy);
                }

                // Обновляем ручки
                updateResizeHandles(selectedShape);
            } else if (selectedShape.Type === "line") {
                selectedShape.X1 += dx;
                selectedShape.Y1 += dy;
                selectedShape.X2 += dx;
                selectedShape.Y2 += dy;

                svg.selectAll("line")
                    .filter(d => d === selectedShape)
                    .attr("x1", selectedShape.X1)
                    .attr("y1", selectedShape.Y1)
                    .attr("x2", selectedShape.X2)
                    .attr("y2", selectedShape.Y2);

                // Обновляем рамку выделения
                if (selectionBox) {
                    selectionBox
                        .attr("x1", selectedShape.X1)
                        .attr("y1", selectedShape.Y1)
                        .attr("x2", selectedShape.X2)
                        .attr("y2", selectedShape.Y2);
                }

                // Обновляем ручки
                updateResizeHandles(selectedShape);
            }

            startX = event.clientX;
            startY = event.clientY;

            // Обновляем JSON
            updateJson();
        }

        if (isResizing && selectedShape) {
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            if (selectedShape.Type === "rect") {
                switch (resizeHandleIndex) {
                    case "0": // Верхний левый угол
                        selectedShape.X += dx;
                        selectedShape.Y += dy;
                        selectedShape.Width -= dx;
                        selectedShape.Height -= dy;
                        break;
                    case "1": // Верхний правый угол
                        selectedShape.Y += dy;
                        selectedShape.Width += dx;
                        selectedShape.Height -= dy;
                        break;
                    case "2": // Нижний левый угол
                        selectedShape.X += dx;
                        selectedShape.Width -= dx;
                        selectedShape.Height += dy;
                        break;
                    case "3": // Нижний правый угол
                        selectedShape.Width += dx;
                        selectedShape.Height += dy;
                        break;
                }

                // Ограничиваем размеры
                if (selectedShape.Width < 0) {
                    selectedShape.Width = 0;
                }
                if (selectedShape.Height < 0) {
                    selectedShape.Height = 0;
                }

                // Обновляем атрибуты фигуры
                svg.selectAll("rect")
                    .filter(d => d === selectedShape)
                    .attr("x", selectedShape.X)
                    .attr("y", selectedShape.Y)
                    .attr("width", selectedShape.Width)
                    .attr("height", selectedShape.Height);

                // Обновляем рамку выделения
                if (selectionBox) {
                    selectionBox
                        .attr("x", selectedShape.X)
                        .attr("y", selectedShape.Y)
                        .attr("width", selectedShape.Width)
                        .attr("height", selectedShape.Height);
                }

                // Обновляем ручки
                updateResizeHandles(selectedShape);
            } else if (selectedShape.Type === "circle") {
                selectedShape.R += dx;
                if (selectedShape.R < 0) selectedShape.R = 0;

                svg.selectAll("circle")
                    .filter(d => d === selectedShape)
                    .attr("r", selectedShape.R)
                    .attr("cx", selectedShape.Cx)
                    .attr("cy", selectedShape.Cy);

                // Обновляем рамку выделения
                if (selectionBox) {
                    selectionBox
                        .attr("r", selectedShape.R + 5)
                        .attr("cx", selectedShape.Cx)
                        .attr("cy", selectedShape.Cy);
                }

                // Обновляем ручки
                updateResizeHandles(selectedShape);
            } else if (selectedShape.Type === "line") {
                if (resizeHandleIndex === "0") {
                    selectedShape.X1 += dx;
                    selectedShape.Y1 += dy;
                } else if (resizeHandleIndex === "1") {
                    selectedShape.X2 += dx;
                    selectedShape.Y2 += dy;
                }

                svg.selectAll("line")
                    .filter(d => d === selectedShape)
                    .attr("x1", selectedShape.X1)
                    .attr("y1", selectedShape.Y1)
                    .attr("x2", selectedShape.X2)
                    .attr("y2", selectedShape.Y2);

                // Обновляем рамку выделения
                if (selectionBox) {
                    selectionBox
                        .attr("x1", selectedShape.X1)
                        .attr("y1", selectedShape.Y1)
                        .attr("x2", selectedShape.X2)
                        .attr("y2", selectedShape.Y2);
                }

                // Обновляем ручки
                updateResizeHandles(selectedShape);
            }

            startX = event.clientX;
            startY = event.clientY;

            // Обновляем JSON
            updateJson();
        }
    });

    /**
     * Обработчик события mouseup для окна.
     */
    window.addEventListener("mouseup", () => {
        if (isLocked) return; // Prevent interactions when locked
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
     */
    svg.on("contextmenu", (event) => {
        if (isLocked) return; // Prevent context menu when locked

        event.preventDefault();
        const [x, y] = d3.pointer(event, window);
        const target = event.target;
        const datum = d3.select(target).datum();

        if (datum) {
            selectShape(datum);
            showContextMenu(event.clientX, event.clientY);
        } else {
            clearSelection();
            hideContextMenu();
        }
    });
};
