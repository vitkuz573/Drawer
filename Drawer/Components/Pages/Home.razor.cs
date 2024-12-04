using Drawer.Converters;
using Drawer.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using System.Text.Json;

namespace Drawer.Components.Pages;

public partial class Home : ComponentBase, IDisposable
{
    private string SelectedTool { get; set; } = "rect";

    private string SelectedColor { get; set; } = "#0000ff";

    private bool IsLocked { get; set; }

    private string JsonInput { get; set; } = "[]";

    private ElementReference _svgElement;
    private Shape? _selectedShape;
    private DotNetObjectReference<Home>? _dotNetRef;

    private double _contextMenuXpx;
    private double _contextMenuYpx;
    private bool _isContextMenuVisible;

    private List<Shape> Shapes { get; set; } = [];

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _dotNetRef = DotNetObjectReference.Create(this);

            await JsRuntime.InvokeVoidAsync("initialize", _svgElement, _dotNetRef);
            await JsRuntime.InvokeVoidAsync("updateJson");
        }
    }

    private async Task OnToolChanged(ChangeEventArgs e)
    {
        SelectedTool = e.Value?.ToString() ?? "rect";

        if (!string.IsNullOrEmpty(SelectedTool))
        {
            await JsRuntime.InvokeVoidAsync("setTool", SelectedTool);
        }
    }

    private async Task OnColorChanged(ChangeEventArgs e)
    {
        SelectedColor = e.Value?.ToString() ?? "#0000ff";

        if (!string.IsNullOrEmpty(SelectedColor))
        {
            await JsRuntime.InvokeVoidAsync("setColor", SelectedColor);
        }
    }

    private async Task OnLockChanged(ChangeEventArgs e)
    {
        IsLocked = (bool)(e.Value ?? false);

        await JsRuntime.InvokeVoidAsync("setLock", IsLocked);
    }

    private async Task OnJsonInputChanged(ChangeEventArgs e)
    {
        JsonInput = e.Value?.ToString() ?? "[]";

        try
        {
            var shapes = JsonSerializer.Deserialize<List<Shape>>(JsonInput, new JsonSerializerOptions
            {
                Converters = { new ShapeJsonConverter() },
                PropertyNameCaseInsensitive = true
            }) ?? new List<Shape>();

            // Обновляем внутреннее состояние Shapes
            Shapes = shapes;

            // Отправляем обновленный JSON в JavaScript для обновления SVG
            await JsRuntime.InvokeVoidAsync("updateShapesFromJson", JsonInput);
        }
        catch (JsonException ex)
        {
            // Обработка ошибок парсинга JSON
            Console.Error.WriteLine($"Invalid JSON: {ex.Message}");
            // Здесь можно добавить уведомление пользователя об ошибке
        }
    }

    [JSInvokable]
    public async Task UpdateJson(string json)
    {
        JsonInput = json;

        Shapes = JsonSerializer.Deserialize<List<Shape>>(json, new JsonSerializerOptions
        {
            Converters = { new ShapeJsonConverter() }
        }) ?? [];

        await InvokeAsync(StateHasChanged);
    }

    [JSInvokable]
    public void OnShapeRightClicked(double svgX, double svgY, string shapeId)
    {
        _selectedShape = Shapes.Find(s => s.Id == shapeId);

        ShowContextMenu(svgX, svgY);
    }

    private async Task DeleteShape()
    {
        if (_selectedShape != null)
        {
            await JsRuntime.InvokeVoidAsync("deleteShape", _selectedShape.Id);
            _selectedShape = null;
            HideContextMenu();
            await JsRuntime.InvokeVoidAsync("updateJson");
        }
    }

    private async Task GetShapeId()
    {
        if (_selectedShape != null)
        {
            await JsRuntime.InvokeVoidAsync("alert", $"ID: {_selectedShape.Id}");

            HideContextMenu();
        }
    }

    private void ShowContextMenu(double x, double y)
    {
        _contextMenuXpx = x;
        _contextMenuYpx = y;
        _isContextMenuVisible = true;

        InvokeAsync(StateHasChanged);
    }

    [JSInvokable]
    public void HideContextMenu()
    {
        _isContextMenuVisible = false;

        InvokeAsync(StateHasChanged);
    }

    public void Dispose()
    {
        _dotNetRef?.Dispose();
    }
}
